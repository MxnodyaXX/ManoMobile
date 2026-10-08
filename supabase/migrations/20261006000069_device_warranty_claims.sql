-- ============================================================================
-- Mano Mobile — warranty claims on phones the shop sold
--
-- warranty_claims (20260902000002) belongs to repair warranties: it needs a
-- repair job and a WR- warranty. A phone sold over the counter has neither —
-- its cover comes from the device itself (20261006000068) and the sale date.
-- So phone claims get their own record, with the four ways the shop settles
-- one:
--
--   repair_shop      repaired here, free — a warranty repair job is opened
--   repair_company   sent back to the company to repair; tracked out and back
--   replace          swapped for another unit (replace_mobile_device)
--   refund           the full price handed back; the phone is taken back
--
-- Status follows the claim through:
--   Open             recorded, being dealt with
--   In repair        at our bench (repair_shop)
--   At company       with the company (repair_company)
--   Ready            fixed / back, waiting for the customer
--   Completed        settled — device returned, replaced or refunded
--   Rejected         not covered
--
-- refund_mobile_device() does the refund's stock and ledger side in one step:
-- the phone comes off the sale (back to stock as a customer return, or set
-- aside for the company), and the invoice records the amount returned.
-- ============================================================================

create sequence if not exists public.device_claim_no_seq start 1;

create or replace function public.next_device_claim_no()
returns text
language sql
volatile
as $$
  select 'PC-' || lpad(nextval('public.device_claim_no_seq')::text, 4, '0')
$$;

create table if not exists public.device_warranty_claims (
  id                    text primary key default public.next_device_claim_no(),
  invoice_no            text not null,
  device_id             bigint references public.mobile_devices (id) on delete set null,
  imei                  text not null,
  device_name           text not null,
  customer              text,
  customer_phone        text,
  sold_on               date,
  warranty_until        date,
  reported_issue        text not null check (btrim(reported_issue) <> ''),
  resolution            text not null check (resolution in ('repair_shop', 'repair_company', 'replace', 'refund')),
  status                text not null default 'Open'
                          check (status in ('Open', 'In repair', 'At company', 'Ready', 'Completed', 'Rejected')),
  -- repair_shop: the warranty repair job opened for it.
  job_id                text,
  -- repair_company: who has it and when.
  company_name          text,
  sent_at               timestamptz,
  expected_back         date,
  back_at               timestamptz,
  -- replace: the unit handed over instead.
  replacement_device_id bigint references public.mobile_devices (id) on delete set null,
  replacement_imei      text,
  -- refund: what was handed back.
  refund_amount         numeric(12,2),
  notes                 text not null default '',
  handled_by            text,
  created_by            uuid references auth.users (id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  resolved_at           timestamptz
);

create index if not exists device_warranty_claims_invoice_idx on public.device_warranty_claims (invoice_no);
create index if not exists device_warranty_claims_imei_idx    on public.device_warranty_claims (imei);
create index if not exists device_warranty_claims_status_idx  on public.device_warranty_claims (status);

drop trigger if exists trg_device_warranty_claims_touch on public.device_warranty_claims;
create trigger trg_device_warranty_claims_touch
  before update on public.device_warranty_claims
  for each row execute function public.touch_updated_at();

alter table public.device_warranty_claims enable row level security;

drop policy if exists device_warranty_claims_select on public.device_warranty_claims;
create policy device_warranty_claims_select on public.device_warranty_claims
  for select to authenticated using (public.is_staff());

-- Taking and following up a claim is counter work.
drop policy if exists device_warranty_claims_write on public.device_warranty_claims;
create policy device_warranty_claims_write on public.device_warranty_claims
  for all to authenticated
  using (public.is_staff() and public.module_can_write('Sales / POS'))
  with check (public.is_staff() and public.module_can_write('Sales / POS'));

comment on table public.device_warranty_claims is
  'Warranty claims on phones sold by the shop: repaired here, sent to the company, replaced or refunded. Repair-warranty claims are warranty_claims.';

-- ── The refund ──────────────────────────────────────────────────────────────

create or replace function public.refund_mobile_device(
  p_claim_id    text,
  p_disposition text,   -- 'resell' | 'return_to_company'
  p_amount      numeric
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.device_warranty_claims;
  d public.mobile_devices;
  s public.sales;
begin
  if not (public.is_staff() and public.module_can_write('Sales / POS')) then
    raise exception using errcode = '42501', message = 'Refunding needs Sales / POS access.';
  end if;
  if p_disposition not in ('resell', 'return_to_company') then
    raise exception 'Choose whether the phone is kept for resale or returned to the company.';
  end if;

  select * into c from public.device_warranty_claims where id = p_claim_id for update;
  if not found then raise exception 'Claim % not found.', p_claim_id; end if;
  if c.status in ('Completed', 'Rejected') then raise exception 'Claim % is already closed.', p_claim_id; end if;

  select * into d from public.mobile_devices where id = c.device_id for update;
  if not found or d.status <> 'sold' or d.sold_invoice_no is distinct from c.invoice_no then
    raise exception 'That phone is no longer recorded as sold on %.', c.invoice_no;
  end if;

  select * into s from public.sales where invoice_no = c.invoice_no for update;
  if not found or s.status = 'Voided' then
    raise exception 'Invoice % cannot be refunded.', c.invoice_no;
  end if;

  if p_amount is null or p_amount <= 0 or p_amount > coalesce(d.sold_price, p_amount) + 0.005 then
    raise exception 'The refund must be more than zero and no more than the price paid (Rs. %).', d.sold_price;
  end if;

  update public.mobile_devices
     set status                = case when p_disposition = 'resell' then 'available' else 'supplier_return' end,
         sold_invoice_no       = null,
         sold_price            = null,
         sold_at               = null,
         returned_from_invoice = c.invoice_no,
         return_reason         = 'Warranty refund — ' || c.reported_issue,
         returned_at           = now()
   where id = d.id;

  update public.sales
     set status          = 'Returned',
         returned_amount = coalesce(returned_amount, 0) + round(p_amount, 2),
         return_reason   = concat_ws(' · ', nullif(return_reason, ''), 'Warranty refund ' || c.id || ' — ' || d.name),
         return_date     = current_date
   where id = s.id;

  update public.device_warranty_claims
     set status = 'Completed', refund_amount = round(p_amount, 2), resolved_at = now()
   where id = c.id;

  return round(p_amount, 2);
end $$;

comment on function public.refund_mobile_device(text, text, numeric) is
  'Warranty refund on a phone claim: takes the phone off the sale (resale stock or company return), records the amount on the invoice, and closes the claim. The cash itself is paid out by the till.';

grant execute on function public.refund_mobile_device(text, text, numeric) to authenticated;
