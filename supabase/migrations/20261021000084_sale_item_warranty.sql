-- ============================================================================
-- Mano Mobile — a warranty chosen per sold item
--
-- An accessory's warranty used to be worked out after the fact: the Warranty
-- Center looked up warranty_policies for its kind/category and counted from
-- the sale date. That is the right default, but the counter sometimes gives a
-- different period — a charger from a better batch gets 3 months, a clearance
-- cable gets none — and the receipt the customer holds says so. The lookup
-- then disagreed with the paper.
--
-- So a line can now carry the period it was actually sold with. Null means
-- "nothing chosen at the counter" and the policy still applies, which keeps
-- every older line, and every screen that doesn't set one, exactly as before.
-- ============================================================================

alter table public.sale_items
  add column if not exists warranty_days integer check (warranty_days is null or warranty_days >= 0),
  add column if not exists warranty_label text;

comment on column public.sale_items.warranty_days is
  'Warranty period given on this line at the counter, in days from the sale date. 0 = sold without warranty. Null = none chosen; the Warranty Center falls back to warranty_policies.';
comment on column public.sale_items.warranty_label is
  'How the chosen warranty was printed on the receipt, e.g. "3 months warranty". Null when warranty_days is null.';
