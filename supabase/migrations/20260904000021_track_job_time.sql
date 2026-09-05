-- ============================================================================
-- Mano Mobile — whether the bench runs a clock
--
-- Every in-progress job currently shows a live timer counting up, on the card
-- and on the technician dashboard. In a shop that bills by the job and not by
-- the hour, that clock measures nothing anybody uses — and a number on screen
-- that nobody uses is not neutral: a technician watching their own elapsed
-- time tick up reads it as being timed, whether or not anyone is looking.
--
-- So it becomes a shop-wide choice, alongside the other work rules.
--
-- ── What it does and does not turn off ──────────────────────────────────────
-- Off hides the elapsed-time displays and stops the per-second re-render that
-- drives them.
--
-- It does NOT stop recording when a job was started. That timestamp orders the
-- bench ("oldest first"), decides what "resume" means, and is part of the job's
-- history — dropping it to hide a clock would cost real information to save a
-- display. Turning this back on therefore shows correct times immediately,
-- rather than starting from zero.
-- ============================================================================

alter table public.app_settings
  add column if not exists track_job_time boolean not null default true;

comment on column public.app_settings.track_job_time is
  'Show elapsed time on in-progress repairs. Off hides the timers; start timestamps are still recorded, since the bench orders by them.';
