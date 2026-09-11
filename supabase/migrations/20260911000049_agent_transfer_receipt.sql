-- ============================================================================
-- Mano Mobile — taking a device back from an agent, and what it cost
--
-- A transfer could be sent and it could be closed, and that was all it knew.
-- agreed_cost held the number quoted before the device left; nothing recorded
-- what the workshop actually charged when it came back. Those are the same
-- number often enough that the difference was easy to ignore, and different
-- often enough that the shop was pricing repairs off a guess.
--
-- ── What is added ───────────────────────────────────────────────────────────
-- actual_cost   what the agent charged, entered when the device is received
-- received_by   who took it back in, so the bench can be asked about it later
--
-- agreed_cost is left exactly as it was. It is the quote, and keeping both is
-- the point: "agreed 3,500, charged 5,000" is a fact about that agent worth
-- being able to see, and one that is gone forever if the receipt overwrites
-- the quote.
--
-- ── Why the cost lives here and not on the job ──────────────────────────────
-- A job can go out more than once — back to the same agent for a rework, or to
-- a second agent when the first could not fix it. A column on repair_jobs
-- would hold whichever number was written last. The cost belongs to the
-- transfer, and the job's total is the sum of its transfers, which is what
-- v_job_agent_cost below gives every screen for free.
--
-- ── reason ──────────────────────────────────────────────────────────────────
-- Already nullable, and staying that way. Only the form insisted on it, and
-- the shop asked for that to stop: a technician who is standing at the counter
-- with the device in their hand should not have to write an essay to send it
-- three doors down.
-- ============================================================================

alter table public.repair_agent_transfers
  add column if not exists actual_cost numeric(12,2),
  add column if not exists received_by text;

comment on column public.repair_agent_transfers.agreed_cost is
  'What the agent quoted before the device left. Never overwritten on return.';
comment on column public.repair_agent_transfers.actual_cost is
  'What the agent actually charged, entered when the device is received back. Null while the device is still out.';
comment on column public.repair_agent_transfers.received_by is
  'Who took the device back in from the agent.';

-- Finding "everything still out" and "everything that came back" are the two
-- questions the agents screen asks, and both are status-first.
create index if not exists repair_agent_transfers_status_idx
  on public.repair_agent_transfers (status, sent_at desc);

-- ── What one job has cost in outside work ───────────────────────────────────
-- Summed over every transfer, so a device that went out twice reads as both.
-- actual_cost falls back to agreed_cost: a device received back before anyone
-- typed a figure is better described by the quote than by zero.
create or replace view public.v_job_agent_cost as
  select
    t.job_id,
    sum(coalesce(t.actual_cost, t.agreed_cost, 0))::numeric(12,2) as agent_cost,
    count(*)                                                       as transfer_count,
    max(t.returned_at)                                             as last_returned_at
  from public.repair_agent_transfers t
  where t.status = 'Returned'
  group by t.job_id;

comment on view public.v_job_agent_cost is
  'Outside-workshop cost per repair job, summed over its returned transfers. Added to parts and labour to give what a repair actually cost the shop.';
