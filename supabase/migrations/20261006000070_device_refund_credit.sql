-- ============================================================================
-- Mano Mobile — a warranty refund on a credit sale reduces the debt first
--
-- refund_mobile_device() (20261006000069) handed the full price back and the
-- till paid it out in cash. On a phone sold on credit that was wrong twice
-- over: the customer was handed cash for money they had never paid, and their
-- credit balance still showed the debt for a phone they no longer have.
--
-- Now a refund settles what is still owed first:
--   * whatever is outstanding on that invoice's credit (capped at the account's
--     balance) comes off the account as a Refund entry naming the invoice and
--     the claim — the debt for the returned phone simply goes away;
--   * only the rest — money the customer actually paid — is handed back, by
--     Cash, Card or Bank transfer. Only Cash comes out of the drawer.
--
-- device_refund_preview() shows that split before anything is committed.
-- ============================================================================

alter table public.device_warranty_claims
  add column if not exists refund_method text check (refund_method in ('Cash', 'Card', 'Bank Transfer'));
alter table public.device_warranty_claims
  add column if not exists refund_credit_amount numeric(12,2);

comment on column public.device_warranty_claims.refund_credit_amount is
  'Part of the refund taken off the customer''s credit balance rather than handed back.';
comment on column public.device_warranty_claims.refund_method is
  'How the rest of the refund was handed back: Cash, Card or Bank Transfer.';

-- ── What is still owed on an invoice, on credit ─────────────────────────────

create or replace function public.invoice_credit_outstanding(p_invoice_no text)
returns table (account_id uuid, outstanding numeric)
language sql
stable
security definer
set search_path = public
as $$
  with acc as (
    select coalesce(
      (select s.credit_account_id from public.sales s where s.invoice_no = p_invoice_no),
      (select e.account_id from public.credit_entries e
        where e.invoice_no = p_invoice_no and e.kind = 'Charge' order by e.id limit 1)
    ) as id
  )
  select acc.id,
         greatest(0, least(
           -- what this invoice still owes on its own entries…
           coalesce((select sum(case when e.kind = 'Charge' then e.amount else -e.amount end)
                       from public.credit_entries e
                      where e.invoice_no = p_invoice_no and e.account_id = acc.id), 0),
           -- …never more than the account owes overall.
           coalesce((select a.balance from public.v_credit_accounts a where a.id = acc.id), 0)
         ))
    from acc
   where acc.id is not null;
$$;

revoke all on function public.invoice_credit_outstanding(text) from public, anon;

-- ── Preview: how a refund of p_amount would split ───────────────────────────

create or replace function public.device_refund_preview(p_claim_id text, p_amount numeric)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  c public.device_warranty_claims;
  o record;
  credit numeric := 0;
begin
  if not public.is_staff() then raise exception 'Not authorised'; end if;
  select * into c from public.device_warranty_claims where id = p_claim_id;
  if not found then raise exception 'Claim % not found.', p_claim_id; end if;
  select * into o from public.invoice_credit_outstanding(c.invoice_no);
  if found then credit := least(coalesce(o.outstanding, 0), greatest(p_amount, 0)); end if;
  return jsonb_build_object('credit', round(credit, 2), 'payout', round(greatest(p_amount, 0) - credit, 2));
end $$;

grant execute on function public.device_refund_preview(text, numeric) to authenticated;

-- The same split, by invoice, before a claim exists (the window shows it
-- while the cashier is still filling the claim in).
create or replace function public.invoice_refund_preview(p_invoice_no text, p_amount numeric)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  o record;
  credit numeric := 0;
begin
  if not public.is_staff() then raise exception 'Not authorised'; end if;
  select * into o from public.invoice_credit_outstanding(p_invoice_no);
  if found then credit := least(coalesce(o.outstanding, 0), greatest(p_amount, 0)); end if;
  return jsonb_build_object('credit', round(credit, 2), 'payout', round(greatest(p_amount, 0) - credit, 2));
end $$;

grant execute on function public.invoice_refund_preview(text, numeric) to authenticated;

