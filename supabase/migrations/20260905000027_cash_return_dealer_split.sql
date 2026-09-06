-- ============================================================================
-- Mano Mobile — a Cash Return is not the same money on both sides
--
-- 20260905000026 recorded every Cash Return the same way: a cash_returns row
-- saying the shop paid money out, plus a reversing entry on any account the
-- job had been charged to. That is right for one of the two cases and wrong
-- for the other, and the difference is real cash.
--
-- ── Mano Mobile's own job ───────────────────────────────────────────────────
-- The customer paid the shop and the shop hands the notes back. Money leaves
-- the till. That is a refund, and it belongs in cash_returns where the daily
-- takings deduct it.
--
-- ── An external dealer's job ────────────────────────────────────────────────
-- Nobody hands anybody cash. The dealer's devices are billed at the end of the
-- period, and a Cash Return is simply a negative line on that bill:
--
--     Devices 1-4      Rs. 12,500
--     Cash Return       (Rs. 5,000)   RM-041
--     ─────────────────────────────
--     Payable           Rs.  7,500
--
-- Written as a cash_returns row it would say the shop paid a dealer Rs. 5,000
-- it never paid, and the day's takings would be understated by that amount
-- while the dealer's bill was ALSO reduced by it — the same Rs. 5,000 counted
-- against the shop twice.
--
-- So: the dealer case writes only the ledger adjustment, linked to the job that
-- caused it. The balance is never quietly edited; the entry is what explains it.
-- ============================================================================

-- ── Which jobs settle in cash ───────────────────────────────────────────────
--
-- The in-house flag on the dealer record, never a name. A shop renames its own
-- dealer row, adds a second branch, or spells it differently in a year, and any
-- check against 'Mano Mobile' silently starts routing real refunds down the
-- wrong path. A job with no dealer at all is a walk-in, so it settles in cash.
create or replace function public.job_settles_in_cash(p_job_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1
      from public.repair_jobs j
      join public.repair_dealers d on d.id = j.dealer_id
     where j.id = p_job_id
       and coalesce(d.in_house, false) = false
  )
$$;

comment on function public.job_settles_in_cash is
  'True when a refund on this job means notes leaving the till (walk-in or in-house dealer). False for an external dealer, whose Cash Return is a deduction from their bill instead.';

-- ============================================================================
-- The refund position, counting whichever side actually settles
-- ============================================================================

drop view if exists public.v_job_refunds;

/**
 * What a job owes back, and how much of it has been settled.
 *
 * `refunded` deliberately reads from ONE side per job, not the sum of both:
 *
 *   Cash-settled job — cash_returns rows, the money out of the till.
 *   Dealer job       — the Refund entries on the dealer's account.
 *
 * Summed together, an in-house job that had also been charged to a customer
 * account would count its single refund twice and report itself settled at
 * half the amount.
 */
create or replace view public.v_job_refunds with (security_invoker = true) as
with settled as (
  select j.id as job_id,
         public.job_settles_in_cash(j.id) as in_cash
    from public.repair_jobs j
),
paid as (
  select s.job_id,
         case when s.in_cash
              then coalesce(c.paid_out, 0)
              else coalesce(e.adjusted, 0)
         end as paid_out,
         case when s.in_cash
              then coalesce(c.n, 0)
              else coalesce(e.n, 0)
         end as payment_count
    from settled s
    left join (
      select job_id, sum(amount) as paid_out, count(*) as n
        from public.cash_returns
       where kind = 'Advance Refund' and job_id is not null
       group by job_id
    ) c on c.job_id = s.job_id
    left join (
      select job_id, sum(amount) as adjusted, count(*) as n
        from public.credit_entries
       where kind = 'Refund' and job_id is not null
       group by job_id
    ) e on e.job_id = s.job_id
)
select
  j.id                                          as job_id,
  j.customer_name,
  j.phone,
  j.completion_type,
  j.dealer_id,
  j.rejob_of,
  s.in_cash                                     as settles_in_cash,
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
  coalesce(p.paid_out, 0)                       as refunded,
  greatest(0,
    case
      when j.completion_type = 'Cash Return'
        then round(coalesce(j.cash_return_amount, 0), 2)
      when j.completion_type in ('Return', 'FOC')
        then round(greatest(0, coalesce(j.advance_paid, 0) - coalesce(j.estimated_cost, 0)), 2)
      else 0
    end - coalesce(p.paid_out, 0)
  )                                             as remaining,
  j.advance_refunded_on                         as settled_on,
  coalesce(p.payment_count, 0)                  as payment_count
