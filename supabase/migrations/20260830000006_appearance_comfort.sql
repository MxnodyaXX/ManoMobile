-- ============================================================================
-- Mano Mobile — screen comfort level
--
-- The palettes added alongside this table moved the page colour but left cards
-- at 93% luminance — near enough to white that staff looking at a 24" monitor
-- for ten hours a day noticed no difference. Cards are the largest bright area
-- on screen, so that is the surface that has to come down.
--
-- This dims every surface in linear light, preserving hue, in four steps:
--
--   0  Normal    ~93% card luminance   (as before)
--   1  Dim       ~75%
--   2  Dimmer    ~58%
--   3  Dimmest   ~43%
--
-- Text is deliberately not dimmed, so contrast IMPROVES as the surface darkens:
-- measured 15.9:1 at Normal down to 7.8:1 at Dimmest, against the 7:1 WCAG AAA
-- body-text bar. Legibility is not the thing being traded away here.
--
-- Defaults to 1 rather than 0. The complaint that prompted this was that the
-- out-of-the-box surface is too bright, and a fix nobody switches on is not a
-- fix. An admin can set it back to Normal in one click.
-- ============================================================================

alter table public.appearance_settings
  add column if not exists comfort smallint not null default 1
    check (comfort between 0 and 3);

comment on column public.appearance_settings.comfort is
  'How far to dim surfaces in light mode: 0 Normal, 1 Dim, 2 Dimmer, 3 Dimmest. Dark mode is already low-luminance and ignores this.';
