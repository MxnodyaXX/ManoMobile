-- ============================================================================
-- Mano Mobile — which supplier a repair part came from
--
-- The same part from two suppliers is two stock lines ("M02 Display" HD+ and
-- CROWN): different quality, different cost, and when it runs out it is
-- reordered from a different place. The supplier is picked from the shop's
-- supplier list and stored as plain text, the same choice mobile_devices and
-- accessory_products already make, so a part keeps its label even if the
-- supplier is later renamed or removed.
-- ============================================================================

alter table public.repair_parts
  add column if not exists supplier text not null default '';

comment on column public.repair_parts.supplier is
  'Supplier this stock line is bought from (name from accessory_suppliers, stored as text). Blank = not recorded.';
