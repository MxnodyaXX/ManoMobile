-- ============================================================================
-- Mano Mobile — repair parts on supplier invoices, in batches, and buying trips
--
-- One trip to Colombo comes back with accessories and repair parts on the same
-- bills. Supplier invoices only knew accessories, and a repair part had a single
-- cost price, so buying at a new price rewrote the cost of every old job.
--
-- ── Past records come first ─────────────────────────────────────────────────
-- Old jobs and old sales are costed by reading today's price off the catalogue.
-- So before anything here can change a price, the cost of everything already
-- done is written down, at exactly the figure the screens show today:
--   repair_part_requests.unit_cost   parts already issued to jobs
--   repair_parts.legacy_cost         older jobs that only typed a part's name
--   sale_items.unit_cost             accessories already sold
-- From here on each is stamped when it happens, from the batch it came out of.
-- This migration moves no stock and rewrites no job, sale or invoice figure.
--
-- ── The model ───────────────────────────────────────────────────────────────
-- Same as accessories (migration 20261021000085), kept in step the same way:
--   repair_part_batches           every lot of a part: cost, supplier, invoice,
--                                 how many are left. Used oldest first.
--   repair_part_stock_movements   every change to a part's stock, signed.
--   purchase_invoice_items        a line is now an accessory or a repair part.
--   purchase_trips                a name for one buying trip, with what the trip
--                                 itself cost. Links bills; each bill stays its own.
-- ============================================================================

do $$
begin
  if to_regclass('public.purchase_invoices') is null then
    raise exception 'Run 20261021000085_supplier_purchasing.sql first';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'repair_parts' and column_name = 'brand') then
    raise exception 'Run 20261107000094_repair_part_brand.sql first';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'repair_parts' and column_name = 'supplier') then
    raise exception 'Run 20261008000072_repair_part_supplier.sql first';
  end if;
end $$;

-- ── Freeze what has already happened ────────────────────────────────────────
-- Each only when its column is new, so running this again can't re-freeze
-- anything at a price set since.

do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'repair_part_requests' and column_name = 'unit_cost') then
    alter table public.repair_part_requests add column unit_cost numeric(12,2);
    -- A request whose part has gone costs 0 today, so that's what it keeps.
    update public.repair_part_requests r
       set unit_cost = coalesce((select p.cost_price from public.repair_parts p where p.sku = r.part_sku), 0)
     where r.status in ('Approved', 'Issued');
  end if;

  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'repair_parts' and column_name = 'legacy_cost') then
    alter table public.repair_parts add column legacy_cost numeric(12,2);
    update public.repair_parts set legacy_cost = cost_price;
  end if;

  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'sale_items' and column_name = 'unit_cost') then
    alter table public.sale_items add column unit_cost numeric(12,2);
    -- A line whose product is gone has no cost on record today, and stays that way.
    update public.sale_items s
       set unit_cost = p.buying_price
      from public.accessory_products p
     where s.kind = 'accessory'
       and s.reference_id ~ '^\d+$'
       and p.id = s.reference_id::bigint;
  end if;
end $$;

comment on column public.repair_part_requests.unit_cost is
  'What each unit cost when it was issued, so a later purchase at a new price leaves this job alone. Null until issued.';
comment on column public.repair_parts.legacy_cost is
  'cost_price when batches began. Older jobs have only the part''s name typed on them and are costed from this. Null on parts added since.';
comment on column public.sale_items.unit_cost is
  'What each unit cost when it was sold, so a later purchase at a new price leaves this sale alone. Accessory lines only.';

-- A new accessory line: what its batches say it cost, else the price right now.
create or replace function public.tg_sale_item_unit_cost()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.kind = 'accessory' and new.unit_cost is null and new.reference_id ~ '^\d+$' then
    select round(sum(-m.qty * m.unit_cost) / nullif(sum(-m.qty), 0), 2) into new.unit_cost
      from public.accessory_stock_movements m
     where m.invoice_no = new.invoice_no
       and m.product_id = new.reference_id::bigint
       and m.kind = 'sale';
    if new.unit_cost is null then
      select buying_price into new.unit_cost from public.accessory_products where id = new.reference_id::bigint;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_sale_item_unit_cost on public.sale_items;
