-- ============================================================================
-- Mano Mobile — the refundable invoice
--
-- A returned job with an advance on it is not a bill, it is a bill in reverse,
-- and it goes through the same billing screen rather than a side door. What
-- changes is the direction and one new line:
--
--   Amount to be Refunded = Advance Paid − (Subtotal + Other Charges)
--
-- Other Charges is the money the shop legitimately keeps out of an advance it
-- is otherwise giving back — a diagnostic already done, a part already fitted
-- and left in, a courier both ways. It is deliberately NOT folded into the
-- subtotal: the subtotal is what the repair was charged at, which on a return
-- is zero, and burying a Rs. 1,500 deduction inside a "Rs. 1,500 repair" would
-- describe work that was never billed.
--
-- ── What this migration changes about refunds ───────────────────────────────
--
-- 1. Refunds become partial. 20260904000023 allowed exactly one Advance Refund
--    per job, which is right when the whole advance goes back in one go and
--    wrong the moment a shop hands over Rs. 6,000 today and Rs. 4,000 on
--    Friday. The unique index goes; a cumulative cap replaces it, so the sum of
--    what has gone out can never exceed what is refundable.
--
-- 2. Other charges are recorded on the job, not on each payment. They are part
--    of working out the refundable amount, decided once when the refundable
--    invoice is raised. Stamped on every partial payment instead, two payments
--    would deduct them twice.
--
-- 3. advance_refunded_on now means SETTLED, not "something went back". A job
--    half refunded is not a refunded job, and a jobs list that says it is
--    would stop anybody chasing the rest.
-- ============================================================================

-- ── Partial refunds ─────────────────────────────────────────────────────────
--
-- The cap moves from "one row" to "the total cannot exceed the refundable
-- amount", enforced inside the function below where the sum can be taken.
drop index if exists public.cash_returns_one_advance_per_job;

-- ── What the shop is keeping back ───────────────────────────────────────────
alter table public.repair_jobs
  add column if not exists refund_other_charges numeric(12,2) not null default 0
    check (refund_other_charges >= 0);

alter table public.repair_jobs
  add column if not exists refund_other_charges_reason text;

comment on column public.repair_jobs.refund_other_charges is
  'Deducted from the advance before refunding it — a cost the shop legitimately keeps. Not part of the subtotal: no repair was billed.';

comment on column public.repair_jobs.refund_other_charges_reason is
  'Why the deduction was made. Required whenever refund_other_charges > 0 — a deduction from somebody else''s money with no stated reason is the thing this exists to prevent.';

comment on column public.repair_jobs.advance_refunded_on is
  'Set when the refund is SETTLED IN FULL. Null while any of the refundable amount is still owed, including after a partial refund.';

-- ── The one place the refund arithmetic lives ───────────────────────────────
--
-- A view rather than a repeated calculation, so the billing screen, the jobs
-- list and any report all read the same numbers. Every screen doing its own
-- subtraction is how "amount to be refunded" ends up meaning two things.
create or replace view public.v_job_refunds with (security_invoker = true) as
select
  j.id                                        as job_id,
  j.customer_name,
  j.phone,
  j.completion_type,
  coalesce(j.advance_paid, 0)                 as advance_paid,
  -- On a return this is zero, which is the point: nothing was charged for.
  coalesce(j.estimated_cost, 0)               as subtotal,
  coalesce(j.refund_other_charges, 0)         as other_charges,
  j.refund_other_charges_reason               as other_charges_reason,
  greatest(
    0,
    coalesce(j.advance_paid, 0)
      - coalesce(j.estimated_cost, 0)
      - coalesce(j.refund_other_charges, 0)
  )                                           as refundable,
  coalesce(r.paid_out, 0)                     as refunded,
  greatest(
    0,
    greatest(
      0,
      coalesce(j.advance_paid, 0)
        - coalesce(j.estimated_cost, 0)
        - coalesce(j.refund_other_charges, 0)
    ) - coalesce(r.paid_out, 0)
  )                                           as remaining,
  j.advance_refunded_on                       as settled_on,
  coalesce(r.payment_count, 0)                as payment_count
from public.repair_jobs j
left join (
  select job_id, sum(amount) as paid_out, count(*) as payment_count
    from public.cash_returns
   where kind = 'Advance Refund' and job_id is not null
   group by job_id
) r on r.job_id = j.id;

comment on view public.v_job_refunds is
  'Refund position per repair job: refundable = advance − subtotal − other charges, less what has already gone out. remaining is what is still owed to the customer.';

-- ── Recording a refund, in whole or in part ─────────────────────────────────

-- The four-argument form is replaced, not overloaded. Left in place it would
-- still be callable and would still refuse a second partial payment, so the
-- bug would survive in whichever caller had not been updated.
drop function if exists public.refund_repair_advance(text, numeric, text, text);

