-- ============================================================================
-- Mano Mobile — voiding a repair invoice undoes the handover it recorded
--
-- void_sale() marked the sale Voided and put accessory stock back, and that
-- was all. For a repair invoice that left the jobs exactly as the checkout had
-- written them: Delivered, invoice number stamped on, and — the part that
-- shows up in every figure — the money "received at handover" still sitting
-- in advance_paid and handover.balanceSettled. So INV-000017 was voided
-- eleven seconds after it was written, and RM-001 went on saying the dealer
-- had paid Rs. 800 on it; the customer list, the dealer card and every
-- analytics figure counted it as paid.
--
-- A voided invoice is a cancelled one. What it recorded did not happen, and
-- the jobs on it go back to where they were before the checkout: finished,
-- ready to collect, unpaid beyond any real intake advance, with no invoice
-- and no charge raised. The counter then issues them again, properly.
--
-- What is unwound, per job on the sale:
--   advance_paid            less what the handover settled (the intake
--                           advance, taken before the invoice, stays)
--   written_off             back to 0 — a write-off was part of that bill
--   handover                cleared
--   invoice_no              cleared
--   status                  Delivered → Completed (a job already Cancelled or
--                           otherwise moved on is left where it is)
--   credit charges          those stamped with this invoice, removed
--
-- Every job gets an event saying so, so the history shows why it moved.
-- The same unwinding is applied once to the sales voided before this existed.
-- ============================================================================

create or replace function public.unwind_voided_sale(p_invoice_no text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  s       public.sales;
  v_job   text;
  j       public.repair_jobs;
  settled numeric(12,2);
begin
  select * into s from public.sales where invoice_no = p_invoice_no;
  if not found or s.status <> 'Voided' then
    return;
  end if;

  -- Charges raised against this invoice — at handover, or by the POS for the
  -- unpaid part of a product sale — describe a bill that no longer exists.
  delete from public.credit_entries
   where kind = 'Charge' and invoice_no = p_invoice_no;

  foreach v_job in array coalesce(s.job_ids, '{}')
  loop
    select * into j from public.repair_jobs where id = v_job for update;
    if not found then continue; end if;
    -- Only a job still carrying this invoice. One re-issued since has a new
    -- number and new figures of its own, and they are not this sale's to undo.
    if j.invoice_no is distinct from p_invoice_no then continue; end if;

    settled := coalesce((j.handover ->> 'balanceSettled')::numeric, 0);

    update public.repair_jobs
       set advance_paid = greatest(coalesce(advance_paid, 0) - settled, 0),
           written_off  = 0,
           handover     = null,
           invoice_no   = null,
           status       = case when status = 'Delivered' then 'Completed'::job_status else status end
     where id = v_job;

    -- Charges raised on the job at that handover that never got the invoice
    -- number stamped on (the stamping is best-effort) go with it.
    delete from public.credit_entries
     where kind = 'Charge' and job_id = v_job and invoice_no is null;

    insert into public.repair_job_events (job_id, from_status, to_status, note, changed_by)
    values (
      v_job, j.status,
      case when j.status = 'Delivered' then 'Completed'::job_status else j.status end,
      format('Invoice %s voided — handover reversed%s', p_invoice_no,
             case when settled > 0 then format(', Rs. %s received at handover taken back off the job', settled) else '' end),
      auth.uid()
    );
  end loop;
end $$;

comment on function public.unwind_voided_sale(text) is
  'Puts the repair jobs on a voided invoice back to finished-and-unpaid, and removes the charges the invoice raised. Called by void_sale(); safe to call again.';

-- ── void_sale, now unwinding what it voids ──────────────────────────────────

create or replace function public.void_sale(p_sale_id uuid)
returns public.sales
language plpgsql
security definer
set search_path = public
as $$
declare
  s    public.sales;
  item record;
begin
  if not (public.is_staff() and public.module_can_write('Sales / POS')) then
    raise exception 'Not authorised to void sales';
  end if;

  select * into s from public.sales where id = p_sale_id for update;
  if not found then
    raise exception 'Sale % not found', p_sale_id;
  end if;

  if s.status = 'Voided' then
    return s;
  end if;

  for item in
    select (elem ->> 'id')::bigint as id, (elem ->> 'qty')::integer as qty, elem ->> 'type' as kind
    from jsonb_array_elements(coalesce(s.line_items, '[]'::jsonb)) as elem
  loop
    if item.kind = 'accessory' and item.id is not null and item.qty > 0 then
      update public.accessory_products set stock = stock + item.qty where id = item.id;
    end if;
  end loop;

  update public.sales set status = 'Voided' where id = p_sale_id
  returning * into s;

  perform public.unwind_voided_sale(s.invoice_no);

  return s;
end $$;

comment on function public.void_sale(uuid) is
  'Voids a sale: restocks every accessory line, and for a repair invoice puts its jobs back to finished-and-unpaid and removes the charges it raised. Idempotent on an already-voided sale.';

grant execute on function public.void_sale(uuid) to authenticated;

-- ── The ones voided before this existed ─────────────────────────────────────
--
-- Two so far: INV-000013 (its jobs were cancelled by hand afterwards and keep
-- that status) and INV-000017 (RM-001, which goes back to Completed with its
-- Rs. 800 "paid" taken off).

do $$
declare
  v record;
begin
  for v in select invoice_no from public.sales where status = 'Voided' and coalesce(array_length(job_ids, 1), 0) > 0
  loop
    perform public.unwind_voided_sale(v.invoice_no);
  end loop;
end $$;
