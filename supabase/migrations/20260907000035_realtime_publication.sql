-- ============================================================================
-- Mano Mobile — telling the other machines
--
-- Every screen in this app loaded its rows once and then never asked again.
-- Fine with one person at one counter; wrong the moment there are two. A job
-- claimed on the bench stayed "available to claim" on the cashier's screen
-- until somebody thought to refresh, and the second person to tap it was told
-- it had been taken — by themselves.
--
-- Postgres can broadcast every insert, update and delete, but only for tables
-- explicitly added to the supabase_realtime publication. That is what this
-- does. The browser side subscribes and refetches — see lib/supabase/useRealtime.
--
-- ── What is published, and what is not ──────────────────────────────────────
-- Only the tables a second person can change under you: work in progress,
-- stock counts, money taken. Reference data an admin edits once a month is
-- left out — the traffic is not worth it, and a stale category name for an
-- hour costs nobody anything.
--
-- ── This publishes changes, not data ────────────────────────────────────────
-- RLS still applies to realtime. A client is only told about rows it could
-- have selected anyway, so adding a table here grants nobody anything they
-- could not already read.
-- ============================================================================

do $$
declare
  t text;
  live text[] := array[
    -- The bench and the counter looking at the same list from two rooms.
    'repair_jobs',
    'repair_dealers',
    -- Stock: asked for on the bench, approved by an admin, booked out at the
    -- counter — three places, any of which can move the number under the others.
    'repair_parts',
    'repair_part_requests',
    'accessory_products',
    -- Money: an invoice raised on the other till belongs in this one's history
    -- and its daily total.
    'sales',
    'cash_returns',
    'credit_entries'
  ];
begin
  foreach t in array live loop
    -- to_regclass rather than a hard reference: a table that does not exist in
    -- this installation should be skipped, not abort the whole migration.
    if to_regclass('public.' || t) is null then
      continue;
    end if;

    -- Adding a table twice is an error, so ask first. This migration has to be
    -- safe to re-run.
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ── Updates need the old row too ────────────────────────────────────────────
--
-- The default REPLICA IDENTITY sends only the primary key on an update, which
-- is enough here — the client refetches rather than reading the payload — but
-- FULL makes the change legible to anything that later wants to know what
-- actually moved, at the cost of a little WAL. Worth it on the two tables
-- where "what changed" is the interesting question.
alter table public.repair_jobs replica identity full;
alter table public.repair_part_requests replica identity full;
