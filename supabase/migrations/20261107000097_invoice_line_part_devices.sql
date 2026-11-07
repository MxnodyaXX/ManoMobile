-- ============================================================================
-- Mano Mobile — add compatible devices to a repair part from an invoice line
--
-- A delivery is often when the shop learns a part also fits another model. An
-- invoice line for an existing part can now list devices to add. They only ever
-- add: nothing is removed, and the part's first device, which its name and SKU
-- come from, stays first. As with barcodes, a draft changes nothing; they join the
-- part when the invoice is finalised.
-- ============================================================================

alter table public.purchase_invoice_items
  add column if not exists add_devices text[] not null default '{}';

-- Copied from 20261107000096, adding add_devices.
create or replace function public.save_purchase_invoice(p jsonb)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id      bigint := nullif(p ->> 'id', '')::bigint;
  v_sup     public.accessory_suppliers;
  v_status  text;
  v_no      text := btrim(coalesce(p ->> 'invoice_no', ''));
  v_item    jsonb;
  v_n       integer := 0;
  v_prod    bigint;
  v_part    bigint;
  v_trip    bigint := nullif(p ->> 'trip_id', '')::bigint;
  v_qty     integer;
  v_cost    numeric;
  v_disc    numeric;
  v_devices text[];
begin
  perform public._purchasing_guard();

  select * into v_sup from public.accessory_suppliers where id = nullif(p ->> 'supplier_id', '')::bigint;
  if not found then raise exception 'Pick a supplier'; end if;
  if v_no = '' then raise exception 'Enter the supplier''s invoice number'; end if;
  if jsonb_array_length(coalesce(p -> 'items', '[]'::jsonb)) = 0 then
    raise exception 'Add at least one item';
  end if;
  if v_trip is not null and not exists (select 1 from public.purchase_trips where id = v_trip) then
    raise exception 'That trip no longer exists';
  end if;
  if exists (
    select 1 from public.purchase_invoices
     where supplier_id = v_sup.id and lower(btrim(invoice_no)) = lower(v_no)
       and status <> 'Void' and id is distinct from v_id
  ) then
    raise exception 'Invoice % from % is already recorded', v_no, v_sup.name;
  end if;

  if v_id is null then
    insert into public.purchase_invoices (supplier_id, supplier_name, invoice_no)
    values (v_sup.id, v_sup.name, v_no)
    returning id into v_id;
    perform public._purchase_event(v_id, 'created', 'Draft created');
  else
    select status into v_status from public.purchase_invoices where id = v_id for update;
    if not found then raise exception 'Purchase invoice % not found', v_id; end if;
    if v_status <> 'Draft' then
      raise exception 'Only a draft can be edited. A finalised invoice is corrected by voiding it and entering it again.';
    end if;
    delete from public.purchase_invoice_items where invoice_id = v_id;
    perform public._purchase_event(v_id, 'edited', 'Draft edited');
  end if;

  update public.purchase_invoices set
    supplier_id     = v_sup.id,
    supplier_name   = v_sup.name,
    invoice_no      = v_no,
    invoice_date    = coalesce(nullif(p ->> 'invoice_date', '')::date, current_date),
    due_date        = nullif(p ->> 'due_date', '')::date,
    expenses        = greatest(coalesce(nullif(p ->> 'expenses', '')::numeric, 0), 0),
    discount        = greatest(coalesce(nullif(p ->> 'discount', '')::numeric, 0), 0),
    notes           = coalesce(p ->> 'notes', ''),
    attachment_path = nullif(p ->> 'attachment_path', ''),
    attachment_name = nullif(p ->> 'attachment_name', ''),
    trip_id         = v_trip,
    initial_payment = case when coalesce(nullif(p -> 'initial_payment' ->> 'amount', '')::numeric, 0) > 0
                           then p -> 'initial_payment' else null end
  where id = v_id;

  for v_item in select * from jsonb_array_elements(p -> 'items') loop
    v_n    := v_n + 1;
    v_prod := nullif(v_item ->> 'product_id', '')::bigint;
    v_part := nullif(v_item ->> 'part_id', '')::bigint;
    v_qty  := nullif(v_item ->> 'qty', '')::integer;
    v_cost := nullif(v_item ->> 'unit_cost', '')::numeric;
    v_disc := coalesce(nullif(v_item ->> 'discount', '')::numeric, 0);

    if v_qty is null or v_qty <= 0 then raise exception 'Line %: quantity must be at least 1', v_n; end if;
    if v_cost is null or v_cost < 0 then raise exception 'Line %: enter the buying price', v_n; end if;
    if v_disc < 0 or v_disc > v_qty * v_cost then raise exception 'Line %: the discount is more than the line', v_n; end if;
    v_devices := array(select btrim(d) from jsonb_array_elements_text(coalesce(v_item -> 'add_devices', '[]'::jsonb)) d where btrim(d) <> '');
    -- The catalogue's own rule, checked here because finalising can be someone else.
    if v_part is not null and cardinality(v_devices) > 0
       and not (public.has_role('Admin'::staff_role)
                or (public.is_admin_cashier() and public.module_can_write('Inventory') and public.may('manage_catalogue'))) then
      raise exception 'Line %: only an Admin can change a part''s compatible devices', v_n;
    end if;
    if v_part is not null then
      if not exists (select 1 from public.repair_parts where id = v_part) then
        raise exception 'Line %: that repair part no longer exists', v_n;
      end if;
    elsif v_prod is not null then
      if not exists (select 1 from public.accessory_products where id = v_prod) then
        raise exception 'Line %: that product no longer exists', v_n;
      end if;
    elsif jsonb_typeof(v_item -> 'new_part') = 'object' then
      if coalesce(btrim(v_item -> 'new_part' ->> 'name'), '') = '' or coalesce(btrim(v_item -> 'new_part' ->> 'sku'), '') = '' then
        raise exception 'Line %: the new repair part needs a name and SKU', v_n;
      end if;
    elsif coalesce(btrim(v_item -> 'new_product' ->> 'name'), '') = '' then
      raise exception 'Line %: pick a product or describe the new one', v_n;
    end if;

    insert into public.purchase_invoice_items (
      invoice_id, product_id, new_product, part_id, new_part, description, qty, unit_cost, expected_sell_price,
      discount, tax_pct, update_selling_price,
      supplier_warranty_days, supplier_warranty_start, supplier_warranty_notes, supplier_warranty_terms,
      customer_warranty_days, sort_order, supplier_barcode, add_devices
    ) values (
      v_id,
      case when v_part is null then v_prod end,
      case when v_part is null and v_prod is null and jsonb_typeof(v_item -> 'new_product') = 'object' then v_item -> 'new_product' end,
      v_part,
      case when v_part is null and v_prod is null and jsonb_typeof(v_item -> 'new_part') = 'object' then v_item -> 'new_part' end,
      coalesce(v_item ->> 'description', ''), v_qty, v_cost,
      greatest(coalesce(nullif(v_item ->> 'expected_sell_price', '')::numeric, 0), 0),
      v_disc, least(greatest(coalesce(nullif(v_item ->> 'tax_pct', '')::numeric, 0), 0), 100),
      coalesce((v_item ->> 'update_selling_price')::boolean, false),
      nullif(v_item ->> 'supplier_warranty_days', '')::integer,
      coalesce(nullif(v_item ->> 'supplier_warranty_start', ''), 'invoice_date'),
      coalesce(v_item ->> 'supplier_warranty_notes', ''),
      coalesce(v_item ->> 'supplier_warranty_terms', ''),
      nullif(v_item ->> 'customer_warranty_days', '')::integer,
      v_n,
      coalesce(btrim(v_item ->> 'supplier_barcode'), ''),
      case when v_part is null then '{}'::text[] else v_devices end
    );
  end loop;

  perform public._purchase_invoice_recalc(v_id);
  return v_id;
end $$;

create or replace function public.tg_purchase_invoice_add_devices()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_it record;
  v_d  text;
begin
  for v_it in
    select part_id, add_devices from public.purchase_invoice_items
     where invoice_id = new.id and part_id is not null and cardinality(add_devices) > 0
     order by sort_order
  loop
    foreach v_d in array v_it.add_devices loop
      update public.repair_parts p
         set compatible_with = p.compatible_with || btrim(v_d)
       where p.id = v_it.part_id
         and not exists (select 1 from unnest(p.compatible_with) e where lower(btrim(e)) = lower(btrim(v_d)));
    end loop;
  end loop;
  return new;
end $$;

drop trigger if exists trg_purchase_invoice_add_devices on public.purchase_invoices;
create trigger trg_purchase_invoice_add_devices
  after update of status on public.purchase_invoices
  for each row
  when (old.status = 'Draft' and new.status = 'Open')
  execute function public.tg_purchase_invoice_add_devices();
