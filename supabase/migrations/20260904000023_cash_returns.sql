-- ============================================================================
-- Mano Mobile — the cash-return ledger
--
-- One table for every rupee that leaves the till going back to somebody, with
-- the reason attached and a link to whatever it was for. See
-- 20260904000022 for why 'Refund' is its own credit_entry_kind.
--
-- ── Why a separate table rather than a negative sale ────────────────────────
-- An advance refund usually has no sale to be negative against. The customer
-- paid Rs. 5,000 at intake and the repair was abandoned before any invoice
-- existed; there is no INV- number for that money to hang off. Forcing one
-- would mean issuing an invoice for a sale that never happened.
--
-- So the money-out ledger stands on its own, carries its own CR- numbers, and
-- points at whichever of job / dealer / invoice / credit account applies. Every
-- report that wants net takings subtracts from it; nothing has to guess whether
-- a sale row is really a sale.
--
-- ── What stays behind ───────────────────────────────────────────────────────
-- The original advance is never edited. repair_jobs.advance_paid still says
-- Rs. 5,000 was received, because it was. The refund is a second, later fact.
-- A shop reconciling its drawer needs both halves; a system that "corrects" the
-- first one is telling it the money was never taken, which is not what happened
-- and does not match the receipt the customer is holding.
-- ============================================================================

create sequence if not exists public.cash_return_no_seq start 1;

create or replace function public.next_cash_return_no()
returns text
language sql
volatile
as $$
  select 'CR-' || lpad(nextval('public.cash_return_no_seq')::text, 6, '0')
$$;

comment on function public.next_cash_return_no is
  'Assigns and returns the next cash-return reference. Advances the sequence — call only when a return is actually being recorded.';

do $$ begin
  create type cash_return_kind as enum ('Advance Refund', 'Dealer Cash Return', 'Sale Refund');
exception when duplicate_object then null; end $$;

comment on type cash_return_kind is
  'Advance Refund: money taken at intake, given back. Dealer Cash Return: a billed job reversed off a dealer account. Sale Refund: an invoiced sale returned.';

create table if not exists public.cash_returns (
  id            uuid primary key default gen_random_uuid(),

  -- CR-000012. Its own series, deliberately not sharing the invoice sequence:
  -- a refund is not an invoice, and a gap in the invoice numbers is the kind
  -- of thing an auditor asks about.
  ref           text not null unique,

  kind          cash_return_kind not null,
  returned_on   date not null default current_date,

  -- Always positive, like credit_entries.amount. The direction is the table.
  amount        numeric(12,2) not null check (amount > 0),

  -- Not nullable and not blank. "Why was this money given back" is the entire
  -- point of the record; a refund with no reason is the thing this table
  -- exists to stop.
  reason        text not null check (btrim(reason) <> ''),

  -- How it physically went back: Cash, Bank Transfer, Card reversal.
  method        text,

  -- Whatever it relates to. All optional individually, but a return with none
  -- of them set is unattached money and is rejected below.
  job_id            text   references public.repair_jobs (id)    on delete set null,
  dealer_id         bigint references public.repair_dealers (id) on delete set null,
  credit_account_id uuid   references public.credit_accounts (id) on delete set null,
  -- The reversing entry this raised on that account, when it raised one.
  credit_entry_id   bigint references public.credit_entries (id) on delete set null,
  invoice_no        text,

  -- Who it went to, denormalised for the same reason credit_accounts denormalise:
  -- customers are not a table in this system.
  payee         text,
  payee_phone   text,

  recorded_by   uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint cash_returns_has_a_subject check (
    job_id is not null or dealer_id is not null
    or credit_account_id is not null or invoice_no is not null
  )
);

comment on table public.cash_returns is
  'Every rupee refunded out of the till, with its reason and what it was for. Reports subtract from this; nothing is ever deleted from it.';

create index if not exists cash_returns_returned_on_idx on public.cash_returns (returned_on desc);
create index if not exists cash_returns_job_idx     on public.cash_returns (job_id)    where job_id is not null;
create index if not exists cash_returns_dealer_idx  on public.cash_returns (dealer_id) where dealer_id is not null;
create index if not exists cash_returns_account_idx on public.cash_returns (credit_account_id) where credit_account_id is not null;

