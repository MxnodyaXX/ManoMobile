-- ============================================================================
-- Mano Mobile — correcting a job after it has been booked in
--
-- Intake is done at a counter with a customer waiting, and things get typed
-- wrong: a transposed digit in a phone number, the wrong model picked from a
-- long list, an IMEI off by one. Until now nothing could fix any of it. The job
-- details modal was read-only, so a mistyped number meant the customer could
-- never be called, and the only recourse was editing the database by hand.
--
-- This is the permission to correct it. It sits behind the admin-cashier tick
-- as well: rewriting what a device was booked in as is not something every
-- person on shift should be able to do quietly, because the intake record is
-- what the customer signed and what a dispute is settled against.
--
-- Defaults TRUE, like the other permissions that restrict rather than grant.
-- The admin-cashier tick is already the gate; this exists so an Admin can take
-- it away from a specific person without taking away Admin Control with it.
-- ============================================================================

alter table public.staff_work_rules
  add column if not exists can_edit_jobs boolean not null default true;

comment on column public.staff_work_rules.can_edit_jobs is
  'Correct a booked-in job''s details. Needs the admin-cashier tick as well; off hides the edit mode entirely.';

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
                when 'edit_jobs'        then r.can_edit_jobs
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
