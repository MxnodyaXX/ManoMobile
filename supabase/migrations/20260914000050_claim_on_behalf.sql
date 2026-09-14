-- ============================================================================
-- Mano Mobile — the counter can work the bench for the technician
--
-- A one-technician shop does not really have two sides. The phone is booked in
-- at the counter, carried three metres, and worked on by the same person who
-- was standing beside the cashier a minute ago — and asking that person to
-- walk back and press Start on a different screen is asking twice for one
-- fact. So the Admin Cashier can now drive the technician's bench.
--
-- ── The rule: the work is the technician's, the typing is the cashier's ────
-- Everything that matters keys off whose name is on the job: the labour rate
-- pre-filled at completion, revenue per technician, My Performance, the name
-- on the warranty. If the cashier's name lands on the work, all of that goes
-- wrong at once. So the job carries the technician; the audit trail carries
-- who actually pressed the button. Both are true, and both are kept.
--
-- ── What this changes ───────────────────────────────────────────────────────
-- claim_repair_job gains p_for. A technician still claims for themselves and
-- the parameter is ignored. An Admin, or an Admin Cashier, may name the
-- technician the job is being claimed for, and the event row records the
-- claimer as changed_by — the one person who can say "I pressed it".
--
-- Every other bench action already worked: updating a job, sending it to an
-- agent, requesting a part — a Cashier could write those since the lifecycle
-- tables were created. This was the one door still locked, because it minted
-- the technician's name from the caller's own profile.
-- ============================================================================

-- A new parameter is a new signature. Without this, Postgres would keep the
-- old one-argument function beside the new one, and every existing caller
-- would silently keep hitting the version that cannot claim for anybody else.
drop function if exists public.claim_repair_job(text);

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
         -- bench by the counter. The trigger reads this to say which.
         assignment_source = case when v_for = me then 'Self-Taken' else 'Assigned' end
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