-- An advance can be given back once. Without this, two cashiers both told to
-- "refund the customer" hand out the advance twice and the drawer is short.
create unique index if not exists cash_returns_one_advance_per_job
  on public.cash_returns (job_id)
  where kind = 'Advance Refund' and job_id is not null;

drop trigger if exists trg_cash_returns_touch on public.cash_returns;
create trigger trg_cash_returns_touch
  before update on public.cash_returns
  for each row execute function public.touch_updated_at();

-- ── Marking the job ─────────────────────────────────────────────────────────
--
-- A date, not an amount. The amount lives in cash_returns and is read from
-- there; storing it twice is how a figure on a job and a figure in the ledger
-- end up disagreeing with nobody able to say which is right. The date is here
-- because the jobs list has to be able to show and filter "advance refunded"
-- without joining the ledger for every row.
alter table public.repair_jobs
  add column if not exists advance_refunded_on date;

comment on column public.repair_jobs.advance_refunded_on is
  'Set when the intake advance was given back. The amount, reason and reference are in cash_returns — this is the flag the jobs list reads.';

-- ============================================================================
-- Recording a return
-- ============================================================================

/**
 * Give a customer their advance back.
 *
 * One call does all of it: the ledger row, the flag on the job, and — where
 * the job had already been charged to somebody's credit account — the entry
 * that takes that charge back off. Split across the client this is three
 * writes that can each half-succeed, and the state in between is a shop that
 * has paid out money it has no record of.
 *
 * The advance itself is left exactly as it was. Rs. 5,000 was received; that
 * is still true after Rs. 5,000 is handed back.
 */
create or replace function public.refund_repair_advance(
  p_job_id text,
  p_amount numeric,
  p_reason text,
  p_method text default 'Cash'
)
returns public.cash_returns
language plpgsql
security definer
set search_path = public
as $$
declare
  j       public.repair_jobs;
  acct    uuid;
  entry   bigint;
  out_row public.cash_returns;
begin
  if not (public.has_role('Admin'::staff_role) or public.is_admin_cashier()) then
    raise exception 'Only an Admin or an admin cashier can refund an advance';
  end if;

  select * into j from public.repair_jobs where id = p_job_id;
  if not found then
    raise exception 'Repair job % does not exist.', p_job_id;
  end if;

  if coalesce(p_amount, 0) <= 0 then
    raise exception 'A refund must be for more than zero.';
  end if;

  -- The shop cannot give back more than it took. Anything beyond the advance
  -- is a different transaction and needs its own decision, not a typo here.
  if round(p_amount, 2) > round(coalesce(j.advance_paid, 0), 2) then
    raise exception 'Cannot refund % — only % was taken in advance on %.',
      round(p_amount, 2), round(coalesce(j.advance_paid, 0), 2), p_job_id;
  end if;

  if btrim(coalesce(p_reason, '')) = '' then
    raise exception 'A refund needs a reason.';
  end if;

  -- If this job had already been billed to a credit account, that charge is no
  -- longer owed: the work is not being done and the money has gone back.
  select e.account_id, e.id into acct, entry
    from public.credit_entries e
   where e.job_id = p_job_id and e.kind = 'Charge'
   limit 1;

  if acct is not null then
    insert into public.credit_entries (account_id, kind, amount, occurred_on, job_id, method, note, created_by)
    values (acct, 'Refund', round(p_amount, 2), current_date, p_job_id, p_method,
            'Advance refunded on ' || p_job_id || ' — ' || btrim(p_reason), auth.uid())
    returning id into entry;
  else
    entry := null;
  end if;

  insert into public.cash_returns (
    ref, kind, amount, reason, method,
    job_id, dealer_id, credit_account_id, credit_entry_id, invoice_no,
    payee, payee_phone, recorded_by
  )
  values (
    public.next_cash_return_no(), 'Advance Refund', round(p_amount, 2), btrim(p_reason), p_method,
    p_job_id, j.dealer_id, acct, entry, j.invoice_no,
    coalesce(nullif(btrim(j.customer_name), ''), 'Walk-in customer'), nullif(btrim(j.phone), ''), auth.uid()
  )
  returning * into out_row;

  update public.repair_jobs set advance_refunded_on = out_row.returned_on where id = p_job_id;

  return out_row;
end $$;

comment on function public.refund_repair_advance is
  'Refund an intake advance: writes the cash_returns row, flags the job, and reverses any credit charge the job had raised. Leaves advance_paid untouched.';

