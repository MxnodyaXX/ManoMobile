-- ============================================================================
-- Mano Mobile — repair tags chosen per kind of job, not by template name
--
-- The job tag that printed was picked by hard-coded names: a template called
-- exactly "Repair Job Tag With Pass" when the customer left a passcode,
-- "RepairJobTagOutsideDealers" for another shop's job, otherwise the repair
-- default. Renaming one quietly changed what printed, and there was no way to
-- say "use this one for that".
--
-- Now:
--   barcode_templates.repair_audience  which side a repair template belongs
--     to — 'internal' (our own customers) or 'external' (another shop's).
--     A template only ever prints for its own side.
--   repair_tag_slots  which template prints in each of four cases:
--     internal / internal_passcode / external / external_passcode.
--     An empty passcode slot falls back to the same side's normal tag.
-- ============================================================================

alter table public.barcode_templates
  add column if not exists repair_audience text
    check (repair_audience is null or repair_audience in ('internal', 'external'));

comment on column public.barcode_templates.repair_audience is
  'Repair tags only: internal (our own customers'' jobs) or external (another shop''s jobs). A repair template prints only for its own side.';

-- Existing repair templates: the outside-dealer one is external, the rest internal.
update public.barcode_templates
   set repair_audience = case when name = 'RepairJobTagOutsideDealers' then 'external' else 'internal' end
 where layout = 'repair' and repair_audience is null;

create table if not exists public.repair_tag_slots (
  slot        text primary key check (slot in ('internal', 'internal_passcode', 'external', 'external_passcode')),
  template_id bigint references public.barcode_templates (id) on delete set null,
  updated_at  timestamptz not null default now()
);

comment on table public.repair_tag_slots is
  'Which repair tag template prints for each kind of job: internal / internal_passcode / external / external_passcode. Empty = fall back (passcode → that side''s normal tag → built-in tag).';

-- Seeded from what printed before, so nothing changes until someone picks otherwise.
insert into public.repair_tag_slots (slot, template_id)
select s.slot, (select id from public.barcode_templates where name = s.name and layout = 'repair' limit 1)
  from (values
    ('internal',          'Repair Job Tag'),
    ('internal_passcode', 'Repair Job Tag With Pass'),
    ('external',          'RepairJobTagOutsideDealers'),
    ('external_passcode', null)
  ) as s(slot, name)
on conflict (slot) do nothing;

alter table public.repair_tag_slots enable row level security;

drop policy if exists repair_tag_slots_select on public.repair_tag_slots;
create policy repair_tag_slots_select on public.repair_tag_slots
  for select to authenticated using (public.is_staff());

-- Same people who may edit label templates.
drop policy if exists repair_tag_slots_write on public.repair_tag_slots;
create policy repair_tag_slots_write on public.repair_tag_slots
  for all to authenticated
  using (public.has_role('Admin'::staff_role, 'Cashier'::staff_role))
  with check (public.has_role('Admin'::staff_role, 'Cashier'::staff_role));
