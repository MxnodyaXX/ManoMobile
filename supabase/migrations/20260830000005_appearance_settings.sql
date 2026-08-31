-- ============================================================================
-- Mano Mobile — appearance settings
--
-- The shop runs on screens all day under fluorescent light, and a pure-white
-- page is the wrong surface for that. Rather than picking one replacement and
-- imposing it, this lets an Admin choose the palette the whole shop sees.
--
-- Deliberately a table with room to grow: the palette is the first appearance
-- setting, not the only one anybody will ever want. Density, font size and a
-- default light/dark preference belong here too when they are asked for, which
-- is why this is not a single `palette` column bolted onto app_settings.
--
-- One row, like app_settings and email_settings — appearance is a property of
-- the shop, not of each person. A cashier and a technician standing at the same
-- counter should not be looking at two different colour schemes.
-- ============================================================================

create table if not exists public.appearance_settings (
  id          boolean primary key default true check (id),

  -- Which palette from lib/settings/appearance.ts is in force. Text rather
  -- than an enum: palettes are defined in the app, and a new one should not
  -- need a migration before an admin can select it.
  palette     text not null default 'default',

  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users (id) on delete set null
);

comment on table public.appearance_settings is
  'Shop-wide look and feel. One row. Palette ids are defined in the app, not here.';

insert into public.appearance_settings (id) values (true) on conflict (id) do nothing;

drop trigger if exists trg_appearance_settings_touch on public.appearance_settings;
create trigger trg_appearance_settings_touch
  before update on public.appearance_settings
  for each row execute function public.touch_updated_at();

alter table public.appearance_settings enable row level security;

-- Everyone reads it — the palette has to be applied on every screen in the
-- shop, including the technician's, and a page that could not read it would
-- flash the default and then correct itself.
drop policy if exists appearance_settings_select on public.appearance_settings;
create policy appearance_settings_select on public.appearance_settings
  for select to authenticated using (public.is_staff());

drop policy if exists appearance_settings_admin_write on public.appearance_settings;
create policy appearance_settings_admin_write on public.appearance_settings
  for all to authenticated
  using (public.has_role('Admin'::staff_role)) with check (public.has_role('Admin'::staff_role));