/**
 * Hand back some or all of a refundable advance.
 *
 * One call does the ledger row, the other-charges decision, the reversal of any
 * credit charge the job raised, and the settled flag. Split across the client
 * these are four writes that can each half-succeed, and the state in between is
 * a shop that has paid out money it has no record of.
 *
 * `p_other_charges` is the invoice-level decision and is written to the job
 * once. On a follow-up partial payment pass null to leave it as it stands;
 * passing a different figure after money has already gone out is refused,
 * because it would move the refundable total under a payment already made.
 *
 * The advance itself is never touched. Rs. 10,000 was received; that stays true
 * after Rs. 8,500 goes back, and the two together are the trail.
 */
create or replace function public.refund_repair_advance(
  p_job_id               text,
  p_amount               numeric,
  p_reason               text,
  p_method               text default 'Cash',
  p_other_charges        numeric default null,
  p_other_charges_reason text default null
)
returns public.cash_returns
language plpgsql
security definer
set search_path = public
as $$
declare
  j          public.repair_jobs;
  charges    numeric(12,2);
  reason_txt text;
  already    numeric(12,2);
  refundable numeric(12,2);
  acct       uuid;
  entry      bigint;
  out_row    public.cash_returns;
begin
  if not (public.has_role('Admin'::staff_role) or public.is_admin_cashier()) then
    raise exception 'Only an Admin or an admin cashier can refund an advance';
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

  select coalesce(sum(amount), 0) into already
    from public.cash_returns
   where job_id = p_job_id and kind = 'Advance Refund';

  -- ── Other charges ────────────────────────────────────────────────────────
  charges    := coalesce(p_other_charges, j.refund_other_charges, 0);
  reason_txt := coalesce(nullif(btrim(coalesce(p_other_charges_reason, '')), ''),
                         j.refund_other_charges_reason);

  if charges < 0 then
    raise exception 'Other charges cannot be negative.';
  end if;

  -- Deducting from money that belongs to somebody else, with no stated reason,
  -- is exactly what this refuses.
  if charges > 0 and coalesce(btrim(reason_txt), '') = '' then
    raise exception 'Other charges of % need a reason.', round(charges, 2);
  end if;

  -- Changing the deduction after money has gone out would move the refundable
  -- total under a payment already made, so the earlier payment could retro-
  -- actively become an overpayment nobody authorised.
  if already > 0 and round(charges, 2) <> round(coalesce(j.refund_other_charges, 0), 2) then
    raise exception 'Other charges cannot be changed once % has already been refunded on %.',
      round(already, 2), p_job_id;
  end if;

  refundable := round(greatest(0,
      coalesce(j.advance_paid, 0) - coalesce(j.estimated_cost, 0) - charges), 2);

  if refundable <= 0 then
    raise exception 'Nothing is refundable on % — the advance of % does not exceed the charges of %.',
      p_job_id, round(coalesce(j.advance_paid, 0), 2),
      round(coalesce(j.estimated_cost, 0) + charges, 2);
  end if;

  -- The cumulative cap that replaces the old one-refund-per-job index.
  if round(already + p_amount, 2) > refundable then
    raise exception 'Only % is still refundable on % (% refundable, % already returned).',
      round(refundable - already, 2), p_job_id, refundable, round(already, 2);
  end if;

  -- ── The credit side ──────────────────────────────────────────────────────
  -- If this job had been billed to a credit account, that charge is no longer
  -- owed: the work is not being done and the money is going back.
  select e.account_id into acct
    from public.credit_entries e
   where e.job_id = p_job_id and e.kind = 'Charge'
   limit 1;

  if acct is not null then
    insert into public.credit_entries (account_id, kind, amount, occurred_on, job_id, method, note, created_by)
    values (acct, 'Refund', round(p_amount, 2), current_date, p_job_id, p_method,
            'Advance refunded on ' || p_job_id || ' — ' || btrim(p_reason), auth.uid())
    returning id into entry;
  else
    entry := null;
  end if;

  -- ── The money out ────────────────────────────────────────────────────────
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

  -- ── The job ──────────────────────────────────────────────────────────────
  update public.repair_jobs
     set refund_other_charges        = charges,
         refund_other_charges_reason = case when charges > 0 then btrim(reason_txt) else null end,
         -- Settled only when the whole refundable amount has gone. A job half
         -- refunded is not a refunded job, and flagging it as one would stop
         -- anybody chasing the rest.
         advance_refunded_on = case
           when round(already + p_amount, 2) >= refundable then out_row.returned_on
           else null
         end
   where id = p_job_id;

  return out_row;
end $$;

comment on function public.refund_repair_advance is
  'Refund some or all of an advance. Caps the cumulative total at advance − subtotal − other charges, requires a reason for any deduction, and flags the job only once nothing is left owing.';

grant select on public.v_job_refunds to authenticated;
grant execute on function public.refund_repair_advance(text, numeric, text, text, numeric, text) to authenticated;
