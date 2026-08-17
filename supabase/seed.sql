-- ============================================================================
-- Mano Mobile — repair seed
--
--   supabase db reset      (runs automatically after migrations)
--   or paste into Dashboard → SQL Editor after the migrations
--
-- Contains NO sample repairs, customers or partner dealers. The only row here
-- is the shop itself, which is operational data rather than demo data: a job
-- with no external dealer prints a job receipt, and that decision is made by
-- looking up the in-house dealer. Everything else — dealers, technicians,
-- agents, jobs — is entered through the app.
--
-- Idempotent: safe to run more than once.
-- ============================================================================

insert into public.repair_dealers (name, address, contact, joined_at, remarks, in_house)
values ('MANO MOBILE CENTRE', '', '', current_date, 'The shop itself — walk-in customers.', true)
on conflict (lower(name)) do nothing;

-- Job numbers start at RM-001 for the first real intake.
select setval(
  'public.repair_job_no_seq',
  greatest((select coalesce(max(nullif(regexp_replace(id, '\D', '', 'g'), ''))::bigint, 0) from public.repair_jobs), 1),
  (select count(*) > 0 from public.repair_jobs)
);
