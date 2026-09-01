-- ============================================================================
-- Mano Mobile — warranties, backed by Supabase
--
-- Warranty was, until now, the SINGLE canonical model living only in
-- localStorage (see cashier/contexts/WarrantyContext.tsx's own comment to
-- that effect) — issued on one staff browser, never seen by any other
-- browser, and never reachable from the public /track page since a
-- customer's own browser has no access to a staff member's localStorage.
--
-- This migration gives warranties a real table so they survive a refresh,
-- are visible to every staff member (not just whoever issued them), and can
-- finally be shown to the customer on their tracking page.
--
-- Mirrors the TypeScript unions in cashier/contexts/WarrantyContext.tsx —
-- keep the two in step.
-- ============================================================================

do $$ begin
  create type warranty_status as enum ('Pending Activation', 'Active', 'Expired', 'Void', 'Claimed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type warranty_scope as enum ('Parts & Labour', 'Parts Only', 'Labour Only');
exception when duplicate_object then null; end $$;

do $$ begin
  create type warranty_claim_status as enum ('Open', 'Under Review', 'Approved', 'Rejected', 'Resolved');
exception when duplicate_object then null; end $$;

do $$ begin
  create type warranty_claim_resolution as enum ('Re-repair (free)', 'Part replaced (free)', 'Partial charge', 'Rejected — out of scope');
exception when duplicate_object then null; end $$;

-- ── Warranty numbers ────────────────────────────────────────────────────────
-- WR-0001, CL-0001 … same reasoning as next_job_no(): a sequence, not a
-- client-side max()+1, so two technicians completing jobs at once can't be
-- handed the same warranty number.

create sequence if not exists public.warranty_no_seq start 1;
create or replace function public.next_warranty_no() returns text language sql volatile as $$
  select 'WR-' || lpad(nextval('public.warranty_no_seq')::text, 4, '0')
$$;

create sequence if not exists public.warranty_claim_no_seq start 1;
create or replace function public.next_warranty_claim_no() returns text language sql volatile as $$
  select 'CL-' || lpad(nextval('public.warranty_claim_no_seq')::text, 4, '0')
$$;

-- ── Warranties ──────────────────────────────────────────────────────────────

create table if not exists public.warranties (
  id              text primary key default public.next_warranty_no(),
  job_id          text not null references public.repair_jobs (id) on delete cascade,
  invoice_no      text,
  customer_name   text not null,
  customer_phone  text not null,
  device_model    text not null,
  imei            text,
  parts_covered   text[] not null default '{}',
  scope           warranty_scope not null default 'Parts & Labour',
  duration_days   integer not null,
  -- Issued at completion; the clock only starts (starts_at/expires_at) at
  -- handover, once the customer actually has the device back.
  issued_at       timestamptz not null default now(),
  starts_at       timestamptz,
  expires_at      timestamptz,
  status          warranty_status not null default 'Pending Activation',
  void_reason     text,
  exclusions      text[] not null default '{}',
  created_at      timestamptz not null default now(),
  created_by      uuid references auth.users (id) on delete set null
);

comment on table public.warranties is
  'One warranty per completed job. Issued (Pending Activation) when the technician finishes the repair, activated (clock starts) at handover.';

-- One warranty per job — issueWarranty() checks for an existing row before
-- inserting, this is the backstop against a double-issue race.
create unique index if not exists warranties_job_id_key on public.warranties (job_id);
create index if not exists warranties_status_idx on public.warranties (status);
create index if not exists warranties_phone_idx on public.warranties (customer_phone);

-- ── Warranty claims ─────────────────────────────────────────────────────────

create table if not exists public.warranty_claims (
  id                text primary key default public.next_warranty_claim_no(),
  warranty_id       text not null references public.warranties (id) on delete cascade,
  job_id            text not null,
  reported_issue    text not null,
  reported_at       timestamptz not null default now(),
  inspection_notes  text,
  within_coverage   boolean,
  resolution        warranty_claim_resolution,
  new_job_id        text,
  handled_by        text not null,
  status            warranty_claim_status not null default 'Open',
  resolved_at       timestamptz
);

create index if not exists warranty_claims_warranty_idx on public.warranty_claims (warranty_id, reported_at desc);

-- ============================================================================
-- Row Level Security — same shape as repair_jobs: every staff role reads,
-- Admin/Cashier/Technician write (technician issues at completion, cashier
-- activates at handover and runs the claims desk), nobody but Admin deletes.
-- ============================================================================

alter table public.warranties       enable row level security;
alter table public.warranty_claims  enable row level security;

drop policy if exists warranties_select on public.warranties;
create policy warranties_select on public.warranties
  for select to authenticated using (public.is_staff());

drop policy if exists warranties_write on public.warranties;
create policy warranties_write on public.warranties
  for insert to authenticated
  with check (public.has_role('Admin'::staff_role, 'Cashier'::staff_role, 'Technician'::staff_role));

drop policy if exists warranties_update on public.warranties;
create policy warranties_update on public.warranties
  for update to authenticated
  using (public.has_role('Admin'::staff_role, 'Cashier'::staff_role, 'Technician'::staff_role))
  with check (public.has_role('Admin'::staff_role, 'Cashier'::staff_role, 'Technician'::staff_role));

drop policy if exists warranties_delete on public.warranties;
create policy warranties_delete on public.warranties
  for delete to authenticated using (public.has_role('Admin'::staff_role));

drop policy if exists warranty_claims_select on public.warranty_claims;
create policy warranty_claims_select on public.warranty_claims
  for select to authenticated using (public.is_staff());

drop policy if exists warranty_claims_write on public.warranty_claims;
create policy warranty_claims_write on public.warranty_claims
  for insert to authenticated
  with check (public.has_role('Admin'::staff_role, 'Cashier'::staff_role));

drop policy if exists warranty_claims_update on public.warranty_claims;
create policy warranty_claims_update on public.warranty_claims
  for update to authenticated
  using (public.has_role('Admin'::staff_role, 'Cashier'::staff_role))
  with check (public.has_role('Admin'::staff_role, 'Cashier'::staff_role));

-- ============================================================================
-- Public lookup for the /track page — same trust boundary as track_job():
-- an exact job id, never a search. Customer name/phone/IMEI/invoice are
-- deliberately left out — the page already has those (masked) from
-- track_job(), and void_reason is a staff-only note.
-- ============================================================================

create or replace function public.track_warranty(p_job_id text)
returns table (
  id             text,
  status         text,
  scope          text,
  duration_days  integer,
  parts_covered  text[],
  exclusions     text[],
  issued_at      timestamptz,
  starts_at      timestamptz,
  expires_at     timestamptz,
  claims         jsonb
)
language sql
security definer
set search_path = public
stable
as $$
  select
    w.id, w.status::text, w.scope::text, w.duration_days,
    w.parts_covered, w.exclusions,
    w.issued_at, w.starts_at, w.expires_at,
    coalesce(
      (select jsonb_agg(jsonb_build_object(
          'id', c.id,
          'status', c.status::text,
          'reportedIssue', c.reported_issue,
          'reportedAt', c.reported_at,
          'resolution', c.resolution::text,
          'resolvedAt', c.resolved_at
        ) order by c.reported_at desc)
       from public.warranty_claims c where c.warranty_id = w.id),
      '[]'::jsonb
    )
  from public.warranties w
  where w.job_id = p_job_id;
$$;

comment on function public.track_warranty(text) is
  'Public warranty lookup for the /track page. Exact job id only — same trust boundary as track_job(). No row at all just means the job has no warranty.';

grant execute on function public.track_warranty(text) to anon, authenticated;