create trigger trg_sale_item_unit_cost
  before insert on public.sale_items
  for each row execute function public.tg_sale_item_unit_cost();

-- ── Buying trips ────────────────────────────────────────────────────────────

create table if not exists public.purchase_trips (
  id         bigint generated by default as identity primary key,
  name       text not null check (length(btrim(name)) > 0),
  trip_date  date not null default current_date,
  -- Bus, fuel, parking: what the trip cost on top of the bills. Nobody is owed
  -- this, so it stays out of every supplier balance.
  cost       numeric(12,2) not null default 0 check (cost >= 0),
  notes      text not null default '',
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists purchase_trips_date_idx on public.purchase_trips (trip_date desc);

alter table public.purchase_invoices
  add column if not exists trip_id bigint references public.purchase_trips (id) on delete set null;
create index if not exists purchase_invoices_trip_idx on public.purchase_invoices (trip_id);

-- ── Invoice lines can be repair parts ───────────────────────────────────────

alter table public.purchase_invoice_items
  -- Restrict: a part bought on an invoice keeps its purchase history.
  add column if not exists part_id  bigint references public.repair_parts (id) on delete restrict,
  -- {name, sku, category, brand, compatible_with[], reorder_level, part_word}
  -- for a part not in the catalogue yet; created at finalise.
  add column if not exists new_part jsonb;
create index if not exists purchase_invoice_items_part_idx on public.purchase_invoice_items (part_id);

do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
     where conrelid = 'public.purchase_invoice_items'::regclass and contype = 'c'
       and pg_get_constraintdef(oid) like '%new_product%'
  loop
    execute format('alter table public.purchase_invoice_items drop constraint %I', c);
  end loop;
end $$;

alter table public.purchase_invoice_items
  add constraint purchase_invoice_items_has_something
  check (num_nonnulls(product_id, new_product, part_id, new_part) > 0);

-- ── Part batches and movements ──────────────────────────────────────────────

create sequence if not exists public.repair_part_batch_no_seq;

create table if not exists public.repair_part_batches (
  id                      bigint generated by default as identity primary key,
  batch_no                text not null unique default ('PBT-' || lpad(nextval('public.repair_part_batch_no_seq')::text, 6, '0')),
  part_id                 bigint not null references public.repair_parts (id) on delete cascade,
  source                  text not null check (source in ('purchase', 'opening', 'adjustment')),
  invoice_id              bigint references public.purchase_invoices (id) on delete set null,
  invoice_item_id         bigint references public.purchase_invoice_items (id) on delete set null,
  receipt_id              bigint references public.purchase_receipts (id) on delete set null,
  supplier_id             bigint references public.accessory_suppliers (id) on delete set null,
  supplier_name           text not null default '',
  received_on             date not null default current_date,
  qty_received            integer not null check (qty_received > 0),
  qty_available           integer not null check (qty_available >= 0 and qty_available <= qty_received),
  unit_cost               numeric(12,2) not null default 0,
  supplier_warranty_days  integer,
  supplier_warranty_start text,
  supplier_warranty_notes text not null default '',
  supplier_warranty_terms text not null default '',
  status                  text not null default 'Active' check (status in ('Active', 'Depleted', 'Reversed')),
  created_by              uuid default auth.uid() references auth.users (id) on delete set null,
  created_at              timestamptz not null default now()
);
create index if not exists repair_part_batches_part_idx on public.repair_part_batches (part_id, received_on, id) where qty_available > 0;
create index if not exists repair_part_batches_invoice_idx on public.repair_part_batches (invoice_id);

-- Same rule as accessory batches.
drop trigger if exists trg_repair_part_batch_status on public.repair_part_batches;
create trigger trg_repair_part_batch_status
  before insert or update on public.repair_part_batches
  for each row execute function public.tg_accessory_batch_status();

create table if not exists public.repair_part_stock_movements (
  id                  bigint generated by default as identity primary key,
  part_id             bigint not null references public.repair_parts (id) on delete cascade,
  batch_id            bigint references public.repair_part_batches (id) on delete set null,
  kind                text not null check (kind in ('purchase', 'opening', 'job', 'adjustment_in', 'adjustment_out', 'reversal')),
  qty                 integer not null check (qty <> 0),
  unit_cost           numeric(12,2),
  request_id          bigint references public.repair_part_requests (id) on delete set null,
  purchase_invoice_id bigint references public.purchase_invoices (id) on delete set null,
  note                text not null default '',
  created_by          uuid default auth.uid() references auth.users (id) on delete set null,
  created_at          timestamptz not null default now()
);
create index if not exists repair_part_stock_movements_part_idx on public.repair_part_stock_movements (part_id, created_at desc);
create index if not exists repair_part_stock_movements_request_idx on public.repair_part_stock_movements (request_id) where request_id is not null;

alter table public.purchase_trips              enable row level security;
alter table public.repair_part_batches         enable row level security;
alter table public.repair_part_stock_movements enable row level security;

do $$
declare t text;
begin
  foreach t in array array['purchase_trips', 'repair_part_batches', 'repair_part_stock_movements'] loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.is_staff())', t || '_select', t);
  end loop;
