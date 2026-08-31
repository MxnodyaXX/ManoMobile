-- ============================================================================
-- Mano Mobile — what a cashier may do
--
-- staff_work_rules already holds "what this person is allowed to do", but every
-- column in it so far describes a technician. A cashier has real authority in
-- this system — they cancel jobs, settle bills, approve parts off the shelf and
-- see the shop's takings — and none of it was gated by anything except being
-- signed in.
--
-- Five permissions, each tied to a code path that actually checks it. A toggle
-- with nothing behind it is worse than no toggle, because it tells an owner
-- something is controlled when it is not.
--
-- All default TRUE except discounting. A shop that has been running with every
-- cashier able to do everything should not find half its counter broken the
-- morning after this migration; discounting defaults off because giving money
-- away is the one worth granting deliberately.
-- ============================================================================

alter table public.staff_work_rules
  add column if not exists can_cancel_jobs      boolean not null default true;
alter table public.staff_work_rules
  add column if not exists can_discount         boolean not null default false;
alter table public.staff_work_rules
  add column if not exists can_approve_parts    boolean not null default true;
alter table public.staff_work_rules
  add column if not exists can_manage_catalogue boolean not null default true;
alter table public.staff_work_rules
  add column if not exists can_view_revenue     boolean not null default true;

comment on column public.staff_work_rules.can_cancel_jobs is
  'Cancel a repair job. Off: the Cancel action is hidden and refused.';
comment on column public.staff_work_rules.can_discount is
  'Settle a job for less than the agreed price. Defaults off — this is the one that costs the shop money.';
comment on column public.staff_work_rules.can_approve_parts is
  'Approve a technician''s part request, which deducts stock.';
comment on column public.staff_work_rules.can_manage_catalogue is
  'Edit dealers, the parts catalogue and repair agents in Admin Control.';
comment on column public.staff_work_rules.can_view_revenue is
  'See takings, profit and cost figures. Off: those tiles and reports are hidden.';

-- ── Enforcing the two that touch data ───────────────────────────────────────
-- The rest are enforced in the app, where the action lives. These two are
-- reachable straight through PostgREST, so a hidden button is not enough.

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
              end
         from public.staff_work_rules r
        where r.profile_id = auth.uid()),
      -- No row yet means nothing has been restricted for this person.
      case perm when 'discount' then false else true end)
  end
$$;

comment on function public.may is
  'Whether the signed-in staff member holds a named permission. Admin always true; a missing rules row means the defaults above.';

-- Approving a part request deducts stock, so the permission is checked where
-- the deduction happens rather than only on the button.
create or replace function public.resolve_part_request(
  p_request_id bigint,
  p_status     part_request_status
) returns public.repair_part_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  req public.repair_part_requests;
begin
  if not public.is_staff() then
    raise exception 'Not authorised to resolve part requests';
  end if;

  if not public.may('approve_parts') then
    raise exception 'You do not have permission to approve part requests';
  end if;

  if p_status not in ('Approved', 'Rejected') then
    raise exception 'resolve_part_request expects Approved or Rejected, got %', p_status;
  end if;

  select * into req
    from public.repair_part_requests
   where id = p_request_id
     for update;

  if not found then
    raise exception 'Part request % not found', p_request_id;
  end if;

  if req.status <> 'Pending' then
    return req;
  end if;

  if p_status = 'Approved' then
    if req.part_sku is null then
      raise exception 'That part is no longer in the catalogue, so stock cannot be deducted';
    end if;

    update public.repair_parts
       set stock = stock - req.quantity
     where sku = req.part_sku
       and stock >= req.quantity;

    if not found then
      raise exception 'Not enough % in stock to approve % unit(s)', req.part_sku, req.quantity;
    end if;
  end if;

  update public.repair_part_requests
     set status      = p_status,
         resolved_at = now(),
         resolved_by = auth.uid()
   where id = p_request_id
  returning * into req;

  return req;
end $$;

-- The catalogue is editable through PostgREST directly, so its RLS carries the
-- permission rather than the Admin Control screen doing it alone.
drop policy if exists parts_catalog_write on public.repair_parts;
create policy parts_catalog_write on public.repair_parts
  for all to authenticated
  using (public.has_role('Admin'::staff_role) or (public.has_role('Cashier'::staff_role) and public.may('manage_catalogue')))
  with check (public.has_role('Admin'::staff_role) or (public.has_role('Cashier'::staff_role) and public.may('manage_catalogue')));
