-- ============================================================================
-- Technician speciality

-- The intake screen lists each technician with what they specialise in
-- ("Screen & Battery", "Motherboard & IC"). That was hard-coded in the
-- frontend; the roster now comes from `profiles`, so the column lives here.

-- Nullable: only technicians need it, and the UI falls back to "Repair
-- Technician" when it is unset.
-- ============================================================================

alter table public.profiles
  add column if not exists speciality text;

comment on column public.profiles.speciality is
  'What this technician mainly works on. Shown on the intake assignment card.';

-- Convenience for admins filling this in after inviting staff:
--   update public.profiles set speciality = 'Screen & Battery'
--   where email = 'kamal@manomobile.lk';
