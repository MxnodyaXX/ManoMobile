-- ============================================================================
-- Mano Mobile — a new repair job can never be handed a number already in use
--
-- "Could not create the repair job: duplicate key value violates unique
-- constraint repair_jobs_pkey". The job number comes from repair_job_no_seq
-- through next_job_no(), and the sequence had fallen behind the table: the
-- next number it gave out was one an existing job already had, so every
-- new intake failed until someone fixed the counter by hand.
--
-- Two things had been resetting it below the highest job number:
--   * supabase/renumber-jobs.sql set it to count(*) of the jobs — lower than
--     the highest RM number as soon as numbers have gaps;
--   * setting it by hand (reset scripts, restores) while jobs remained.
-- The insert trigger from 20260907000038 only drags the counter up when a
-- job is saved with a typed RM- number, so it couldn't catch either case.
--
-- So next_job_no() now steps past any number already on file. The sequence
-- still guarantees two tills never get the same number; this guarantees the
-- number isn't already taken. And the counter is put back in step once here.
-- ============================================================================

create or replace function public.next_job_no()
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v text;
begin
  loop
    -- Pad to 3 digits without truncating: lpad() alone turns 1006 into '100'.
    v := 'RM-' || (select case when length(x) >= 3 then x else lpad(x, 3, '0') end
                     from (select nextval('public.repair_job_no_seq')::text as x) s);
    exit when not exists (select 1 from public.repair_jobs where id = v);
    -- Taken: the counter is behind the table. Jump past the highest number
    -- on file rather than creeping through the gaps — a gap may be a deleted
    -- job whose number is already on somebody's receipt.
    perform setval('public.repair_job_no_seq', greatest(
      (select coalesce(max(substring(id from 4)::bigint), 0) from public.repair_jobs where id ~ '^RM-[0-9]+$'),
      (select last_value from public.repair_job_no_seq)));
  end loop;
  return v;
end $$;

comment on function public.next_job_no() is
  'Next RM-nnn job number from repair_job_no_seq, skipping any number a job already has — so a counter that fell behind the table can never cause a duplicate-key failure at intake.';

-- One-time resync: carry on from the highest RM number on file.
do $$
declare
  hi bigint;
begin
  select coalesce(max(substring(id from 4)::bigint), 0)
    into hi
    from public.repair_jobs
   where id ~ '^RM-[0-9]+$';

  if hi > 0 then
    perform setval('public.repair_job_no_seq',
                   greatest(hi, (select last_value from public.repair_job_no_seq)));
  end if;
end $$;
