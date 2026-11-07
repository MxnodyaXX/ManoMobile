-- ============================================================================
-- Mano Mobile — a brand on each repair part type
--
-- A part's name is now model + brand + part: "Samsung M02s Crown Display". The
-- brand is kept in its own column as well, because the types of one part are
-- listed together by their name with the brand taken out. Without it the screen
-- couldn't tell the Crown and HD+ displays are the same part.
-- ============================================================================

alter table public.repair_parts
  add column if not exists brand text not null default '';

comment on column public.repair_parts.brand is
  'Who made this type of the part, e.g. Crown. Optional. Also appears in the name; the catalogue groups types by the name without it.';