/**
 * Return cash to a repair dealer.
 *
 * Two effects, and they are the same event seen from two sides: the shop is
 * out the money, and the dealer no longer owes it. Both are written here so
 * they cannot come apart.
 *
 * p_job_id is optional but strongly wanted — it is what turns a line reading
 * "balance reduced by 8,500" into "Cash Return — RM-041", which is the
 * difference between a statement a dealer accepts and one they query.
 */
create or replace function public.record_dealer_cash_return(
  p_account_id uuid,
  p_amount numeric,
  p_reason text,
  p_job_id text default null,
  p_method text default 'Cash'
)
returns public.cash_returns
language plpgsql
security definer
set search_path = public
as $$
declare
  a       public.credit_accounts;
  entry   bigint;
  out_row public.cash_returns;
  note    text;
begin
  if not (public.has_role('Admin'::staff_role) or public.is_admin_cashier()) then
    raise exception 'Only an Admin or an admin cashier can record a cash return';
  end if;

  select * into a from public.credit_accounts where id = p_account_id;
  if not found then
    raise exception 'That credit account does not exist.';
  end if;

  if coalesce(p_amount, 0) <= 0 then
    raise exception 'A cash return must be for more than zero.';
  end if;

  if btrim(coalesce(p_reason, '')) = '' then
    raise exception 'A cash return needs a reason.';
  end if;

  -- The note is what the dealer reads on their statement, so it says what the
  -- money was and which job it belonged to rather than leaving the balance
  -- change unexplained.
  note := 'Cash Return'
       || case when p_job_id is not null then ' — ' || p_job_id else '' end
       || ' — ' || btrim(p_reason);

  insert into public.credit_entries (account_id, kind, amount, occurred_on, job_id, method, note, created_by)
  values (p_account_id, 'Refund', round(p_amount, 2), current_date, p_job_id, p_method, note, auth.uid())
  returning id into entry;

  insert into public.cash_returns (
    ref, kind, amount, reason, method,
    job_id, dealer_id, credit_account_id, credit_entry_id,
    payee, payee_phone, recorded_by
  )
  values (
    public.next_cash_return_no(), 'Dealer Cash Return', round(p_amount, 2), btrim(p_reason), p_method,
    p_job_id, a.dealer_id, p_account_id, entry,
    a.name, a.phone, auth.uid()
  )
  returning * into out_row;

  return out_row;
end $$;

comment on function public.record_dealer_cash_return is
  'Return cash to a dealer: reduces their credit balance with an explained Refund entry and records the money out in cash_returns.';

-- ============================================================================
-- Reporting
-- ============================================================================

-- Refunds already reduce the balance, since it is charges minus everything
-- else. What the view could not do is say how much of the reduction was money
-- handed back rather than money received — the difference between a dealer who
-- paid and one whose work was returned.
--
-- Dropped and recreated rather than replaced: CREATE OR REPLACE VIEW can only
-- append columns at the end, and total_refunded belongs beside the other three
-- totals it is read with, not stranded after `status`. Safe here because
-- nothing in the database selects from this view — it is read over PostgREST —
-- so a plain DROP (no CASCADE, which would silently take dependents with it)
-- either succeeds or tells us something now depends on it.
drop view if exists public.v_credit_accounts;

create view public.v_credit_accounts with (security_invoker = true) as

select
  a.id, a.holder_kind, a.name, a.phone, a.nic, a.email, a.address, a.dealer_id,
  a.credit_limit, a.terms_days, a.auto_opened, a.notes, a.opened_by,
  a.created_at, a.updated_at,
  coalesce(sum(e.amount) filter (where e.kind = 'Charge'),    0) as total_charged,
  coalesce(sum(e.amount) filter (where e.kind = 'Payment'),   0) as total_paid,
  coalesce(sum(e.amount) filter (where e.kind = 'Write-off'), 0) as total_written_off,
  coalesce(sum(e.amount) filter (where e.kind = 'Refund'),    0) as total_refunded,
  coalesce(sum(e.amount) filter (where e.kind = 'Charge'), 0)
    - coalesce(sum(e.amount) filter (where e.kind <> 'Charge'), 0) as balance,
  min(e.occurred_on) filter (where e.kind = 'Charge')  as first_charge_on,
  max(e.occurred_on) filter (where e.kind = 'Payment') as last_payment_on,
  count(*) filter (where e.kind = 'Charge')            as charge_count,
  case
    when coalesce(sum(e.amount) filter (where e.kind = 'Charge'), 0)
       - coalesce(sum(e.amount) filter (where e.kind <> 'Charge'), 0) <= 0.005 then 'Settled'
    when a.credit_limit > 0
     and coalesce(sum(e.amount) filter (where e.kind = 'Charge'), 0)
       - coalesce(sum(e.amount) filter (where e.kind <> 'Charge'), 0) > a.credit_limit then 'Over limit'
    when min(e.occurred_on) filter (where e.kind = 'Charge') + a.terms_days < current_date then 'Overdue'
    else 'Current'
  end as status
