-- ============================================================================
-- Mano Mobile — a short number on every repair part
--
-- A part's SKU is typed by hand and reads like M02-D-CROWN: fine on a bin, slow
-- to say across the bench or key in. Every row in repair_parts — so each type
-- of a part (CROWN, HD+) separately — now gets a short running number, 1001 up.
-- Assigned by the database, never typed, and never reused or changed, so a
-- number on an old label always means the same part.
--
-- The SKU stays as it is: part requests and jobs still link to parts by SKU.
-- ============================================================================

create sequence if not exists public.repair_part_no_seq start 1001;

alter table public.repair_parts
  add column if not exists part_no text;

-- One at a time and in name order, so the types of one part sit next to each
-- other in the numbering. A plain UPDATE gives no such order.
do $$
declare r record;
begin
  for r in select id from public.repair_parts where part_no is null order by lower(name), sku, id loop
    update public.repair_parts set part_no = nextval('public.repair_part_no_seq')::text where id = r.id;
  end loop;
end $$;

alter table public.repair_parts
  alter column part_no set default nextval('public.repair_part_no_seq')::text,
  alter column part_no set not null;

create unique index if not exists repair_parts_part_no_key on public.repair_parts (part_no);

-- The default runs as whoever inserts the part.
grant usage on sequence public.repair_part_no_seq to authenticated;

comment on column public.repair_parts.part_no is
  'Short identifying number for this part type, e.g. 1001. Database-assigned, unique, never reused. The SKU is still what other tables link by.';
