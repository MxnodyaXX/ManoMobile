-- ============================================================================
-- Mano Mobile — model number → device lookup
--
-- Typing a model number on intake already auto-fills the brand and model, but
-- it learned that mapping by scanning past repair_jobs — so it inherited every
-- mistake anyone ever typed. Today's data has "c2" resolving to Other/TA-1114
-- and a TA+1557 typo sitting alongside the real TA-1557: garbage that then
-- auto-fills itself into the next job, and the one after that.
--
-- This is the reference table instead. One row per model number, correctable
-- in one place, and the intake form prefers it over job history.
--
-- It keeps learning: saving a job whose brand and model are both real (not the
-- "Other" placeholder, not blank) records the mapping here. That filter is the
-- whole difference — the old lookup learned from everything, this learns only
-- from entries somebody actually filled in properly.
-- ============================================================================

create table if not exists public.device_models (
  id           bigint generated always as identity primary key,
  -- The number printed on the box or shown under Settings, e.g. M2006C3MG.
  model_number text not null,
  brand        text not null,
  model        text not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid references auth.users (id) on delete set null
);

-- Case- and punctuation-insensitive, matching normaliseModelNumber() in the
-- app: "TA-1557", "ta 1557" and "TA1557" are one number typed three ways, and
-- three rows for them would make the lookup answer differ by how it was typed.
create unique index if not exists device_models_number_key
  on public.device_models (upper(replace(replace(model_number, ' ', ''), '-', '')));

create index if not exists device_models_brand_idx on public.device_models (brand, model);

drop trigger if exists trg_device_models_touch on public.device_models;
create trigger trg_device_models_touch
  before update on public.device_models
  for each row execute function public.touch_updated_at();

-- ── Seed from the history worth keeping ─────────────────────────────────────
-- Only jobs where somebody filled in a real brand AND a real model AND a model
-- number. That drops the "Other"-branded rows, which are exactly the ones
-- producing nonsense suggestions today.
--
-- distinct on (...) order by created_at desc: where the same number was
-- recorded more than once, the most recent spelling wins — a number mistyped
-- once and corrected later ends up with the correction.

insert into public.device_models (model_number, brand, model)
select distinct on (upper(replace(replace(j.model_number, ' ', ''), '-', '')))
       trim(j.model_number), trim(j.brand), trim(j.model)
  from public.repair_jobs j
 where coalesce(trim(j.model_number), '') <> ''
   and coalesce(trim(j.brand), '') not in ('', 'Other')
   and coalesce(trim(j.model), '') <> ''
 order by upper(replace(replace(j.model_number, ' ', ''), '-', '')), j.created_at desc
on conflict do nothing;

-- ── Row level security ──────────────────────────────────────────────────────

alter table public.device_models enable row level security;

-- Every intake reads it; the counter corrects it, since the cashier taking the
-- device in is the one who spots a wrong suggestion.
drop policy if exists device_models_select on public.device_models;
create policy device_models_select on public.device_models
  for select to authenticated using (public.is_staff());

drop policy if exists device_models_write on public.device_models;
create policy device_models_write on public.device_models
  for all to authenticated
  using (public.has_role('Admin'::staff_role, 'Cashier'::staff_role))
  with check (public.has_role('Admin'::staff_role, 'Cashier'::staff_role));

comment on table public.device_models is
  'Model number to brand/model lookup for intake auto-fill. Preferred over scanning past repair_jobs, which inherits every typo.';
