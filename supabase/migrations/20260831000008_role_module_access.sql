-- ============================================================================
-- Mano Mobile — role → module access, made real
--
-- The Permissions screen has shown a 17-module by 5-role grid since it was
-- built, with a Save button that set a "Saved" flag for two and a half seconds
-- and wrote nothing. Nothing outside that screen ever read it. An owner could
-- set "Cashier: Financial Reports — none", see it confirm, and the cashier
-- would still open financial reports.
--
-- This stores the grid and gives Postgres two functions to enforce it with.
--
-- ── The one rule that matters here ──────────────────────────────────────────
-- A MISSING ROW MEANS ALLOWED. Every check below falls open, never closed.
-- These policies sit in front of the tables the shop runs on; a half-applied
-- migration, a role nobody thought to seed, or a module renamed in the app must
-- never be able to lock a counter out mid-repair. Access control that fails
-- closed on its own bookkeeping is worse than none, because it fails at the
-- worst possible moment and looks like the app is broken.
-- ============================================================================

do $$ begin
  create type module_access as enum ('full', 'view', 'none');
exception when duplicate_object then null; end $$;

create table if not exists public.role_module_access (
  role       staff_role not null,
  -- The module name exactly as the Permissions screen lists it. Text, not an
  -- enum: the module list lives in the app, and adding one should not need a
  -- migration before an admin can set it.
  module     text not null,
  access     module_access not null default 'none',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  primary key (role, module)
);

comment on table public.role_module_access is
  'What each role may do with each module. A missing row means allowed — see the migration header.';

drop trigger if exists trg_role_module_access_touch on public.role_module_access;
create trigger trg_role_module_access_touch
  before update on public.role_module_access
  for each row execute function public.touch_updated_at();

-- ── Seed: exactly the grid the screen has been showing ──────────────────────

insert into public.role_module_access (role, module, access) values
  ('Admin','Dashboard','full'),          ('Cashier','Dashboard','view'),          ('Technician','Dashboard','view'),      ('Accounts','Dashboard','view'),
  ('Admin','Sales / POS','full'),        ('Cashier','Sales / POS','full'),        ('Technician','Sales / POS','none'),    ('Accounts','Sales / POS','none'),
  ('Admin','Repairs','full'),            ('Cashier','Repairs','full'),            ('Technician','Repairs','full'),        ('Accounts','Repairs','none'),
  ('Admin','Inventory','full'),          ('Cashier','Inventory','full'),          ('Technician','Inventory','view'),      ('Accounts','Inventory','none'),
  ('Admin','Customers','full'),          ('Cashier','Customers','full'),          ('Technician','Customers','view'),      ('Accounts','Customers','view'),
  ('Admin','Cash Register','full'),      ('Cashier','Cash Register','full'),      ('Technician','Cash Register','none'),  ('Accounts','Cash Register','view'),
  ('Admin','Sales Reports','full'),      ('Cashier','Sales Reports','view'),      ('Technician','Sales Reports','none'),  ('Accounts','Sales Reports','view'),
  ('Admin','Repair Reports','full'),     ('Cashier','Repair Reports','view'),     ('Technician','Repair Reports','view'), ('Accounts','Repair Reports','view'),
  ('Admin','Financial Reports','full'),  ('Cashier','Financial Reports','none'),  ('Technician','Financial Reports','none'), ('Accounts','Financial Reports','full'),
  ('Admin','General Ledger','full'),     ('Cashier','General Ledger','none'),     ('Technician','General Ledger','none'), ('Accounts','General Ledger','full'),
  ('Admin','AR / AP','full'),            ('Cashier','AR / AP','none'),            ('Technician','AR / AP','none'),        ('Accounts','AR / AP','full'),
  ('Admin','Staff Management','full'),   ('Cashier','Staff Management','none'),   ('Technician','Staff Management','none'), ('Accounts','Staff Management','none'),
  ('Admin','Suppliers','full'),          ('Cashier','Suppliers','none'),          ('Technician','Suppliers','none'),      ('Accounts','Suppliers','view'),
  ('Admin','Purchase Orders','full'),    ('Cashier','Purchase Orders','none'),    ('Technician','Purchase Orders','none'), ('Accounts','Purchase Orders','view'),
  ('Admin','Device Registry','full'),    ('Cashier','Device Registry','view'),    ('Technician','Device Registry','view'), ('Accounts','Device Registry','none'),
  ('Admin','Notifications','full'),      ('Cashier','Notifications','none'),      ('Technician','Notifications','none'),  ('Accounts','Notifications','none'),
  ('Admin','System Settings','full'),    ('Cashier','System Settings','none'),    ('Technician','System Settings','none'), ('Accounts','System Settings','none')
on conflict (role, module) do nothing;

-- ── The two checks ──────────────────────────────────────────────────────────

