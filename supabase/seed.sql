-- ============================================================================
-- Mano Mobile — repair seed data
--
--   supabase db reset      (runs automatically after migrations)
--   or paste into Dashboard → SQL Editor after the migration
--
-- Idempotent: re-running tops up what is missing and leaves edits alone.
-- Seeds the dealer registry plus a handful of jobs so the Repair Management
-- tabs are not empty on a fresh database. Delete the jobs block for a clean
-- production start — the dealers block is worth keeping (the in-house dealer
-- is what makes walk-in jobs print a job receipt rather than a dealer invoice).
-- ============================================================================

-- ── Dealers ─────────────────────────────────────────────────────────────────

insert into public.repair_dealers (name, address, contact, joined_at, remarks, in_house)
values
  ('MANO MOBILE CENTRE', 'Main Street, Colombo 04',        '+94 11 234 5678', '2021-07-05', 'The shop itself — walk-in customers.', true),
  ('Tech Hub Colombo',   '123 Galle Road, Colombo 03',     '+94 11 223 4567', '2022-03-14', null,  false),
  ('Mobile World Kandy', '45 Peradeniya Rd, Kandy',        '+94 81 223 4567', '2022-09-01', null,  false),
  ('Digital Zone Negombo', '78 Main St, Negombo',          '+94 31 222 3344', '2023-01-20', null,  false),
  ('Smart Phones Galle', '12 Lighthouse St, Galle',        '+94 91 224 5566', '2023-06-11', null,  false)
on conflict (lower(name)) do nothing;

-- ── Demo jobs ───────────────────────────────────────────────────────────────
-- Explicit ids so the block can be re-run safely. The sequence is bumped past
-- them afterwards, otherwise the first real intake would collide on RM-001.

insert into public.repair_jobs (
  id, customer_name, phone, brand, model, imei, issue, technician,
  status, priority, estimated_cost, advance_paid,
  created_at, estimated_completion, started_at, completed_at, paused_at, pause_reason,
  dealer, dealer_id, received_items
)
select
  v.id, v.customer_name, v.phone, v.brand, v.model, v.imei, v.issue, v.technician,
  v.status::job_status, v.priority::job_priority, v.estimated_cost, v.advance_paid,
  v.created_at::timestamptz, v.estimated_completion::date,
  v.started_at::timestamptz, v.completed_at::timestamptz, v.paused_at::timestamptz, v.pause_reason,
  v.dealer, d.id, v.received_items
from (values
  ('RM-001', 'Kasun Perera',       '+94 77 123 4567', 'Apple',   'iPhone 14 Pro',  '351988100241349', 'Screen Damage',   'Kamal',  'Completed',  'High',   25000, 5000, '2025-04-20', '2025-04-22', '2025-04-20', '2025-04-22', null, null,
   'MANO MOBILE CENTRE', array['SIM Card','Charger']),
  ('RM-002', 'Nimali Silva',       '+94 71 234 5678', 'Samsung', 'Galaxy S23',     '354668771114184', 'Battery',         'Nimal',  'Delivered',  'Normal',  8000, 2000, '2025-04-21', '2025-04-23', '2025-04-21', '2025-04-23', null, null,
   'MANO MOBILE CENTRE', array['Back Cover']),
  ('RM-003', 'Roshan Fernando',    '+94 76 345 6789', 'Xiaomi',  'Redmi Note 12',  '354682282577565', 'Charging Port',   'Suresh', 'Pending',    'Urgent',  4500, 1000, '2025-04-19', '2025-04-21', '2025-04-19', null, '2025-04-20', 'Waiting for charging-port module to arrive',
   'MANO MOBILE CENTRE', array[]::text[]),
  ('RM-004', 'Pradeep Jayawardena','+94 75 567 8901', 'Oppo',    'Reno 8',         null,              'Speaker / Mic',   'Nimal',  'Non-Issued', 'Low',     3000,    0, '2025-04-22', '2025-04-25', null, null, null, null,
   'MANO MOBILE CENTRE', array[]::text[]),
  ('RM-005', 'Samantha Bandara',   '+94 78 678 9012', 'Samsung', 'Galaxy A54',     '864562049583598', 'Water Damage',    'Suresh', 'Delivered',  'High',   12000, 3000, '2025-04-21', '2025-04-24', '2025-04-22', '2025-04-24', null, null,
   'Tech Hub Colombo',   array[]::text[])
) as v (
  id, customer_name, phone, brand, model, imei, issue, technician,
  status, priority, estimated_cost, advance_paid,
  created_at, estimated_completion, started_at, completed_at, paused_at, pause_reason,
  dealer, received_items
)
left join public.repair_dealers d on lower(d.name) = lower(v.dealer)
on conflict (id) do nothing;

-- Move the sequence past anything seeded so generated ids never collide.
-- The third argument matters: with no jobs yet it must be false, otherwise the
-- first real intake would skip RM-001 and start at RM-002.
select setval(
  'public.repair_job_no_seq',
  greatest((select coalesce(max(nullif(regexp_replace(id, '\D', '', 'g'), ''))::bigint, 0) from public.repair_jobs), 1),
  (select count(*) > 0 from public.repair_jobs)
);
