-- ============================================================================
-- Mano Mobile — renumber the repair jobs from RM-001, keeping every one
--
-- NOT A MIGRATION. Nothing runs this for you. Paste it into the SQL editor.
--
-- The counter has handed out 76 numbers and two jobs survive, so the shop's
-- first real repair is RM-076. This writes every job out, clears the table,
-- puts them all back under RM-001, RM-002, … in the order they were received,
-- and leaves the counter ready to carry on from the end.
--
-- ── How to run it ───────────────────────────────────────────────────────────
--   1. Run it as it is. It changes NOTHING — dry_run is true, so it does the
--      whole job and then deliberately fails, showing you the mapping it would
--      have applied in the error DETAIL.
--   2. Read that mapping. If it is right, change `dry_run := true` on the
--      first line of the block to `false` and run it again.
--   3. Run the SELECT at the bottom to see the result.
--
-- ── Why it is one DO block and not a script ─────────────────────────────────
-- Because BEGIN … COMMIT is not reliably one transaction here. The Supabase
-- editor commits between statements, which is how the first attempt lost a
-- temp table declared ON COMMIT DROP — and far worse than a lost temp table,
-- it meant a failure halfway would have left the jobs deleted and not yet put
-- back, with nothing to roll back to.
--
-- A single statement is atomic no matter who runs it. So the whole thing is
-- one DO block holding its working data in variables rather than temp tables:
-- either all of it happens or none of it does, and the dry run gets its
-- rollback for free by raising at the end.
--
-- ── Read this before setting dry_run false ──────────────────────────────────
-- A job number is not a private key. It is printed on receipts, quoted down
-- the phone, written into stored invoice HTML, sent by SMS, and typed into the
-- public /track page by customers. None of those copies can be reached from
-- here — which is why this is safe today and would not be in a month.
-- ============================================================================

do $$
declare
  dry_run boolean := true;   -- ← set to false to actually apply it

  map        jsonb;          -- old id → new id
  jobs       jsonb;          -- the job rows, in date order
  kids       jsonb := '[]';  -- everything the delete would cascade away
  links      jsonb := '[]';  -- the job_ids the delete would blank
  buf        jsonb;
  rec        record;
  el         jsonb;
  row_json   jsonb;
  t          record;
  pk         text;
  n_docs     bigint;
  has_ident  boolean;
  summary    text;
