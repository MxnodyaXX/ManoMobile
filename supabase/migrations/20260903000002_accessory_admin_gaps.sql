-- ============================================================================
-- Mano Mobile — closing two gaps left by the accessory inventory pass
-- (20260903000001):
--
--   1. Activate/Deactivate on categories/brands/suppliers. Admin Control
--      could only Add/Edit/Delete them; deleting a category that products
--      still reference orphans their label, where deactivating just hides
--      it from new picks and leaves history alone.
--
--   2. Voiding a sale didn't restock. sales was deliberately kept as one
--      table with a description string, not a header-plus-lines pair (see
--      20260901000011's own comment) — right call for every screen that
--      only ever reads a sale back. But reversing a sale needs to know
--      exactly what it moved, and a string can't answer that. line_items
--      is the minimal fix: a nullable jsonb column, populated only by sales
--      whose stock needs to be reversible (today, just accessories), read
--      only by void_sale() below. Every other read of `sales` is unchanged.
-- ============================================================================

-- ── 1. Activate / Deactivate ────────────────────────────────────────────────

alter table public.accessory_categories add column if not exists active boolean not null default true;
alter table public.accessory_brands     add column if not exists active boolean not null default true;
alter table public.accessory_suppliers  add column if not exists active boolean not null default true;

comment on column public.accessory_categories.active is
  'Inactive categories stay on record (existing products keep their label) but drop out of the Add/Edit Product picker.';
comment on column public.accessory_brands.active is
  'Inactive brands stay on record but drop out of the Add/Edit Product picker.';
comment on column public.accessory_suppliers.active is
  'Inactive suppliers stay on record but drop out of the Add/Edit Product picker.';

-- ── 2. Structured cart lines + voiding that actually restocks ──────────────

alter table public.sales add column if not exists line_items jsonb;

comment on column public.sales.line_items is
  'Structured cart lines for sales whose stock needs to be reversible on void. Currently only accessory sales populate this: [{"type":"accessory","id":12,"qty":2}, ...]. Null/empty for repair and other sales — there is nothing there to restock.';

-- A plain `update sales set status = ''Voided''` (what SalesHistory did before
-- this) never touched stock, so a voided accessory sale left the units it sold
-- permanently gone from the count. This is the same shape as
-- sell_accessory_stock(): one definer function, one transaction, so the status
-- flip and every restock happen together or not at all. Idempotent — voiding
-- an already-voided sale returns it unchanged rather than double-crediting
-- stock on a second click.
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

  update public.sales set status = 'Voided' where id = p_sale_id
  returning * into s;

  return s;
end $$;

comment on function public.void_sale(uuid) is
  'Voids a sale and restocks every accessory line in its line_items, in one transaction. Idempotent on an already-voided sale.';

grant execute on function public.void_sale(uuid) to authenticated;
