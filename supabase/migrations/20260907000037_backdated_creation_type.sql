-- ============================================================================
-- Mano Mobile — the third door in
--
-- Two ways into the system so far: Normal (booked in, then worked on) and
-- Instant (repaired first, written up minutes later). Both describe work this
-- shop did with the system watching.
--
-- A shop that has been running for years has a drawer of work the system never
-- saw. Job books, carbon receipts, a spreadsheet — repairs that happened,
-- were paid for, and are the customer's history whether or not this database
-- knows about them. When that handset comes back, "have we seen this IMEI
-- before" should say yes.
--
-- So: 'Backdated'. Not a kind of repair — the same third fact as the other two,
-- which door the record came through. What separates it from Instant is only
-- that its dates are typed rather than taken from the clock, and that nothing
-- downstream should treat it as news: no "we have received your device" to a
-- customer who collected it in March.
--
-- Alone in its own migration because Postgres refuses to use an enum value in
-- the same transaction that added it — the index and the view that filter on
-- 'Backdated' are in 20260907000038.
-- ============================================================================

alter type job_creation_type add value if not exists 'Backdated';

comment on type job_creation_type is
  'How a job entered the system. Normal: booked in, then worked on. Instant: repaired first, written up after. Backdated: a record of work done before this system held it, entered with its own dates.';
