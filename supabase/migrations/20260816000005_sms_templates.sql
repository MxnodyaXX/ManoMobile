-- ============================================================================
-- Editable customer SMS templates
--
-- The wording used to live in the frontend, so changing a sentence meant a code
-- change and a deploy. It now lives here: an Admin edits the text, and the
-- cashier and technician apps pick it up on their next send.
--
-- Bodies use {placeholders} which the app substitutes per job — see
-- src/lib/sms/templates.ts for the list each event supports.
-- ============================================================================

create table if not exists public.sms_templates (
  -- The lifecycle event this fires on: created | started | paused | finished.
  event       text primary key,
  name        text not null,
  body        text not null,
  is_active   boolean not null default true,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users (id) on delete set null
);

comment on table public.sms_templates is
  'Customer SMS wording, editable by Admin. One row per lifecycle event.';
comment on column public.sms_templates.is_active is
  'When false the message is not sent automatically; staff can still send by hand.';

drop trigger if exists trg_sms_templates_touch on public.sms_templates;
create trigger trg_sms_templates_touch
  before update on public.sms_templates
  for each row execute function public.touch_updated_at();

alter table public.sms_templates enable row level security;

-- Everyone sends, so everyone reads. Only Admin rewrites what the shop says.
drop policy if exists sms_templates_select on public.sms_templates;
create policy sms_templates_select on public.sms_templates
  for select to authenticated using (public.is_staff());

drop policy if exists sms_templates_admin_write on public.sms_templates;
create policy sms_templates_admin_write on public.sms_templates
  for all to authenticated
  using (public.has_role('Admin'::staff_role)) with check (public.has_role('Admin'::staff_role));

-- ── Defaults ────────────────────────────────────────────────────────────────
-- Seeded once. `do nothing` on conflict so re-running the migration never
-- overwrites wording an admin has since edited.

insert into public.sms_templates (event, name, body) values
('created', 'Job Received',
'Hi {customer_name},
we have received your {device} for repair.

Job Number - {job_number}
Fault - {fault}
Estimated Price - {estimated_price}
Assigned Technician - {technician}

Paid Amount - {paid_amount}
Due Amount - {due_amount}

Estimated Completion - {estimated_completion}

We will keep you updated. Thank you for choosing {shop}.

For any other information contact {contact}.'),

('started', 'Repair Started',
'Hi {customer_name},
work has now started on your {device}.

Job Number - {job_number}
Fault - {fault}
Assigned Technician - {technician}
Estimated Completion - {estimated_completion}

We will notify you as soon as it is ready. Thank you for choosing {shop}.

For any other information contact {contact}.'),

('paused', 'Repair On Hold',
'Hi {customer_name},
your repair has been placed on hold.

Job Number - {job_number}
Device - {device}
Reason - {pause_reason}
Assigned Technician - {technician}

We will resume as soon as possible and keep you informed. Thank you for your patience.
{shop}.

For any other information contact {contact}.'),

('finished', 'Ready For Collection',
'Great news {customer_name}!
Your {device} has been repaired and is ready to collect.

Job Number - {job_number}
Fault - {fault}
Repaired By - {technician}

Total - {total}
Paid Amount - {paid_amount}
Due Amount - {due_amount}

Please bring this job number when collecting.
Thank you for choosing {shop}.

For any other information contact {contact}.')
on conflict (event) do nothing;