end $$;

-- ── Keeping part batches in step with stock ─────────────────────────────────
-- repair_parts.stock stays the number every screen reads. Stock going down comes
-- out of the oldest batch first (what was on the shelf before batches began goes
-- first of all); stock going up by hand becomes an adjustment batch.

create or replace function public.tg_repair_part_stock_batches()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_delta     integer;
  v_remaining integer;
  v_take      integer;
  v_b         record;
  v_request   bigint := nullif(current_setting('mm.part_request', true), '')::bigint;
  v_batch     bigint;
begin
  if coalesce(current_setting('mm.stock_source', true), '') = 'managed' then
    return new;
  end if;

  v_delta := new.stock - case when tg_op = 'INSERT' then 0 else old.stock end;
  if v_delta = 0 then return new; end if;

  if v_delta > 0 then
    insert into public.repair_part_batches (part_id, source, supplier_name, received_on, qty_received, qty_available, unit_cost)
    values (new.id, case when tg_op = 'INSERT' then 'opening' else 'adjustment' end,
            coalesce(new.supplier, ''), current_date, v_delta, v_delta, new.cost_price)
    returning id into v_batch;
    insert into public.repair_part_stock_movements (part_id, batch_id, kind, qty, unit_cost, note)
    values (new.id, v_batch, case when tg_op = 'INSERT' then 'opening' else 'adjustment_in' end, v_delta, new.cost_price,
            case when tg_op = 'INSERT' then 'Stock entered with the part' else 'Stock adjusted' end);
  else
    v_remaining := -v_delta;
    for v_b in
      select id, qty_available, unit_cost from public.repair_part_batches
       where part_id = new.id and qty_available > 0 and status <> 'Reversed'
       order by (source = 'opening') desc, received_on, id
       for update
    loop
      exit when v_remaining <= 0;
      v_take := least(v_remaining, v_b.qty_available);
      update public.repair_part_batches set qty_available = qty_available - v_take where id = v_b.id;
      insert into public.repair_part_stock_movements (part_id, batch_id, kind, qty, unit_cost, request_id, note)
      values (new.id, v_b.id, case when v_request is not null then 'job' else 'adjustment_out' end, -v_take, v_b.unit_cost, v_request,
              case when v_request is not null then '' else 'Stock adjusted' end);
      v_remaining := v_remaining - v_take;
    end loop;
    -- Stock no batch accounts for: the count must still be recorded.
    if v_remaining > 0 then
      insert into public.repair_part_stock_movements (part_id, kind, qty, unit_cost, request_id, note)
      values (new.id, case when v_request is not null then 'job' else 'adjustment_out' end, -v_remaining, new.cost_price, v_request, 'No batch to take it from');
    end if;
  end if;
  return new;
end $$;

-- Opening batches for what is on the shelf today, before the trigger so they're
-- written once, at the cost those parts carry now.
insert into public.repair_part_batches (part_id, source, supplier_name, received_on, qty_received, qty_available, unit_cost)
select p.id, 'opening', coalesce(p.supplier, ''), current_date, p.stock, p.stock, p.cost_price
  from public.repair_parts p
 where p.stock > 0
   and not exists (select 1 from public.repair_part_batches b where b.part_id = p.id);

