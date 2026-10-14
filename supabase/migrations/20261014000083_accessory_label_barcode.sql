-- ============================================================================
-- Mano Mobile — a numeric shop barcode on every accessory
--
-- The shop's own label used to encode the item code (e.g. MCB-005). That code
-- is built from the category, so it reads well to a person but says nothing a
-- scanner needs, and it prints as a long, wide CODE128 strip.
--
-- The same item is also bought in several batches at different prices, and
-- each batch is its own product row so its cost and price stay its own. The
-- packaging barcode is the same on every batch — it can't tell them apart.
-- The shop's label has to.
--
-- So every product row now gets its own label_barcode: a 13-digit EAN-13
-- assigned by the database, never typed. It starts with "20", the GS1 range
-- set aside for in-store use, so it can never collide with a manufacturer's
-- barcode off a box. The item code stays as the human-readable reference.
-- ============================================================================

create sequence if not exists public.accessory_label_barcode_seq;

-- "20" + 10-digit running number + EAN-13 check digit.
create or replace function public.next_accessory_label_barcode()
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  body  text := '20' || lpad(nextval('public.accessory_label_barcode_seq')::text, 10, '0');
  total int  := 0;
  i     int;
begin
  -- EAN-13: digits in odd positions weigh 1, even positions 3.
  for i in 1..12 loop
    total := total + substr(body, i, 1)::int * case when i % 2 = 0 then 3 else 1 end;
  end loop;
  return body || ((10 - total % 10) % 10)::text;
end $$;

comment on function public.next_accessory_label_barcode() is
  'Next in-store EAN-13 (prefix 20) for an accessory label. Unique per call; check digit included.';

-- A volatile default is evaluated once per existing row, so every product
-- already on the shelf gets its own number here too.
alter table public.accessory_products
  add column if not exists label_barcode text not null default public.next_accessory_label_barcode();

create unique index if not exists accessory_products_label_barcode_key
  on public.accessory_products (label_barcode);

comment on column public.accessory_products.label_barcode is
  'The shop''s own numeric barcode (in-store EAN-13, prefix 20), printed on the shelf label. Database-assigned and unique per product row — so each batch of the same item scans to its own price.';
