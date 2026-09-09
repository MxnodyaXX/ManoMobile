-- ============================================================================
-- Mano Mobile — who gets to say what the rack looks like
--
-- 20260908000040 put the rack layout in app_settings, which only an Admin may
-- write. That is right for the work rules sharing that row — whether a
-- technician may hold two jobs at once is a decision about how the shop is
-- run — and wrong for this one. The rack is the parts catalogue's furniture,
-- and the people who file parts into it are the senior counter staff, not
-- whoever holds the Admin login.
--
-- ── Why a function and not a looser policy ──────────────────────────────────
-- RLS is per row, and app_settings is one row. Widening its write policy to
-- let an admin cashier describe the rack would also let them change the work
-- rules, which is a different decision with different consequences and was
-- never asked for.
--
-- So the column gets its own door: one function that writes parts_rack and
-- nothing else, under exactly the permission the parts catalogue already
-- runs on — see parts_catalog_write in 20260831000009. Anyone who may add a
-- spare part may describe the rack it goes in; the same people, the same rule,
-- one place to change it.
-- ============================================================================

create or replace function public.set_parts_rack(p_layout jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- The catalogue's own rule, quoted rather than re-invented.
  if not (
    public.has_role('Admin'::staff_role)
    or (public.is_admin_cashier()
        and public.module_can_write('Inventory')
        and public.may('manage_catalogue'))
  ) then
    raise exception using
      errcode = '42501',
      message = 'You are not allowed to change the rack layout.',
      hint    = 'Needs an Admin, or an Admin Cashier with Inventory write access and the catalogue permission.';
  end if;

  -- A definer function bypasses RLS, so it checks its own input rather than
  -- trusting the caller. Shape only: which bays are hidden is the shop's
  -- business, but a rack with no rows is nobody's.
  if p_layout is null
     or jsonb_typeof(p_layout) <> 'object'
     or jsonb_typeof(p_layout -> 'rows') <> 'number'
     or jsonb_typeof(p_layout -> 'cols') <> 'number'
     or (p_layout ->> 'rows')::numeric not between 1 and 26
     or (p_layout ->> 'cols')::numeric not between 1 and 16
     or coalesce(jsonb_typeof(p_layout -> 'hidden'), 'array') <> 'array'
  then
    raise exception 'That is not a usable rack layout.';
  end if;

  insert into public.app_settings (id, parts_rack, updated_by)
  values (true, p_layout, auth.uid())
  on conflict (id) do update
    set parts_rack = excluded.parts_rack,
        updated_by = excluded.updated_by;
end $$;

comment on function public.set_parts_rack(jsonb) is
  'Writes app_settings.parts_rack and nothing else, for anyone who may maintain the parts catalogue. Exists so an Admin Cashier can describe the rack without also gaining write access to the work rules in the same row.';

revoke all on function public.set_parts_rack(jsonb) from public;
grant execute on function public.set_parts_rack(jsonb) to authenticated;
