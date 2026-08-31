-- ============================================================================
-- Mano Mobile — the sales ledger
--
-- Invoice numbers have been real since 20260821000001: every Complete Sale,
-- Generate Invoice and Issue Job draws INV-000123 from a Postgres sequence, so
-- two cashiers can never be handed the same one.
--
-- The sale itself was not stored at all. SalesContext was
--
--     const [sales, setSales] = useState<SaleTx[]>([])
--
-- with no localStorage and no table behind it. So the shop burned a permanent
-- invoice number, printed it, handed it to a customer — and on the next page
-- refresh there was no record of what INV-000123 was for, who bought it, or
-- what they paid. Sales History, Invoice History and the Daily Summary all read
-- that same empty array, which is why they are always empty the morning after.
--
-- A number that identifies nothing is worse than no number, because it looks
-- like a record. This is the record.
--
-- One table, not a header-plus-lines pair. Every screen that reads sales wants
-- the invoice, its total and one line of description; the individual items are
-- already described on the printed invoice and, for a repair, in the jobs
-- themselves — which job_ids points back at. Splitting lines out would add a
-- join to every read for something nothing currently asks.
-- ============================================================================

do $$ begin
  create type sale_category as enum ('Accessories', 'Mobile', 'Repair', 'Others');
exception when duplicate_object then null; end $$;

do $$ begin
  -- Voided: cancelled before it ever counted. Returned: it counted, and then
  -- came back. The two are different money and are never merged.
  create type sale_status as enum ('Paid', 'Voided', 'Returned');
exception when duplicate_object then null; end $$;

create table if not exists public.sales (
  id            uuid primary key default gen_random_uuid(),

  -- The number from invoice_no_seq. Unique because that is the whole promise
  -- the sequence makes; if two rows could share one, the sequence was pointless.
  invoice_no    text not null unique,

  sold_on       date not null default current_date,
  category      sale_category not null,
  status        sale_status not null default 'Paid',

  customer      text not null default 'Walk-in',
  customer_phone text,

  -- Set when the sale was billed to a dealer rather than a walk-in.
  dealer_id     bigint references public.repair_dealers (id) on delete set null,
  -- Set when it went on account. The charge lives in credit_entries; this is
  -- the link back from the invoice to whose balance it landed on.
  credit_account_id uuid references public.credit_accounts (id) on delete set null,

  items         text not null default '',
  -- The repair jobs this invoice covered, so a job can be traced to the invoice
  -- it was billed on and back again. Empty for over-the-counter sales.
  job_ids       text[] not null default '{}',

  total          numeric(12,2) not null default 0,
  discount_pct   numeric(6,2),
  tax_pct        numeric(6,2),
  tax_amount     numeric(12,2),

  payment_method text,
  cash_amount    numeric(12,2),
  card_amount    numeric(12,2),
  card_ref       text,

  returned_amount numeric(12,2),
  return_reason   text,
  return_date     date,

  -- Who was at the till. Recorded by name because that is what a printed
  -- invoice and a shift report show, with the id kept for anything that needs
  -- to be certain which account it was.
  cashier       text,
  shift_id      text,
  created_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.sales is
  'One row per invoice actually issued. The invoice number comes from invoice_no_seq; see 20260821000001.';

create index if not exists sales_sold_on_idx  on public.sales (sold_on desc);
create index if not exists sales_category_idx on public.sales (category);
create index if not exists sales_dealer_idx   on public.sales (dealer_id) where dealer_id is not null;

drop trigger if exists trg_sales_touch on public.sales;
create trigger trg_sales_touch
  before update on public.sales
  for each row execute function public.touch_updated_at();

-- ── The other direction ─────────────────────────────────────────────────────
--
-- sales.job_ids says which jobs an invoice covered. This says which invoice a
-- job was billed on, which is the question the repair screens actually ask:
-- somebody looking at RM-027 wants to know what it was invoiced as, without
-- scanning every sale's array to find it.
alter table public.repair_jobs
  add column if not exists invoice_no text;

comment on column public.repair_jobs.invoice_no is
  'The invoice this job was billed on. Set when the sale is recorded; null until then.';

create index if not exists repair_jobs_invoice_no_idx
  on public.repair_jobs (invoice_no) where invoice_no is not null;

-- ── Naming the invoice on a credit charge ───────────────────────────────────
--
-- When a job is handed over unpaid, the Delivered trigger raises a charge on
-- the holder's account (see 20260901000010). It knows the job but not the
-- invoice, because the invoice number is assigned a moment later by whoever is
-- finalising the sale. This fills that gap in.
--
-- It has to be a function rather than an update from the app: amending a credit
-- entry is Admin-only, deliberately — an edited payment changes what somebody
-- is owed with no trace of the original. This is narrower than an amendment. It
-- only ever fills in a blank invoice number, never changes one already set, and
-- never touches an amount.
create or replace function public.stamp_invoice_on_credit_charges(
  p_invoice_no text,
  p_job_ids    text[]
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  touched integer;
begin
  if not public.is_staff() then
    raise exception 'Not authorised';
  end if;
  if coalesce(btrim(p_invoice_no), '') = '' or p_job_ids is null then
    return 0;
  end if;

  update public.credit_entries
     set invoice_no = p_invoice_no
   where kind = 'Charge'
     and job_id = any (p_job_ids)
     and invoice_no is null;

  get diagnostics touched = row_count;
  return touched;
end $$;

comment on function public.stamp_invoice_on_credit_charges is
  'Fills the invoice number in on a handover credit charge. Only ever sets a blank one; never edits an amount or an existing number.';

-- ── Who may do what ─────────────────────────────────────────────────────────

alter table public.sales enable row level security;

drop policy if exists sales_select on public.sales;
create policy sales_select on public.sales
  for select to authenticated
  using (public.is_staff() and public.module_can_read('Sales / POS'));

-- Recording a sale is the counter's whole job. Anybody who may work the till
-- may write one; refusing here would mean refusing to sell.
drop policy if exists sales_insert on public.sales;
create policy sales_insert on public.sales
  for insert to authenticated
  with check (public.is_staff() and public.module_can_write('Sales / POS'));

-- Returns and voids are ordinary counter work too — a customer comes back with
-- the phone the same afternoon. What is deliberately NOT allowed is deleting:
-- an invoice number was issued and printed, so the row has to survive whatever
-- happened to the sale. A void is a status, not an absence.
drop policy if exists sales_update on public.sales;
create policy sales_update on public.sales
  for update to authenticated
  using (public.is_staff() and public.module_can_write('Sales / POS'))
  with check (public.is_staff() and public.module_can_write('Sales / POS'));

drop policy if exists sales_delete on public.sales;
create policy sales_delete on public.sales
  for delete to authenticated
  using (public.has_role('Admin'::staff_role));
