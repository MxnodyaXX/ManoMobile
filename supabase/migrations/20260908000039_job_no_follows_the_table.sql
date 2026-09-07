-- ============================================================================
-- Mano Mobile — put the job counter back in step with the table
--
-- Empty repair_jobs and the next job still books in as RM-076, because the
-- number never came from the table. It comes from repair_job_no_seq, and a
-- sequence only moves forward: it has handed out 75 numbers, so the next one
-- is 76 whether or not those rows still exist. TRUNCATE ... RESTART IDENTITY
-- does not help either — that only restarts sequences OWNED BY a column, and
-- this one is standalone, reached through next_job_no().
--
-- ── Why this is a one-time correction and not a rule ────────────────────────
-- The obvious fix is a trigger: when the table goes empty, restart at 1. It
-- was written, and then deliberately dropped.
--
-- "A job number is never reused" is a property this shop should be able to
-- state without a footnote. It is printed on receipts, quoted down the phone,
-- and typed into the public /track page by customers. Making it conditional on
-- a table being empty turns it into a rule somebody has to remember in two
-- years, in exchange for convenience during a setup that happens once.
--
-- So the counter is corrected here, and the correction is repeatable by hand —
-- the same block lives in supabase/reset-transactions.sql for the next time
-- the test data is cleared. What it never does is rewind on its own.
-- ============================================================================

do $$
declare
  hi bigint;
begin
  -- max(), not count(): with RM-003 and RM-009 left and the rest deleted, the
  -- next number has to be 10, not 3.
  select coalesce(max(substring(id from 4)::bigint), 0)
    into hi
    from public.repair_jobs
   where id ~ '^RM-[0-9]+$';

  if hi = 0 then
    -- is_called = false, so the next number is 1 rather than 2.
    perform setval('public.repair_job_no_seq', 1, false);
    raise notice 'No repair jobs on file — the next one will be RM-001.';
  else
    perform setval('public.repair_job_no_seq', hi);
    raise notice 'Highest job on file is RM-%; the next one will follow it.', hi;
  end if;
end $$;
