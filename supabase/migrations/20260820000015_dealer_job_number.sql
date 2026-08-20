-- ============================================================================
-- Mano Mobile — the dealer's own job number
--
-- Devices arrive from other shops with that shop's docket already on them, and
-- staff have to find the phone by the number the dealer quotes down the phone —
-- "where is 54000?" — not by our number.
--
-- Two shops can legitimately both use 54000, so the number is only unique
-- WITHIN a dealer. That is what the constraint below says, and it is the whole
-- point of keeping this in its own column rather than in `id`:
--
--   repair_jobs.id            stays globally unique and internal. It is what
--                             the barcode tag encodes, what every child table
--                             points at, and what a scan resolves.
--   repair_jobs.dealer_job_no the dealer's number, unique per dealer, shown
--                             and searchable alongside ours.
--
-- Making `id` composite instead would have meant adding dealer_id to nine
-- child tables and their foreign keys, and would have left a scanned "54000"
-- unable to say which dealer's job it is.
-- ============================================================================

alter table public.repair_jobs
  add column if not exists dealer_job_no text;

comment on column public.repair_jobs.dealer_job_no is
  'The job number on the originating dealer''s docket. NULL for our own walk-in jobs. Unique per dealer, not globally.';

-- NULLs compare as distinct in Postgres, so every in-house job can leave this
-- empty without tripping the constraint — exactly the behaviour wanted here.
do $$ begin
  alter table public.repair_jobs
    add constraint repair_jobs_dealer_job_no_unique unique (dealer_id, dealer_job_no);
exception when duplicate_object then null; end $$;

-- Staff search by the dealer's number far more often than they browse by it,
-- and the unique constraint's index is on (dealer_id, dealer_job_no) — no use
-- for a lookup that knows only the number.
create index if not exists repair_jobs_dealer_job_no_idx
  on public.repair_jobs (dealer_job_no)
  where dealer_job_no is not null;
