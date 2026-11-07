-- ============================================================================
-- Mano Mobile — old stock as its own batch
--
-- Stock found on the shelf isn't a purchase: there's no bill, nobody is owed, and
-- it shouldn't change an item's latest cost or supplier. Editing the stock number
-- doesn't do either, because that batch would take today's price.
--
-- So old stock is added directly, as a batch with its own cost. The item stays one
-- row with one stock number, and this batch is used before newer ones. It moves
-- stock up by exactly what was entered and changes no job, sale or invoice.
-- ============================================================================

alter table public.repair_part_batches
  add column if not exists manual       boolean not null default false,
  add column if not exists date_unknown boolean not null default false,
  add column if not exists note         text not null default '';

alter table public.accessory_batches
  add column if not exists manual       boolean not null default false,
  add column if not exists date_unknown boolean not null default false,
  add column if not exists note         text not null default '';

comment on column public.repair_part_batches.manual is
  'Added by hand as old stock, not from an invoice. Only these can be removed, and only while none has been used.';
comment on column public.accessory_batches.manual is
  'Added by hand as old stock, not from an invoice. Only these can be removed, and only while none has been sold.';

create or replace function public.add_old_part_stock(
  p_part_id bigint, p_qty integer, p_unit_cost numeric, p_received_on date default null, p_note text default ''
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_part  public.repair_parts;
  v_batch bigint;
begin
  perform public._purchasing_guard();
  if p_qty is null or p_qty <= 0 then raise exception 'Enter how many'; end if;
  if p_unit_cost is null or p_unit_cost < 0 then raise exception 'Enter what each one cost'; end if;
  if p_received_on > current_date then raise exception 'The date can''t be in the future'; end if;
  select * into v_part from public.repair_parts where id = p_part_id for update;
  if not found then raise exception 'That repair part no longer exists'; end if;

  perform set_config('mm.stock_source', 'managed', true);
  -- Opening batches are used first whatever their date.
  insert into public.repair_part_batches (part_id, source, manual, date_unknown, received_on, qty_received, qty_available, unit_cost, note)
  values (p_part_id, 'opening', true, p_received_on is null, coalesce(p_received_on, current_date), p_qty, p_qty, round(p_unit_cost, 2), coalesce(btrim(p_note), ''))
  returning id into v_batch;

  update public.repair_parts set stock = stock + p_qty where id = p_part_id;

  insert into public.repair_part_stock_movements (part_id, batch_id, kind, qty, unit_cost, note)
  values (p_part_id, v_batch, 'opening', p_qty, round(p_unit_cost, 2), coalesce(nullif(btrim(p_note), ''), 'Old stock added'));
  perform set_config('mm.stock_source', '', true);
  return v_batch;
end $$;

create or replace function public.add_old_accessory_stock(
  p_product_id bigint, p_qty integer, p_unit_cost numeric, p_received_on date default null, p_note text default ''
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch bigint;
  v_date  date;
begin
  perform public._purchasing_guard();
  if p_qty is null or p_qty <= 0 then raise exception 'Enter how many'; end if;
  if p_unit_cost is null or p_unit_cost < 0 then raise exception 'Enter what each one cost'; end if;
  if p_received_on > current_date then raise exception 'The date can''t be in the future'; end if;
  perform 1 from public.accessory_products where id = p_product_id for update;
  if not found then raise exception 'That product no longer exists'; end if;

  -- Accessories sell oldest date first. With no date given, it goes before
  -- whatever is on the shelf.
  v_date := coalesce(p_received_on, (
    select least(min(received_on) - 1, current_date) from public.accessory_batches
     where product_id = p_product_id and qty_available > 0 and status <> 'Reversed'
  ), current_date);

  perform set_config('mm.stock_source', 'managed', true);
  insert into public.accessory_batches (product_id, source, manual, date_unknown, received_on, qty_received, qty_available, unit_cost, note)
  values (p_product_id, 'opening', true, p_received_on is null, v_date, p_qty, p_qty, round(p_unit_cost, 2), coalesce(btrim(p_note), ''))
  returning id into v_batch;

  update public.accessory_products set stock = stock + p_qty where id = p_product_id;

  insert into public.accessory_stock_movements (product_id, batch_id, kind, qty, unit_cost, note)
  values (p_product_id, v_batch, 'opening', p_qty, round(p_unit_cost, 2), coalesce(nullif(btrim(p_note), ''), 'Old stock added'));
  perform set_config('mm.stock_source', '', true);
  return v_batch;
end $$;

-- A mistake can be taken back while none of the batch has gone out.
create or replace function public.remove_old_part_stock(p_batch_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_b public.repair_part_batches;
begin
  perform public._purchasing_guard();
  select * into v_b from public.repair_part_batches where id = p_batch_id for update;
  if not found or not v_b.manual or v_b.status = 'Reversed' then raise exception 'That batch can''t be removed'; end if;
  if v_b.qty_available < v_b.qty_received then raise exception 'Some of this batch has already been used, so it can''t be removed'; end if;

  perform set_config('mm.stock_source', 'managed', true);
  update public.repair_parts set stock = stock - v_b.qty_received where id = v_b.part_id and stock >= v_b.qty_received;
  if not found then raise exception 'Stock is lower than this batch. Correct the stock first.'; end if;
  update public.repair_part_batches set qty_available = 0, status = 'Reversed' where id = p_batch_id;
  insert into public.repair_part_stock_movements (part_id, batch_id, kind, qty, unit_cost, note)
  values (v_b.part_id, p_batch_id, 'reversal', -v_b.qty_received, v_b.unit_cost, 'Old stock removed');
  perform set_config('mm.stock_source', '', true);
end $$;

create or replace function public.remove_old_accessory_stock(p_batch_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_b public.accessory_batches;
begin
  perform public._purchasing_guard();
  select * into v_b from public.accessory_batches where id = p_batch_id for update;
  if not found or not v_b.manual or v_b.status = 'Reversed' then raise exception 'That batch can''t be removed'; end if;
  if v_b.qty_available < v_b.qty_received then raise exception 'Some of this batch has already been sold, so it can''t be removed'; end if;

  perform set_config('mm.stock_source', 'managed', true);
  update public.accessory_products set stock = stock - v_b.qty_received where id = v_b.product_id and stock >= v_b.qty_received;
  if not found then raise exception 'Stock is lower than this batch. Correct the stock first.'; end if;
  update public.accessory_batches set qty_available = 0, status = 'Reversed' where id = p_batch_id;
  insert into public.accessory_stock_movements (product_id, batch_id, kind, qty, unit_cost, note)
  values (v_b.product_id, p_batch_id, 'reversal', -v_b.qty_received, v_b.unit_cost, 'Old stock removed');
  perform set_config('mm.stock_source', '', true);
end $$;
