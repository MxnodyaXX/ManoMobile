-- ============================================================================
-- Mano Mobile — the old records, and the job numbers they bring with them
--
-- Completes 20260907000037, which could only add the enum value. Everything
-- here reads it.
--
-- ── Why a shop types its own job number here ────────────────────────────────
-- A backdated record is a row out of a job book, and that book already gave it
-- a number. The customer's receipt says RM-014; so should this. Every other
-- way in takes the next number from the sequence, and rightly — but a record
-- of the past that renumbers the past is no longer a record of it.
--
-- That opens a hole the sequence cannot see. Type RM-140 while the sequence
-- sits at 74, and nothing breaks today: it breaks in sixty-six repairs' time,
-- at a counter, when next_job_no() finally reaches 140 and every insert starts
-- failing on a duplicate key nobody can explain. The trigger below closes it by
-- dragging the sequence up to any explicit number it sees, so the collision
-- cannot be arranged in the first place.
-- ============================================================================

-- Backdated rows are a bounded historical import, not a growing share of the
-- table, so the index only covers them — same shape as the instant one.
create index if not exists repair_jobs_backdated_idx
  on public.repair_jobs (created_at desc)
  where creation_type = 'Backdated';

/**
 * The historical records, under a name of their own.
 *
 * A view over repair_jobs, exactly as instant_repair_jobs is: same rows, no
 * second copy to fall out of step. Useful for the one question that genuinely
 * needs the distinction — "how much of this year's figures is history we typed
 * in rather than work we did while the system was watching" — which is a
 * reporting question, not a reason for a second table.
 */
create or replace view public.past_repair_jobs with (security_invoker = true) as
select *
  from public.repair_jobs
 where creation_type = 'Backdated';

comment on view public.past_repair_jobs is
  'Repairs that happened before this system recorded them, entered afterwards with their own dates. A view over repair_jobs — a past record is an ordinary job that came in by a different door.';

grant select on public.past_repair_jobs to authenticated;

/**
 * Keep the sequence ahead of any job number typed by hand.
 *
 * Only fires on an id shaped like RM-<digits>, which is the only shape that
 * can ever collide with next_job_no(). setval to n makes the next generated
 * number n+1, so an imported RM-140 pushes the counter past it rather than
 * leaving a landmine for whoever is at the counter that day.
 *
 * greatest() so importing an OLD number — the ordinary case, RM-014 while the
 * sequence is at 74 — moves nothing.
 */
create or replace function public.tg_repair_jobs_keep_job_no_ahead()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  n bigint;
begin
  if new.id ~ '^RM-[0-9]+$' then
    n := substring(new.id from 4)::bigint;
    perform setval(
      'public.repair_job_no_seq',
      greatest(n, (select last_value from public.repair_job_no_seq))
    );
  end if;
  return new;
end $$;

drop trigger if exists trg_repair_jobs_keep_job_no_ahead on public.repair_jobs;
create trigger trg_repair_jobs_keep_job_no_ahead
  after insert on public.repair_jobs
  for each row execute function public.tg_repair_jobs_keep_job_no_ahead();

comment on function public.tg_repair_jobs_keep_job_no_ahead() is
  'Drags repair_job_no_seq up to any explicitly supplied RM- number, so a hand-typed job number can never collide with one the sequence issues later.';
