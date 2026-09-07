-- ============================================================================
-- Tracking page: an advance the customer never paid
--
-- repair_jobs.advance_paid is written up to the full amount at handover, so the
-- balance lands on zero. Deliberate, and it makes "Advance paid" read as though
-- every customer paid the whole bill before the work started.
--
-- On an instant job it is plainly wrong. Nothing was taken in advance — the
-- repair was done and paid for in one visit — and the customer opens their
-- tracking link to a receipt claiming they paid Rs. 5,600 up front.
--
-- The settlement is already on the handover record, so the real advance is
-- simply what is left after taking it back off. Nothing stored changes; the
-- page is given the second number so it can tell the two apart:
--
--   advance_paid    5,600   what the row holds after handover
--   settled_amount  5,600   paid when the device was collected
--   -------------------------------
--   advance          0      what was actually taken up front
--
-- Recreated rather than replaced because the column list grows, and a function
-- cannot change its OUT parameters in place.
-- ============================================================================

drop function if exists public.track_job(text);

create or replace function public.track_job(p_job_id text)
returns table (
  id                  text,
  customer_name       text,
  customer_phone      text,
  brand               text,
  model               text,
  imei                text,
  issue               text,
  status              text,
  estimated_completion date,
  estimated_cost      numeric,
  advance_paid        numeric,
  -- What was handed over at collection. Null until the device is collected.
  settled_amount      numeric,
  original_estimate   numeric,
  revised_estimate    numeric,
  labour_cost         numeric,
  approval            jsonb,
  warranty_id         text,
  technician          text,
  created_at          date,
  started_at          date,
  completed_at        date,
  received_items      text[],
  parts_used          text[],
  cosmetic_condition  jsonb,
  intake_photos       text[],
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
    j.id, j.customer_name,
    public.mask_phone(j.phone),
    j.brand, j.model,
    public.mask_imei(j.imei),
    j.issue, j.status,
    j.estimated_completion, j.estimated_cost, j.advance_paid,
    (j.handover ->> 'balanceSettled')::numeric,
    j.original_estimate, j.revised_estimate, j.labour_cost,
    j.approval, j.warranty_id,
    nullif(j.technician, 'Unassigned'),
    j.created_at::date,
    j.started_at::date,
    j.completed_at::date,
    j.received_items,
    j.parts_used,
    j.cosmetic_condition,
    j.intake_photos,
    j.pause_reason,
    j.cancel_reason,
    j.cancelled_at::date,
    (j.handover ->> 'handedOverAt')::date
  from public.repair_jobs j
  where j.id = p_job_id;
$$;

comment on function public.track_job(text) is
  'Public job-status lookup for the /track page. Exact id only — never lists jobs. Phone/IMEI are masked in SQL; passcode, signature and staff-only notes stay excluded entirely. settled_amount separates what was paid at collection from any genuine advance.';

grant execute on function public.track_job(text) to anon, authenticated;
