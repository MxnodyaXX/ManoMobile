-- ============================================================================
-- Per-technician repair permissions
--
-- app_settings holds the shop default; this table holds exceptions for one
-- person. Ten technicians can each work under different rules — a senior tech
-- running five devices at once, a trainee limited to one — without the shop
-- default having to suit everybody.
--
-- The tri-state matters: NULL means "inherit the shop rule", which is not the
-- same as false. Change the shop default and everyone on NULL follows it;
-- anyone with an explicit value keeps theirs.
-- ============================================================================

create table if not exists public.staff_work_rules (
  profile_id                  uuid primary key references public.profiles (id) on delete cascade,

  -- NULL = inherit from app_settings
  allow_multiple_active_jobs  boolean,
  max_active_jobs             integer check (max_active_jobs is null or max_active_jobs > 0),
  require_start_before_finish boolean,

  -- Person-level permissions. These have no shop-wide equivalent: they are
  -- about what this individual is trusted to do.
  can_claim_unassigned        boolean not null default true,
  can_transfer_to_agent       boolean not null default true,

  notes                       text,
  updated_at                  timestamptz not null default now(),
  updated_by                  uuid references auth.users (id) on delete set null
);

comment on table public.staff_work_rules is
  'Per-technician overrides of the shop work rules. A missing row means "all defaults".';
comment on column public.staff_work_rules.allow_multiple_active_jobs is
  'NULL inherits app_settings; true/false overrides it for this person only.';

drop trigger if exists trg_staff_work_rules_touch on public.staff_work_rules;
create trigger trg_staff_work_rules_touch
  before update on public.staff_work_rules
  for each row execute function public.touch_updated_at();

alter table public.staff_work_rules enable row level security;

-- Staff can see the rules they work under (the technician screens read them to
-- decide what to offer); only Admin sets them.
drop policy if exists staff_work_rules_select on public.staff_work_rules;
create policy staff_work_rules_select on public.staff_work_rules
  for select to authenticated using (public.is_staff());

drop policy if exists staff_work_rules_admin_write on public.staff_work_rules;
create policy staff_work_rules_admin_write on public.staff_work_rules
  for all to authenticated
  using (public.has_role('Admin'::staff_role)) with check (public.has_role('Admin'::staff_role));
