-- ============================================================================
-- Mano Mobile — the agent registry is counter work too
--
-- The companion to 20260910000047. That migration opened the dealer registry
-- to an Admin Cashier and this one opens the other half of the same drawer:
-- the external workshops a device gets sent out to for chip-level work or FRP.
--
-- Both lists are reference data for the Repairs module, both are read by every
-- staff member because the job cannot be booked in or transferred out without
-- choosing from them, and both were written Admin-only on the same afternoon
-- for the same reason — Admin Control was one screen for one person. Fixing
-- one and not the other would have moved the wall rather than removed it: the
-- cashier who can now add RIZVI's shop as a dealer still could not add RIZVI
-- as an agent.
--
-- ── The rule this borrows ───────────────────────────────────────────────────
-- The same one, so there is one idea of "senior counter staff may maintain
-- reference data" across the whole module rather than a different answer per
-- table: an Admin, or an Admin Cashier who may write to Repairs and holds the
-- catalogue permission.
--
-- Reading is unchanged. Technicians already select an agent when transferring
-- a device out, and that is a read.
-- ============================================================================

drop policy if exists agents_admin_write on public.repair_agents;
create policy agents_admin_write on public.repair_agents
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

comment on table public.repair_agents is
  'The outside workshops a device can be sent to. Maintained by an Admin or an Admin Cashier with catalogue rights; readable by all staff, because a technician picks one from this list when transferring a job out.';
