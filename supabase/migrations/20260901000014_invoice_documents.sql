-- ============================================================================
-- Mano Mobile — keeping the invoice that was actually handed over
--
-- Every sale screen renders a printable invoice and prints it by copying that
-- element's outerHTML into a print container. The customer walks out with a
-- piece of paper; the app kept nothing but a row of figures.
--
-- Invoice History could therefore only ever show a summary it rebuilt from
-- those figures. That is not the same document, and the difference matters:
-- prices get revised, a job's estimate changes, a dealer is renamed, the
-- template itself gets redesigned. Re-rendering an invoice from today's data
-- produces a document the customer has never seen — which is exactly the thing
-- an invoice is supposed to be proof against.
--
-- So the rendered document is stored as it was, once, at the moment it was
-- issued. A reprint is then a reprint rather than a re-creation.
--
-- ── Why a separate table ────────────────────────────────────────────────────
-- The HTML runs to tens of kilobytes. sales is read as a list on three screens;
-- carrying a large text column on every row of those queries would make the
-- common case pay for the rare one. This is fetched only when somebody opens a
-- single invoice.
-- ============================================================================

create table if not exists public.invoice_documents (
  -- Keyed by the invoice number, not a surrogate id: there is exactly one
  -- document per invoice, and the number is what everything else already holds.
  invoice_no text primary key references public.sales (invoice_no) on delete cascade,

  html       text not null,

  -- The @page rule the original was printed with — paper size and margins.
  -- A5 landscape for an in-house repair slip, A4 for a dealer invoice. Without
  -- it a reprint comes out on whatever the reprinting screen happens to use.
  page_css   text,

  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.invoice_documents is
  'The rendered invoice as it was issued. Stored once so a reprint is a reprint, not a re-creation from current data.';

alter table public.invoice_documents enable row level security;

drop policy if exists invoice_documents_select on public.invoice_documents;
create policy invoice_documents_select on public.invoice_documents
  for select to authenticated
  using (public.is_staff() and public.module_can_read('Sales / POS'));

-- Written once, by whoever completed the sale.
drop policy if exists invoice_documents_insert on public.invoice_documents;
create policy invoice_documents_insert on public.invoice_documents
  for insert to authenticated
  with check (public.is_staff() and public.module_can_write('Sales / POS'));

-- Deliberately no update policy. A stored invoice that can be edited after the
-- fact is worth less than no stored invoice at all — it would look like proof
-- while being nothing of the kind. Corrections are new invoices, or a credit
-- note; the original stands.
drop policy if exists invoice_documents_delete on public.invoice_documents;
create policy invoice_documents_delete on public.invoice_documents
  for delete to authenticated
  using (public.has_role('Admin'::staff_role));
