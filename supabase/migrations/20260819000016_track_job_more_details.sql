-- ============================================================================
-- Mano Mobile — more detail on the public job-tracking page
--
-- track_job() (20260819000015) returned just enough to show a status strip.
-- Adds the fields the customer actually wants to see on their own job: who's
-- working on it, when it was taken in / started / finished, what was handed
-- over with the device, and — when relevant — why it's paused or cancelled.
--
-- Still deliberately narrow: no phone, address, IMEI, passcode, signature, or
-- internal technician notes. Those stay staff-only regardless of who holds
-- the job id.
--
-- CREATE OR REPLACE can't add columns to a RETURNS TABLE function — Postgres
-- treats that as changing the OUT parameters, which requires a drop first.
-- ============================================================================

drop function if exists public.track_job(text);

create function public.track_job(p_job_id text)
returns table (
  id                  text,
  customer_name       text,
  brand               text,
  model               text,
  issue               text,
  status              text,
  estimated_completion date,
  estimated_cost      numeric,
  advance_paid        numeric,
  original_estimate   numeric,
  revised_estimate    numeric,
  approval            jsonb,
  warranty_id         text,
  technician          text,
  created_at          date,
  started_at          date,
  completed_at        date,
  received_items      text[],
  pause_reason        text,
  cancel_reason       text,
  cancelled_at        date,
  handed_over_at      date
)
language sql
security definer
set search_path = public
stable
as $$
  select
    j.id, j.customer_name, j.brand, j.model, j.issue, j.status,
    j.estimated_completion, j.estimated_cost, j.advance_paid,
    j.original_estimate, j.revised_estimate, j.approval, j.warranty_id,
    nullif(j.technician, 'Unassigned'),
    j.created_at::date,
    j.started_at::date,
    j.completed_at::date,
    j.received_items,
    j.pause_reason,
    j.cancel_reason,
    j.cancelled_at::date,
    (j.handover ->> 'handedOverAt')::date
  from public.repair_jobs j
  where j.id = p_job_id;
$$;

comment on function public.track_job(text) is
  'Public job-status lookup for the /track page. Exact id only — never lists jobs. Deliberately narrow column set.';

grant execute on function public.track_job(text) to anon, authenticated;