from public.repair_jobs j
join settled s on s.job_id = j.id
left join paid p on p.job_id = j.id;

comment on view public.v_job_refunds is
  'What each repair job owes back and how much is settled. settles_in_cash says which side counts: the till for a walk-in or in-house job, the dealer''s ledger for an external one.';

-- ============================================================================
-- Settling it
-- ============================================================================

/**
 * Settle some or all of what a job owes, down whichever path applies.
 *
 * The caller does not choose. Passing that decision to a screen would mean two
 * screens could disagree about whether a dealer had been handed cash, and the
 * one that got it wrong would be the one that wrote the row.
 *
 *   Cash-settled — a cash_returns row. Money out of the till, deducted from the
 *   day's takings. Any charge the job raised on an account is reversed too, so
 *   a job that was both billed on account and refunded in cash does not stay
 *   owing.
 *
 *   Dealer — a Refund entry on the dealer's account and nothing else. It reads
 *   on their statement as "Cash Return — RM-041", the negative line that
 *   explains why the bill came down. No cash_returns row, because no cash
 *   moved: writing one would understate the day's takings by an amount the
 *   shop never paid, while also reducing the dealer's bill by it.
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
  j        public.repair_jobs;
  pos      public.v_job_refunds;
  acct     uuid;
  entry    bigint;
  out_row  public.cash_returns;
  note_txt text;
begin
  if not (public.has_role('Admin'::staff_role) or public.is_admin_cashier()) then
    raise exception 'Only an Admin or an admin cashier can settle a refund';
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
    raise exception 'Only % is still owed on % (% owed, % already settled).',
      round(pos.remaining, 2), p_job_id, pos.refundable, round(pos.refunded, 2);
  end if;

  note_txt := case when j.completion_type = 'Cash Return'
                   then 'Cash Return — ' || p_job_id
                   else 'Advance refunded — ' || p_job_id end
            || ' — ' || btrim(p_reason);

  -- ── The dealer's ledger ──────────────────────────────────────────────────
  --
  -- On a dealer job this IS the transaction. On a cash-settled job it is a
  -- tidy-up: reversing a charge the job raised on somebody's account, so the
  -- money is not both refunded and still owed.
  if pos.settles_in_cash then
    select e.account_id into acct
      from public.credit_entries e
     where e.job_id = p_job_id and e.kind = 'Charge'
     limit 1;
  else
    -- The dealer's own account. Opened here if this is the first thing that
    -- ever landed on it, the same way an unpaid handover opens one.
    select a.id into acct
      from public.credit_accounts a
     where a.dealer_id = j.dealer_id;

    if acct is null then
      insert into public.credit_accounts (holder_kind, name, phone, address, dealer_id, auto_opened)
      select 'Dealer', d.name, d.contact, d.address, d.id, true
        from public.repair_dealers d
       where d.id = j.dealer_id
      returning id into acct;
    end if;

    if acct is null then
      raise exception 'Job % is billed to a dealer that no longer exists, so there is no account to adjust.', p_job_id;
    end if;
  end if;

  if acct is not null then
    insert into public.credit_entries (account_id, kind, amount, occurred_on, job_id, method, note, created_by)
    values (acct, 'Refund', round(p_amount, 2), current_date, p_job_id,
            case when pos.settles_in_cash then p_method else 'Bill adjustment' end,
            note_txt, auth.uid())
    returning id into entry;
  end if;

  -- ── The till ─────────────────────────────────────────────────────────────
  if pos.settles_in_cash then
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
  else
    -- Nothing left the till, so there is no cash_returns row to return. The
    -- caller still gets a record of what happened, built from the ledger entry
    -- rather than invented — the ref names the entry it actually wrote.
    out_row := null;
    out_row.id          := gen_random_uuid();
    out_row.ref         := 'ADJ-' || entry::text;
    out_row.kind        := 'Dealer Cash Return';
    out_row.returned_on := current_date;
    out_row.amount      := round(p_amount, 2);
    out_row.reason      := btrim(p_reason);
    out_row.method      := 'Bill adjustment';
    out_row.job_id      := p_job_id;
    out_row.dealer_id   := j.dealer_id;
    out_row.credit_account_id := acct;
    out_row.credit_entry_id   := entry;
    out_row.invoice_no  := j.invoice_no;
    out_row.payee       := (select d.name from public.repair_dealers d where d.id = j.dealer_id);
    out_row.recorded_by := auth.uid();
    out_row.created_at  := now();
    out_row.updated_at  := now();
  end if;

  -- Settled only when nothing is left owing. A job half settled is not a
  -- settled job, and flagging it as one would stop anybody chasing the rest.
  update public.repair_jobs
     set advance_refunded_on = case
           when round(pos.refunded + p_amount, 2) >= pos.refundable then current_date
           else null
         end
   where id = p_job_id;

  return out_row;
end $$;

comment on function public.refund_repair_advance is
  'Settle a job''s Cash Return. A walk-in or in-house job pays out of the till and lands in cash_returns; an external dealer''s job becomes a negative line on their account instead, with no cash movement.';

grant select on public.v_job_refunds to authenticated;
grant execute on function public.job_settles_in_cash(text) to authenticated;
grant execute on function public.refund_repair_advance(text, numeric, text, text) to authenticated;

-- ============================================================================
-- Raising the dealer's adjustment
-- ============================================================================
--
-- A dealer's Cash Return never goes through the refund screen — no cash moves,
-- so there is nothing for a cashier to count out. It reaches their ledger the
-- same way every other dealer charge does: when the job is handed over.
--
-- Without this the negative line would appear on the printed invoice and the
-- dealer's running balance would never hear about it, so the statement and the
-- invoice would disagree by exactly the returned amount.

/**
 * Put a dealer's Cash Return on their account when the job is handed over.
 *
 * Idempotent by the existence check, not by an index: re-saving a Delivered
 * job must not raise the deduction twice, and a partial settlement already
 * recorded from elsewhere should not be topped up behind the cashier's back.
 */
