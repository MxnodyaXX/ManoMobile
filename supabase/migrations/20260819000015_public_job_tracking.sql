-- ============================================================================
-- Mano Mobile — public job tracking (the QR-code "/track" page)
--
-- The customer-facing tracking page reads a job by scanning the QR code
-- printed on their receipt (see JobReceiptSlip / ReceiptRender's {{trackUrl}})
-- and, if the estimate changed after diagnosis, can approve it there — no
-- staff login involved, by design.
--
-- repair_jobs' own RLS (`jobs_select ... to authenticated using is_staff()`)
-- correctly refuses that: a customer's browser has no session at all. Rather
-- than loosen the table's own policy — which would let anyone list every job
-- in the shop — these two SECURITY DEFINER functions are the only door in:
-- exact-id lookup only (no listing), and a narrow, single-column update for
-- approval. Both run as their owner regardless of the caller's role, so an
-- anonymous visitor can use them without ever seeing raw table access.
--
-- track_job() also returns a deliberately small set of columns — no IMEI,
-- passcode, signature, or internal notes reach a public endpoint just because
-- the row has them.
-- ============================================================================

create or replace function public.track_job(p_job_id text)
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
  warranty_id         text
)
language sql
security definer
set search_path = public
stable
as $$
  select
    j.id, j.customer_name, j.brand, j.model, j.issue, j.status,
    j.estimated_completion, j.estimated_cost, j.advance_paid,
    j.original_estimate, j.revised_estimate, j.approval, j.warranty_id
  from public.repair_jobs j
  where j.id = p_job_id;
$$;

comment on function public.track_job(text) is
  'Public job-status lookup for the /track page. Exact id only — never lists jobs. Deliberately narrow column set.';

grant execute on function public.track_job(text) to anon, authenticated;

-- ── Self-service approval ───────────────────────────────────────────────────
-- A customer approving a revised estimate from the tracking page. Scoped to
-- exactly the `approval` column — nothing else on the job can move through
-- this door.

create or replace function public.approve_job_estimate(p_job_id text, p_approved_by text)
returns public.repair_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  job public.repair_jobs;
begin
  update public.repair_jobs
  set approval = jsonb_build_object(
    'amount',           coalesce(revised_estimate, estimated_cost),
    'approvedBy',        nullif(trim(p_approved_by), ''),
    'channel',           'Online',
    'approvedAt',        to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'recordedByStaff',   'Customer (self-service)'
  )
  where id = p_job_id
  returning * into job;

  if not found then
    raise exception 'Job % not found', p_job_id;
  end if;

  return job;
end;
$$;

comment on function public.approve_job_estimate(text, text) is
  'Public self-service approval from the /track page. Writes only the approval column.';

grant execute on function public.approve_job_estimate(text, text) to anon, authenticated;
