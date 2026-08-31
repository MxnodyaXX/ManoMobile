-- ============================================================================
-- Mano Mobile — what was discounted, and what was actually paid
--
-- The sales ledger stores `total`: the amount the invoice was raised for. That
-- is enough for Sales History and the Daily Summary, which are both about
-- turnover, and it is what 20260901000011 set out to record.
--
-- Invoice History asks two more questions, and they are the ones a shop chases:
-- how much came off the price, and how much of the bill has actually been
-- settled. Without the second, every invoice looks either fully paid or fully
-- unpaid, and a partly-settled repair — the ordinary case here, where an
-- advance is taken at intake and the balance at collection — cannot be told
-- apart from either.
--
-- ── Why paid is nullable and discount is not ────────────────────────────────
-- discount defaults to 0 because "no discount" is a real and correct answer for
-- every sale already recorded.
--
-- paid has no honest default. Zero would mark every existing invoice unpaid;
-- total would mark a credit sale settled. So it stays null, meaning "not
-- recorded", and the app falls back to the invoice's own status — a row marked
-- Paid is treated as paid in full. New sales fill it in properly.
-- ============================================================================

alter table public.sales
  add column if not exists subtotal numeric(12,2);
alter table public.sales
  add column if not exists discount numeric(12,2) not null default 0;
alter table public.sales
  add column if not exists paid     numeric(12,2);

comment on column public.sales.subtotal is
  'The bill before any discount. Null on rows written before this column existed; total + discount is the fallback.';
comment on column public.sales.discount is
  'Amount taken off the bill, in rupees. 0 means none, which is the honest default for every existing row.';
comment on column public.sales.paid is
  'How much of the invoice has been settled. Null means it was never recorded — fall back to the status, not to zero.';