create or replace function public.module_can_read(p_module text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.has_role('Admin'::staff_role) then true
    else coalesce(
      (select a.access <> 'none'
         from public.role_module_access a
        where a.role = public.current_staff_role()
          and a.module = p_module),
      true)   -- no row: allowed
  end
$$;

create or replace function public.module_can_write(p_module text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.has_role('Admin'::staff_role) then true
    else coalesce(
      (select a.access = 'full'
         from public.role_module_access a
        where a.role = public.current_staff_role()
          and a.module = p_module),
      true)   -- no row: allowed
  end
$$;

comment on function public.module_can_read is
  'May the caller open this module at all? Admin always; a missing row allows.';
comment on function public.module_can_write is
  'May the caller change things in this module? Only on full access. Admin always; a missing row allows.';

-- ── Row level security on the grid itself ───────────────────────────────────

alter table public.role_module_access enable row level security;

-- Everyone reads it: each app has to know what to show its own user, and a
-- sidebar that could not read this would render every item and then hide them.
drop policy if exists role_module_access_select on public.role_module_access;
create policy role_module_access_select on public.role_module_access
  for select to authenticated using (public.is_staff());

drop policy if exists role_module_access_admin_write on public.role_module_access;
create policy role_module_access_admin_write on public.role_module_access
  for all to authenticated
  using (public.has_role('Admin'::staff_role)) with check (public.has_role('Admin'::staff_role));

-- ── Enforcement ─────────────────────────────────────────────────────────────
--
-- Applied where a wrong cell is recoverable, and deliberately NOT applied to
-- two things:
--
--   profiles      — every screen resolves its own role and the technician
--                   roster from it. Gating reads here would break sign-in
--                   itself, and "Staff Management" is already Admin-only.
--   repair_jobs   — reads stay role-based. A single mis-set cell would empty
--                   the counter, the bench and the job tracker at once, with
--                   no way back in through the UI. Writes ARE gated, so
--                   "view" means view.
--
-- Everything else follows the grid for both reads and writes.

-- Inventory: the spare-parts catalogue.
drop policy if exists parts_catalog_select on public.repair_parts;
create policy parts_catalog_select on public.repair_parts
  for select to authenticated
  using (public.is_staff() and public.module_can_read('Inventory'));

drop policy if exists parts_catalog_write on public.repair_parts;
create policy parts_catalog_write on public.repair_parts
  for all to authenticated
  using (
    public.has_role('Admin'::staff_role)
    or (public.module_can_write('Inventory') and public.may('manage_catalogue'))
  )
  with check (
    public.has_role('Admin'::staff_role)
    or (public.module_can_write('Inventory') and public.may('manage_catalogue'))
  );

-- Repairs: writes only. See the note above for why reads are left alone.
--
-- These REPLACE jobs_insert and jobs_update rather than adding a policy beside
-- them. Permissive policies OR together, so a new "and module_can_write" policy
-- sitting next to the originals would grant exactly what the originals already
-- granted and enforce nothing. The original conditions are carried over intact
-- and the module check is ANDed into each.
drop policy if exists jobs_insert on public.repair_jobs;
create policy jobs_insert on public.repair_jobs
  for insert to authenticated
  with check (
    public.has_role('Admin'::staff_role, 'Cashier'::staff_role)
    and public.module_can_write('Repairs')
  );

drop policy if exists jobs_update on public.repair_jobs;
create policy jobs_update on public.repair_jobs
  for update to authenticated
  using (
    public.has_role('Admin'::staff_role, 'Cashier'::staff_role, 'Technician'::staff_role)
    and public.module_can_write('Repairs')
  )
  with check (
    public.has_role('Admin'::staff_role, 'Cashier'::staff_role, 'Technician'::staff_role)
    and public.module_can_write('Repairs')
  );

-- jobs_select and jobs_delete are left exactly as they were: reads for the
-- reason above, and deletes are already Admin-only, whom the grid never limits.

-- Notifications: the wording customers receive.
drop policy if exists sms_templates_admin_write on public.sms_templates;
create policy sms_templates_admin_write on public.sms_templates
  for all to authenticated
  using (public.has_role('Admin'::staff_role) and public.module_can_write('Notifications'))
  with check (public.has_role('Admin'::staff_role) and public.module_can_write('Notifications'));

drop policy if exists email_templates_admin_write on public.email_templates;
create policy email_templates_admin_write on public.email_templates
  for all to authenticated
  using (public.has_role('Admin'::staff_role) and public.module_can_write('Notifications'))
  with check (public.has_role('Admin'::staff_role) and public.module_can_write('Notifications'));

-- System Settings: the shop's own configuration.
drop policy if exists app_settings_admin_write on public.app_settings;
create policy app_settings_admin_write on public.app_settings
  for all to authenticated
  using (public.has_role('Admin'::staff_role) and public.module_can_write('System Settings'))
  with check (public.has_role('Admin'::staff_role) and public.module_can_write('System Settings'));
