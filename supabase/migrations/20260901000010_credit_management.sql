-- ============================================================================
-- Mano Mobile — credit management
--
-- Credit already existed in this app five times over, and not once for real:
-- a "Credit Customers" screen under Customer Management, plus a credit-customer
-- picker embedded separately in Mobile, Accessory, Other and Repair Sales. Each
-- held its own useState([]). A customer put on account at the mobile counter did
-- not exist at the accessory counter, did not appear on the credit screen, and
-- was gone on refresh. The shop could hand a phone over on credit and have no
-- record of it anywhere.
--
-- This is the one place that owes money is recorded.
--
-- ── The shape ───────────────────────────────────────────────────────────────
--   credit_accounts   who owes: a walk-in customer, or a repair dealer.
--   credit_entries    every charge, payment and write-off against an account.
--   v_credit_accounts an account with its balance and status worked out.
--
-- A balance is never stored. It is the sum of the entries, so it cannot drift
-- from the history that explains it — the failure mode of every hand-maintained
-- balance column is that the two stop agreeing and nobody can say which is right.
--
-- ── Repair balances post themselves ─────────────────────────────────────────
-- When a job is marked Delivered with money still outstanding, a charge appears
-- on the holder's account automatically (see post_repair_balance_to_credit).
-- Nothing leaves the shop unpaid without being written down. That is a
-- deliberate trade: it means accounts get opened by the system rather than by a
-- person, so those are flagged auto_opened with a zero credit limit — the
-- account exists to record a debt, never to authorise a further one.
-- ============================================================================

-- ── Matching a walk-in ──────────────────────────────────────────────────────
--
-- Customers have no table in this system; they exist as a name and a phone
-- number on each repair job. The number is the only thing stable enough to
-- recognise somebody by, and it is typed by hand at the counter — "0777 537383",
-- "0777537383" and "+94777537383" are one person. This strips it down to the
-- digits that identify them, so the account lookup and the uniqueness index
-- agree about who is who.
create or replace function public.normalise_phone(p text)
returns text
language sql
immutable
as $$
  select nullif(
           regexp_replace(
             -- A Sri Lankan number written internationally: +94 77 ... is the
             -- same subscriber as 077 ....
             regexp_replace(coalesce(p, ''), '^\+?94', '0'),
             '[^0-9]', '', 'g'),
           '')
$$;

comment on function public.normalise_phone is
  'Digits-only form of a phone number, with +94 folded to a leading 0, for matching a customer typed in twice.';

do $$ begin
  create type credit_holder_kind as enum ('Customer', 'Dealer');
exception when duplicate_object then null; end $$;

do $$ begin
  -- Charge adds to what is owed; Payment is money received; Write-off clears a
  -- balance the shop has given up on. Write-off is separate from Payment on
  -- purpose — rolled together, the takings would include money nobody paid.
  create type credit_entry_kind as enum ('Charge', 'Payment', 'Write-off');
exception when duplicate_object then null; end $$;

-- ── Accounts ────────────────────────────────────────────────────────────────

