-- ============================================================================
-- Mano Mobile — admin-managed Device Faults list
--
-- The checklist on New Repair -> Step 2 (Device & Faults) was a hardcoded
-- array in NewRepairForm.tsx — an admin wanting to add, rename, or drop a
-- fault had to ask for a code change. This moves it into a real table so
-- Admin Control can manage it directly, the same way Repair Dealers and the
-- Repair Parts catalogue already are.
--
-- Seeded with the exact list that was hardcoded before, so nothing changes
-- on the intake form until an admin actually edits it.
-- ============================================================================

create table if not exists public.device_faults (
  id          bigint generated always as identity primary key,
  label       text not null,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Case-insensitive: "Water Damage" and "water damage" are the same fault
-- typed twice, not two different ones.
create unique index if not exists device_faults_label_key on public.device_faults (lower(label));
create index if not exists device_faults_sort_idx on public.device_faults (sort_order, id);

drop trigger if exists trg_device_faults_touch on public.device_faults;
create trigger trg_device_faults_touch
  before update on public.device_faults
  for each row execute function public.touch_updated_at();

alter table public.device_faults enable row level security;

-- Every intake needs to read the list; only an admin edits it.
drop policy if exists device_faults_select on public.device_faults;
create policy device_faults_select on public.device_faults
  for select to authenticated using (public.is_staff());

drop policy if exists device_faults_write on public.device_faults;
create policy device_faults_write on public.device_faults
  for all to authenticated
  using (public.has_role('Admin'::staff_role))
  with check (public.has_role('Admin'::staff_role));

insert into public.device_faults (label, sort_order) values
  ('Screen Cracked / Broken', 10),
  ('Screen Not Displaying',   20),
  ('Touch Not Working',       30),
  ('Battery Draining Fast',   40),
  ('Won''t Turn On / Dead',   50),
  ('Charging Port Faulty',    60),
  ('Speaker / Mic Issue',     70),
  ('Camera Not Working',      80),
  ('Software / Bootloop',     90),
  ('Water Damage',            100),
  ('Overheating',             110),
  ('Signal / Network Issue',  120)
on conflict (lower(label)) do nothing;

comment on table public.device_faults is
  'Admin-managed checklist of common device faults, shown on New Repair -> Step 2. sort_order controls display order (ties broken by id).';