insert into public.repair_part_stock_movements (part_id, batch_id, kind, qty, unit_cost, note)
select b.part_id, b.id, 'opening', b.qty_received, b.unit_cost, 'Stock on hand when batches began'
  from public.repair_part_batches b
 where b.source = 'opening'
   and not exists (select 1 from public.repair_part_stock_movements m where m.batch_id = b.id);

drop trigger if exists trg_repair_part_stock_batches on public.repair_parts;
create trigger trg_repair_part_stock_batches
  after insert or update of stock on public.repair_parts
  for each row execute function public.tg_repair_part_stock_batches();

-- ── Issuing a part stamps its cost ──────────────────────────────────────────
-- Copied from 20260830000007. Added: mm.part_request, so the movements name this
-- request, and unit_cost, read back from those movements.
create or replace function public.resolve_part_request(
  p_request_id bigint,
  p_status     part_request_status
) returns public.repair_part_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  req    public.repair_part_requests;
  v_cost numeric;
begin
  if not public.is_staff() then
    raise exception 'Not authorised to resolve part requests';
  end if;

  if not public.may('approve_parts') then
    raise exception 'You do not have permission to approve part requests';
  end if;

  if p_status not in ('Approved', 'Rejected') then
    raise exception 'resolve_part_request expects Approved or Rejected, got %', p_status;
  end if;

  select * into req
    from public.repair_part_requests
   where id = p_request_id
     for update;

  if not found then
    raise exception 'Part request % not found', p_request_id;
  end if;

  if req.status <> 'Pending' then
    return req;
  end if;

  if p_status = 'Approved' then
    if req.part_sku is null then
      raise exception 'That part is no longer in the catalogue, so stock cannot be deducted';
    end if;

    perform set_config('mm.part_request', p_request_id::text, true);
    update public.repair_parts
       set stock = stock - req.quantity
     where sku = req.part_sku
       and stock >= req.quantity;

    if not found then
      raise exception 'Not enough % in stock to approve % unit(s)', req.part_sku, req.quantity;
    end if;
    perform set_config('mm.part_request', '', true);

    select round(sum(-m.qty * m.unit_cost) / nullif(sum(-m.qty), 0), 2) into v_cost
      from public.repair_part_stock_movements m
     where m.request_id = p_request_id;
    if v_cost is null then
      select cost_price into v_cost from public.repair_parts where sku = req.part_sku;
    end if;
  end if;

  update public.repair_part_requests
     set status      = p_status,
         resolved_at = now(),
         resolved_by = auth.uid(),
         unit_cost   = v_cost
   where id = p_request_id
  returning * into req;

  return req;
end $$;

-- ── Trips ───────────────────────────────────────────────────────────────────

create or replace function public.save_purchase_trip(p jsonb)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id   bigint := nullif(p ->> 'id', '')::bigint;
  v_name text := btrim(coalesce(p ->> 'name', ''));
  v_cost numeric := coalesce(nullif(p ->> 'cost', '')::numeric, 0);
begin
  perform public._purchasing_guard();
  if v_name = '' then raise exception 'Give the trip a name'; end if;
  if v_cost < 0 then raise exception 'The trip cost can''t be negative'; end if;

  if v_id is null then
    insert into public.purchase_trips (name, trip_date, cost, notes)
    values (v_name, coalesce(nullif(p ->> 'trip_date', '')::date, current_date), v_cost, coalesce(p ->> 'notes', ''))
    returning id into v_id;
  else
    update public.purchase_trips
       set name = v_name, trip_date = coalesce(nullif(p ->> 'trip_date', '')::date, trip_date),
           cost = v_cost, notes = coalesce(p ->> 'notes', '')
     where id = v_id;
    if not found then raise exception 'Trip % not found', v_id; end if;
  end if;
  return v_id;
end $$;

