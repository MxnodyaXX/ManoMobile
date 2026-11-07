-- ============================================================================
-- Mano Mobile — a repair part remembers the names it used to have
--
-- Older finished jobs have no link to a part, only its name typed in
-- repair_jobs.parts_used ("M02 Display x2"), and their parts cost is found by
-- matching that text to the catalogue. Renaming a part would break the match:
-- those jobs would cost nothing and their profit would look higher than it was.
--
-- So every rename keeps the old name here, and the cost lookups try these when
-- no part has the name now. Done in a trigger, so it holds for every rename
-- however it is made, and job history itself is never rewritten.
-- ============================================================================

alter table public.repair_parts
  add column if not exists former_names text[] not null default '{}';

create or replace function public.repair_parts_keep_former_name()
returns trigger
language plpgsql
as $$
begin
  -- A change of capitals only still matches, since the lookups ignore case.
  if lower(btrim(new.name)) is distinct from lower(btrim(old.name))
     and not btrim(old.name) = any (new.former_names) then
    new.former_names := array_append(new.former_names, btrim(old.name));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_repair_parts_keep_former_name on public.repair_parts;
create trigger trg_repair_parts_keep_former_name
  before update of name on public.repair_parts
  for each row execute function public.repair_parts_keep_former_name();

comment on column public.repair_parts.former_names is
  'Names this part had before, kept by trigger so older jobs that typed the old name can still be costed.';
