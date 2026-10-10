-- ============================================================================
-- Mano Mobile — estimated cost for repairs finished without a recorded cost
--
-- Hundreds of repairs were finished before parts were issued through the
-- system and before technician charges were recorded. Their revenue is real;
-- their cost is missing, so every one of them counted as 100% profit.
--
-- An Admin can now type a cost for any finished job — parts and technician
-- together, in one figure — and profit uses it for that job only:
--   * a job with an entered cost uses it in place of what was recorded (many
--     older jobs have a technician charge but parts never issued in the
--     system, so the record is only part of the cost);
--   * a job without one uses what was recorded (parts issued by tag plus the
--     technician charge).
-- Agent charges are already recorded on the agent transfers, so they are never
-- part of the estimate.
--
-- Kept in its own columns, with who entered it and when, so the reports can say
-- how much of the profit rests on estimates and the figures can be reviewed.
-- ============================================================================

alter table public.repair_jobs
  add column if not exists backfill_cost    numeric(12,2) check (backfill_cost is null or backfill_cost >= 0),
  add column if not exists backfill_cost_by uuid references auth.users (id) on delete set null,
  add column if not exists backfill_cost_at timestamptz;

comment on column public.repair_jobs.backfill_cost is
  'Admin-entered parts + technician cost for a finished job. When set, profit uses it in place of issued parts + labour_cost. Excludes agent charges.';

/**
 * Sets (or clears, with a null cost) the estimate on many jobs at once.
 * p_rows: [{ "job_id": "JOB-0123", "cost": 2500 }, ...]
 * Admin only. Returns how many jobs were changed.
 */
create or replace function public.set_repair_cost_estimates(p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r       jsonb;
  v_cost  numeric;
  v_count integer := 0;
begin
  if not public.has_role('Admin'::staff_role) then
    raise exception 'Only an Admin can enter estimated repair costs.' using errcode = '42501';
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Expected a list of { job_id, cost }.';
  end if;

  for r in select * from jsonb_array_elements(p_rows) loop
    v_cost := case when r->>'cost' is null or r->>'cost' = '' then null else round((r->>'cost')::numeric, 2) end;
    if v_cost is not null and v_cost < 0 then
      raise exception 'A cost cannot be negative (job %).', r->>'job_id';
    end if;

    update public.repair_jobs
       set backfill_cost    = v_cost,
           backfill_cost_by = case when v_cost is null then null else auth.uid() end,
           backfill_cost_at = case when v_cost is null then null else now() end
     where id = r->>'job_id'
       and backfill_cost is distinct from v_cost;
    if found then v_count := v_count + 1; end if;
  end loop;

  return v_count;
end $$;

revoke all on function public.set_repair_cost_estimates(jsonb) from public;
grant execute on function public.set_repair_cost_estimates(jsonb) to authenticated;
