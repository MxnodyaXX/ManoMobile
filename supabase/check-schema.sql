-- ============================================================================
-- Mano Mobile — what has this database actually got?
--
-- NOT A MIGRATION. Read-only: it changes nothing, so run it whenever.
--
-- `invoice_documents` turning out not to exist is the sort of thing that
-- surfaces as a crash in a screen nobody opened for a week. The app assumes
-- the schema its migrations describe; where the database is behind, the
-- feature that needs the missing piece does not degrade, it breaks.
--
-- This lists every object the code expects and says which are missing, so the
-- answer is one query rather than an error at a counter. Anything marked
-- MISSING means the migration that adds it has not been run.
-- ============================================================================

with expected(kind, name, added_by) as (values
  -- ── Tables ────────────────────────────────────────────────────────────────
  ('table', 'repair_jobs',            '20260812000001 repair core'),
  ('table', 'repair_dealers',         '20260812000001 repair core'),
  ('table', 'repair_job_events',      '20260812000001 repair core'),
  ('table', 'repair_assignments',     '20260813000003 lifecycle'),
  ('table', 'repair_issued',          '20260813000003 lifecycle'),
  ('table', 'repair_non_issued',      '20260813000003 lifecycle'),
  ('table', 'repair_agents',          '20260813000003 lifecycle'),
  ('table', 'repair_agent_transfers', '20260813000003 lifecycle'),
  ('table', 'sms_messages',           '20260816000004 sms log'),
  ('table', 'sms_templates',          '20260816000004 sms log'),
  ('table', 'repair_parts',           '20260819000010 parts catalog'),
  ('table', 'repair_part_requests',   '20260819000010 parts catalog'),
  ('table', 'repair_parts_used',      '20260819000010 parts catalog'),
  ('table', 'email_messages',         '20260819000014 customer email'),
  ('table', 'email_templates',        '20260819000014 customer email'),
  ('table', 'sales',                  '20260901000011 sales'),
  ('table', 'invoice_documents',      '20260901000014 invoice documents'),
  ('table', 'credit_accounts',        '20260901000010 credit management'),
  ('table', 'credit_entries',         '20260901000010 credit management'),
  ('table', 'warranties',             '20260902000002 warranties'),
  ('table', 'warranty_claims',        '20260902000002 warranties'),
  ('table', 'cash_returns',           '20260904000023 cash returns'),
  ('table', 'app_settings',           '20260812000001 repair core'),
  ('table', 'receipt_templates',      '20260819000017 issue invoice templates'),

  -- ── Views ─────────────────────────────────────────────────────────────────
  ('view',  'v_credit_accounts',      '20260901000010 / 23 cash returns'),
  ('view',  'v_daily_cash',           '20260904000023 cash returns'),
  ('view',  'v_job_refunds',          '20260905000026 cash return job'),
  ('view',  'instant_repair_jobs',    '20260906000031 instant jobs'),
  ('view',  'past_repair_jobs',       '20260907000038 past records'),

  -- ── Functions ─────────────────────────────────────────────────────────────
  ('function', 'next_job_no',                   '20260812000001 repair core'),
  ('function', 'next_invoice_no',               '20260821000001 invoice numbers'),
  ('function', 'post_repair_balance_to_credit', '20260901000010 credit management'),
  ('function', 'next_cash_return_no',           '20260904000023 cash returns'),
  ('function', 'refund_repair_advance',         '20260904000023 cash returns'),
  ('function', 'record_dealer_cash_return',     '20260904000023 cash returns'),
  ('function', 'job_settles_in_cash',           '20260905000027 dealer split'),
  ('function', 'post_cash_return_to_dealer',    '20260905000027 dealer split'),
  ('function', 'track_job',                     '20260907000034 track settled'),
  ('function', 'tg_repair_jobs_keep_job_no_ahead', '20260907000038 past records'),

  -- ── Columns the newer screens read ────────────────────────────────────────
  ('column', 'app_settings.track_job_time',              '20260904000021 track job time'),
  ('column', 'repair_jobs.cash_return_amount',           '20260905000026 cash return job'),
  ('column', 'repair_jobs.rejob_of',                     '20260905000026 cash return job'),
  ('column', 'repair_jobs.device_unidentified_reason',   '20260906000028 unidentified'),
  ('column', 'repair_jobs.creation_type',                '20260906000031 instant jobs'),
  ('column', 'credit_entries.invoice_no',                '20260906000030 stamp invoice'),

  -- ── Enum values ───────────────────────────────────────────────────────────
  ('enum', 'credit_entry_kind.Refund',       '20260904000022 refund kind'),
  ('enum', 'completion_type.Cash Return',    '20260905000025 cash return type'),
  ('enum', 'job_creation_type.Normal',       '20260906000031 instant jobs'),
  ('enum', 'job_creation_type.Instant',      '20260906000031 instant jobs'),
  ('enum', 'job_creation_type.Backdated',    '20260907000037 backdated type'),

  -- ── Things with no object of their own ────────────────────────────────
  --
  -- Some migrations add no table, view or function — they replace a function
  -- body, insert a row, or change a publication. Those are checked by what
  -- they actually did, because otherwise they are invisible here and a
  -- database missing them looks complete.

  -- A credit account's status is NOT an enum. It is worked out inside
  -- v_credit_accounts by a CASE over the entries, which is why the values are
  -- checked by reading the view definition rather than pg_enum — asking
  -- pg_enum reports MISSING for something that was never a type.
  ('viewdef', 'v_credit_accounts:Overdue',  '20260906000029 restore status'),
  ('viewdef', 'v_credit_accounts:Settled',  '20260906000029 restore status'),

  -- Realtime is a publication membership, not a schema object. Without it the
  -- app works and simply stops updating between machines.
  ('realtime', 'repair_jobs',    '20260907000035 realtime publication'),
  ('realtime', 'repair_dealers', '20260907000035 realtime publication'),

  -- Message templates are rows.
  ('row', 'sms_templates.instant',          '20260907000032 instant sms'),
  ('row', 'sms_templates.instant_settled',  '20260907000033 instant settled sms')
)
select
  e.kind,
  e.name,
  case when present then 'ok' else 'MISSING' end as state,
  e.added_by