create table if not exists public.credit_accounts (
  id           uuid primary key default gen_random_uuid(),
  holder_kind  credit_holder_kind not null,

  -- Denormalised on purpose. A dealer's account keeps naming them after the
  -- dealer row is edited or removed, and a walk-in has no row to point at:
  -- customers live on repair_jobs in this system, not in a table of their own.
  name         text not null check (btrim(name) <> ''),
  phone        text,
  nic          text,
  email        text,
  address      text,

  -- Set for holder_kind = 'Dealer'. One account per dealer, enforced below.
  dealer_id    bigint references public.repair_dealers (id) on delete set null,

  -- What they may run up. 0 means no approved credit — the account can still
  -- carry a balance (an unpaid handover has to be recorded somewhere), it just
  -- shows as over limit, which is exactly what it is.
  credit_limit numeric(12,2) not null default 0 check (credit_limit >= 0),

  -- Days from a charge until it counts as overdue.
  terms_days   integer not null default 30 check (terms_days >= 0),

  -- True when this account was opened by the system to hold an unpaid handover
  -- rather than by somebody deciding to extend credit. Worth seeing on screen:
  -- the two mean very different things about the shop's exposure.
  auto_opened  boolean not null default false,

  notes        text,
  opened_by    uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.credit_accounts is
  'Who owes the shop money — a walk-in customer or a repair dealer. Balances are not stored here; see v_credit_accounts.';

-- One account per dealer. Two accounts for Phone House means two balances and
-- no way to tell which one the statement should be run from.
create unique index if not exists credit_accounts_one_per_dealer
  on public.credit_accounts (dealer_id)
  where dealer_id is not null;

-- A phone number is how a walk-in is recognised at the counter, so the same
-- number cannot open two accounts. Blank numbers are exempt: several different
-- people can genuinely have no number on file.
create unique index if not exists credit_accounts_one_per_customer_phone
  on public.credit_accounts (public.normalise_phone(phone))
  where holder_kind = 'Customer' and phone is not null and btrim(phone) <> '';

create index if not exists credit_accounts_kind_idx on public.credit_accounts (holder_kind);

drop trigger if exists trg_credit_accounts_touch on public.credit_accounts;
create trigger trg_credit_accounts_touch
  before update on public.credit_accounts
  for each row execute function public.touch_updated_at();

-- ── Entries ─────────────────────────────────────────────────────────────────

create table if not exists public.credit_entries (
  id          bigserial primary key,
  account_id  uuid not null references public.credit_accounts (id) on delete cascade,
  kind        credit_entry_kind not null,

  -- Always positive. Which way it moves the balance is the kind's job — a
  -- signed amount plus a kind gives two ways to say the same thing and
  -- eventually they disagree.
  amount      numeric(12,2) not null check (amount > 0),

  occurred_on date not null default current_date,
  due_on      date,

  -- What this entry is for. job_id is set on charges that came from a repair.
  job_id      text references public.repair_jobs (id) on delete set null,
  invoice_no  text,
  method      text,
  note        text,

  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);

comment on table public.credit_entries is
  'Every movement on a credit account. The account balance is the sum of these and is never stored separately.';

-- A repair can be charged to an account once. The handover path and the
-- Delivered trigger can both fire for the same job; without this, a job that
-- was re-saved would be billed twice and the customer would be chased for money
-- they never owed.
create unique index if not exists credit_entries_one_charge_per_job
  on public.credit_entries (job_id)
  where kind = 'Charge' and job_id is not null;

create index if not exists credit_entries_account_idx on public.credit_entries (account_id, occurred_on desc);

-- ── The balance ─────────────────────────────────────────────────────────────

-- security_invoker so the policies below actually apply to it. A view is owned
-- by whoever created it and, left at the default, runs with their rights —
-- which would hand every reader the whole ledger regardless of RLS.
create or replace view public.v_credit_accounts with (security_invoker = true) as
select
  a.id,
  a.holder_kind,
  a.name,
  a.phone,
  a.nic,
  a.email,
  a.address,
  a.dealer_id,
  a.credit_limit,
  a.terms_days,
  a.auto_opened,
  a.notes,
  a.opened_by,
  a.created_at,
  a.updated_at,
  coalesce(sum(e.amount) filter (where e.kind = 'Charge'),    0) as total_charged,
  coalesce(sum(e.amount) filter (where e.kind = 'Payment'),   0) as total_paid,
  coalesce(sum(e.amount) filter (where e.kind = 'Write-off'), 0) as total_written_off,
  coalesce(sum(e.amount) filter (where e.kind = 'Charge'), 0)
    - coalesce(sum(e.amount) filter (where e.kind <> 'Charge'), 0) as balance,
  -- The oldest charge still inside the window that decides "overdue". This is
  -- the account's age, not any one invoice's: a shop chases the account.
  min(e.occurred_on) filter (where e.kind = 'Charge')                as first_charge_on,
  max(e.occurred_on) filter (where e.kind = 'Payment')               as last_payment_on,
  count(*) filter (where e.kind = 'Charge')                          as charge_count,
  case
    when coalesce(sum(e.amount) filter (where e.kind = 'Charge'), 0)
       - coalesce(sum(e.amount) filter (where e.kind <> 'Charge'), 0) <= 0.005 then 'Settled'
    when min(e.occurred_on) filter (where e.kind = 'Charge')
         < current_date - a.terms_days then 'Overdue'
    else 'Active'
  end as status
from public.credit_accounts a
left join public.credit_entries e on e.account_id = a.id
group by a.id;

comment on view public.v_credit_accounts is
  'Credit accounts with balance, totals and Active/Overdue/Settled worked out from the entries.';

-- ── Posting a repair balance ────────────────────────────────────────────────

/**
 * Put whatever is still owed on a delivered job onto the right account.
 *
 * Resolution order, and why:
 *   dealer job  → that dealer's account. The dealer is who the shop invoices;
 *                 the end customer is theirs, not ours.
 *   walk-in     → an account matched on phone number, opened if there is none.
 *
 * Opening an account here is the price of "nothing leaves unpaid without being
 * recorded". Such accounts are marked auto_opened with a zero limit, so they
 * read as a debt to collect rather than credit somebody was granted.
 *
 * Does nothing at all when the job is settled, which is the ordinary case.
 */
create or replace function public.post_repair_balance_to_credit(p_job_id text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  j           public.repair_jobs;
  outstanding numeric(12,2);
  acct        uuid;
  dealer      public.repair_dealers;
begin
  select * into j from public.repair_jobs where id = p_job_id;
  if not found then
    return null;
  end if;

  outstanding := round(coalesce(j.estimated_cost, 0) - coalesce(j.advance_paid, 0), 2);
  -- Rounding noise on a numeric is not a debt.
  if outstanding <= 0.005 then
    return null;
  end if;

  -- Already charged: the unique index would reject it anyway, but returning the
  -- existing account is more useful than raising at the caller.
  select account_id into acct
    from public.credit_entries
   where job_id = p_job_id and kind = 'Charge'
   limit 1;
  if acct is not null then
    return acct;
  end if;

  if j.dealer_id is not null then
    select * into dealer from public.repair_dealers where id = j.dealer_id;
    -- An in-house "dealer" is the shop itself, so its jobs are walk-ins.
    if found and not coalesce(dealer.in_house, false) then
      select id into acct from public.credit_accounts where dealer_id = dealer.id;
      if acct is null then
        insert into public.credit_accounts (holder_kind, name, phone, address, dealer_id, auto_opened)
        values ('Dealer', dealer.name, dealer.contact, dealer.address, dealer.id, true)
        returning id into acct;
      end if;
    end if;
  end if;

  if acct is null then
    if coalesce(btrim(j.phone), '') <> '' then
      select id into acct
        from public.credit_accounts
       where holder_kind = 'Customer'
         and public.normalise_phone(phone) = public.normalise_phone(j.phone);
    end if;

    if acct is null then
      insert into public.credit_accounts (holder_kind, name, phone, email, auto_opened)
      values ('Customer', coalesce(nullif(btrim(j.customer_name), ''), 'Walk-in customer'),
              nullif(btrim(j.phone), ''), nullif(btrim(j.customer_email), ''), true)
      returning id into acct;
    end if;
  end if;

  insert into public.credit_entries (account_id, kind, amount, occurred_on, due_on, job_id, note, created_by)
  select acct, 'Charge', outstanding, current_date,
         current_date + a.terms_days,
         p_job_id,
         'Balance outstanding on ' || p_job_id || ' at handover',
         auth.uid()
    from public.credit_accounts a
   where a.id = acct
  on conflict do nothing;

  return acct;
end $$;

comment on function public.post_repair_balance_to_credit is
  'Charge a delivered job''s unpaid balance to the dealer or customer account, opening one if needed. Idempotent per job.';

/**
 * The same thing, fired by the database when a job reaches Delivered.
 *
 * The app calls the function directly at handover too. That is not redundant:
 * the trigger is what makes the guarantee true no matter which code path, or
 * which future code path, marks a job delivered. Both are idempotent, so the
 * pair can only ever produce one charge.
 */
create or replace function public.tg_post_delivered_job_to_credit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'Delivered' and old.status is distinct from 'Delivered' then
    -- Never let a credit-posting problem block the handover itself. The phone
    -- is going back to its owner either way; a missing charge is a reconciling
    -- item, a failed handover is a customer standing at the counter.
    begin
      perform public.post_repair_balance_to_credit(new.id);
    exception when others then
      raise warning 'Could not post % to credit: %', new.id, sqlerrm;
    end;
  end if;
  return new;
end $$;

drop trigger if exists trg_post_delivered_job_to_credit on public.repair_jobs;
create trigger trg_post_delivered_job_to_credit
  after update on public.repair_jobs
  for each row execute function public.tg_post_delivered_job_to_credit();

-- ── Who may do what ─────────────────────────────────────────────────────────

alter table public.credit_accounts enable row level security;
alter table public.credit_entries  enable row level security;

-- Everybody at the counter reads it: you cannot collect a debt you cannot see.
drop policy if exists credit_accounts_select on public.credit_accounts;
create policy credit_accounts_select on public.credit_accounts
  for select to authenticated
  using (public.is_staff() and public.module_can_read('Customers'));

-- Opening an account, or changing a limit, is deciding how much the shop is
-- willing to be owed. That is the senior decision, so it needs the same tick as
-- Admin Control — see migration 20260831000009.
drop policy if exists credit_accounts_write on public.credit_accounts;
create policy credit_accounts_write on public.credit_accounts
  for all to authenticated
  using (public.is_admin_cashier() and public.module_can_write('Customers'))
  with check (public.is_admin_cashier() and public.module_can_write('Customers'));

drop policy if exists credit_entries_select on public.credit_entries;
create policy credit_entries_select on public.credit_entries
  for select to authenticated
  using (public.is_staff() and public.module_can_read('Customers'));

-- Taking a payment is ordinary counter work, and refusing it would mean turning
-- money away. Any cashier may record one.
drop policy if exists credit_entries_payment on public.credit_entries;
create policy credit_entries_payment on public.credit_entries
  for insert to authenticated
  with check (
    kind = 'Payment'
    and public.is_staff()
    and public.module_can_write('Customers')
  );

-- Charges and write-offs are not. A charge invents a debt; a write-off forgives
-- one. Both belong with whoever sets the limits.
drop policy if exists credit_entries_manage on public.credit_entries;
create policy credit_entries_manage on public.credit_entries
  for insert to authenticated
  with check (
    kind <> 'Payment'
    and public.is_admin_cashier()
    and public.module_can_write('Customers')
  );

-- Correcting the ledger is rarer and more dangerous than adding to it: an
-- edited payment changes what a customer is owed with no trace of the original.
drop policy if exists credit_entries_amend on public.credit_entries;
create policy credit_entries_amend on public.credit_entries
  for update to authenticated
  using (public.has_role('Admin'::staff_role))
  with check (public.has_role('Admin'::staff_role));

drop policy if exists credit_entries_delete on public.credit_entries;
create policy credit_entries_delete on public.credit_entries
  for delete to authenticated
  using (public.has_role('Admin'::staff_role));