-- The bills stay; they just stop being linked to a trip.
create or replace function public.delete_purchase_trip(p_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._purchasing_guard();
  delete from public.purchase_trips where id = p_id;
end $$;

-- ── Balances: same view, plus the trip ──────────────────────────────────────

drop view if exists public.purchase_invoice_summary;
create view public.purchase_invoice_summary
with (security_invoker = true) as
select i.*,
       t.name                                      as trip_name,
       coalesce(p.paid, 0)                         as paid,
       greatest(i.total - coalesce(p.paid, 0), 0)  as outstanding,
       coalesce(q.qty, 0)                          as qty_ordered,
       coalesce(q.received, 0)                     as qty_received,
       coalesce(q.lines, 0)                        as line_count
  from public.purchase_invoices i
  left join public.purchase_trips t on t.id = i.trip_id
  left join (
    select a.invoice_id, sum(a.amount) as paid
      from public.supplier_payment_allocations a
      join public.supplier_payments sp on sp.id = a.payment_id and sp.status = 'Valid'
     group by a.invoice_id
  ) p on p.invoice_id = i.id
  left join (
    select invoice_id, sum(qty) as qty, sum(received_qty) as received, count(*) as lines
      from public.purchase_invoice_items group by invoice_id
  ) q on q.invoice_id = i.id;

grant select on public.purchase_invoice_summary to authenticated;

-- ── Save a draft: copied from 085, adding trip_id, part_id and new_part ─────

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
      customer_warranty_days, sort_order
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
      v_n
    );
  end loop;

  perform public._purchase_invoice_recalc(v_id);
  return v_id;
end $$;

-- ── Receive: copied from 085, adding the repair part branch ─────────────────

