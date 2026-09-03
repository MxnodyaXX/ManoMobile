-- ============================================================================
-- Mano Mobile — claiming an unassigned repair, safely
--
-- How work reaches a technician needs no shop-wide setting: picking somebody at
-- intake sends the job to them, and leaving it blank offers it to everyone.
-- That is already how the data behaves — a job carries a technician name and an
-- assignment_type of Assigned or Self-Taken, and the bench shows what nobody
-- holds.
--
-- What was missing is any protection on the taking, and any record of it.
--
-- ── The race this closes ────────────────────────────────────────────────────
-- Claiming was a read-modify-write from the browser: read the job, see no
-- technician, write your name. Two technicians with the pool open both read
-- "unassigned" and both write, and the second silently overwrites the first.
-- Nothing in the UI can fix that, because by the time either request is sent
-- both have already decided.
--
-- claim_repair_job() below is a single conditional UPDATE. The WHERE clause is
-- the check, so the database decides the winner and the loser is told plainly
-- rather than discovering it later when the phone is not on their bench.
-- ============================================================================

-- ── Assignment history ──────────────────────────────────────────────────────
--
-- repair_job_events already records every status change, by trigger, so it
-- cannot be skipped. Assignment moves are a different axis — a job can change
-- hands without changing status — so the two names ride alongside.
alter table public.repair_job_events
  add column if not exists technician_from text;
alter table public.repair_job_events
  add column if not exists technician_to   text;

comment on column public.repair_job_events.technician_to is
  'Who holds the job after this event. Set on claim, release and reassignment; null on a plain status change.';

/**
 * The name this session works under, for stamping onto a job.
 *
 * Jobs record their technician by name — the same weakness noted in
 * lib/repair/technicians.ts — so claiming has to resolve the signed-in user to
 * the name their queue filters on, not to their id.
 */
create or replace function public.my_staff_name()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select nullif(btrim(p.full_name), '')
    from public.profiles p
   where p.id = auth.uid()
$$;

/**
 * Take an unassigned job, atomically.
 *
 * Returns the row on success. Raises when the job is already held, so the
 * caller cannot mistake "somebody else got it" for "it worked" — a silent
 * failure here means two people carrying the same phone around.
 *
 * The guard is the WHERE clause, not a preceding SELECT: between a check and a
 * write there is always room for the other technician's write, and this is
 * precisely the case where two people are looking at the same list.
 */
create or replace function public.claim_repair_job(p_job_id text)
returns public.repair_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  me      text;
  holder  text;
  claimed public.repair_jobs;
begin
  if not public.is_staff() then
    raise exception 'Not authorised to claim repairs';
  end if;

  -- Same permission the bench already reads. Admins are never limited by it.
  if not (public.has_role('Admin'::staff_role)
          or coalesce((select r.can_claim_unassigned
                         from public.staff_work_rules r
                        where r.profile_id = auth.uid()), true)) then
    raise exception 'You are not permitted to claim unassigned repairs';
  end if;

  me := public.my_staff_name();
  if me is null then
    raise exception 'Your profile has no name, so a job cannot be recorded against you';
  end if;

  update public.repair_jobs j
     set technician        = me,
         assignment_source = 'Self-Taken'
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

  insert into public.repair_job_events (job_id, from_status, to_status, note, technician_to, changed_by)
  values (p_job_id, claimed.status, claimed.status, 'Claimed from the available pool', me, auth.uid());

  return claimed;
end $$;

comment on function public.claim_repair_job is
  'Atomically take an unassigned repair. Raises if somebody already holds it.';

/**
 * Put a job back in the pool, or hand it to somebody else.
 *
 * Admin only. A technician who cannot finish a job asks; they do not take each
 * other's work, and they do not quietly drop it either — both moves are
 * recorded with the name that held it before.
 *
 * Passing null for p_to releases; passing a name reassigns.
 */
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
                                  then 'Self-Taken' else 'Assigned' end
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

-- ── Enforcement ─────────────────────────────────────────────────────────────
--
-- A technician may work on their own jobs and on unclaimed ones. They may not
-- edit a repair somebody else is holding — the spec's requirement, and the
-- reason claiming is worth anything at all.
--
-- REPLACES jobs_update rather than sitting beside it: permissive policies OR
-- together, so an extra policy here would grant exactly what the old one
-- already granted and enforce nothing. The Admin and Cashier arms are carried
-- over unchanged.
drop policy if exists jobs_update on public.repair_jobs;
create policy jobs_update on public.repair_jobs
  for update to authenticated
  using (
    public.module_can_write('Repairs')
    and (
      public.has_role('Admin'::staff_role, 'Cashier'::staff_role)
      or (
        public.has_role('Technician'::staff_role)
        and (
          technician is null
          or btrim(technician) = ''
          or lower(btrim(technician)) = 'unassigned'
          or technician = public.my_staff_name()
        )
      )
    )
  )
  with check (
    public.module_can_write('Repairs')
    and (
      public.has_role('Admin'::staff_role, 'Cashier'::staff_role)
      -- A technician's write must leave the job theirs. Without this they could
      -- pass their own job to somebody else, which is the Admin's call.
      or (public.has_role('Technician'::staff_role) and technician = public.my_staff_name())
    )
  );