-- ── The refund, credit first ────────────────────────────────────────────────

drop function if exists public.refund_mobile_device(text, text, numeric);

create or replace function public.refund_mobile_device(
  p_claim_id    text,
  p_disposition text,              -- 'resell' | 'return_to_company'
  p_amount      numeric,
  p_method      text default 'Cash' -- how the paid part is handed back
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.device_warranty_claims;
  d public.mobile_devices;
  s public.sales;
  o record;
  credit numeric := 0;
  payout numeric;
begin
  if not (public.is_staff() and public.module_can_write('Sales / POS')) then
    raise exception using errcode = '42501', message = 'Refunding needs Sales / POS access.';
  end if;
  if p_disposition not in ('resell', 'return_to_company') then
    raise exception 'Choose whether the phone is kept for resale or returned to the company.';
  end if;
  if coalesce(p_method, '') not in ('Cash', 'Card', 'Bank Transfer') then
    raise exception 'Refund method must be Cash, Card or Bank Transfer.';
  end if;

  select * into c from public.device_warranty_claims where id = p_claim_id for update;
  if not found then raise exception 'Claim % not found.', p_claim_id; end if;
  if c.status in ('Completed', 'Rejected') then raise exception 'Claim % is already closed.', p_claim_id; end if;

  select * into d from public.mobile_devices where id = c.device_id for update;
  if not found or d.status <> 'sold' or d.sold_invoice_no is distinct from c.invoice_no then
    raise exception 'That phone is no longer recorded as sold on %.', c.invoice_no;
  end if;

  select * into s from public.sales where invoice_no = c.invoice_no for update;
  if not found or s.status = 'Voided' then
    raise exception 'Invoice % cannot be refunded.', c.invoice_no;
  end if;

  if p_amount is null or p_amount <= 0 or p_amount > coalesce(d.sold_price, p_amount) + 0.005 then
    raise exception 'The refund must be more than zero and no more than the price paid (Rs. %).', d.sold_price;
  end if;

  -- Credit first: what the customer still owes on this invoice is cancelled
  -- rather than handed back to them in cash.
  select * into o from public.invoice_credit_outstanding(c.invoice_no);
  if found and coalesce(o.outstanding, 0) > 0.005 then
    credit := round(least(o.outstanding, p_amount), 2);
    insert into public.credit_entries (account_id, kind, amount, invoice_no, note, created_by)
    values (o.account_id, 'Refund', credit, c.invoice_no,
            format('Warranty refund %s — %s returned', c.id, d.name), auth.uid());
  end if;
  payout := round(p_amount - credit, 2);

  update public.mobile_devices
     set status                = case when p_disposition = 'resell' then 'available' else 'supplier_return' end,
         sold_invoice_no       = null,
         sold_price            = null,
         sold_at               = null,
         returned_from_invoice = c.invoice_no,
         return_reason         = 'Warranty refund — ' || c.reported_issue,
         returned_at           = now()
   where id = d.id;

  update public.sales
     set status          = 'Returned',
         returned_amount = coalesce(returned_amount, 0) + round(p_amount, 2),
         return_reason   = concat_ws(' · ', nullif(return_reason, ''), 'Warranty refund ' || c.id || ' — ' || d.name),
         return_date     = current_date
   where id = s.id;

  update public.device_warranty_claims
     set status = 'Completed',
         refund_amount = round(p_amount, 2),
         refund_credit_amount = credit,
         refund_method = case when payout > 0.005 then p_method else null end,
         resolved_at = now()
   where id = c.id;

  return jsonb_build_object('credit', credit, 'payout', payout, 'method', p_method);
end $$;

comment on function public.refund_mobile_device(text, text, numeric, text) is
  'Warranty refund on a phone claim: cancels what is still owed on the invoice''s credit first (a Refund entry), returns the rest by Cash/Card/Bank Transfer, takes the phone off the sale and closes the claim. Cash is paid out by the till.';

grant execute on function public.refund_mobile_device(text, text, numeric, text) to authenticated;
