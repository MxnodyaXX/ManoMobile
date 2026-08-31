-- ============================================================================
-- Mano Mobile — the admin cashier
--
-- Admin Control is the shop's settings screen: categories, brands, suppliers,
-- dealers, repair agents, the spare-parts catalogue, part requests, the device
-- fault checklist, barcode design and the counter PIN. It has been reachable by
-- anyone signed into the cashier app. On a counter with three people on shift
-- that means three people who can rewrite the parts catalogue between customers.
--
-- This adds a senior cashier — an "admin cashier" — and makes Admin Control
-- theirs. A plain cashier keeps every counter permission they already had;
-- they simply no longer see the settings screen.
--
-- ── Why this one defaults to FALSE ──────────────────────────────────────────
-- Migration 20260831000008 says a missing row means ALLOWED, and that rule is
-- right for the things it governs: those are restrictions, and a restriction
-- that appears out of nowhere locks a counter out mid-repair.
--
-- This column is the opposite kind of flag. It is an ELEVATION — it hands
-- somebody the settings screen — and an elevation that switches itself on for
-- everyone is not a safe default, it is the absence of the feature. It matches
-- can_discount, the other column here that grants rather than restricts.
--
-- The cost of that choice is real and worth stating: after this runs, no
-- cashier has Admin Control until an Admin ticks somebody. Nothing at the
-- counter stops working — jobs, sales, the register and the till are all
-- untouched — but whoever used to manage dealers and parts needs the tick
-- before they can again.
-- ============================================================================

alter table public.staff_work_rules
  add column if not exists is_admin_cashier boolean not null default false;

comment on column public.staff_work_rules.is_admin_cashier is
  'A senior cashier who may open Admin Control. Defaults false: this grants access rather than removing it. Admins always have it regardless of this column.';

-- ── The check ───────────────────────────────────────────────────────────────

create or replace function public.is_admin_cashier()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    -- The Admin role owns this screen outright; the column is about cashiers.
    when public.has_role('Admin'::staff_role) then true
    else coalesce(
      (select r.is_admin_cashier
         from public.staff_work_rules r
        where r.profile_id = auth.uid()),
      false)   -- no row: a plain cashier
  end
$$;

comment on function public.is_admin_cashier is
  'May the signed-in person open Admin Control? Admin always; every other role needs the tick.';

-- Same answer through may(), so the app can ask one question for every
-- counter permission instead of two.
create or replace function public.may(perm text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    -- An Admin is never limited by a cashier permission.
    when public.has_role('Admin'::staff_role) then true
    else coalesce(
      (select case perm
                when 'cancel_jobs'      then r.can_cancel_jobs
                when 'discount'         then r.can_discount
                when 'approve_parts'    then r.can_approve_parts
                when 'manage_catalogue' then r.can_manage_catalogue
                when 'view_revenue'     then r.can_view_revenue
                when 'admin_cashier'    then r.is_admin_cashier
              end
         from public.staff_work_rules r
        where r.profile_id = auth.uid()),
      -- No row yet: nothing has been restricted for this person, but nothing
      -- has been granted either. The two flags that grant stay off.
      case perm when 'discount' then false
                when 'admin_cashier' then false
                else true end)
  end
$$;

comment on function public.may is
  'Whether the signed-in staff member holds a named permission. Admin always true; a missing rules row means the defaults above.';

-- ── Enforcement ─────────────────────────────────────────────────────────────
--
-- The parts catalogue is the one thing behind Admin Control that a cashier can
-- also reach straight through PostgREST, so hiding the screen is not enough for
-- it. A cashier now needs both: the settings screen (is_admin_cashier) and the
-- permission for that section within it (manage_catalogue).
--
-- The rest of Admin Control — categories, brands, suppliers, dealers, agents,
-- faults, barcode design, the PIN — is client-side state with no table of its
-- own to police, and part requests are already gated by may('approve_parts')
-- inside resolve_part_request(). Those stay as they are.
drop policy if exists parts_catalog_write on public.repair_parts;
create policy parts_catalog_write on public.repair_parts
  for all to authenticated
  using (
    public.has_role('Admin'::staff_role)
    or (public.is_admin_cashier() and public.module_can_write('Inventory') and public.may('manage_catalogue'))
  )
  with check (
    public.has_role('Admin'::staff_role)
    or (public.is_admin_cashier() and public.module_can_write('Inventory') and public.may('manage_catalogue'))
  );
