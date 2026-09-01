-- ============================================================================
-- Mano Mobile — what an invoice cost the shop
--
-- Two numbers matter for margin and neither was reachable per invoice.
--
--   discount  — already on sales (20260901000013), but nothing ever wrote to
--               it: the repair table's Discount column was hard-coded to 0, so
--               every repair invoice recorded "no discount given" whatever
--               actually happened at the counter.
--
--   bad debt  — money billed and then given up on. It exists in credit_entries
--               as a Write-off, but a write-off is against an ACCOUNT. So the
--               shop could see "Phone House cost us Rs. 4,000" and never which
--               invoices went bad, which is the question that tells you whether
--               a job type, a dealer or a price point is the problem.
--
-- This adds the per-invoice figure and keeps it in step with the write-offs it
-- comes from, so "revenue billed vs. revenue kept" is one query rather than a
-- reconciliation.
-- ============================================================================

alter table public.sales
  add column if not exists bad_debt numeric(12,2) not null default 0;

comment on column public.sales.bad_debt is
  'How much of this invoice was written off as uncollectable. Maintained from credit_entries write-offs that name it; never edited directly.';

create index if not exists sales_bad_debt_idx on public.sales (sold_on)
  where bad_debt > 0;

/**
 * Keep sales.bad_debt in step with the write-offs behind it.
 *
 * Derived, not entered. A figure a person can type is a figure that drifts from
 * the ledger it is supposed to summarise, and then nobody can say which is
 * right — the same reason credit balances are summed from entries rather than
 * stored.
 *
 * A write-off with no invoice number still reduces the account balance; it just
 * cannot be attributed to a bill. That is honest: writing off a whole account
 * is a real thing to do, and inventing an invoice to hang it on would be worse
 * than leaving the per-invoice figure at zero.
 */
create or replace function public.tg_writeoff_to_sale()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and new.kind = 'Write-off' and new.invoice_no is not null then
    update public.sales
       set bad_debt = bad_debt + new.amount
     where invoice_no = new.invoice_no;

  elsif tg_op = 'DELETE' and old.kind = 'Write-off' and old.invoice_no is not null then
    -- Only an Admin can delete a ledger entry, and if one does the summary has
    -- to follow it back down. greatest() guards against a negative total if the
    -- same entry were somehow reversed twice.
    update public.sales
       set bad_debt = greatest(0, bad_debt - old.amount)
     where invoice_no = old.invoice_no;
  end if;

  return null;
end $$;

drop trigger if exists trg_writeoff_to_sale on public.credit_entries;
create trigger trg_writeoff_to_sale
  after insert or delete on public.credit_entries
  for each row execute function public.tg_writeoff_to_sale();

comment on function public.tg_writeoff_to_sale is
  'Rolls credit write-offs up onto the invoice they name, so bad debt is readable per sale.';
