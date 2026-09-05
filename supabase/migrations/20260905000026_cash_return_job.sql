-- ============================================================================
-- Mano Mobile — the Cash Return job
--
-- Cash Return is a financial outcome OF a repair job, not a module beside one.
-- Everything downstream — the cashier's list, Sales Management, billing, the
-- accounts, the dealer's statement — reads the same two fields on the job that
-- the technician set. There is no second refund record to keep in step, and no
-- screen has to be told separately that a refund is due.
--
-- ── What the technician decides, and what they do not ───────────────────────
-- The technician decides that money should go back and how much. They do not
-- decide that it HAS gone back — they are not holding the till. So a job marked
-- Cash Return owes a refund; the refund itself is recorded when a cashier
-- actually counts the notes out, through refund_repair_advance as before.
--
-- Marking the job and paying the money are the same two separate events this
-- ledger has kept apart from the start.
--
-- ── Other Charges is removed ────────────────────────────────────────────────
-- It was added in 20260905000024 to let a shop keep part of an advance back.
-- Cash Return replaces it: the technician states the figure that should go
-- back, so a deduction is expressed by naming a smaller amount rather than by
-- a second field that has to be reasoned about and reconciled. One number the
-- shop decided beats two numbers it has to subtract.
-- ============================================================================

-- ── What the technician sets ────────────────────────────────────────────────

alter table public.repair_jobs
  add column if not exists cash_return_amount numeric(12,2)
    check (cash_return_amount is null or cash_return_amount >= 0);

comment on column public.repair_jobs.cash_return_amount is
  'What the shop owes back on a Cash Return job, set by the technician at completion. Owed, not yet paid — the payment is a cash_returns row.';

-- ── Where the job came from ─────────────────────────────────────────────────
--
-- A re-job is the same device back for the same fault. Recording which job it
-- repeats is what lets the technician see, while deciding, that this handset
-- was already repaired for Rs. 5,000 — which is usually the number that should
-- go back. Nullable and never required: plenty of Cash Returns have no earlier
-- job behind them, and gating the feature on a link would rule those out.
alter table public.repair_jobs
  add column if not exists rejob_of text references public.repair_jobs (id) on delete set null;

comment on column public.repair_jobs.rejob_of is
  'The earlier repair this job repeats, when it is a re-job. Null for ordinary intake; never required, since a Cash Return can happen with no earlier job.';

create index if not exists repair_jobs_rejob_of_idx
  on public.repair_jobs (rejob_of) where rejob_of is not null;

-- ── Other Charges, undone ───────────────────────────────────────────────────
--
-- Dropped rather than left unused: a column nothing writes but the refund
-- arithmetic still subtracts is a figure waiting to be wrong.
--
-- The view that reads them has to go first. Postgres refuses to drop a column
-- something depends on, and the tempting fix — DROP COLUMN ... CASCADE — would
-- take the view with it silently, leaving the rebuilt one below as the only
-- thing standing between the app and a missing relation. Dropping the view
-- explicitly says what is being removed.
drop view if exists public.v_job_refunds;

alter table public.repair_jobs drop column if exists refund_other_charges;
alter table public.repair_jobs drop column if exists refund_other_charges_reason;

-- ============================================================================
-- The refund position, per job
-- ============================================================================

-- Recreated rather than replaced: the column list changes shape, and
-- CREATE OR REPLACE VIEW can only append. Already dropped above, before the
-- columns it depended on.

/**
 * What a job owes back, and how much of it has gone.
 *
 * Two sources, deliberately not summed:
 *
 *   Cash Return — the technician stated the figure. That IS the amount, and it
 *   already accounts for whatever the customer paid; adding an advance on top
 *   would refund the same money twice.
 *
 *   Return / FOC — nobody stated a figure, so what is owed back is whatever
 *   part of the advance is not covering a charge.
 */
create or replace view public.v_job_refunds with (security_invoker = true) as
select
  j.id                                          as job_id,
  j.customer_name,
  j.phone,
  j.completion_type,
  j.dealer_id,
  j.rejob_of,
  coalesce(j.advance_paid, 0)                   as advance_paid,
  coalesce(j.estimated_cost, 0)                 as subtotal,
  coalesce(j.cash_return_amount, 0)             as cash_return_amount,
  case
    when j.completion_type = 'Cash Return'
      then round(coalesce(j.cash_return_amount, 0), 2)
    when j.completion_type in ('Return', 'FOC')
      then round(greatest(0, coalesce(j.advance_paid, 0) - coalesce(j.estimated_cost, 0)), 2)
    else 0
  end                                           as refundable,
  coalesce(r.paid_out, 0)                       as refunded,
  greatest(0,
    case
      when j.completion_type = 'Cash Return'
        then round(coalesce(j.cash_return_amount, 0), 2)
      when j.completion_type in ('Return', 'FOC')
        then round(greatest(0, coalesce(j.advance_paid, 0) - coalesce(j.estimated_cost, 0)), 2)
      else 0
    end - coalesce(r.paid_out, 0)
  )                                             as remaining,
  j.advance_refunded_on                         as settled_on,
  coalesce(r.payment_count, 0)                  as payment_count
