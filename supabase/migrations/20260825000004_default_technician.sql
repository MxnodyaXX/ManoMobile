-- ============================================================================
-- Mano Mobile — the main technician
--
-- Most shops have one person who does the bulk of the work, and every intake
-- ends up assigned to them anyway. Marking that once removes a decision from
-- every single repair taken in, instead of the cashier picking the same name a
-- hundred times a day.
--
-- It sets the DEFAULT on the intake form, not a rule. The cashier can still
-- assign somebody else, or nobody — Step 4 of the wizard remains skippable.
-- Making it compulsory would break the job pool, where unassigned jobs are the
-- whole point: a technician claims what they can take rather than having work
-- pushed at them.
--
-- Lives on staff_work_rules alongside the other per-person settings, so an
-- admin sets it in the same place they set everything else about that person.
-- ============================================================================

alter table public.staff_work_rules
  add column if not exists is_default_technician boolean not null default false;

comment on column public.staff_work_rules.is_default_technician is
  'True for the one technician new repairs are pre-assigned to on the intake form. At most one row may be true.';

-- At most one. A partial unique index rather than a trigger: the database
-- refuses a second default outright instead of quietly picking a winner.
create unique index if not exists staff_work_rules_one_default_technician
  on public.staff_work_rules (is_default_technician) where is_default_technician;

-- ── Switching it ────────────────────────────────────────────────────────────
-- Clearing the old default and setting the new one are two statements that
-- must not be seen apart. Done from the client they would momentarily leave
-- either zero defaults or two — and two is what the index above rejects, so
-- the wrong order fails outright.

create or replace function public.set_default_technician(p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_role('Admin'::staff_role) then
    raise exception 'Only an Admin can set the main technician';
  end if;

  update public.staff_work_rules
     set is_default_technician = false
   where is_default_technician
     and profile_id is distinct from p_profile_id;

  -- NULL clears the default without setting a new one, so a shop that stops
  -- having a main technician is not forced to nominate a replacement.
  if p_profile_id is not null then
    insert into public.staff_work_rules (profile_id, is_default_technician)
    values (p_profile_id, true)
    on conflict (profile_id) do update set is_default_technician = true;
  end if;
end $$;
