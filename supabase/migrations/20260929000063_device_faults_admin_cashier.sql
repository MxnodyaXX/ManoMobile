-- ============================================================================
-- Mano Mobile — the device fault checklist is counter work too
--
-- Admin Control -> Repairs -> Device Faults would not edit or delete. The
-- table's write policy (20260821000002) allowed the Admin role only, and was
-- never revisited when the Admin Cashier arrived: 20260831000009 handed Admin
-- Control to admin cashiers but assumed the fault list was client-side state
-- "with no table of its own to police" — it has had one since 20260821.
--
-- So an admin cashier could open the screen and press the buttons, and the
-- database quietly refused: a DELETE that RLS filters out affects no rows and
-- returns no error (the fault simply stayed), and an UPDATE came back with no
-- row (the edit failed).
--
-- ── The rule ────────────────────────────────────────────────────────────────
-- Exactly the dealer registry's (20260910000047): an Admin, or an Admin
-- Cashier who may write to Repairs and holds the catalogue permission. One
-- idea of "senior counter staff maintain reference data", not two.
--
-- Reading is unchanged — every intake reads the list.
-- ============================================================================

drop policy if exists device_faults_write on public.device_faults;
create policy device_faults_write on public.device_faults
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

comment on table public.device_faults is
  'Admin-managed checklist of common device faults, shown on New Repair -> Step 2. Maintained by an Admin or an Admin Cashier with catalogue rights; readable by all staff. sort_order controls display order (ties broken by id).';