create or replace function public.post_cash_return_to_dealer(p_job_id text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  j     public.repair_jobs;
  acct  uuid;
  entry bigint;
begin
  select * into j from public.repair_jobs where id = p_job_id;
  if not found
     or j.completion_type is distinct from 'Cash Return'
     or coalesce(j.cash_return_amount, 0) <= 0
     or public.job_settles_in_cash(p_job_id) then
    return null;
  end if;

  -- Anything already on this job means somebody has handled it.
  if exists (select 1 from public.credit_entries
              where job_id = p_job_id and kind = 'Refund') then
    return null;
  end if;

  select a.id into acct from public.credit_accounts a where a.dealer_id = j.dealer_id;
  if acct is null then
    insert into public.credit_accounts (holder_kind, name, phone, address, dealer_id, auto_opened)
    select 'Dealer', d.name, d.contact, d.address, d.id, true
      from public.repair_dealers d
     where d.id = j.dealer_id
    returning id into acct;
  end if;
  if acct is null then
    return null;
  end if;

  insert into public.credit_entries (account_id, kind, amount, occurred_on, job_id, method, note, created_by)
  values (acct, 'Refund', round(j.cash_return_amount, 2), current_date, p_job_id, 'Bill adjustment',
          'Cash Return — ' || p_job_id || ' — deducted from the dealer''s bill', auth.uid())
  returning id into entry;

  update public.repair_jobs set advance_refunded_on = current_date where id = p_job_id;

  return entry;
end $$;

comment on function public.post_cash_return_to_dealer is
  'Deducts an external dealer''s Cash Return from their account at handover. No cash moves, so nothing is written to cash_returns.';

create or replace function public.tg_post_delivered_job_to_credit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'Delivered' and old.status is distinct from 'Delivered' then
    -- Never let a credit-posting problem block the handover itself. The phone
    -- is going back to its owner either way; a missing charge is a reconciling
    -- item, a failed handover is a customer standing at the counter.
    begin
      perform public.post_repair_balance_to_credit(new.id);
    exception when others then
      raise warning 'Could not post % to credit: %', new.id, sqlerrm;
    end;

    begin
      perform public.post_cash_return_to_dealer(new.id);
    exception when others then
      raise warning 'Could not post the Cash Return on % to the dealer: %', new.id, sqlerrm;
    end;
  end if;
  return new;
end $$;

drop trigger if exists trg_post_delivered_job_to_credit on public.repair_jobs;
create trigger trg_post_delivered_job_to_credit
  after update on public.repair_jobs
  for each row execute function public.tg_post_delivered_job_to_credit();

grant execute on function public.post_cash_return_to_dealer(text) to authenticated;
