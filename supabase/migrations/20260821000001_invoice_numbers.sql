-- ============================================================================
-- Mano Mobile — real invoice numbers
--
-- Every sale flow (Accessories, Mobile, Other, Repair Sales, and the Job
-- Issue invoice) previously made up its own invoice number in the browser —
-- Date.now() timestamps or Math.random() digits, in a handful of different
-- formats, never checked against anything. Two cashiers completing a sale in
-- the same second could be handed the same number, and nothing stopped it.
--
-- One shared sequence instead — same fix repair_job_no_seq already applied
-- to job numbers (see 20260812000001_repair_core.sql). All sale types draw
-- from the same series (INV-000001, INV-000002, …) since it's one shop's
-- invoice book, not one per department.
-- ============================================================================

create sequence if not exists public.invoice_no_seq start 1;

-- Actually assigns a number — nextval() always advances the sequence, so
-- this must only be called once a sale is really being finalised, never
-- while a cart is still being edited or a preview is just being shown.
create or replace function public.next_invoice_no()
returns text
language sql
volatile
as $$
  select 'INV-' || lpad(nextval('public.invoice_no_seq')::text, 6, '0')
$$;

comment on function public.next_invoice_no() is
  'Assigns and returns the next invoice number. Advances invoice_no_seq — call only when a sale is actually being completed, not for on-screen previews.';