from public.repair_jobs j
left join (
  select job_id, sum(amount) as paid_out, count(*) as payment_count
    from public.cash_returns
   where kind = 'Advance Refund' and job_id is not null
   group by job_id
) r on r.job_id = j.id;

comment on view public.v_job_refunds is
  'What each repair job owes back and how much has gone. Cash Return jobs use the amount the technician set; Return/FOC jobs use the unspent part of the advance.';

-- ============================================================================
-- Recording the payment
-- ============================================================================

-- The six-argument form carried Other Charges. Replaced, not overloaded, so no
-- caller can keep passing a deduction that no longer exists.
drop function if exists public.refund_repair_advance(text, numeric, text, text, numeric, text);

/**
 * Pay back some or all of what a job owes.
 *
 * Partial by design: Rs. 6,000 today and Rs. 4,000 on Friday is two calls, and
 * the cumulative total is capped at what the job actually owes.
 *
 * Works the same whether the money is owed because the technician marked a Cash
 * Return or because a returned job is sitting on an advance — v_job_refunds
 * decides which, so this function does not need to know the difference and no
 * caller has to choose a code path.
 *
 * A dealer's job adjusts the dealer's account by the same act. The Refund entry
 * carries the job id and a note naming it, so the statement says which repair
 * moved the balance rather than leaving a bare reduction.
 */
create or replace function public.refund_repair_advance(
  p_job_id text,
  p_amount numeric,
  p_reason text,
  p_method text default 'Cash'
)
returns public.cash_returns
language plpgsql
security definer
set search_path = public
as $$
declare
  j          public.repair_jobs;
  pos        public.v_job_refunds;
  acct       uuid;
  entry      bigint;
  out_row    public.cash_returns;
  note_txt   text;
begin
  if not (public.has_role('Admin'::staff_role) or public.is_admin_cashier()) then
    raise exception 'Only an Admin or an admin cashier can pay a refund';
  end if;

  select * into j from public.repair_jobs where id = p_job_id;
  if not found then
    raise exception 'Repair job % does not exist.', p_job_id;
  end if;

  if coalesce(p_amount, 0) <= 0 then
    raise exception 'A refund must be for more than zero.';
  end if;

  if btrim(coalesce(p_reason, '')) = '' then
    raise exception 'A refund needs a reason.';
  end if;

  select * into pos from public.v_job_refunds where job_id = p_job_id;

  if pos.refundable <= 0 then
    raise exception 'Nothing is owed back on % — it is not a Cash Return and its advance does not exceed what was charged.', p_job_id;
  end if;

  if round(pos.refunded + p_amount, 2) > pos.refundable then
    raise exception 'Only % is still owed on % (% owed, % already paid back).',
      round(pos.remaining, 2), p_job_id, pos.refundable, round(pos.refunded, 2);
  end if;

  -- ── The dealer's account, where there is one ─────────────────────────────
  -- A job billed to an account is no longer owed: the money is going back.
  select e.account_id into acct
    from public.credit_entries e
   where e.job_id = p_job_id and e.kind = 'Charge'
   limit 1;

  if acct is not null then
    note_txt := case when j.completion_type = 'Cash Return'
                     then 'Cash Return — ' || p_job_id
                     else 'Advance refunded — ' || p_job_id end
              || ' — ' || btrim(p_reason);

    insert into public.credit_entries (account_id, kind, amount, occurred_on, job_id, method, note, created_by)
    values (acct, 'Refund', round(p_amount, 2), current_date, p_job_id, p_method, note_txt, auth.uid())
    returning id into entry;
  else
    entry := null;
  end if;

  insert into public.cash_returns (
    ref, kind, amount, reason, method,
    job_id, dealer_id, credit_account_id, credit_entry_id, invoice_no,
    payee, payee_phone, recorded_by
  )
  values (
    public.next_cash_return_no(), 'Advance Refund', round(p_amount, 2), btrim(p_reason), p_method,
    p_job_id, j.dealer_id, acct, entry, j.invoice_no,
    coalesce(nullif(btrim(j.customer_name), ''), 'Walk-in customer'), nullif(btrim(j.phone), ''), auth.uid()
  )
  returning * into out_row;

  -- Settled only when nothing is left owing. A job half paid back is not a
  -- refunded job, and flagging it as one would stop anybody chasing the rest.
  update public.repair_jobs
     set advance_refunded_on = case
           when round(pos.refunded + p_amount, 2) >= pos.refundable then out_row.returned_on
           else null
         end
   where id = p_job_id;

  return out_row;
end $$;

comment on function public.refund_repair_advance is
  'Pay back some or all of what a repair job owes — a technician-set Cash Return amount, or the unspent part of an advance. Caps at what is owed, adjusts any dealer account, and flags the job only once nothing is left.';

grant select on public.v_job_refunds to authenticated;
grant execute on function public.refund_repair_advance(text, numeric, text, text) to authenticated;
