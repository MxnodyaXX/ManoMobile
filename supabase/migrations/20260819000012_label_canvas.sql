-- ============================================================================
-- Mano Mobile — free-form label design
--
-- The built-in layouts (product / repair tag / part) each draw a fixed
-- arrangement: logo here, barcode there, shop details underneath. That covers
-- the common labels but nothing else — adding one more line to the repair tag
-- meant editing React.
--
-- `elements` turns a template into a canvas: an ordered list of boxes placed
-- in millimetres on the label, each one a piece of text, an image, a barcode
-- or a rule. Text may contain {{tokens}} which resolve per print, so one
-- design serves every job.
--
-- Kept as jsonb rather than a child table on purpose. Elements are only ever
-- read and written as a whole design — nothing queries "all text boxes across
-- templates" — and a child table would turn every save into a diff.
--
-- An empty array means "use the built-in layout for this template's `layout`",
-- so every existing template keeps printing exactly as it does today.
-- ============================================================================

alter table public.barcode_templates
  add column if not exists elements jsonb not null default '[]'::jsonb;

-- Guard the shape at the edge: an object here instead of an array would break
-- every renderer that maps over it, and it is far easier to reject on write
-- than to defend against on read in three components.
do $$ begin
  alter table public.barcode_templates
    add constraint barcode_templates_elements_is_array
    check (jsonb_typeof(elements) = 'array');
exception when duplicate_object then null; end $$;

comment on column public.barcode_templates.elements is
  'Ordered label elements ({type,x,y,w,h,...} in mm). Empty array = use the built-in layout named by `layout`.';