create or replace function public.receive_purchase_invoice(
  p_id bigint, p_lines jsonb default null, p_received_on date default current_date, p_note text default ''
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv     public.purchase_invoices;
  v_it      record;
  v_q       integer;
  v_cost    numeric;
  v_receipt bigint;
  v_batch   bigint;
  v_total   integer := 0;
begin
  perform public._purchasing_guard();
  select * into v_inv from public.purchase_invoices where id = p_id for update;
  if not found then raise exception 'Purchase invoice % not found', p_id; end if;
  if v_inv.status <> 'Open' then
    raise exception 'Only a finalised invoice can be received (this one is %)', v_inv.status;
  end if;

  -- Batches and stock are written here, so the stock triggers stand aside.
  perform set_config('mm.stock_source', 'managed', true);

  insert into public.purchase_receipts (invoice_id, received_on, note)
  values (p_id, coalesce(p_received_on, current_date), coalesce(p_note, ''))
  returning id into v_receipt;

  for v_it in
    select * from public.purchase_invoice_items where invoice_id = p_id order by sort_order for update
  loop
    if p_lines is null then
      v_q := v_it.qty - v_it.received_qty;
    else
      select coalesce(sum((e ->> 'qty')::integer), 0) into v_q
        from jsonb_array_elements(p_lines) e where (e ->> 'item_id')::bigint = v_it.id;
    end if;
    continue when v_q is null or v_q = 0;
    if v_q < 0 or v_q > v_it.qty - v_it.received_qty then
      raise exception '%: at most % can still be received', coalesce(nullif(v_it.description, ''), 'Line ' || v_it.sort_order), v_it.qty - v_it.received_qty;
    end if;
    if v_it.product_id is null and v_it.part_id is null then
      raise exception 'Line % has no product yet — finalise the invoice first', v_it.sort_order;
    end if;

    v_cost := round(v_it.line_total / v_it.qty, 2);

    if v_it.part_id is not null then
      insert into public.repair_part_batches (
        part_id, source, invoice_id, invoice_item_id, receipt_id, supplier_id, supplier_name,
        received_on, qty_received, qty_available, unit_cost,
        supplier_warranty_days, supplier_warranty_start, supplier_warranty_notes, supplier_warranty_terms
      ) values (
        v_it.part_id, 'purchase', p_id, v_it.id, v_receipt, v_inv.supplier_id, v_inv.supplier_name,
        coalesce(p_received_on, current_date), v_q, v_q, v_cost,
        v_it.supplier_warranty_days, v_it.supplier_warranty_start, v_it.supplier_warranty_notes, v_it.supplier_warranty_terms
      ) returning id into v_batch;

      -- cost_price becomes the latest price, for what's quoted from here on.
      -- Anything already issued has its own cost written down.
      update public.repair_parts
         set stock      = stock + v_q,
             cost_price = v_cost,
             supplier   = v_inv.supplier_name
       where id = v_it.part_id;

      insert into public.repair_part_stock_movements (part_id, batch_id, kind, qty, unit_cost, purchase_invoice_id, note)
      values (v_it.part_id, v_batch, 'purchase', v_q, v_cost, p_id, v_inv.supplier_name || ' ' || v_inv.invoice_no);
    else
      insert into public.accessory_batches (
        product_id, source, invoice_id, invoice_item_id, receipt_id, supplier_id, supplier_name,
        received_on, qty_received, qty_available, unit_cost, expected_sell_price,
        supplier_warranty_days, supplier_warranty_start, supplier_warranty_notes, supplier_warranty_terms,
        customer_warranty_days
      ) values (
        v_it.product_id, 'purchase', p_id, v_it.id, v_receipt, v_inv.supplier_id, v_inv.supplier_name,
        coalesce(p_received_on, current_date), v_q, v_q, v_cost, nullif(v_it.expected_sell_price, 0),
        v_it.supplier_warranty_days, v_it.supplier_warranty_start, v_it.supplier_warranty_notes, v_it.supplier_warranty_terms,
        v_it.customer_warranty_days
      ) returning id into v_batch;

      update public.accessory_products
         set stock         = stock + v_q,
             buying_price  = v_cost,
             selling_price = case when v_it.update_selling_price and v_it.expected_sell_price > 0
                                  then v_it.expected_sell_price else selling_price end,
             supplier      = v_inv.supplier_name
       where id = v_it.product_id;

      insert into public.accessory_stock_movements (product_id, batch_id, kind, qty, unit_cost, purchase_invoice_id, note)
      values (v_it.product_id, v_batch, 'purchase', v_q, v_cost, p_id, v_inv.supplier_name || ' ' || v_inv.invoice_no);
    end if;

    update public.purchase_invoice_items set received_qty = received_qty + v_q where id = v_it.id;
    v_total := v_total + v_q;
  end loop;

  if v_total = 0 then raise exception 'Nothing to receive — enter a quantity on at least one line'; end if;

  perform public._purchase_event(p_id, 'received', v_total || ' unit(s) received' || case when coalesce(p_note, '') <> '' then ' — ' || p_note else '' end);
  perform set_config('mm.stock_source', '', true);
  return v_receipt;
end $$;

-- ── Finalise: copied from 085, adding new repair parts ──────────────────────

create or replace function public.finalise_purchase_invoice(p_id bigint, p_receive_all boolean default false)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv  public.purchase_invoices;
  v_it   record;
  v_np   jsonb;
  v_code text;
  v_new  bigint;
  v_b    text;
  v_pay  jsonb;
begin
  perform public._purchasing_guard();
  select * into v_inv from public.purchase_invoices where id = p_id for update;
  if not found then raise exception 'Purchase invoice % not found', p_id; end if;
  if v_inv.status <> 'Draft' then raise exception 'This invoice is already %', v_inv.status; end if;

  for v_it in
    select * from public.purchase_invoice_items
     where invoice_id = p_id and product_id is null and new_product is not null
     order by sort_order for update
  loop
    v_np   := v_it.new_product;
    v_code := btrim(coalesce(v_np ->> 'code', ''));
    if v_code = '' then
      raise exception 'New product "%" needs an item code', v_np ->> 'name';
    end if;
    if exists (select 1 from public.accessory_products where lower(code) = lower(v_code)) then
      raise exception 'Item code % is already used — select that product instead of creating a new one', v_code;
    end if;
    if exists (
      select 1 from public.accessory_products
       where lower(btrim(name)) = lower(btrim(v_np ->> 'name'))
         and lower(btrim(brand)) = lower(btrim(coalesce(v_np ->> 'brand', '')))
         and lower(btrim(model)) = lower(btrim(coalesce(v_np ->> 'model', '')))
    ) then
      raise exception '"%" already exists in the catalogue — select it so this delivery becomes a new batch of it', v_np ->> 'name';
    end if;

    insert into public.accessory_products (
      code, name, brand, category, subcategory, model, description,
      buying_price, selling_price, stock, min_stock, supplier, created_by
    ) values (
      v_code, btrim(v_np ->> 'name'), coalesce(v_np ->> 'brand', ''), coalesce(v_np ->> 'category', ''),
      coalesce(v_np ->> 'subcategory', ''), coalesce(v_np ->> 'model', ''), coalesce(v_np ->> 'description', ''),
      round(v_it.line_total / v_it.qty, 2), v_it.expected_sell_price, 0,
      coalesce(nullif(v_np ->> 'min_stock', '')::integer, 5), v_inv.supplier_name, auth.uid()
    ) returning id into v_new;

    for v_b in select btrim(x) from jsonb_array_elements_text(coalesce(v_np -> 'barcodes', '[]'::jsonb)) x loop
      if v_b <> '' then
        insert into public.accessory_barcodes (product_id, barcode) values (v_new, v_b)
        on conflict (product_id, barcode) do nothing;
      end if;
    end loop;

    update public.purchase_invoice_items set product_id = v_new, update_selling_price = false where id = v_it.id;
    perform public._purchase_event(p_id, 'product_created', btrim(v_np ->> 'name') || ' (' || v_code || ') added to the catalogue');
  end loop;

  for v_it in
    select * from public.purchase_invoice_items
     where invoice_id = p_id and part_id is null and new_part is not null
     order by sort_order for update
  loop
    -- Adding to the parts catalogue is limited to the same people as its own screen.
    if not (public.has_role('Admin'::staff_role)
            or (public.is_admin_cashier() and public.module_can_write('Inventory') and public.may('manage_catalogue'))) then
      raise exception 'Only an Admin can add a new repair part. Add "%" to the catalogue first, or ask an Admin to finalise this invoice.', v_it.new_part ->> 'name';
    end if;
    v_np   := v_it.new_part;
    v_code := btrim(coalesce(v_np ->> 'sku', ''));
    if v_code = '' then
      raise exception 'New repair part "%" needs a SKU', v_np ->> 'name';
    end if;
    if exists (select 1 from public.repair_parts where lower(sku) = lower(v_code)) then
      raise exception 'SKU % is already used — select that part instead of creating a new one', v_code;
    end if;
    if exists (
      select 1 from public.repair_parts
       where lower(btrim(name)) = lower(btrim(v_np ->> 'name'))
         and lower(btrim(coalesce(brand, ''))) = lower(btrim(coalesce(v_np ->> 'brand', '')))
    ) then
      raise exception '"%" is already in the catalogue — select it so this delivery becomes a new batch of it', v_np ->> 'name';
    end if;

    insert into public.repair_parts (
      sku, name, brand, category, compatible_with, stock, reorder_level, cost_price, supplier, created_by
    ) values (
      v_code, btrim(v_np ->> 'name'), coalesce(v_np ->> 'brand', ''),
      coalesce(nullif(v_np ->> 'category', ''), 'Other')::part_category,
      array(select jsonb_array_elements_text(coalesce(v_np -> 'compatible_with', '[]'::jsonb))),
      0, coalesce(nullif(v_np ->> 'reorder_level', '')::integer, 5),
      round(v_it.line_total / v_it.qty, 2), v_inv.supplier_name, auth.uid()
    ) returning id into v_new;

    update public.purchase_invoice_items set part_id = v_new where id = v_it.id;
    perform public._purchase_event(p_id, 'part_created', btrim(v_np ->> 'name') || ' (' || v_code || ') added to the parts catalogue');
  end loop;

  update public.purchase_invoices
     set status = 'Open', finalised_at = now(), finalised_by = auth.uid()
   where id = p_id;
  perform public._purchase_event(p_id, 'finalised', 'Invoice finalised — Rs ' || v_inv.total);

  v_pay := v_inv.initial_payment;
  if v_pay is not null and coalesce(nullif(v_pay ->> 'amount', '')::numeric, 0) > 0 then
    perform public.record_supplier_payment(
      v_inv.supplier_id,
      coalesce(nullif(v_pay ->> 'paid_on', '')::date, current_date),
      coalesce(nullif(v_pay ->> 'method', ''), 'Cash'),
      coalesce(v_pay ->> 'reference', ''),
      coalesce(v_pay ->> 'notes', ''),
      jsonb_build_array(jsonb_build_object('invoice_id', p_id, 'amount', (v_pay ->> 'amount')::numeric))
    );
    update public.purchase_invoices set initial_payment = null where id = p_id;
  end if;

  if p_receive_all then
    perform public.receive_purchase_invoice(p_id, null, current_date, 'Received with the invoice');
  end if;
end $$;

-- ── Void: copied from 085, adding part batches ──────────────────────────────
-- A part's cost_price stays at the voided purchase's price, as an accessory's
-- buying price does. Nothing issued depends on it, and the next purchase or an
-- edit of the part sets it.

create or replace function public.void_purchase_invoice(p_id bigint, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.purchase_invoices;
  v_b   record;
begin
  perform public._purchasing_guard();
  select * into v_inv from public.purchase_invoices where id = p_id for update;
  if not found then raise exception 'Purchase invoice % not found', p_id; end if;

  if v_inv.status = 'Draft' then
    delete from public.purchase_invoices where id = p_id;
    return;
  end if;
  if v_inv.status = 'Void' then return; end if;
  if coalesce(btrim(p_reason), '') = '' then raise exception 'Give a reason for voiding the invoice'; end if;

  if exists (
    select 1 from public.supplier_payment_allocations a
      join public.supplier_payments sp on sp.id = a.payment_id and sp.status = 'Valid'
     where a.invoice_id = p_id
  ) then
    raise exception 'This invoice has payments against it — void those payments first';
  end if;

  for v_b in
    select b.*, p.name as product_name from public.accessory_batches b
      join public.accessory_products p on p.id = b.product_id
     where b.invoice_id = p_id and b.status <> 'Reversed'
  loop
    if v_b.qty_available < v_b.qty_received then
      raise exception '% from batch % has already gone out (% of %) — it can''t be reversed. Adjust the stock instead.',
        v_b.product_name, v_b.batch_no, v_b.qty_received - v_b.qty_available, v_b.qty_received;
    end if;
  end loop;

  for v_b in
    select b.*, p.name as part_name from public.repair_part_batches b
      join public.repair_parts p on p.id = b.part_id
     where b.invoice_id = p_id and b.status <> 'Reversed'
  loop
    if v_b.qty_available < v_b.qty_received then
      raise exception '% from batch % has already gone out (% of %) — it can''t be reversed. Adjust the stock instead.',
        v_b.part_name, v_b.batch_no, v_b.qty_received - v_b.qty_available, v_b.qty_received;
    end if;
  end loop;

  perform set_config('mm.stock_source', 'managed', true);
  for v_b in select * from public.accessory_batches where invoice_id = p_id and status <> 'Reversed' for update loop
    update public.accessory_products set stock = stock - v_b.qty_received where id = v_b.product_id and stock >= v_b.qty_received;
    if not found then
      raise exception 'Stock of product % is lower than batch % — adjust the stock first', v_b.product_id, v_b.batch_no;
    end if;
    update public.accessory_batches set qty_available = 0, status = 'Reversed' where id = v_b.id;
    insert into public.accessory_stock_movements (product_id, batch_id, kind, qty, unit_cost, purchase_invoice_id, note)
    values (v_b.product_id, v_b.id, 'reversal', -v_b.qty_received, v_b.unit_cost, p_id, 'Invoice voided: ' || p_reason);
  end loop;
  for v_b in select * from public.repair_part_batches where invoice_id = p_id and status <> 'Reversed' for update loop
    update public.repair_parts set stock = stock - v_b.qty_received where id = v_b.part_id and stock >= v_b.qty_received;
    if not found then
      raise exception 'Stock of part % is lower than batch % — adjust the stock first', v_b.part_id, v_b.batch_no;
    end if;
    update public.repair_part_batches set qty_available = 0, status = 'Reversed' where id = v_b.id;
    insert into public.repair_part_stock_movements (part_id, batch_id, kind, qty, unit_cost, purchase_invoice_id, note)
    values (v_b.part_id, v_b.id, 'reversal', -v_b.qty_received, v_b.unit_cost, p_id, 'Invoice voided: ' || p_reason);
  end loop;
  perform set_config('mm.stock_source', '', true);

  update public.purchase_invoices
     set status = 'Void', voided_at = now(), voided_by = auth.uid(), void_reason = p_reason
   where id = p_id;
  perform public._purchase_event(p_id, 'voided', p_reason);
end $$;

-- ── Realtime ────────────────────────────────────────────────────────────────

do $$
declare t text;
begin
  foreach t in array array['purchase_trips', 'repair_part_batches'] loop
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
