-- ============================================================================
-- Mano Mobile — a sold phone comes back and the customer gets another one
--
-- A phone sold a few days ago comes back faulty. The shop takes it back and
-- hands over a different unit. Until now there was no way to say so: the
-- returned IMEI stayed "sold" on the old invoice, and the unit handed over
-- was still "available" on the shelf, so the inventory was wrong twice.
--
-- replace_mobile_device() does the swap in one transaction:
--
--   * the returned device must be one actually sold on that invoice;
--   * the replacement must be on the shelf (available or reserved);
--   * the replacement is marked sold on the SAME invoice — the customer's
--     receipt, warranty and credit account stay exactly where they were;
--   * the returned device goes one of two ways, chosen at the counter:
--       resell            back to 'available', flagged as a customer return
--                         so nobody sells it as new by mistake;
--       return_to_company 'supplier_return' — set aside to go back to the
--                         supplier; 'returned_to_supplier' once it has gone;
--   * a price difference is recorded. When the customer pays extra, a fresh
--     invoice number is drawn for that top-up so the money has a receipt.
--
-- Every swap is kept in device_replacements, so an invoice can always show
-- which phones went out on it and which came back.
-- ============================================================================

-- ── Two new places a device can be ──────────────────────────────────────────

alter table public.mobile_devices drop constraint if exists mobile_devices_status_check;
alter table public.mobile_devices add constraint mobile_devices_status_check
  check (status in ('available', 'sold', 'reserved', 'supplier_return', 'returned_to_supplier'));

-- Set when a customer brought this unit back. Kept after it is resold, so its
-- history does not disappear the moment it sells again.
alter table public.mobile_devices add column if not exists returned_from_invoice text;
alter table public.mobile_devices add column if not exists return_reason         text;
alter table public.mobile_devices add column if not exists returned_at           timestamptz;

comment on column public.mobile_devices.returned_from_invoice is
  'The invoice a customer returned this device from (replacement). Null for a unit that never came back.';

-- ── sell_mobile_sale, refusing the new statuses too ────────────────────────
-- The 20260924000059 version only refused 'sold'. A unit set aside for the
-- company is not stock either, so selling now requires available/reserved.

