-- ============================================================================
-- Repair completion type
--
-- A finished job is not always a successful, chargeable repair:
--
--   Normal  the repair was done and is charged as quoted
--   Return  the repair could not be done; the device goes back unrepaired
--   FOC     the repair was done, free of charge
--
-- All three end with the device leaving the bench and the customer collecting
-- it, so they share the Completed status. Without this column a returned device
-- and a successful repair are indistinguishable in the record, and both would
-- read as chargeable work in any report.
-- ============================================================================

do $$ begin
  create type completion_type as enum ('Normal', 'Return', 'FOC');
exception when duplicate_object then null; end $$;

alter table public.repair_jobs
  add column if not exists completion_type completion_type;

comment on column public.repair_jobs.completion_type is
  'How the job finished. Null until it is completed. Return = not repaired, FOC = repaired free of charge.';

-- Existing completed jobs predate the column; they were all ordinary repairs.
update public.repair_jobs
   set completion_type = 'Normal'
 where completion_type is null
   and status in ('Completed', 'Delivered');

alter table public.repair_assignments
  add column if not exists completion_type completion_type;

-- Keep the technician stage in step with the job.
create or replace function public.sync_completion_type()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.completion_type is not null then
    update public.repair_assignments
       set completion_type = new.completion_type
     where job_id = new.id;
  end if;
  return new;
end $$;

drop trigger if exists trg_repair_jobs_completion_type on public.repair_jobs;
create trigger trg_repair_jobs_completion_type
  after update of completion_type on public.repair_jobs
  for each row execute function public.sync_completion_type();
