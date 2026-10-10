-- ============================================================================
-- Mano Mobile — one open warranty claim per phone
--
-- A phone already under a claim (at the company, on the bench, waiting to be
-- collected) could be claimed again from the Warranty Center, opening a second
-- repair job or sending it "to the company" twice. The counter now shows the
-- open claim instead of offering a new one; this makes the database refuse
-- it too, so two cashiers at once cannot both get through.
--
-- A trigger rather than a unique index, so claims already duplicated before
-- this do not stop it being applied — they can be closed by hand. A claim
-- that is Completed or Rejected never blocks: a phone repaired under warranty
-- can come back with a different fault and be claimed again.
-- ============================================================================

create or replace function public.tg_one_open_device_claim()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  other text;
begin
  if new.status in ('Completed', 'Rejected') then
    return new;
  end if;

  select id into other
    from public.device_warranty_claims
   where imei = new.imei
     and id is distinct from new.id
     and status not in ('Completed', 'Rejected')
   limit 1;

  if other is not null then
    raise exception 'IMEI % already has an open warranty claim (%). Finish or close that claim first.', new.imei, other
      using errcode = '23505';
  end if;
  return new;
end $$;

drop trigger if exists trg_one_open_device_claim on public.device_warranty_claims;
create trigger trg_one_open_device_claim
  before insert or update of status, imei on public.device_warranty_claims
  for each row execute function public.tg_one_open_device_claim();