from expected e
cross join lateral (
  select case e.kind
    when 'table' then
      to_regclass('public.' || e.name) is not null
    when 'view' then
      to_regclass('public.' || e.name) is not null
    when 'function' then
      exists (
        select 1 from pg_proc p
          join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname = e.name
      )
    when 'column' then
      exists (
        select 1 from information_schema.columns c
         where c.table_schema = 'public'
           and c.table_name  = split_part(e.name, '.', 1)
           and c.column_name = split_part(e.name, '.', 2)
      )
    when 'enum' then
      exists (
        select 1 from pg_type t
          join pg_enum v on v.enumtypid = t.oid
         where t.typname = split_part(e.name, '.', 1)
           and v.enumlabel = substring(e.name from position('.' in e.name) + 1)
      )
    when 'viewdef' then
      to_regclass('public.' || split_part(e.name, ':', 1)) is not null
      and pg_get_viewdef(('public.' || split_part(e.name, ':', 1))::regclass)
          like '%' || split_part(e.name, ':', 2) || '%'
    when 'realtime' then
      exists (
        select 1 from pg_publication_tables
         where pubname = 'supabase_realtime'
           and schemaname = 'public'
           and tablename = e.name
      )
    when 'row' then
      to_regclass('public.sms_templates') is not null
      and exists (
        select 1 from public.sms_templates
         where event = split_part(e.name, '.', 2)
      )
    else false
  end as present
) chk
-- Missing first: the point of running this is to see what is not there.
order by (case when present then 1 else 0 end), e.kind, e.name;
