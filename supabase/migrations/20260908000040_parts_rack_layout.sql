-- ============================================================================
-- Mano Mobile — the parts rack, as it actually stands
--
-- The bay picker shipped as a fixed 8 × 5 grid, which is a guess. The real
-- rack is two units side by side, one column three drawers tall and the next
-- four, with a gap in the middle where the shelf ends. A picker that shows
-- forty identical bays when thirty-one exist is worse than none: it invites
-- somebody to file a screen in B-7, and B-7 is a wall.
--
-- So the shape is configuration, not code. One shop-wide layout, edited by an
-- Admin, read by everyone — the same arrangement as the work rules it sits
-- beside, and for the same reason: it describes the shop, not the software.
--
-- ── Why hidden bays rather than a shape ─────────────────────────────────────
-- The obvious model is a list of columns each with its own height. It cannot
-- express the gap between the two units, or a missing drawer in the middle of
-- a column, and both are in the photograph.
--
-- A grid with holes in it can express any of that, and it keeps the bay codes
-- stable: A-3 is the third bay of the top row whatever is hidden around it, so
-- hiding a bay never renames the one next to it and never quietly moves a part
-- that is already filed.
-- ============================================================================

alter table public.app_settings
  add column if not exists parts_rack jsonb;

comment on column public.app_settings.parts_rack is
  'Shape of the spare-parts rack: {"rows":5,"cols":8,"hidden":["A-1","C-4"]}. Rows are lettered from A, columns numbered from 1, and a bay is "<row>-<col>". Null means the built-in default — the app never depends on this row existing.';

-- Deliberately left null rather than seeded. Null reads as the default layout
-- in the client, so a shop that never opens the editor sees exactly what it
-- saw before, and a shop that does gets its own shape without a migration
-- having guessed at one first.
