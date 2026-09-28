-- ============================================================================
-- Mano Mobile — a dealer portal key short enough to scan
--
-- 20260928000061 made the key 64 hex characters. Printed as a QR in the small
-- box on an A5 dealer invoice, a URL that long needs a dense code that most
-- phone cameras could not read. 32 hex characters is one random UUID — 122
-- bits, still far beyond guessing — and roughly halves the QR's density.
--
-- Any key already issued at 64 characters is replaced. Only invoices printed
-- in between carry the long key; those links stop working and a reprint gives
-- the new one.
-- ============================================================================

update public.repair_dealers
   set portal_token = replace(gen_random_uuid()::text, '-', '')
 where length(portal_token) > 32;

alter table public.repair_dealers
  alter column portal_token set default replace(gen_random_uuid()::text, '-', '');

create or replace function public.regenerate_dealer_portal_token(p_dealer_id bigint)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v text := replace(gen_random_uuid()::text, '-', '');
begin
  if not public.has_role('Admin'::staff_role) then
    raise exception using errcode = '42501', message = 'Only an Admin can reset a dealer''s portal link.';
  end if;
  update public.repair_dealers set portal_token = v where id = p_dealer_id;
  if not found then
    raise exception 'Dealer % not found.', p_dealer_id;
  end if;
  return v;
end $$;

grant execute on function public.regenerate_dealer_portal_token(bigint) to authenticated;