create or replace function public.sell_mobile_sale(
  p_devices     jsonb,
  p_accessories jsonb default '[]'::jsonb
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  item    record;
  d       public.mobile_devices;
  v_no    text;
begin
  if not (public.is_staff() and public.module_can_write('Sales / POS')) then
    raise exception using errcode = '42501', message = 'Selling needs Sales / POS access.';
  end if;

  if p_devices is null or jsonb_typeof(p_devices) <> 'array' or jsonb_array_length(p_devices) = 0 then
    raise exception 'A mobile sale needs at least one device.';
  end if;

  for item in
    select (elem ->> 'id')::bigint as id, (elem ->> 'price')::numeric as price
    from jsonb_array_elements(p_devices) as elem
  loop
    if item.id is null or item.price is null or item.price < 0 then
      raise exception 'Invalid device line: %', item;
    end if;

    select * into d from public.mobile_devices where id = item.id for update;
    if not found then
      raise exception 'Device % is no longer in the inventory.', item.id;
    end if;
    if d.status = 'sold' then
      raise exception 'IMEI % (%) has already been sold on %.', d.imei, d.name, coalesce(d.sold_invoice_no, 'another invoice');
    end if;
    if d.status not in ('available', 'reserved') then
      raise exception 'IMEI % (%) is set aside to go back to the company and cannot be sold.', d.imei, d.name;
    end if;
    if d.min_selling_price > 0 and item.price < d.min_selling_price then
      raise exception 'IMEI % (%) cannot be sold below its minimum price of Rs. %.', d.imei, d.name, d.min_selling_price;
    end if;
  end loop;

  if p_accessories is not null and jsonb_typeof(p_accessories) = 'array' and jsonb_array_length(p_accessories) > 0 then
    perform public.sell_accessory_stock(p_accessories);
  end if;

  v_no := public.next_invoice_no();

  for item in
    select (elem ->> 'id')::bigint as id, (elem ->> 'price')::numeric as price
    from jsonb_array_elements(p_devices) as elem
  loop
    update public.mobile_devices
       set status          = 'sold',
           sold_invoice_no = v_no,
           sold_price      = round(item.price, 2),
           sold_at         = now()
     where id = item.id;
  end loop;

  return v_no;
end $$;

-- ── The record of every swap ────────────────────────────────────────────────

create table if not exists public.device_replacements (
  id                    bigint generated by default as identity primary key,
  invoice_no            text not null,
  returned_device_id    bigint not null references public.mobile_devices (id),
  replacement_device_id bigint not null references public.mobile_devices (id),
  returned_imei         text not null,
  replacement_imei      text not null,
  reason                text not null,
  disposition           text not null check (disposition in ('resell', 'return_to_company')),
  returned_price        numeric(12,2) not null default 0,
  replacement_price     numeric(12,2) not null default 0,
  -- replacement_price − returned_price. Positive: the customer paid extra;
  -- negative: the shop gave money back.
  price_difference      numeric(12,2) not null default 0,
  -- The invoice the extra payment was receipted on, when there was one.
  topup_invoice_no      text,
  created_by            uuid references auth.users (id) on delete set null,
  created_at            timestamptz not null default now()
);

create index if not exists device_replacements_invoice_idx on public.device_replacements (invoice_no);

alter table public.device_replacements enable row level security;

drop policy if exists device_replacements_select on public.device_replacements;
create policy device_replacements_select on public.device_replacements
  for select to authenticated
  using (public.is_staff() and public.module_can_read('Sales / POS'));
-- Written only through replace_mobile_device(); no insert/update/delete policy.

comment on table public.device_replacements is
  'One row per phone swapped on an invoice: which unit came back, which went out, why, and where the returned one went.';

-- ── The swap ────────────────────────────────────────────────────────────────

create or replace function public.replace_mobile_device(
  p_invoice_no        text,
  p_returned_id       bigint,
  p_replacement_id    bigint,
  p_reason            text,
  p_disposition       text,
  p_replacement_price numeric
)
returns public.device_replacements
language plpgsql
security definer
set search_path = public
as $$
declare
  s     public.sales;
  r_old public.mobile_devices;
  r_new public.mobile_devices;
  diff  numeric(12,2);
  topup text;
  rec   public.device_replacements;
begin
  if not (public.is_staff() and public.module_can_write('Sales / POS')) then
    raise exception using errcode = '42501', message = 'Replacing a device needs Sales / POS access.';
  end if;
  if coalesce(btrim(p_reason), '') = '' then
    raise exception 'Say why the device came back.';
  end if;
  if p_disposition not in ('resell', 'return_to_company') then
    raise exception 'Choose whether the returned device is kept for resale or returned to the company.';
  end if;
  if p_replacement_price is null or p_replacement_price < 0 then
    raise exception 'Invalid replacement price.';
  end if;
  if p_returned_id = p_replacement_id then
    raise exception 'The replacement must be a different device.';
  end if;

  select * into s from public.sales where invoice_no = p_invoice_no for update;
  if not found then
    raise exception 'There is no invoice %.', p_invoice_no;
  end if;
  if s.status = 'Voided' then
    raise exception 'Invoice % is voided — there is nothing to replace.', p_invoice_no;
  end if;

  -- Both rows locked, lower id first, so two tills swapping the same pair
  -- cannot deadlock each other.
  perform 1 from public.mobile_devices
   where id in (p_returned_id, p_replacement_id) order by id for update;

  select * into r_old from public.mobile_devices where id = p_returned_id;
  if not found or r_old.status <> 'sold' or r_old.sold_invoice_no is distinct from p_invoice_no then
    raise exception 'That device was not sold on %.', p_invoice_no;
  end if;

  select * into r_new from public.mobile_devices where id = p_replacement_id;
  if not found then
    raise exception 'The replacement device is no longer in the inventory.';
  end if;
  if r_new.status not in ('available', 'reserved') then
    raise exception 'IMEI % (%) is not on the shelf — it is %.', r_new.imei, r_new.name, r_new.status;
  end if;

  diff := round(p_replacement_price - coalesce(r_old.sold_price, 0), 2);
  if diff > 0 then
    topup := public.next_invoice_no();
  end if;

  -- The replacement goes out on the customer's original invoice.
  update public.mobile_devices
     set status          = 'sold',
         sold_invoice_no = p_invoice_no,
         sold_price      = round(p_replacement_price, 2),
         sold_at         = now()
   where id = p_replacement_id;

  update public.mobile_devices
     set status                = case when p_disposition = 'resell' then 'available' else 'supplier_return' end,
         sold_invoice_no       = null,
         sold_price            = null,
         sold_at               = null,
         returned_from_invoice = p_invoice_no,
         return_reason         = btrim(p_reason),
         returned_at           = now()
   where id = p_returned_id;

  insert into public.device_replacements (
    invoice_no, returned_device_id, replacement_device_id, returned_imei, replacement_imei,
    reason, disposition, returned_price, replacement_price, price_difference, topup_invoice_no, created_by
  ) values (
    p_invoice_no, p_returned_id, p_replacement_id, r_old.imei, r_new.imei,
    btrim(p_reason), p_disposition, coalesce(r_old.sold_price, 0), round(p_replacement_price, 2), diff, topup, auth.uid()
  )
  returning * into rec;

  return rec;
end $$;

comment on function public.replace_mobile_device(text, bigint, bigint, text, text, numeric) is
  'Swaps a returned phone for another on the same invoice: the replacement is sold, the returned unit goes back to stock (resell) or to supplier_return, and the swap is logged. Draws a top-up invoice number when the customer owes a difference.';

grant execute on function public.replace_mobile_device(text, bigint, bigint, text, text, numeric) to authenticated;
