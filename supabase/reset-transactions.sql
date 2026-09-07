-- ============================================================================
-- Mano Mobile — clear the trading data, keep the shop
--
-- NOT A MIGRATION. It lives outside supabase/migrations/ on purpose so that
-- nothing ever runs it for you. Paste it into the SQL editor when you mean it.
--
-- ⚠  THIS DELETES EVERY REPAIR, SALE, INVOICE AND LEDGER ENTRY.
--    Take a backup first. There is no undo.
--
-- ── What it is for ──────────────────────────────────────────────────────────
-- The cut-over from testing to trading. Months of made-up repairs and invoices
-- are in the tables; the dealers, technicians, parts catalogue, price lists,
-- templates and staff accounts around them are real and were set up once.
-- This clears the first and keeps the second.
--
-- ── Why deleting only the jobs is not enough ────────────────────────────────
-- Every foreign key onto repair_jobs is `on delete cascade` or `on delete set
-- null`, so wiping the jobs takes the assignments, part requests, warranties
-- and job events with them — and leaves the sales, credit entries and cash
-- returns behind with their job_id blanked. The books then show test invoices
-- with nothing behind them, which is worse than either extreme: it looks like
-- real trading whose paperwork went missing.
--
-- ── What survives ───────────────────────────────────────────────────────────
--   repair_dealers, repair_agents, repair_parts, device_models, device_faults
--   accessory_* (catalogue and stock), credit_accounts (emptied, not removed)
--   profiles, role_module_access, staff_work_rules
--   app_settings, appearance_settings, and every template
-- ============================================================================

begin;

-- Money and paperwork first: these reference jobs with `set null`, so deleting
-- the jobs would orphan them rather than remove them.
delete from public.cash_returns;
delete from public.credit_entries;      -- credit_accounts stay, at zero
delete from public.invoice_documents;
delete from public.sales;

-- Message logs. Not books, but they name jobs and customers that are going.
delete from public.sms_messages;
delete from public.email_messages;

-- The jobs, and everything that cascades from them: assignments, issued /
-- non-issued records, job events, part requests, parts used, warranties and
-- their claims.
delete from public.repair_jobs;

-- ── The counters ────────────────────────────────────────────────────────────
--
-- Sequences do not follow their tables — that is the whole reason a wiped
-- database still books in at RM-076. is_called = false so the next value is 1
-- rather than 2.
select setval('public.repair_job_no_seq',     1, false);
select setval('public.invoice_no_seq',        1, false);
select setval('public.cash_return_no_seq',    1, false);
select setval('public.warranty_no_seq',       1, false);
select setval('public.warranty_claim_no_seq', 1, false);

-- Read the counts before committing. Every one of these should be 0.
select
  (select count(*) from public.repair_jobs)    as jobs,
  (select count(*) from public.sales)          as sales,
  (select count(*) from public.credit_entries) as credit_entries,
  (select count(*) from public.cash_returns)   as cash_returns;

commit;
-- rollback;  -- ← swap for the commit above if the counts are not what you expect
