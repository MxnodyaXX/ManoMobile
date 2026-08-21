-- ============================================================================
-- Mano Mobile — job issue invoice canvas templates
--
-- A second printable alongside the job receipt: the "SALES INVOICE" a
-- customer gets when their repaired device is issued back to them (see
-- IssueJobModal / RepairInvoicePreview in JobsTable.tsx) — different moment
-- (handover, not intake), different shape (an itemised line + payment/credit
-- status), different default paper (A4 portrait, not A5 landscape).
--
-- Reuses receipt_templates rather than a new table: the element model (text/
-- image/line/qr, positioned in mm, {{tokens}}) is identical either way, and
-- an admin managing "the shop's printables" shouldn't need two different
-- screens with two different saving mechanisms. `kind` is what tells them
-- apart — a row is a job-receipt design or an issue-invoice design, never
-- both — and each kind gets its own default, not one default shared across
-- both document types.
-- ============================================================================

alter table public.receipt_templates
  add column if not exists kind text not null default 'receipt';

do $$ begin
  alter table public.receipt_templates
    add constraint receipt_templates_kind_check check (kind in ('receipt', 'issue'));
exception when duplicate_object then null; end $$;

comment on column public.receipt_templates.kind is
  '''receipt'' = job-intake receipt (JobReceiptSlip). ''issue'' = job-handover sales invoice (RepairInvoicePreview).';

-- The old constraint allowed at most one default across the whole table;
-- replaced with one default PER kind, so a receipt design and an invoice
-- design can each have their own default at the same time.
drop index if exists receipt_templates_one_default;
create unique index if not exists receipt_templates_one_default_per_kind
  on public.receipt_templates (kind) where is_default;

-- set_default_receipt_template only cleared *some* default before; now it
-- must clear the default within the target's own kind, not across both.
create or replace function public.set_default_receipt_template(p_id bigint)
returns public.receipt_templates
language plpgsql
security definer
set search_path = public
as $$
declare
  tpl public.receipt_templates;
  target_kind text;
begin
  if not public.has_role('Admin'::staff_role, 'Cashier'::staff_role) then
    raise exception 'Not authorised to change the default receipt template';
  end if;

  select kind into target_kind from public.receipt_templates where id = p_id;
  if target_kind is null then
    raise exception 'Receipt template % not found', p_id;
  end if;

  update public.receipt_templates set is_default = false
   where is_default and kind = target_kind and id <> p_id;

  update public.receipt_templates set is_default = true
   where id = p_id
  returning * into tpl;

  return tpl;
end $$;
