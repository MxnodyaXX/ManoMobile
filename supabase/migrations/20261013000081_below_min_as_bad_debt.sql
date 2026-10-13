-- ============================================================================
-- Mano Mobile — selling under the minimum: the shortfall is bad debt
--
-- 20261001000064 let a phone be sold under its minimum price, but only with a
-- typed reason, and kept the shortfall in its own Below-Minimum account.
--
-- Now:
--   * the sale simply goes through — a reason is welcome but not required
--     (left blank, it is recorded as "Sold under the minimum price");
--   * the shortfall (minimum − price sold at) is booked as the invoice's bad
--     debt, so it shows in Invoice History's Bad Debt column and total, the
--     same place as money written off;
--   * it is still listed in the Below-Minimum account and report as before.
--
-- sales.bad_debt_below_min holds the part of bad_debt that came from this, so
-- it is never added twice and the write-off trigger (20260901000016), which
-- adds and subtracts its own amounts, is undisturbed.
--
-- The invoice row is written by the counter just after sell_mobile_sale marks
-- the phones sold, so the booking runs from both sides: when the invoice is
-- inserted, and when a below-minimum line is recorded for an invoice that
-- already exists. Past below-minimum sales are booked once at the end.
-- ============================================================================

alter table public.sales
  add column if not exists bad_debt_below_min numeric(12,2) not null default 0;

comment on column public.sales.bad_debt_below_min is
  'Part of bad_debt that is phones sold under their minimum price (sum of device_below_min_sales.shortfall for this invoice).';

-- ── Booking ────────────────────────────────────────────────────────────────

create or replace function public.book_below_min_bad_debt(p_invoice_no text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sum numeric(12,2);
begin
  select coalesce(sum(shortfall), 0) into v_sum
    from public.device_below_min_sales where invoice_no = p_invoice_no;

  update public.sales
     set bad_debt           = greatest(0, bad_debt - bad_debt_below_min + v_sum),
         bad_debt_below_min = v_sum
   where invoice_no = p_invoice_no
     and bad_debt_below_min is distinct from v_sum;
end $$;

-- The invoice arrives after the below-minimum lines: count them in as it lands.
create or replace function public.tg_sales_below_min_bad_debt()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sum numeric(12,2);
begin
  select coalesce(sum(shortfall), 0) into v_sum
    from public.device_below_min_sales where invoice_no = new.invoice_no;
  if v_sum > 0 then
    new.bad_debt           := coalesce(new.bad_debt, 0) + v_sum;
    new.bad_debt_below_min := v_sum;
  end if;
  return new;
end $$;

drop trigger if exists trg_sales_below_min_bad_debt on public.sales;
create trigger trg_sales_below_min_bad_debt
  before insert on public.sales
  for each row execute function public.tg_sales_below_min_bad_debt();

-- A below-minimum line recorded (or removed) for an invoice that exists.
create or replace function public.tg_below_min_to_sale()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.book_below_min_bad_debt(coalesce(new.invoice_no, old.invoice_no));
  return null;
end $$;

drop trigger if exists trg_below_min_to_sale on public.device_below_min_sales;
create trigger trg_below_min_to_sale
  after insert or update or delete on public.device_below_min_sales
  for each row execute function public.tg_below_min_to_sale();

-- ── sell_mobile_sale: no reason required ───────────────────────────────────

create or replace function public.sell_mobile_sale(
  p_devices          jsonb,
  p_accessories      jsonb default '[]'::jsonb,
  p_below_min_reason text  default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  item     record;
  d        public.mobile_devices;
  v_no     text;
  v_reason text := coalesce(nullif(btrim(coalesce(p_below_min_reason, '')), ''), 'Sold under the minimum price');
  v_cashier text;
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
  end loop;

  if p_accessories is not null and jsonb_typeof(p_accessories) = 'array' and jsonb_array_length(p_accessories) > 0 then
    perform public.sell_accessory_stock(p_accessories);
  end if;

  v_no := public.next_invoice_no();
  select full_name into v_cashier from public.profiles where id = auth.uid();

  for item in
    select (elem ->> 'id')::bigint as id, (elem ->> 'price')::numeric as price
    from jsonb_array_elements(p_devices) as elem
  loop
    select * into d from public.mobile_devices where id = item.id;

    -- Under the minimum: the shortfall is booked (and becomes the invoice's
    -- bad debt through the triggers above). The sale is never refused for it.
    if d.min_selling_price > 0 and round(item.price, 2) < d.min_selling_price then
      insert into public.device_below_min_sales (
        invoice_no, device_id, imei, device_name, brand, buying_price,
        min_price, sold_price, shortfall, reason, cashier, created_by
      ) values (
        v_no, d.id, d.imei, d.name, d.brand, d.buying_price,
        d.min_selling_price, round(item.price, 2), d.min_selling_price - round(item.price, 2),
        v_reason, v_cashier, auth.uid()
      );
    end if;

    update public.mobile_devices
       set status          = 'sold',
           sold_invoice_no = v_no,
           sold_price      = round(item.price, 2),
           sold_at         = now()
     where id = item.id;
  end loop;

  return v_no;
end $$;

comment on function public.sell_mobile_sale(jsonb, jsonb, text) is
  'Marks every device on a mobile sale sold, deducts its accessory stock, and returns the invoice number — one transaction. A device under its minimum price is sold anyway: the shortfall is recorded in device_below_min_sales and booked as the invoice''s bad debt.';

grant execute on function public.sell_mobile_sale(jsonb, jsonb, text) to authenticated;

-- ── Past below-minimum sales ───────────────────────────────────────────────
do $$
declare r record;
begin
  for r in select distinct invoice_no from public.device_below_min_sales loop
    perform public.book_below_min_bad_debt(r.invoice_no);
  end loop;
end $$;
