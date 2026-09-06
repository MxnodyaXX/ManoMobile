-- ============================================================================
-- Mano Mobile — when the device cannot be identified
--
-- A dead handset cannot be asked what it is. No power, no display, locked, or
-- damaged past reading the label: the model number and IMEI are simply not
-- obtainable, and the technician is the person who finds that out.
--
-- Those fields have always been optional at completion, so nothing was ever
-- blocked. What was missing is the difference between two blanks:
--
--   "nobody has filled this in yet"  — somebody should go and look
--   "this cannot be filled in"       — somebody already did
--
-- Left the same, the second is indistinguishable from the first, and the job
-- gets re-opened by whoever notices the gap next. Worse, a technician under
-- pressure to fill a box invents a model number, and an invented one is harder
-- to undo than an empty one — it looks like data.
--
-- Deliberately not inferred from the reported fault. "No power" at intake is
-- what the customer said; the technician's diagnosis is the fact, and the two
-- disagree often enough that guessing from the first would be wrong on real
-- jobs.
-- ============================================================================

alter table public.repair_jobs
  add column if not exists device_unidentified_reason text;

comment on column public.repair_jobs.device_unidentified_reason is
  'Why the model number and IMEI could not be read, when the technician could not obtain them. Null means they were never asked for or were supplied — an empty model number with a reason here is a settled question, not an outstanding one.';
