-- ============================================================================
-- Mano Mobile — the claim function's assignment type, cast properly
--
-- 20260914000050 rewrote claim_repair_job to take p_for, and in doing so
-- changed
--
--     assignment_source = 'Self-Taken'
--
-- into
--
--     assignment_source = case when v_for = me then 'Self-Taken' else 'Assigned' end
--
-- A bare literal is of type unknown and Postgres coerces it to the column's
-- enum without comment. A CASE over literals resolves to text, and text is not
-- assigned to an enum column: "column assignment_source is of type
-- assignment_type but expression is of type text". plpgsql only type-checks a
-- statement when it first runs, so the function created cleanly and failed on
-- the first real claim — from the whole-shop bench, naming the technician.
--
-- The fix is the cast. Nothing else in the function changes; it is repeated
-- here in full because a function body cannot be patched in place.
-- ============================================================================

create or replace function public.claim_repair_job(p_job_id text, p_for text default null)
returns public.repair_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  me       text;
  v_for    text;
  holder   text;
  claimed  public.repair_jobs;
  is_admin boolean;
begin
  if not public.is_staff() then
    raise exception 'Not authorised to claim repairs';
  end if;

  me := public.my_staff_name();
  if me is null then
    raise exception 'Your profile has no name, so a job cannot be recorded against you';
  end if;

  is_admin := public.has_role('Admin'::staff_role) or public.is_admin_cashier();

  -- Whose bench the job lands on.
  --
  -- Only senior counter staff may name somebody else, and only a real
  -- technician may be named: "for" a name that is not on the roster would put
  -- a job on a bench nobody sits at.
  if p_for is not null and btrim(p_for) <> '' and btrim(p_for) <> me then
    if not is_admin then
      raise exception 'Only an Admin or an Admin Cashier can claim a repair for somebody else';
    end if;
    if not exists (
      select 1 from public.profiles p
       where p.role = 'Technician'::staff_role
         and p.status = 'Active'
         and btrim(p.full_name) = btrim(p_for)
    ) then
      raise exception '"%" is not an active technician', p_for;
    end if;
    v_for := btrim(p_for);
  else
    -- Claiming for yourself: the same permission the bench already reads.
    -- Admins are never limited by it.
    if not (public.has_role('Admin'::staff_role)
            or coalesce((select r.can_claim_unassigned
                           from public.staff_work_rules r
                          where r.profile_id = auth.uid()), true)) then
      raise exception 'You are not permitted to claim unassigned repairs';
    end if;
    v_for := me;
  end if;

  update public.repair_jobs j
     set technician        = v_for,
         -- Taken off the pile by the person who will do it, or put on their
         -- bench by the counter. The trigger reads this to say which. Cast on
         -- each arm: a CASE over bare literals is text, and text does not go
         -- into an enum column.
         assignment_source = case when v_for = me
                                  then 'Self-Taken'::assignment_type
                                  else 'Assigned'::assignment_type end
   where j.id = p_job_id
     -- Unassigned means both spellings: intake writes the literal, other paths
     -- leave it empty. Missing either one lets a claimed job be claimed again.
     and (j.technician is null
          or btrim(j.technician) = ''
          or lower(btrim(j.technician)) = 'unassigned')
     and j.status not in ('Completed', 'Delivered', 'Cancelled')
  returning * into claimed;

  if not found then
    select technician into holder from public.repair_jobs where id = p_job_id;
    if holder is null then
      raise exception 'That repair no longer exists.';
    end if;
    raise exception 'This repair has already been started by another technician (%).', holder;
  end if;

  -- changed_by is the login that pressed the button; technician_to is whose
  -- bench it went to. When they differ, the note says so in words as well,
  -- because the note is what the history screen shows.
  insert into public.repair_job_events (job_id, from_status, to_status, note, technician_to, changed_by)
  values (
    p_job_id, claimed.status, claimed.status,
    case when v_for = me then 'Claimed from the available pool'
         else format('Claimed from the available pool for %s by %s', v_for, me) end,
    v_for, auth.uid()
  );

  return claimed;
end $$;

comment on function public.claim_repair_job is
  'Atomically take an unassigned repair. Raises if somebody already holds it. An Admin or Admin Cashier may pass p_for to claim it onto a named technician''s bench; the event records who pressed the button.';

-- ── The same fault, lying dormant in reassign_repair_job ────────────────────
-- Written with the identical CASE-over-literals in 20260902000019. Nothing in
-- the app calls it yet, which is the only reason it has never failed. Fixed
-- here rather than found later by whoever wires up the Admin reassign button.
create or replace function public.reassign_repair_job(p_job_id text, p_to text)
returns public.repair_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  previous text;
  moved    public.repair_jobs;
begin
  if not public.has_role('Admin'::staff_role) then
    raise exception 'Only an Admin can reassign or release a repair';
  end if;

  select technician into previous from public.repair_jobs where id = p_job_id;
  if not found then
    raise exception 'That repair no longer exists.';
  end if;

  update public.repair_jobs
     set technician        = coalesce(nullif(btrim(p_to), ''), 'Unassigned'),
         -- Released work is claimable again; handed-over work was assigned.
         assignment_source = case when nullif(btrim(p_to), '') is null
                                  then 'Self-Taken'::assignment_type
                                  else 'Assigned'::assignment_type end
   where id = p_job_id
  returning * into moved;

  insert into public.repair_job_events (job_id, from_status, to_status, note, technician_from, technician_to, changed_by)
  values (
    p_job_id, moved.status, moved.status,
    case when nullif(btrim(p_to), '') is null
         then 'Released back to the available pool'
         else 'Reassigned by an Admin' end,
    previous, moved.technician, auth.uid());

  return moved;
end $$;

comment on function public.reassign_repair_job is
  'Admin-only. Null target releases the job to the pool; a name hands it over. Both are recorded with the previous holder.';
