-- ============================================================================
-- Mano Mobile — a Cash Return belongs to its invoice
--
-- On a dealer's statement a Cash Return currently stands alone:
--
--   Refund · Bill adjustment      Cash Return — RM-045      − Rs. 5,000
--   Repairs - INV-000019 · 4 jobs                           + Rs. 5,500
--
-- Two lines that look unrelated, and the reader has to know that RM-045 was on
-- INV-000019 to understand why the balance moved. It is the one entry type
-- where a bare negative invites a phone call.
--
-- The cause is narrow. stamp_invoice_on_credit_charges fills the invoice number
-- in on handover charges and was written when a charge was the only kind that
-- could belong to an invoice — `where kind = 'Charge'`. Refunds are stamped by
-- nothing, so they have no invoice to group under.
--
-- Widening it is the whole fix: a Cash Return job billed on INV-000019 gets the
-- same number its charges got, and the statement can show it inside that
-- invoice with the job, the device and the amount that caused the deduction.
--
-- Still only ever fills a blank. It never edits an amount and never overwrites
-- a number already set — amending a credit entry stays Admin-only, deliberately.
-- ============================================================================

create or replace function public.stamp_invoice_on_credit_charges(
  p_invoice_no text,
  p_job_ids    text[]
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  touched integer;
begin
  if not public.is_staff() then
    raise exception 'Not authorised';
  end if;
  if coalesce(btrim(p_invoice_no), '') = '' or p_job_ids is null then
    return 0;
  end if;

  update public.credit_entries
     set invoice_no = p_invoice_no
   -- Refunds included: a Cash Return on this invoice is part of what the
   -- invoice came to, and reads as an unexplained deduction without it.
   -- Payments and write-offs are deliberately left out — those are their own
   -- events, and a part payment against an invoice is exactly the thing
   -- somebody opens this history to look at on its own.
   where kind in ('Charge', 'Refund')
     and job_id = any (p_job_ids)
     and invoice_no is null;

  get diagnostics touched = row_count;
  return touched;
end $$;

comment on function public.stamp_invoice_on_credit_charges is
  'Fills the invoice number in on a handover charge or a Cash Return refund, so both appear under the invoice they belong to. Only ever sets a blank one; never edits an amount or an existing number.';

-- ── The other order of events ───────────────────────────────────────────────
--
-- The stamp runs when the sale is recorded. A Cash Return raised at handover
-- for a job whose invoice already exists can take the number straight away,
-- rather than waiting for a sale that has already happened.
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

  insert into public.credit_entries (account_id, kind, amount, occurred_on, job_id, invoice_no, method, note, created_by)
  values (acct, 'Refund', round(j.cash_return_amount, 2), current_date, p_job_id,
          j.invoice_no, 'Bill adjustment',
          'Cash Return — ' || p_job_id || ' — deducted from the dealer''s bill', auth.uid())
  returning id into entry;

  update public.repair_jobs set advance_refunded_on = current_date where id = p_job_id;

  return entry;
end $$;

-- ── Existing entries ────────────────────────────────────────────────────────
--
-- Refunds already raised have no invoice number and never will, since the
-- stamp only runs at the moment a sale is recorded. Filling them in from the
-- job they name puts the statements that already exist right, rather than
-- leaving a permanent stripe of unexplained deductions before this migration.
update public.credit_entries e
   set invoice_no = j.invoice_no
  from public.repair_jobs j
 where e.job_id = j.id
   and e.kind = 'Refund'
   and e.invoice_no is null
   and j.invoice_no is not null;
