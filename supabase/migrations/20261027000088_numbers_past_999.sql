-- ============================================================================
-- Mano Mobile — document numbers that keep working past their padding width
--
-- The real cause of "duplicate key value violates repair_jobs_pkey":
-- Postgres's lpad() doesn't only pad, it TRUNCATES. lpad('1006', 3, '0') is
-- '100'. next_job_no() built 'RM-' || lpad(n, 3, '0'), so from the 1000th job
-- on every new number came out as RM-100 — a job that already exists — and
-- every intake failed. 20261027000086's skip-if-taken loop still used lpad,
-- so it could never get past RM-100.
--
-- The same trap waits at 10,000 for warranty (WR-), warranty claim (CL-) and
-- phone claim (PC-) numbers, so they are fixed here too.
--
-- doc_no(prefix, n, width) pads to at least `width` digits and never cuts:
-- RM-007, RM-999, RM-1000, RM-12345.
-- ============================================================================

create or replace function public.doc_no(p_prefix text, p_n bigint, p_width integer)
returns text
language sql
immutable
as $$
  select p_prefix || case when length(p_n::text) >= p_width then p_n::text
                          else lpad(p_n::text, p_width, '0') end
$$;

comment on function public.doc_no(text, bigint, integer) is
  'prefix || n zero-padded to at least p_width digits. Unlike a bare lpad(), never truncates a longer number.';

-- ── Repair job numbers ──────────────────────────────────────────────────────

create or replace function public.next_job_no()
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v text;
begin
  loop
    v := public.doc_no('RM-', nextval('public.repair_job_no_seq'), 3);
    exit when not exists (select 1 from public.repair_jobs where id = v);
    -- Taken: the counter is behind the table. Jump past the highest number
    -- on file rather than creeping through the gaps — a gap may be a deleted
    -- job whose number is already on somebody's receipt.
    perform setval('public.repair_job_no_seq', greatest(
      (select coalesce(max(substring(id from 4)::bigint), 0) from public.repair_jobs where id ~ '^RM-[0-9]+$'),
      (select last_value from public.repair_job_no_seq)));
  end loop;
  return v;
end $$;

create or replace function public.peek_next_job_no()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  n  bigint;
  hi bigint;
begin
  select case when is_called then last_value + 1 else last_value end
    into n
    from public.repair_job_no_seq;

  select coalesce(max(substring(id from 4)::bigint), 0)
    into hi
    from public.repair_jobs
   where id ~ '^RM-[0-9]+$';

  if exists (select 1 from public.repair_jobs where id = public.doc_no('RM-', n, 3)) then
    n := greatest(n, hi + 1);
  end if;

  return public.doc_no('RM-', n, 3);
end $$;

grant execute on function public.peek_next_job_no() to authenticated;

-- ── Warranty, warranty claim and phone claim numbers ────────────────────────

create or replace function public.next_warranty_no() returns text language sql volatile as $$
  select public.doc_no('WR-', nextval('public.warranty_no_seq'), 4)
$$;

create or replace function public.next_warranty_claim_no() returns text language sql volatile as $$
  select public.doc_no('CL-', nextval('public.warranty_claim_no_seq'), 4)
$$;

do $$
begin
  if to_regclass('public.device_claim_no_seq') is not null then
    execute $f$
      create or replace function public.next_device_claim_no() returns text language sql volatile as $b$
        select public.doc_no('PC-', nextval('public.device_claim_no_seq'), 4)
      $b$
    $f$;
  end if;
end $$;
