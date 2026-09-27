-- ============================================================================
-- Mano Mobile — a third canvas-template kind: the dealer sales invoice
--
-- receipt_templates already holds two kinds (receipt, issue) via its `kind`
-- column — see 20260819000017. This adds a third, 'dealerInvoice', for the
-- outside-dealer invoice built in DealerInvoicePrintable.tsx.
--
-- That document is fundamentally different from the other two: a receipt or
-- an issue invoice is always exactly one page, one job. A dealer invoice can
-- carry twenty jobs across several pages, with some elements repeating on
-- every page and others belonging only to the first or only to the last —
-- see repeatScope on ReceiptElement (lib/repair/receiptElements.ts). No
-- schema change was needed for that: `elements` is jsonb, so repeatScope is
-- just a new key on an element object, present or absent. This migration
-- only has to teach the kind column about the new value.
-- ============================================================================

alter table public.receipt_templates
  drop constraint if exists receipt_templates_kind_check;

alter table public.receipt_templates
  add constraint receipt_templates_kind_check check (kind in ('receipt', 'issue', 'dealerInvoice'));

comment on column public.receipt_templates.kind is
  '''receipt'' = job-intake receipt (JobReceiptSlip). ''issue'' = job-handover sales invoice (JobIssuePrintable, one job). ''dealerInvoice'' = outside-dealer sales invoice (DealerInvoicePrintable, many jobs, paginated).';

-- receipt_templates_one_default_per_kind is already a plain (kind) partial
-- unique index — no change needed, it already covers any kind value.
