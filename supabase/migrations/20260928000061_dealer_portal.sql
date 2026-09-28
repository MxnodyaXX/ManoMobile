-- ============================================================================
-- Mano Mobile — the dealer portal behind the QR code on a dealer invoice
--
-- A dealer scans the QR on their invoice and lands on /dealer, which shows:
--   * that invoice, with every job on it — device, IMEI, fault, technician,
--     when it was received, started, finished and handed over, and what each
--     line cost;
--   * what the dealer owes the shop in total, from their credit account;
--   * every earlier invoice, each openable the same way;
--   * the jobs of theirs still in the shop.
--
-- ── Why a token, not the invoice number ─────────────────────────────────────
-- Invoice numbers are sequential (INV-000123). A page keyed on one would let
-- anybody walk the sequence and read every dealer's bills and balance. So each
-- dealer gets a long random portal_token, the QR carries it, and both public
-- functions refuse to answer without a token that matches a dealer. An invoice
-- is only ever shown to the dealer it was billed to.
--
-- Staff can issue a new token (regenerate_dealer_portal_token) if a printed
-- link ever needs to stop working; every old QR for that dealer then dies.
--
-- ── What is never exposed ───────────────────────────────────────────────────
-- Same rule as track_job(): no passcode, no signatures, no intake photos, no
-- end-customer phone, nothing staff-only beyond what the printed invoice
-- already shows the dealer (technician name and remarks are on that paper).
-- ============================================================================

alter table public.repair_dealers
  add column if not exists portal_token text;

update public.repair_dealers
   set portal_token = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
 where portal_token is null;

alter table public.repair_dealers
  alter column portal_token set default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
alter table public.repair_dealers
  alter column portal_token set not null;

create unique index if not exists repair_dealers_portal_token_key on public.repair_dealers (portal_token);

comment on column public.repair_dealers.portal_token is
  'Secret key in the dealer portal link printed as a QR on dealer invoices. 64 random hex characters; regenerate to revoke old links.';

-- ── Resolve a token to its dealer ───────────────────────────────────────────

create or replace function public.dealer_from_portal_token(p_token text)
returns public.repair_dealers
language sql
stable
security definer
set search_path = public
as $$
  select * from public.repair_dealers
   where length(coalesce(p_token, '')) >= 32
     and portal_token = p_token
   limit 1;
$$;

revoke all on function public.dealer_from_portal_token(text) from public, anon, authenticated;

-- ── One job, as the dealer may see it ───────────────────────────────────────

create or replace function public.dealer_portal_job_json(j public.repair_jobs, p_invoice_no text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id',            j.id,
    'dealerJobNo',   j.dealer_job_no,
    'customerName',  j.customer_name,
    'brand',         j.brand,
    'model',         j.model,
    'imei',          j.imei,
    'issue',         j.issue,
    'technician',    case when j.technician = 'Unassigned' then null else j.technician end,
    'status',        j.status,
    'completionType', j.completion_type,
    'receivedAt',    j.created_at,
    'startedAt',     j.started_at,
    'completedAt',   j.completed_at,
    'issuedAt',      j.handover ->> 'handedOverAt',
    'cancelledAt',   j.cancelled_at,
    'estimatedCompletion', j.estimated_completion,
    'estimate',      j.estimated_cost,
    'advancePaid',   j.advance_paid,
    'techRemarks',   j.tech_remarks,
    'partsUsed',     to_jsonb(coalesce(j.parts_used, '{}')),
    -- What the invoice actually billed for this job, when it has a line.
    'unitPrice',     li.unit_price,
    'discount',      li.discount,
    'lineTotal',     li.line_total
  )
  from (select 1) _
  left join lateral (
    select si.unit_price, si.discount, si.line_total
      from public.sale_items si
     where p_invoice_no is not null
       and si.invoice_no = p_invoice_no
       and si.kind = 'repair_service'
       and si.reference_id = j.id
     limit 1
  ) li on true;
$$;

revoke all on function public.dealer_portal_job_json(public.repair_jobs, text) from public, anon, authenticated;

-- ── The portal: account, invoices, jobs in the shop ─────────────────────────

