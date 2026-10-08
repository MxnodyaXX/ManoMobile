-- ============================================================================
-- Mano Mobile — how an agent's repair turned out, in the shop's own words
--
-- A transfer's status says where the device is: Sent (with the agent) or
-- Returned (back in the shop). The screens showed that word, "Returned", for a
-- device the agent had fully repaired — and in this shop "Return" means "could
-- not be repaired". So a finished repair read as a failed one.
--
-- outcome records what actually happened, with the same three words the
-- shop's own completions use:
--   Normal   repaired, and charged for
--   FOC      repaired free of charge
--   Return   could not be repaired
--
-- Older transfers carried this only as text in return_notes ("Repaired" /
-- "Returned unrepaired"); it is read back out of that below.
-- ============================================================================

alter table public.repair_agent_transfers
  add column if not exists outcome text check (outcome in ('Normal', 'FOC', 'Return'));

comment on column public.repair_agent_transfers.outcome is
  'How the agent''s repair ended: Normal (repaired, charged), FOC (repaired free), Return (could not repair). Null while the device is still out.';

update public.repair_agent_transfers
   set outcome = case
         when return_notes ilike 'Returned unrepaired%' then 'Return'
         when coalesce(actual_cost, 0) = 0 and return_notes ilike 'Repaired%' and actual_cost is not null then 'FOC'
         else 'Normal'
       end
 where status = 'Returned'
   and outcome is null;
