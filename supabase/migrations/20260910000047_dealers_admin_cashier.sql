-- ============================================================================
-- Mano Mobile — the dealer registry is counter work
--
-- Adding a repair dealer needed the Admin login. It was written that way when
-- Admin Control was one screen for one person, and it has not been true for a
-- while: an Admin Cashier already maintains the parts catalogue, corrects a
-- recorded payment, settles a refund and describes the parts rack.
--
-- A new dealer walks in with three phones. The person booking them in is the
-- person at the counter, and until now they had to stop, find whoever holds
-- the Admin password, and have them type a name and an address.
--
-- ── The rule this borrows ───────────────────────────────────────────────────
-- parts_catalog_write in 20260831000009, with Repairs in place of Inventory:
-- an Admin, or an Admin Cashier who may write to the module the data belongs
-- to and holds the catalogue permission. The same shape, so there is one idea
-- of "senior counter staff may maintain reference data" rather than two.
--
-- Reading is unchanged — every staff member could already see the list, and
-- has to, because intake starts by choosing from it.
-- ============================================================================

drop policy if exists dealers_admin_write on public.repair_dealers;
create policy dealers_admin_write on public.repair_dealers
  for all to authenticated
  using (
    public.has_role('Admin'::staff_role)
    or (public.is_admin_cashier()
        and public.module_can_write('Repairs')
        and public.may('manage_catalogue'))
  )
  with check (
    public.has_role('Admin'::staff_role)
    or (public.is_admin_cashier()
        and public.module_can_write('Repairs')
        and public.may('manage_catalogue'))
  );

comment on table public.repair_dealers is
  'The shops that send repairs in, plus the in-house entry for walk-ins. Maintained by an Admin or an Admin Cashier with catalogue rights; readable by all staff, because intake starts by choosing from this list.';
