-- ============================================================================
-- Mano Mobile — an invoice settled on credit shows as paid
--
-- sales.paid was written once, at the counter: Rs. 2,500 of a Rs. 5,000 bill,
-- the rest on the customer's credit account. When the customer later paid off
-- that Rs. 2,500 the account went to Settled — but nothing touched the
-- invoice, so Sales History went on calling INV-000357 "Part paid" forever.
--
-- Now sales.paid follows the credit ledger. Whenever an entry on an account
-- changes, that account's invoices are worked out again, the way a statement
-- reads:
--   * payments and refunds that name an invoice settle that invoice;
--   * payments and refunds that name none settle the oldest invoices first;
--   * an invoice's paid = what was paid at the counter (its total less what
--     was charged to the account) + what has since been settled on it.
-- Write-offs close a balance without paying it, so they reduce what is owed
-- but never count as paid — the invoice's bad_debt already reports them.
--
-- Every account is worked out once below, so invoices already settled are
-- corrected straight away.
-- ============================================================================

create or replace function public.sync_invoice_paid_for_account(p_account uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  inv    record;
  pool   numeric;
  open   numeric;
  take   numeric;
  settled numeric;
begin
  if p_account is null then return; end if;

  -- Money received against the account without naming an invoice.
  select coalesce(sum(amount), 0) into pool
    from public.credit_entries
   where account_id = p_account and invoice_no is null and kind in ('Payment', 'Refund');

  for inv in
    select e.invoice_no,
           sum(e.amount) filter (where e.kind = 'Charge')                  as charged,
           coalesce(sum(e.amount) filter (where e.kind in ('Payment', 'Refund')), 0) as paid_tagged,
           coalesce(sum(e.amount) filter (where e.kind = 'Write-off'), 0)  as written_off,
           min(e.occurred_on) filter (where e.kind = 'Charge')             as first_on
      from public.credit_entries e
     where e.account_id = p_account and e.invoice_no is not null
     group by e.invoice_no
    having coalesce(sum(e.amount) filter (where e.kind = 'Charge'), 0) > 0
     order by min(e.occurred_on) filter (where e.kind = 'Charge'), e.invoice_no
  loop
    open := inv.charged - inv.paid_tagged - inv.written_off;
    settled := inv.paid_tagged;
    if open < 0 then
      -- Paid more than this invoice owed: the extra settles older ones' share
      -- of the pool for the rest of the loop.
      pool := pool - open;
      settled := settled + open;
      open := 0;
    end if;
    take := least(open, greatest(pool, 0));
    pool := pool - take;
    settled := settled + take;

    update public.sales s
       set paid = least(s.total, greatest(0, round((s.total - inv.charged) + settled, 2)))
     where s.invoice_no = inv.invoice_no
       and s.status <> 'Voided'
       and s.paid is distinct from least(s.total, greatest(0, round((s.total - inv.charged) + settled, 2)));
  end loop;
end $$;

comment on function public.sync_invoice_paid_for_account(uuid) is
  'Recomputes sales.paid for every invoice charged to one credit account from its ledger: tagged payments settle their invoice, untagged ones the oldest first. Write-offs are never counted as paid.';

create or replace function public.tg_sync_invoice_paid()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    perform public.sync_invoice_paid_for_account(new.account_id);
  end if;
  if tg_op in ('DELETE', 'UPDATE') and (tg_op = 'DELETE' or old.account_id is distinct from new.account_id) then
    perform public.sync_invoice_paid_for_account(old.account_id);
  end if;
  return null;
end $$;

drop trigger if exists trg_sync_invoice_paid on public.credit_entries;
create trigger trg_sync_invoice_paid
  after insert or update or delete on public.credit_entries
  for each row execute function public.tg_sync_invoice_paid();

-- Catch up every account now.
do $$
declare a record;
begin
  for a in select distinct account_id from public.credit_entries where account_id is not null loop
    perform public.sync_invoice_paid_for_account(a.account_id);
  end loop;
end $$;
