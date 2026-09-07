-- ============================================================================
-- Mano Mobile — the job that was already done
--
-- Four customers at the counter, each with a five-minute fault. The shop fixes
-- them while they wait and writes them up afterwards. Put through the normal
-- flow that means creating a job, assigning a technician, having the
-- technician accept it, start it, finish it, and only then billing it — six
-- steps recording a sequence that never happened, while four people watch.
--
-- So there is a second way in. What there is NOT is a second kind of job.
--
-- ── Why this is a column and a view, not a table ────────────────────────────
-- The brief asked for an instant_repair_jobs table as an "identification
-- layer", and immediately after that for every real fact to keep flowing into
-- the existing tables. Those two together mean the new table would hold one
-- boolean per job and nothing else — and a boolean kept in a second table is a
-- boolean that can disagree with the row it describes. A job deleted here and
-- not there, or flagged there and not here, and no way to say which is right.
--
-- The column carries it, and `instant_repair_jobs` below is a view giving that
-- name to exactly the rows it would have held. Anything written against the
-- table name works; nothing can drift, because there is only one copy.
--
-- ── What an Instant Job is, in the data ─────────────────────────────────────
-- A repair_jobs row like any other: status Completed, a technician, a final
-- cost, its parts in part_requests, its stock already deducted, ready for the
-- cashier to invoice. Sales, repair income, technician reports, dealer
-- accounts, customer history and IMEI-based re-job detection all read it
-- without being told it is special, because it is not.
-- ============================================================================

do $$ begin
  create type job_creation_type as enum ('Normal', 'Instant');
exception when duplicate_object then null; end $$;

comment on type job_creation_type is
  'How a job entered the system. Normal: booked in, then worked on. Instant: repaired first, written up after.';

alter table public.repair_jobs
  add column if not exists creation_type job_creation_type not null default 'Normal';

comment on column public.repair_jobs.creation_type is
  'How the job entered the system, not what kind of repair it is. Instant jobs are ordinary completed repairs that skipped the assignment and progress steps because the work was already finished.';

-- Instant jobs are a small slice of the table and the only thing anyone filters
-- this column for, so the index only covers them.
create index if not exists repair_jobs_instant_idx
  on public.repair_jobs (created_at desc)
  where creation_type = 'Instant';

/**
 * The instant jobs, under the name the brief asked for.
 *
 * A view rather than a table: same rows, no second copy to keep in step. It
 * carries the whole job, not an id and a flag, so anything reading it gets the
 * repair itself rather than a pointer back to one.
 */
create or replace view public.instant_repair_jobs with (security_invoker = true) as
select *
  from public.repair_jobs
 where creation_type = 'Instant';

comment on view public.instant_repair_jobs is
  'Repairs entered after the work was done. A view over repair_jobs, not a separate store — an Instant Job is an ordinary completed job that came in by a different door.';

grant select on public.instant_repair_jobs to authenticated;
