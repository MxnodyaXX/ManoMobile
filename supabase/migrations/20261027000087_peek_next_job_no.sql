-- ============================================================================
-- Mano Mobile — the intake form's "next job number" preview, read properly
--
-- The preview took the highest job id by sorting the ids as text. That works
-- while every number has three digits; once RM-1000 exists it doesn't — as
-- text, "RM-999" sorts after "RM-1006", so the form would keep previewing
-- RM-1000 forever. It also ignored the counter itself, which can be ahead of
-- the table (numbers burned by failed saves).
--
-- This answers the question the way next_job_no() will: the counter's next
-- value, stepped past any number already on file. It only looks — nothing is
-- reserved, the counter does not move.
-- ============================================================================

create or replace function public.peek_next_job_no()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  n  bigint;
  hi bigint;
begin
  select case when is_called then last_value + 1 else last_value end
    into n
    from public.repair_job_no_seq;

  select coalesce(max(substring(id from 4)::bigint), 0)
    into hi
    from public.repair_jobs
   where id ~ '^RM-[0-9]+$';

  -- Same rule as next_job_no(): never a number already taken.
  if exists (select 1 from public.repair_jobs where id = 'RM-' || case when n >= 100 then n::text else lpad(n::text, 3, '0') end) then
    n := greatest(n, hi + 1);
  end if;

  return 'RM-' || case when n >= 100 then n::text else lpad(n::text, 3, '0') end;
end $$;

grant execute on function public.peek_next_job_no() to authenticated;

comment on function public.peek_next_job_no() is
  'The job number the next intake will most likely get (counter''s next value, past any taken number). A preview only — reserves nothing.';