begin
  -- ── 1. Is there anything that could not be corrected afterwards? ─────────
  --
  -- The line is not "has this job been billed". A sale is a row and a row can
  -- be updated — job_ids is rewritten below. The line is "does something name
  -- this job that cannot be rewritten", and there is exactly one such thing:
  -- invoice_documents, the rendered invoice stored as it was handed over. It
  -- has no update policy at all, deliberately — an invoice that can be edited
  -- afterwards looks like proof while being nothing of the kind.
  if to_regclass('public.invoice_documents') is not null
     and to_regclass('public.sales') is not null then
    select count(*) into n_docs
      from public.invoice_documents d
      join public.sales s on s.invoice_no = d.invoice_no
     where exists (
       select 1 from unnest(s.job_ids) x
         join public.repair_jobs j on j.id = x
     );

    if n_docs > 0 then
      raise exception using
        message = 'Renumbering refused — a stored invoice names one of these jobs.',
        detail  = format('%s invoice document(s) cover a job that is about to change number.', n_docs),
        hint    = 'invoice_documents is immutable by design, so the document could never be corrected to match. Clear the trading data with reset-transactions.sql instead.';
    end if;
  end if;

  -- ── 2. The new numbers ───────────────────────────────────────────────────
  --
  -- In date order, because a job number is a shop's running count of work
  -- taken in and a job book out of order helps nobody.
  --
  -- Backdated records are worth a thought: a past record received in March
  -- sorts ahead of a job booked in September whichever was typed first, and if
  -- it was entered carrying its own number out of the old job book, this
  -- overwrites it. For the order the system issued them in instead, use:
  --   order by (case when id ~ '^RM-[0-9]+$'
  --                  then substring(id from 4)::bigint else 0 end), created_at
  select jsonb_object_agg(old_id, new_id)
    into map
    from (
      select id as old_id,
             'RM-' || lpad(row_number() over (order by created_at, id)::text, 3, '0') as new_id
        from public.repair_jobs
    ) m;

  if map is null then
    raise exception 'There are no repair jobs to renumber.';
  end if;

  -- ── 3. Copy out everything the delete would destroy ──────────────────────
  --
  -- Deleting a repair job does not only remove the job. It takes the
  -- assignments, job events, part requests, parts used, warranties and
  -- warranty claims with it — the cascade reaches grandchildren, not just
  -- children — and it blanks the job_id on every message, credit entry and
  -- cash return that named one.
  --
  -- Held whole, as jsonb: every column in whatever type it really is, with no
  -- column list here to fall out of date the next time one is added. The
  -- tables are discovered from the foreign keys rather than listed, for the
  -- same reason.
  select coalesce(jsonb_agg(to_jsonb(j) order by j.created_at, j.id), '[]'::jsonb)
    into jobs
    from public.repair_jobs j;

  for t in
    with recursive cascaded as (
      select c.conrelid, 1 as depth,
             (select a.attname from pg_attribute a
               where a.attrelid = c.conrelid and a.attnum = c.conkey[1]) as fk_col
        from pg_constraint c
       where c.confrelid = 'public.repair_jobs'::regclass
         and c.contype = 'f' and c.confdeltype = 'c'
         and c.conrelid <> c.confrelid
      union
      select c.conrelid, k.depth + 1, null::text
        from pg_constraint c
        join cascaded k on c.confrelid = k.conrelid
       where c.contype = 'f' and c.confdeltype = 'c'
         and c.conrelid <> c.confrelid
         and c.conrelid <> 'public.repair_jobs'::regclass
         -- A depth stop, so a loop in the keys ends the walk and not the
         -- session. Nothing here nests anywhere near this deep.
         and k.depth < 5
    )
    select conrelid::regclass::text as tbl, min(depth) as depth, max(fk_col) as fk_col
      from cascaded group by conrelid order by 2, 1
  loop
    -- Only the first level carries a job_id to rewrite. Deeper rows point at
    -- their own parent's key, which is preserved exactly, so they go back
    -- untouched. The loop runs in depth order and appends, so the array ends
    -- up in insert order: a parent before its children.
    execute format(
      'select coalesce(jsonb_agg(jsonb_build_object(''tbl'', %L, ''fk'', %L, ''row'', to_jsonb(x))), ''[]''::jsonb) from %s x',
      t.tbl, t.fk_col, t.tbl
    ) into buf;
    kids := kids || buf;
  end loop;

  -- The links that would be blanked rather than deleted. Nothing afterwards
  -- could reconstruct which message belonged to which repair, so the pairs are
  -- captured now, while they still exist.
  for t in
    select c.conrelid::regclass::text as tbl,
           (select a.attname from pg_attribute a
             where a.attrelid = c.conrelid and a.attnum = c.conkey[1]) as fk_col
      from pg_constraint c
     where c.confrelid = 'public.repair_jobs'::regclass
       and c.contype = 'f' and c.confdeltype = 'n'
       and c.conrelid <> c.confrelid
     order by 1
  loop
    -- Needs a single-column primary key to address the row by. Anything else
    -- is reported rather than guessed at.
    pk := null;
    select a.attname into pk
      from pg_index i
      join pg_attribute a on a.attrelid = i.indrelid and a.attnum = i.indkey[0]
     where i.indrelid = t.tbl::regclass and i.indisprimary and i.indnatts = 1;

    if pk is null then
      raise warning 'Cannot restore % links: no single-column primary key.', t.tbl;
      continue;
    end if;

    execute format(
      'select coalesce(jsonb_agg(jsonb_build_object(''tbl'', %L, ''pk_col'', %L, ''pk_val'', %I::text, ''fk_col'', %L, ''old_job'', %I::text)), ''[]''::jsonb) from %s where %I is not null',
      t.tbl, pk, pk, t.fk_col, t.fk_col, t.tbl, t.fk_col
    ) into buf;
    links := links || buf;
  end loop;

  -- ── 4. Let the jobs go back in without the shop reacting to them ─────────
  --
  -- The step that is not obvious, and skipping it is what breaks the whole
  -- approach. repair_jobs has two AFTER INSERT triggers:
  --
  --   trg_repair_jobs_log_status   writes a repair_job_events row per job
  --   trg_repair_jobs_sync_stages  writes repair_issued / repair_non_issued
  --
  -- Both did their work when the jobs were first booked in, and both rows are
  -- already held above waiting to go back. Left enabled, the first would
  -- double every job's history and the second would collide with a primary key
  -- about to be re-inserted.
  --
  -- DISABLE TRIGGER USER leaves the foreign keys enforced — those are internal
  -- triggers, not user ones — so the re-insert is still checked.
  execute 'alter table public.repair_jobs disable trigger user';

  -- ── 5. Out, and back in under the new numbers ────────────────────────────
  delete from public.repair_jobs;

  -- rejob_of points from a repeat repair at the job it repeats, so it is
  -- remapped alongside the id — left alone it would point at a number that no
  -- longer exists and the insert would fail on its own foreign key.
  for rec in select value from jsonb_array_elements(jobs) loop
    el := rec.value;
    execute 'insert into public.repair_jobs select * from jsonb_populate_record(null::public.repair_jobs, $1)'
      using el
            || jsonb_build_object('id', map ->> (el ->> 'id'))
            || case when el ->> 'rejob_of' is null then '{}'::jsonb
                    else jsonb_build_object('rejob_of', map ->> (el ->> 'rejob_of')) end;
  end loop;

  for rec in select value from jsonb_array_elements(kids) loop
    el       := rec.value;
    row_json := el -> 'row';

    -- OVERRIDING SYSTEM VALUE, where the table needs it.
    --
    -- repair_job_events.id is `generated always as identity`, which refuses an
    -- explicit value outright — and an explicit value is the point: these are
    -- the same rows going back, keeping the ids other rows refer to. Letting
    -- the column re-generate would renumber the history along with the jobs.
    --
    -- The identity sequences are already past these values from when the rows
    -- were first written, so putting them back cannot collide with anything
    -- issued later.
    select exists (
      select 1 from pg_attribute
       where attrelid = (el ->> 'tbl')::regclass
         and attidentity <> '' and not attisdropped
    ) into has_ident;

    execute format(
      'insert into %s %s select * from jsonb_populate_record(null::%s, $1)',
      el ->> 'tbl',
      case when has_ident then 'overriding system value' else '' end,
      el ->> 'tbl'
    )
      using case
              when el ->> 'fk' is null then row_json
              else row_json || jsonb_build_object(el ->> 'fk', map ->> (row_json ->> (el ->> 'fk')))
            end;
  end loop;

  execute 'alter table public.repair_jobs enable trigger user';

  -- ── 6. The links that were blanked ───────────────────────────────────────
  for rec in select value from jsonb_array_elements(links) loop
    el := rec.value;
    execute format(
      'update %s set %I = $1 where %I::text = $2',
      el ->> 'tbl', el ->> 'fk_col', el ->> 'pk_col'
    ) using map ->> (el ->> 'old_job'), el ->> 'pk_val';
  end loop;

  -- sales.job_ids is a text[] saying which jobs an invoice covered. No foreign
  -- key, so nothing above touched it. Rewritten element by element, keeping
  -- the order and leaving alone anything not being renumbered.
  if to_regclass('public.sales') is not null then
    update public.sales s
       set job_ids = (
         select coalesce(array_agg(coalesce(map ->> u.x, u.x) order by u.ord), '{}')
           from unnest(s.job_ids) with ordinality as u(x, ord)
       )
     where exists (
       select 1 from unnest(s.job_ids) as x where map ->> x is not null
     );
  end if;

  -- ── 7. The counter carries on from the end ───────────────────────────────
  --
  -- Sequences do not follow their table — that is the whole reason an emptied
  -- database still books in at RM-076.
  perform setval('public.repair_job_no_seq', (select count(*) from public.repair_jobs));

  -- ── 8. Say what happened ─────────────────────────────────────────────────
  select string_agg(format('%s  ->  %s', key, value), chr(10) order by value)
    into summary
    from jsonb_each_text(map);

  if dry_run then
    -- The rollback and the report in one gesture. Raising here undoes
    -- everything above — the delete, the inserts, the trigger switch, all of
    -- it — while the message still reaches the screen, which is the only way
    -- to show a result the editor has not already committed.
    raise exception using
      message = format('DRY RUN - nothing was changed. %s job(s) would be renumbered:', jsonb_array_length(jobs)),
      detail  = summary,
      hint    = 'Set dry_run := false on the first line of the block and run it again to apply this.';
  end if;

  raise notice 'Renumbered % job(s):%', jsonb_array_length(jobs), chr(10) || summary;
end $$;


-- ── Run this afterwards to see the result ───────────────────────────────────
select id, customer_name, brand, model, status, technician,
       created_at::date as received, completed_at::date as completed
  from public.repair_jobs
 order by id;
