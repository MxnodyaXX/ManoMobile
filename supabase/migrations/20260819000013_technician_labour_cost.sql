-- ============================================================================
-- Mano Mobile — what a repair costs in labour
--
-- The dashboard showed "Labour" as the repair charge minus parts, which is not
-- a cost at all — it is the part of the revenue that is not parts. Profit was
-- therefore unknowable: a job charging Rs. 14,000 with Rs. 8,000 of parts
-- looks identical whether the technician is paid Rs. 500 or Rs. 5,000 for it.
--
-- The technician enters what they are charging when they mark a job complete —
-- only they know what the work was worth. Since a busy bench does a hundred
-- jobs a day, each person gets a default that pre-fills that box:
--
--   none        starts at zero
--   fixed       starts at a flat amount
--   percentage  starts at a share of what the job was charged
--   custom      starts empty, so it has to be considered every time
--
-- The entered amount is then SNAPSHOT onto the job. Recomputing it from the
-- current default would silently rewrite last year's profit every time
-- somebody renegotiates, which is the one thing a cost figure must never do.
-- ============================================================================

do $$ begin
  create type labour_cost_mode as enum ('none', 'fixed', 'percentage', 'custom');
exception when duplicate_object then null; end $$;

-- ── Per-technician default ──────────────────────────────────────────────────

alter table public.staff_work_rules
  add column if not exists labour_cost_mode labour_cost_mode not null default 'none';

alter table public.staff_work_rules
  add column if not exists labour_cost_value numeric(12,2) not null default 0
    check (labour_cost_value >= 0);

comment on column public.staff_work_rules.labour_cost_mode is
  'What pre-fills this technician''s charge box at completion: nothing, a fixed amount, a percentage of the charge, or an empty box. They can always overwrite it.';
comment on column public.staff_work_rules.labour_cost_value is
  'The default: rupees when mode is fixed, percent (0-100) when mode is percentage. Ignored for none and custom.';

-- A percentage over 100 would make every job loss-making and is always a typo
-- — someone typing a rupee amount into the percent box.
do $$ begin
  alter table public.staff_work_rules
    add constraint staff_work_rules_percentage_range
    check (labour_cost_mode <> 'percentage' or labour_cost_value <= 100);
exception when duplicate_object then null; end $$;

-- ── What the technician charged for this job ────────────────────────────────

alter table public.repair_jobs
  add column if not exists labour_cost numeric(12,2)
    check (labour_cost is null or labour_cost >= 0);

comment on column public.repair_jobs.labour_cost is
  'What the technician charged for this job, entered by them when they marked it complete. NULL for jobs completed before this existed — those fall back to the current default rate, which the UI flags as an estimate.';