-- ============================================================================
-- Credit reminder SMS — link sms_messages to the credit account it's about
--
-- sms_messages already has a nullable job_id, written by any SMS about a
-- repair job (see 20260816000004_sms_log.sql). A credit-balance reminder
-- isn't about a job — it's about a credit_accounts row — so this adds the
-- equivalent nullable column for that case, same shape: nullable (most SMS
-- rows are still unrelated to a credit account), on delete set null (losing
-- an account should not take its SMS history down with it).
--
-- Both the manual "Notify" button (CreditCustomers.tsx, AllCustomers.tsx,
-- via /api/sms/send) and the daily cron (/api/cron/credit-reminders) write
-- this column. The cron also reads it back, to dedupe "have we already
-- texted this account today" against sms_messages rows with a matching
-- account_id and purpose = 'credit-reminder'.
-- ============================================================================

alter table public.sms_messages
  add column if not exists account_id uuid references public.credit_accounts (id) on delete set null;

create index if not exists sms_messages_account_idx on public.sms_messages (account_id);

comment on column public.sms_messages.account_id is
  'Credit account this SMS was about (credit-reminder purpose), same idea as job_id for repair SMS. Null for anything else.';