from public.credit_accounts a
left join public.credit_entries e on e.account_id = a.id
group by a.id;

comment on view public.v_credit_accounts is
  'Credit accounts with their balance worked out from the entries. total_refunded separates money handed back from money received.';

/**
 * Net takings for a day, with returns already subtracted.
 *
 * The point of this view is that no screen has to remember to subtract. A
 * report that reads sales alone overstates a day with a refund in it by the
 * full refunded amount, and the person reading it has no way to tell.
 */
create or replace view public.v_daily_cash with (security_invoker = true) as
with taken as (
  select sold_on as on_date,
         sum(total) filter (where status = 'Paid')     as sales_total,
         sum(coalesce(returned_amount, 0))             as sale_returns,
         count(*) filter (where status = 'Paid')       as sale_count
    from public.sales
   group by sold_on
),
given_back as (
  select returned_on as on_date,
         sum(amount)                                                 as cash_returned,
         sum(amount) filter (where kind = 'Advance Refund')          as advance_refunds,
         sum(amount) filter (where kind = 'Dealer Cash Return')      as dealer_returns,
         count(*)                                                    as return_count
    from public.cash_returns
   group by returned_on
)
select
  coalesce(t.on_date, g.on_date)              as on_date,
  coalesce(t.sales_total, 0)                  as sales_total,
  coalesce(t.sale_returns, 0)                 as sale_returns,
  coalesce(t.sale_count, 0)                   as sale_count,
  coalesce(g.cash_returned, 0)                as cash_returned,
  coalesce(g.advance_refunds, 0)              as advance_refunds,
  coalesce(g.dealer_returns, 0)               as dealer_returns,
  coalesce(g.return_count, 0)                 as return_count,
  coalesce(t.sales_total, 0)
    - coalesce(t.sale_returns, 0)
    - coalesce(g.cash_returned, 0)            as net_takings
from taken t
full outer join given_back g on g.on_date = t.on_date;

comment on view public.v_daily_cash is
  'Takings per day with sale returns and cash returns already deducted. net_takings is the figure that belongs in a revenue report.';

-- ============================================================================
-- Access
-- ============================================================================

alter table public.cash_returns enable row level security;

-- Everyone who can see the money can see what went back out. A refund hidden
-- from the people reading the sales figures is exactly how it gets missed.
drop policy if exists cash_returns_read on public.cash_returns;
create policy cash_returns_read on public.cash_returns
  for select to authenticated
  using (public.is_staff());

-- Written only through the two functions above, which are SECURITY DEFINER and
-- do their own permission check. No direct insert: a bare insert would skip the
-- credit entry and the flag on the job, leaving exactly the half-recorded state
-- this table exists to prevent.
drop policy if exists cash_returns_write on public.cash_returns;

-- Nothing is ever edited or removed. A refund that was wrong is corrected by
-- recording what actually happened next, the same way the rest of this ledger
-- works — an amended history is not a history.
drop policy if exists cash_returns_update on public.cash_returns;
drop policy if exists cash_returns_delete on public.cash_returns;

-- Re-granted because the view was dropped above, and a dropped object takes
-- its grants with it. Supabase's default privileges would cover a newly
-- created view anyway; saying it here means the migration does not depend on
-- that being configured.
grant select on public.v_credit_accounts to authenticated;

grant select on public.cash_returns to authenticated;
grant select on public.v_daily_cash to authenticated;
grant execute on function public.refund_repair_advance(text, numeric, text, text) to authenticated;
grant execute on function public.record_dealer_cash_return(uuid, numeric, text, text, text) to authenticated;