create or replace function public.dealer_portal(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  d       public.repair_dealers;
  acc     record;
  has_acc boolean;
begin
  d := public.dealer_from_portal_token(p_token);
  if d.id is null then
    return null;
  end if;

  select a.balance, a.total_charged, a.total_paid, a.total_written_off, a.total_refunded,
         a.credit_limit, a.terms_days, a.status, a.first_charge_on, a.last_payment_on
    into acc
    from public.v_credit_accounts a
   where a.dealer_id = d.id
   limit 1;
  has_acc := found;

  return jsonb_build_object(
    'dealer', jsonb_build_object(
      'name', d.name, 'contact', d.contact, 'address', d.address, 'joinedAt', d.joined_at
    ),
    'account', case when not has_acc then null else jsonb_build_object(
      'balance',        acc.balance,
      'totalCharged',   acc.total_charged,
      'totalPaid',      acc.total_paid,
      'totalWrittenOff', acc.total_written_off,
      'totalRefunded',  acc.total_refunded,
      'creditLimit',    acc.credit_limit,
      'termsDays',      acc.terms_days,
      'status',         acc.status,
      'firstChargeOn',  acc.first_charge_on,
      'lastPaymentOn',  acc.last_payment_on
    ) end,
    'invoices', coalesce((
      select jsonb_agg(jsonb_build_object(
               'invoiceNo',  s.invoice_no,
               'date',       s.sold_on,
               'createdAt',  s.created_at,
               'total',      s.total,
               'paid',       coalesce(s.paid, case when s.status = 'Paid' and s.credit_account_id is null then s.total else 0 end),
               'discount',   s.discount,
               'status',     s.status,
               'jobCount',   coalesce(array_length(s.job_ids, 1), 0),
               -- What is still open on this invoice's charges, from the ledger.
               'outstanding', greatest(coalesce((
                   select sum(case when e.kind = 'Charge' then e.amount else -e.amount end)
                     from public.credit_entries e
                    where e.invoice_no = s.invoice_no
                 ), 0), 0)
             ) order by s.sold_on desc, s.created_at desc)
        from public.sales s
       where s.dealer_id = d.id
         and s.status <> 'Voided'
    ), '[]'::jsonb),
    'openJobs', coalesce((
      select jsonb_agg(public.dealer_portal_job_json(j, null) order by j.created_at desc)
        from public.repair_jobs j
       where j.dealer_id = d.id
         and j.status not in ('Delivered', 'Cancelled')
    ), '[]'::jsonb)
  );
end $$;

comment on function public.dealer_portal(text) is
  'Public dealer portal: dealer, credit balance, invoices and jobs still in the shop — only for a valid portal_token. Returns null otherwise.';

grant execute on function public.dealer_portal(text) to anon, authenticated;

-- ── One invoice, with every job on it ───────────────────────────────────────

create or replace function public.dealer_portal_invoice(p_token text, p_invoice_no text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  d public.repair_dealers;
  s public.sales;
begin
  d := public.dealer_from_portal_token(p_token);
  if d.id is null then
    return null;
  end if;

  -- Only an invoice billed to THIS dealer. Anything else answers exactly as
  -- a missing invoice does, so the page cannot be used to probe numbers.
  select * into s from public.sales
   where invoice_no = p_invoice_no and dealer_id = d.id and status <> 'Voided';
  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'invoiceNo', s.invoice_no,
    'date',      s.sold_on,
    'createdAt', s.created_at,
    'status',    s.status,
    'subtotal',  s.subtotal,
    'discount',  s.discount,
    'total',     s.total,
    'paid',      coalesce(s.paid, case when s.status = 'Paid' and s.credit_account_id is null then s.total else 0 end),
    'paymentMethod', s.payment_method,
    'cashier',   s.cashier,
    'outstanding', greatest(coalesce((
        select sum(case when e.kind = 'Charge' then e.amount else -e.amount end)
          from public.credit_entries e
         where e.invoice_no = s.invoice_no
      ), 0), 0),
    'jobs', coalesce((
      select jsonb_agg(public.dealer_portal_job_json(j, s.invoice_no) order by array_position(s.job_ids, j.id))
        from public.repair_jobs j
       where j.id = any (s.job_ids)
    ), '[]'::jsonb),
    -- Products billed on the same invoice (a cover, a glass).
    'otherLines', coalesce((
      select jsonb_agg(jsonb_build_object(
               'description', si.description, 'qty', si.qty,
               'unitPrice', si.unit_price, 'discount', si.discount, 'lineTotal', si.line_total
             ) order by si.sort_order)
        from public.sale_items si
       where si.invoice_no = s.invoice_no
         and si.kind not in ('repair_service', 'repair_part')
    ), '[]'::jsonb)
  );
end $$;

comment on function public.dealer_portal_invoice(text, text) is
  'Public dealer portal: one invoice and all its jobs, only when it was billed to the dealer the token belongs to. Returns null otherwise.';

grant execute on function public.dealer_portal_invoice(text, text) to anon, authenticated;

-- ── Revoking a link ─────────────────────────────────────────────────────────

create or replace function public.regenerate_dealer_portal_token(p_dealer_id bigint)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
begin
  if not public.has_role('Admin'::staff_role) then
    raise exception using errcode = '42501', message = 'Only an Admin can reset a dealer''s portal link.';
  end if;
  update public.repair_dealers set portal_token = v where id = p_dealer_id;
  if not found then
    raise exception 'Dealer % not found.', p_dealer_id;
  end if;
  return v;
end $$;

grant execute on function public.regenerate_dealer_portal_token(bigint) to authenticated;
