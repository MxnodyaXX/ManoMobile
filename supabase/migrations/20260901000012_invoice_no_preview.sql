-- ============================================================================
-- Mano Mobile — showing the invoice number before the sale is finalised
--
-- next_invoice_no() assigns a number, and assigning is the point: nextval()
-- advances the sequence every time it is called. That is why it is only ever
-- called on the Complete Sale / Generate Invoice / Issue Job click itself.
--
-- Which left the cashier with no invoice number anywhere on screen until after
-- the invoice existed. They are standing at a counter writing a number into a
-- book, or telling a customer what to quote when they come back, and the screen
-- showed nothing until it was too late to see it in context.
--
-- So: a second function that LOOKS at the sequence without moving it.
--
-- ── What this is and is not ─────────────────────────────────────────────────
-- It is a preview, and the UI says so. Two cashiers billing at the same moment
-- both see INV-000124; whoever finalises first gets it and the other gets 125.
-- The alternative — reserving a real number when the billing panel opens —
-- would burn a number every time somebody opened a sale and walked away,
-- leaving gaps in an invoice book that has to be explainable to an auditor.
-- A preview that is occasionally superseded is better than a permanent hole.
-- ============================================================================

create or replace function public.peek_next_invoice_no()
returns text
language sql
stable
security definer
set search_path = public
as $$
  -- is_called is false only before the very first nextval(), when last_value
  -- IS the next number rather than the last one handed out.
  select 'INV-' || lpad(
           (case when s.is_called then s.last_value + 1 else s.last_value end)::text,
           6, '0')
    from public.invoice_no_seq s
$$;

comment on function public.peek_next_invoice_no is
  'The number next_invoice_no() would return, without consuming it. A preview only — the number is not reserved until the sale is finalised.';
