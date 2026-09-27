-- ============================================================================
-- Mano Mobile — selling a phone takes it off the shelf
--
-- mobile_devices became durable in 20260922000056, but Mobile Sales never read
-- it: the counter searched a hard-coded empty array, so no phone could ever be
-- scanned, and nothing that was sold would have been marked sold. The same
-- IMEI could go out of the door twice and the inventory would still call it
-- available.
--
-- This gives the counter one call that does the whole sale's stock movement:
--
--   sell_mobile_sale(p_devices, p_accessories) → invoice number
--
--   * every device is locked, must still be available (or reserved), and must
--     not be priced below its min_selling_price — checked here, not just in
--     the browser, because a price field is the easiest thing to bend;
--   * each device is marked sold and stamped with the invoice it went on;
--   * accessory stock is deducted through sell_accessory_stock(), the only
--     path that ever deducts it;
--   * the invoice number is drawn last, so a sale refused for any reason above
--     rolls back without burning a number from invoice_no_seq.
--
-- One transaction: either every device and every accessory moves, or none do.
--
-- Voiding the invoice puts the devices back on the shelf — void_sale() below
-- is the 20260917000055 version plus that one step.
-- ============================================================================

-- ── What a sold device remembers ────────────────────────────────────────────

alter table public.mobile_devices add column if not exists sold_invoice_no text;
alter table public.mobile_devices add column if not exists sold_price      numeric(12,2);
alter table public.mobile_devices add column if not exists sold_at         timestamptz;

create index if not exists mobile_devices_sold_invoice_idx
  on public.mobile_devices (sold_invoice_no) where sold_invoice_no is not null;

comment on column public.mobile_devices.sold_invoice_no is
  'The invoice this device was sold on. Set by sell_mobile_sale(), cleared when that invoice is voided.';
comment on column public.mobile_devices.sold_price is
  'What the device was actually sold for, after its line discount.';

-- ── An invoice line for a phone ─────────────────────────────────────────────
-- Not used by any SQL in this file, so adding it inside the migration's
-- transaction is safe.
alter type sale_item_kind add value if not exists 'device';

-- ── The sale ────────────────────────────────────────────────────────────────

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
  v_count integer := 0;
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
    if d.min_selling_price > 0 and item.price < d.min_selling_price then
      raise exception 'IMEI % (%) cannot be sold below its minimum price of Rs. %.', d.imei, d.name, d.min_selling_price;
    end if;

    v_count := v_count + 1;
  end loop;

  -- Accessories first among the writes: it raises if any line is short, and
  -- everything above is only locks so far.
  if p_accessories is not null and jsonb_typeof(p_accessories) = 'array' and jsonb_array_length(p_accessories) > 0 then
    perform public.sell_accessory_stock(p_accessories);
  end if;

  -- Every check has passed; only now take a number.
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

comment on function public.sell_mobile_sale(jsonb, jsonb) is
  'Marks every device on a mobile sale sold, deducts its accessory stock, and returns the invoice number — all in one transaction. p_devices: [{"id": 7, "price": 85000}], p_accessories: [{"id": 12, "qty": 1}].';

grant execute on function public.sell_mobile_sale(jsonb, jsonb) to authenticated;

-- ── void_sale, now putting phones back too ──────────────────────────────────

create or replace function public.void_sale(p_sale_id uuid)
returns public.sales
language plpgsql
security definer
set search_path = public
as $$
declare
  s    public.sales;
  item record;
begin
  if not (public.is_staff() and public.module_can_write('Sales / POS')) then
    raise exception 'Not authorised to void sales';
  end if;

  select * into s from public.sales where id = p_sale_id for update;
  if not found then
    raise exception 'Sale % not found', p_sale_id;
  end if;

  if s.status = 'Voided' then
    return s;
  end if;

  for item in
    select (elem ->> 'id')::bigint as id, (elem ->> 'qty')::integer as qty, elem ->> 'type' as kind
    from jsonb_array_elements(coalesce(s.line_items, '[]'::jsonb)) as elem
  loop
    if item.kind = 'accessory' and item.id is not null and item.qty > 0 then
      update public.accessory_products set stock = stock + item.qty where id = item.id;
    end if;
  end loop;

  -- Found by the invoice they were stamped with rather than by line_items, so
  -- a device goes back even if the lines were never written — and a device
  -- sold again since (a new invoice number) is left alone.
  update public.mobile_devices
     set status          = 'available',
         sold_invoice_no = null,
         sold_price      = null,
         sold_at         = null
   where sold_invoice_no = s.invoice_no;

  update public.sales set status = 'Voided' where id = p_sale_id
  returning * into s;

  perform public.unwind_voided_sale(s.invoice_no);

  return s;
end $$;

comment on function public.void_sale(uuid) is
  'Voids a sale: restocks every accessory line, returns every device sold on it to available, and for a repair invoice puts its jobs back to finished-and-unpaid and removes the charges it raised. Idempotent on an already-voided sale.';

grant execute on function public.void_sale(uuid) to authenticated;
