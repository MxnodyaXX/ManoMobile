-- ============================================================================
-- Mano Mobile — a dealer's invoice, filled in over several entries
--
-- Typing a shop's old job book in is not one repair at a time. A dealer's month
-- came back on one invoice covering nine phones, and the person entering it has
-- nine records to make and one invoice to put them all on.
--
-- Today every past record raises its own invoice, so that month becomes nine
-- invoices the dealer never saw. What is needed is the opposite: raise the
-- invoice once, add repairs to it as they are typed, and shut it when the last
-- one is in.
--
-- ── Why sales, and not a table of its own ───────────────────────────────────
-- Because it is an invoice. It belongs in the ledger with every other one — in
-- Sales History, in the day's takings, in a customer's invoice history — and a
-- second store for "invoices we typed in later" would be a second answer to
-- "what did this dealer get billed".
--
-- All this adds is the one thing sales could not say: whether an invoice is
-- still being filled in.
-- ============================================================================

alter table public.sales
  add column if not exists closed_at timestamptz;

comment on column public.sales.closed_at is
  'Set when an invoice is finished and no more jobs may be added. Null means still open — only ever true of invoices built up by hand from past records.';

/**
 * Add one repair to an invoice that is still open.
 *
 * The amounts move with it: an invoice that gains a 4,000 repair is a 4,000
 * bigger invoice. Anything else would leave the total disagreeing with the
 * lines it is made of, which is the state every part of this system spends its
 * time avoiding.
 *
 * Refuses a closed invoice, a voided one, and a job that is already on it —
 * the last of those is the one that actually happens, when somebody re-enters
 * a record they are not sure they saved.
 */
create or replace function public.append_job_to_sale(
  p_invoice_no text,
  p_job_id     text,
  p_line_total numeric,
  p_received   numeric default 0
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale public.sales;
begin
  if not public.is_staff() then
    raise exception using errcode = '42501', message = 'Only staff can add to an invoice.';
  end if;

  select * into v_sale from public.sales where invoice_no = p_invoice_no;
  if not found then
    raise exception 'There is no invoice %.', p_invoice_no;
  end if;
  if v_sale.status = 'Voided' then
    raise exception 'Invoice % is voided.', p_invoice_no;
  end if;
  if v_sale.closed_at is not null then
    raise exception 'Invoice % is closed — reopen it before adding more work.', p_invoice_no;
  end if;
  if p_job_id = any (coalesce(v_sale.job_ids, '{}')) then
    raise exception '% is already on invoice %.', p_job_id, p_invoice_no;
  end if;

  update public.sales
     set job_ids = array_append(coalesce(job_ids, '{}'), p_job_id),
         total   = coalesce(total, 0) + greatest(coalesce(p_line_total, 0), 0),
         paid    = coalesce(paid, 0)  + greatest(coalesce(p_received, 0), 0),
         items   = case
                     when coalesce(btrim(items), '') = '' then p_job_id
                     else items || ', ' || p_job_id
                   end
   where invoice_no = p_invoice_no;

  -- The job points back, so the pair can be read from either end.
  update public.repair_jobs set invoice_no = p_invoice_no where id = p_job_id;
end $$;

comment on function public.append_job_to_sale(text, text, numeric, numeric) is
  'Adds a repair job to an open invoice and moves the invoice total and receipt with it. Refuses closed, voided, and already-listed jobs.';

/**
 * Finished — nothing more goes on this one.
 *
 * Reversible on purpose. Closing is somebody saying "that is the whole
 * invoice", and being wrong about that is an ordinary mistake, not one worth
 * making them void a good invoice to undo.
 */
create or replace function public.set_sale_closed(p_invoice_no text, p_closed boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    raise exception using errcode = '42501', message = 'Only staff can close an invoice.';
  end if;

  update public.sales
     set closed_at = case when p_closed then now() else null end
   where invoice_no = p_invoice_no
     and status <> 'Voided';

  if not found then
    raise exception 'There is no invoice % to close.', p_invoice_no;
  end if;
end $$;

comment on function public.set_sale_closed(text, boolean) is
  'Marks an invoice finished, or reopens it. Only affects whether more jobs may be added.';

revoke all on function public.append_job_to_sale(text, text, numeric, numeric) from public;
revoke all on function public.set_sale_closed(text, boolean) from public;
grant execute on function public.append_job_to_sale(text, text, numeric, numeric) to authenticated;
grant execute on function public.set_sale_closed(text, boolean) to authenticated;
