-- ============================================================================
-- Mano Mobile — put the credit statuses back
--
-- 20260904000023 recreated v_credit_accounts to add total_refunded, and while
-- rewriting the CASE it changed what the view calls things:
--
--   'Active'  became  'Current'
--   and a new 'Over limit' was introduced
--
-- Neither was asked for and neither exists anywhere else. The credit screen
-- keys its colours and icons off exactly three values — Active, Overdue,
-- Settled — so every account came back with a status the lookup had no entry
-- for, and the page died on `statusConfig[a.status].icon` before it could draw
-- a single row.
--
-- The lesson is narrow and worth stating: a view's output is an interface. The
-- column list survived that migration intact, which is what a review looks at,
-- while the values inside a column changed underneath it — and nothing in the
-- database complains about that, only the screen reading it.
--
-- "Over limit" was redundant as well as breaking. The credit screen already
-- works it out per account from credit_limit and balance, and shows it as a
-- badge beside the status rather than instead of it, which is right: an
-- account can be over its limit AND overdue, and a single status field cannot
-- say both.
-- ============================================================================

-- Same columns in the same order, so a plain replace is enough — only the
-- expression inside `status` differs.
create or replace view public.v_credit_accounts with (security_invoker = true) as
select
  a.id, a.holder_kind, a.name, a.phone, a.nic, a.email, a.address, a.dealer_id,
  a.credit_limit, a.terms_days, a.auto_opened, a.notes, a.opened_by,
  a.created_at, a.updated_at,
  coalesce(sum(e.amount) filter (where e.kind = 'Charge'),    0) as total_charged,
  coalesce(sum(e.amount) filter (where e.kind = 'Payment'),   0) as total_paid,
  coalesce(sum(e.amount) filter (where e.kind = 'Write-off'), 0) as total_written_off,
  coalesce(sum(e.amount) filter (where e.kind = 'Refund'),    0) as total_refunded,
  coalesce(sum(e.amount) filter (where e.kind = 'Charge'), 0)
    - coalesce(sum(e.amount) filter (where e.kind <> 'Charge'), 0) as balance,
  min(e.occurred_on) filter (where e.kind = 'Charge')  as first_charge_on,
  max(e.occurred_on) filter (where e.kind = 'Payment') as last_payment_on,
  count(*) filter (where e.kind = 'Charge')            as charge_count,
  -- Exactly as 20260901000010 defined it. Refunds already reduce the balance
  -- through the `<> 'Charge'` arm, so a settled-by-refund account reads as
  -- Settled without the CASE needing to know refunds exist.
  case
    when coalesce(sum(e.amount) filter (where e.kind = 'Charge'), 0)
       - coalesce(sum(e.amount) filter (where e.kind <> 'Charge'), 0) <= 0.005 then 'Settled'
    when min(e.occurred_on) filter (where e.kind = 'Charge')
         < current_date - a.terms_days then 'Overdue'
    else 'Active'
  end as status
from public.credit_accounts a
left join public.credit_entries e on e.account_id = a.id
group by a.id;

comment on view public.v_credit_accounts is
  'Credit accounts with balance, totals and Active/Overdue/Settled worked out from the entries. total_refunded separates money handed back from money received.';

grant select on public.v_credit_accounts to authenticated;
