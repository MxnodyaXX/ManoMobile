-- ============================================================================
-- Shop work rules
--
-- How the shop actually runs varies: a technician handling 100 devices a day
-- works several at once and does not stop to press Start on each one, while a
-- smaller shop may want one job at a time and every start recorded.
--
-- One row, edited by Admin, read by everyone. Kept as columns rather than a
-- key/value bag so each rule is typed and self-documenting.
-- ============================================================================

create table if not exists public.app_settings (
  -- Single-row table: the check constraint makes a second row impossible.
  id                          boolean primary key default true check (id),

  -- May a technician have more than one job in progress at the same time?
  allow_multiple_active_jobs  boolean not null default true,

  -- Optional cap when the above is true. Null = no limit.
  max_active_jobs             integer check (max_active_jobs is null or max_active_jobs > 0),

  -- Must a job be started in the system before it can be marked finished?
  -- Off suits a busy bench where work begins before anyone touches a screen.
  require_start_before_finish boolean not null default true,

  updated_at                  timestamptz not null default now(),
  updated_by                  uuid references auth.users (id) on delete set null
);

comment on table public.app_settings is
  'Shop-wide work rules. Exactly one row.';

drop trigger if exists trg_app_settings_touch on public.app_settings;
create trigger trg_app_settings_touch
  before update on public.app_settings
  for each row execute function public.touch_updated_at();

-- Seed the single row with permissive defaults (matching how a busy bench works).
insert into public.app_settings (id, allow_multiple_active_jobs, require_start_before_finish)
values (true, true, true)
on conflict (id) do nothing;

alter table public.app_settings enable row level security;

-- Everyone reads the rules they work under; only Admin changes them.
drop policy if exists app_settings_select on public.app_settings;
create policy app_settings_select on public.app_settings
  for select to authenticated using (public.is_staff());

drop policy if exists app_settings_admin_write on public.app_settings;
create policy app_settings_admin_write on public.app_settings
  for all to authenticated
  using (public.has_role('Admin'::staff_role)) with check (public.has_role('Admin'::staff_role));
