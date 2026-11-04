-- ============================================================================
-- Mano Mobile — a fourth canvas-template kind: the accessory sales invoice
--
-- receipt_templates holds the repair documents (receipt, issue, dealerInvoice)
-- via its `kind` column — see 20260928000001. This adds 'accessoryInvoice',
-- the A5 invoice printed at the end of an Accessory Sale
-- (AccessoryInvoicePrintable.tsx). Like the dealer invoice it lists many rows
-- (one per product sold) and can run onto a second sheet, so it reuses the
-- same repeatScope handling — nothing new in `elements`, only the kind value.
-- ============================================================================

alter table public.receipt_templates
  drop constraint if exists receipt_templates_kind_check;

alter table public.receipt_templates
  add constraint receipt_templates_kind_check
  check (kind in ('receipt', 'issue', 'dealerInvoice', 'accessoryInvoice'));

comment on column public.receipt_templates.kind is
  '''receipt'' = job-intake receipt (JobReceiptSlip). ''issue'' = job-handover sales invoice (JobIssuePrintable, one job). ''dealerInvoice'' = outside-dealer sales invoice (DealerInvoicePrintable, many jobs, paginated). ''accessoryInvoice'' = accessory counter-sale invoice (AccessoryInvoicePrintable, one row per product, paginated).';

-- receipt_templates_one_default_per_kind is a plain (kind) partial unique
-- index — it already covers the new value.
