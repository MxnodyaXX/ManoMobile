-- ============================================================================
-- Repair-parts approval exemption
--
-- Off (false) by default: a technician's part requests go to Admin for
-- approval unless this is explicitly granted. Mirrors can_claim_unassigned /
-- can_transfer_to_agent as a person-only permission with no shop-wide
-- equivalent, but defaults the other way — approval is the safe default for
-- a brand-new control, not something granted implicitly.
-- ============================================================================

alter table public.staff_work_rules
  add column if not exists can_use_parts_without_approval boolean not null default false;

comment on column public.staff_work_rules.can_use_parts_without_approval is
  'True: this technician''s part requests are auto-approved and stock is deducted immediately. False (default): requests go to Admin for approval.';