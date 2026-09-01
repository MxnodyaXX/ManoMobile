-- ============================================================================
-- Mano Mobile — data for the redesigned public tracking page
--
-- The {track_link} sent in the "Ready For Collection" SMS/email points at
-- /track, which is getting a proper redesign (device condition at drop-off,
-- intake photos, parts used, a masked contact/IMEI, and "previous repairs on
-- this device"). track_job() needs a few more columns to support it, and a
-- second function answers "what else has this customer had repaired" —
-- still an exact-job-id lookup at the boundary, same as track_job() itself,
-- just resolving to *other* rows once inside.
--
-- Still excluded, on purpose, same as the original narrowing comment says:
-- passcode, signature, and anything staff-only like technician remarks or
-- future-fault notes. Phone and IMEI are now included, but masked in SQL —
-- the raw values never leave the database, only "077 xxx xx89" /
-- "3591 xxxx xxxx 4417" ever reach the browser.
-- ============================================================================

create or replace function public.mask_phone(p text)
returns text
language sql
immutable
as $$
  select case
    when p is null or length(regexp_replace(p, '\D', '', 'g')) < 4 then null
    else
      left(regexp_replace(p, '\D', '', 'g'), 3) || ' ••• ••' ||
      right(regexp_replace(p, '\D', '', 'g'), 2)
  end;
$$;

create or replace function public.mask_imei(v text)
returns text
language sql
immutable
as $$
  select case
    when v is null or length(regexp_replace(v, '\D', '', 'g')) < 8 then null
    else
      left(regexp_replace(v, '\D', '', 'g'), 4) || ' •••• •••• ' ||
      right(regexp_replace(v, '\D', '', 'g'), 4)
  end;
$$;

drop function if exists public.track_job(text);

create function public.track_job(p_job_id text)
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
  'Public job-status lookup for the /track page. Exact id only — never lists jobs. Phone/IMEI are masked in SQL; passcode, signature and staff-only notes stay excluded entirely.';

grant execute on function public.track_job(text) to anon, authenticated;

-- ── Previous repairs on this device ──────────────────────────────────────────
-- "This device" means this customer's phone number — the one thing every job
-- of theirs shares, IMEI included or not. Resolves the id to a phone
-- server-side rather than accepting one as a parameter, so this stays an
-- extension of "I already know one of my own job ids", not a way to search
-- by phone number directly.

create or replace function public.track_job_history(p_job_id text)
returns table (
  id            text,
  brand         text,
  model         text,
  issue         text,
  status        text,
  estimated_cost numeric,
  completed_at  date,
  created_at    date
)
language sql
security definer
set search_path = public
stable
as $$
  select h.id, h.brand, h.model, h.issue, h.status, h.estimated_cost,
         h.completed_at::date, h.created_at::date
  from public.repair_jobs h
  where h.phone = (select j.phone from public.repair_jobs j where j.id = p_job_id)
    and h.id <> p_job_id
    and h.phone is not null and h.phone <> ''
  order by h.created_at desc
  limit 10;
$$;

comment on function public.track_job_history(text) is
  'Other jobs for the same customer as p_job_id, narrow columns only. Same trust boundary as track_job(): you must already hold one exact job id.';

grant execute on function public.track_job_history(text) to anon, authenticated;
