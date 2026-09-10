-- ============================================================================
-- Mano Mobile — the customer who came in to ask
--
-- A customer walks in or rings: "my phone, is it done?" Today that conversation
-- happens entirely at the counter and dies there. The cashier looks the job up,
-- says "not yet", and the technician — the only person who can change the
-- answer — never learns anybody asked. The job sits in the same place in the
-- same queue as thirty others nobody has chased.
--
-- So the asking becomes a fact on the job. Recorded once by whoever took the
-- question, visible on the bench until the technician has seen it, and counted,
-- because the third time somebody asks about the same repair is different from
-- the first and the shop should be able to see which is which.
--
-- ── Why seen-at rather than a boolean ───────────────────────────────────────
-- A flag that the technician clears is wrong the moment a second customer call
-- arrives after they cleared it: the flag is already off, so the new question
-- is invisible. Two timestamps cannot lose that — an inquiry is outstanding
-- while inquiry_at is newer than inquiry_seen_at, so every fresh question
-- reopens it whatever happened before.
--
-- The pair also survives the technician acknowledging and then the customer
-- ringing again ten minutes later, which is exactly the case a shop cares
-- about and exactly the one a boolean drops.
-- ============================================================================

alter table public.repair_jobs
  add column if not exists inquiry_at      timestamptz,
  add column if not exists inquiry_by      text,
  add column if not exists inquiry_note    text,
  add column if not exists inquiry_seen_at timestamptz,
  add column if not exists inquiry_count   integer not null default 0;

comment on column public.repair_jobs.inquiry_at is
  'When a customer last asked about this job at the counter. Outstanding while newer than inquiry_seen_at.';
comment on column public.repair_jobs.inquiry_seen_at is
  'When the technician last acknowledged the inquiry. Older than inquiry_at means a question is still waiting.';
comment on column public.repair_jobs.inquiry_count is
  'How many times a customer has chased this repair. The third ask is not the first.';

-- The bench reads "what is waiting on me" constantly and the answer is a
-- handful of rows, so the index covers only those.
create index if not exists repair_jobs_open_inquiry_idx
  on public.repair_jobs (inquiry_at desc)
  where inquiry_at is not null;

/**
 * Record that a customer chased this repair.
 *
 * Definer, because the people who take the question are cashiers and the job
 * row belongs to the bench — and because this writes two things that must not
 * disagree: the flag the technician sees, and the line in the job's history
 * that says who asked and when. One call, or neither.
 *
 * Deliberately does not touch priority. A customer asking is a fact about the
 * customer, not a re-quote of the work, and quietly promoting Normal to Urgent
 * would rewrite the technician's queue on the strength of a phone call.
 * Attention is shown, not enforced.
 */
create or replace function public.record_customer_inquiry(
  p_job_id text,
  p_note   text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status job_status;
  v_who    text;
begin
  if not public.is_staff() then
    raise exception using errcode = '42501', message = 'Only staff can record a customer inquiry.';
  end if;

  select status into v_status from public.repair_jobs where id = p_job_id;
  if not found then
    raise exception 'There is no job %.', p_job_id;
  end if;

  -- Recorded by name, because that is what the bench and the history need to
  -- read. The uuid is on the event row for anything that needs to be certain.
  select coalesce(nullif(btrim(full_name), ''), 'Counter')
    into v_who
    from public.profiles where id = auth.uid();

  update public.repair_jobs
     set inquiry_at    = now(),
         inquiry_by    = coalesce(v_who, 'Counter'),
         inquiry_note  = nullif(btrim(coalesce(p_note, '')), ''),
         inquiry_count = coalesce(inquiry_count, 0) + 1
   where id = p_job_id;

  -- to_status is not null on this table, so the event carries the status the
  -- job is actually in. Nothing moved — the note is what makes it readable.
  insert into public.repair_job_events (job_id, from_status, to_status, note, changed_by)
  values (
    p_job_id, v_status, v_status,
    coalesce(nullif(btrim(coalesce(p_note, '')), ''), 'Customer asked about this job'),
    auth.uid()
  );
end $$;

comment on function public.record_customer_inquiry(text, text) is
  'Marks a job as chased by its customer and writes the same fact into its history. Does not change priority — attention is shown to the technician, not enforced on the queue.';

/**
 * The technician has seen it.
 *
 * Only moves the marker forward, so acknowledging an old question can never
 * bury a newer one that arrived while the modal was open.
 */
create or replace function public.acknowledge_customer_inquiry(p_job_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    raise exception using errcode = '42501', message = 'Only staff can acknowledge a customer inquiry.';
  end if;

  update public.repair_jobs
     set inquiry_seen_at = greatest(now(), coalesce(inquiry_seen_at, now()))
   where id = p_job_id;
end $$;

comment on function public.acknowledge_customer_inquiry(text) is
  'Marks the outstanding customer inquiry on a job as seen by the bench.';

revoke all on function public.record_customer_inquiry(text, text) from public;
revoke all on function public.acknowledge_customer_inquiry(text) from public;
grant execute on function public.record_customer_inquiry(text, text) to authenticated;
grant execute on function public.acknowledge_customer_inquiry(text) to authenticated;