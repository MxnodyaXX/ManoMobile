-- ============================================================================
-- Mano Mobile — a technician who works the whole shop's bench
--
-- The whole-shop bench (every job listed, any job actionable, "who did the
-- work?" asked at finish) was the Admin's and the Admin Cashier's only. A shop
-- with a senior technician — the one who opens up, hands out the work and
-- finishes whatever is left — needs that technician to have it too, from
-- their own technician login.
--
-- So it becomes a per-technician switch, set by an Admin in
-- Admin Control -> Permissions -> Technicians.
--
-- ── What the switch actually unlocks ────────────────────────────────────────
-- The app shows the whole-shop bench; the database is what lets the work be
-- saved. jobs_update (20260902000019) allowed a technician to change only
-- their own or unclaimed jobs, and to leave a job assigned only to themselves.
-- A whole-shop technician may update any job and record any technician on it
-- — finishing a job for the person who actually did it is the point.
-- Admin and Cashier arms are unchanged.
-- ============================================================================

alter table public.staff_work_rules
  add column if not exists is_whole_shop_technician boolean not null default false;

comment on column public.staff_work_rules.is_whole_shop_technician is
  'A technician who works the whole shop''s bench: sees every job and may act on any of them. Grants rather than restricts, so it defaults false.';

create or replace function public.is_whole_shop_technician()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role('Technician'::staff_role)
     and coalesce(
           (select r.is_whole_shop_technician
              from public.staff_work_rules r
             where r.profile_id = auth.uid()),
           false)
$$;

comment on function public.is_whole_shop_technician is
  'Is the signed-in person a technician switched to the whole-shop bench?';

drop policy if exists jobs_update on public.repair_jobs;
create policy jobs_update on public.repair_jobs
  for update to authenticated
  using (
    public.module_can_write('Repairs')
    and (
      public.has_role('Admin'::staff_role, 'Cashier'::staff_role)
      or public.is_whole_shop_technician()
      or (
        public.has_role('Technician'::staff_role)
        and (
          technician is null
          or btrim(technician) = ''
          or lower(btrim(technician)) = 'unassigned'
          or technician = public.my_staff_name()
        )
      )
    )
  )
  with check (
    public.module_can_write('Repairs')
    and (
      public.has_role('Admin'::staff_role, 'Cashier'::staff_role)
      or public.is_whole_shop_technician()
      -- A technician's write must leave the job theirs. Without this they could
      -- pass their own job to somebody else, which is the Admin's call.
      or (public.has_role('Technician'::staff_role) and technician = public.my_staff_name())
    )
  );
