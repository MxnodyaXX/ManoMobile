-- ============================================================================
-- Mano Mobile — every phone carries its own warranty
--
-- Phones were stocked, sold and replaced with no warranty recorded anywhere —
-- and a phone's warranty is the one a customer actually comes back about. It
-- also differs phone to phone: a brand-new handset with the company's one-year
-- cover, a used one with the shop's month, a refurbished one with three.
--
-- So it lives on the device itself:
--   warranty_days  how long it is covered, counted from the day it is sold.
--                  Null means "the shop's default for phones" (Warranty Center
--                  -> Policies); 0 means sold with no warranty.
--   warranty_note  whose cover it is and anything worth saying — "Samsung
--                  company warranty", "Shop warranty, battery excluded".
--
-- Set when the phone is added to inventory, editable afterwards — including on
-- phones already sold, so the stock already in the shop can be filled in.
-- The Warranty Center reads it against the sale date.
-- ============================================================================

alter table public.mobile_devices
  add column if not exists warranty_days integer check (warranty_days is null or warranty_days >= 0);
alter table public.mobile_devices
  add column if not exists warranty_note text not null default '';

comment on column public.mobile_devices.warranty_days is
  'Warranty in days from the sale date. Null = the shop default for phones (warranty_policies, kind device); 0 = no warranty.';
comment on column public.mobile_devices.warranty_note is
  'Whose warranty it is and any condition — e.g. "Samsung company warranty".';
