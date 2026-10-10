-- ============================================================================
-- Mano Mobile — un-named payments are assigned once and never move again
--
-- The bug, third time: correcting INV-044 and INV-047 to credit made INV-057
-- "Part paid" (Rs. 2,700). Correcting INV-057 to nothing received then made
-- INV-075 "Part paid" instead.
--
-- Why: Thirasara Max has payments recorded against the account without
-- naming an invoice (from before payments were recorded per invoice). Since
-- 20261008000071, every change on the account worked those payments out
-- across the invoices AGAIN, from scratch. 076 and 078 changed the rule for
-- sharing them out, but kept re-sharing — so every correction took the money
-- off one invoice and it landed on the next one. The total owed was always
-- right; which invoice looked paid kept moving.
--
-- The fix: stop re-sharing.
--
--   1. Once, now: each un-named payment is assigned to the invoices it paid,
--      oldest first — only invoices sold on or before the day it was paid,
--      never an invoice corrected from paid to credit, and only WHOLE
--      invoices. A lump sum clears invoices completely; whatever cannot clear
--      the next one in full stays "on account" rather than making an invoice
--      Part paid. Each assignment becomes its own payment line naming the
--      invoice (marked auto_allocated), so it is fixed from then on.
--   2. From now on an invoice's paid = what was taken at the counter + the
--      payments that name it. Money on account that names no invoice is
--      never spread onto invoices by itself — the customer's balance still
--      counts it, and Settle Credit applies new payments to named invoices.
--   3. Correcting an invoice changes that invoice only. Money that step 1
--      assigned to it is released back to "on account", because the cashier
--      has just said what was really received for it.
--
-- So a correction can no longer move another invoice. Totals and every
-- customer balance are unchanged: payments are split, never added or lost.
-- ============================================================================

alter table public.credit_entries
  add column if not exists auto_allocated boolean not null default false;

comment on column public.credit_entries.auto_allocated is
  'Part of an un-named payment assigned to this invoice by migration 20261011000079. Released back to on-account if the invoice''s payment is corrected.';

-- ── 2. The recalculation: named payments only ──────────────────────────────

create or replace function public.sync_invoice_paid_for_account(p_account uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_account is null then return; end if;

  update public.sales s
     set paid = least(s.total, greatest(0, round((s.total - c.charged) + least(c.paid_named, c.charged), 2)))
    from (
      select e.invoice_no,
             sum(e.amount) filter (where e.kind = 'Charge') as charged,
             coalesce(sum(e.amount) filter (where e.kind in ('Payment', 'Refund')), 0) as paid_named
        from public.credit_entries e
       where e.account_id = p_account and e.invoice_no is not null
       group by e.invoice_no
      having coalesce(sum(e.amount) filter (where e.kind = 'Charge'), 0) > 0
    ) c
   where s.invoice_no = c.invoice_no
     and s.status <> 'Voided'
     and s.paid is distinct from least(s.total, greatest(0, round((s.total - c.charged) + least(c.paid_named, c.charged), 2)));
end $$;

comment on function public.sync_invoice_paid_for_account(uuid) is
  'Recomputes sales.paid for every invoice charged to one credit account: what was taken at the counter plus the payments that name the invoice. Money on account that names no invoice is never spread onto invoices. Write-offs are never counted as paid.';

-- ── 3. Corrections change only the corrected invoice ───────────────────────

create or replace function public.correct_sale_payment(
  p_invoice_no text,
  p_received   numeric,
  p_method     text default null,
  p_note       text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  s        public.sales;
  j        public.repair_jobs;
  bill     numeric(12,2);
  received numeric(12,2);
  left_    numeric(12,2);
  settled  numeric(12,2);
  owed     numeric(12,2);
  share    numeric(12,2);
  acct     uuid;
  was_at   timestamptz;
  was_mark boolean;
  v_job    text;
  v_status job_status;
begin
  if not (public.has_role('Admin'::staff_role) or public.is_admin_cashier()) then
    raise exception using
      errcode = '42501',
      message = 'Correcting a recorded payment needs an admin cashier.';
  end if;

  select * into s from public.sales where invoice_no = p_invoice_no;
  if not found then
    raise exception 'There is no invoice %.', p_invoice_no;
  end if;
  if s.status = 'Voided' then
    raise exception 'Invoice % is voided — there is nothing to correct.', p_invoice_no;
  end if;

  bill     := coalesce(s.total, 0);
  received := round(least(greatest(coalesce(p_received, 0), 0), bill), 2);

  update public.sales
     set paid           = received,
         payment_method = coalesce(nullif(btrim(coalesce(p_method, '')), ''), payment_method)
   where invoice_no = p_invoice_no;

  -- Money assigned to this invoice from an un-named payment goes back on
  -- account: the cashier is saying what was really received for it. Only
  -- this invoice changes; nothing is handed to any other invoice.
  update public.credit_entries
     set invoice_no = null,
         note = concat_ws(' · ', nullif(note, ''), 'Released from ' || p_invoice_no || ' by a payment correction')
   where invoice_no = p_invoice_no
     and auto_allocated
     and kind in ('Payment', 'Refund');

  -- ── Repairs: the balance rides on the job ────────────────────────────────
  left_ := received;

  for j in
    select * from public.repair_jobs
     where id = any (coalesce(s.job_ids, '{}'))
     order by coalesce(estimated_cost, 0) desc
  loop
    settled := coalesce((j.handover ->> 'balanceSettled')::numeric, 0);
    owed    := greatest(coalesce(j.estimated_cost, 0) - coalesce(j.written_off, 0)
                        - (coalesce(j.advance_paid, 0) - settled), 0);
    share   := round(least(owed, greatest(left_, 0)), 2);
    left_   := left_ - share;

    update public.repair_jobs
       set advance_paid = greatest(coalesce(advance_paid, 0) - settled + share, 0),
           handover = case
                        when handover is null then null
                        else jsonb_set(handover, '{balanceSettled}', to_jsonb(share))
                      end
     where id = j.id;

    select min(created_at), coalesce(bool_or(settle_by_name_only), false) into was_at, was_mark
      from public.credit_entries where job_id = j.id and kind = 'Charge';

    delete from public.credit_entries
     where job_id = j.id and kind = 'Charge';

    -- No charge before: this correction is what puts the job on credit.
    perform set_config('mano.correcting_payment', case when was_at is null or was_mark then 'raise' else '' end, true);
    perform public.post_repair_balance_to_credit(j.id);
    perform set_config('mano.correcting_payment', '', true);

    if was_at is not null then
      update public.credit_entries set created_at = was_at
       where job_id = j.id and kind = 'Charge';
    end if;
  end loop;

  perform public.stamp_invoice_on_credit_charges(p_invoice_no, coalesce(s.job_ids, '{}'));

  -- ── Everything else: the balance rides on the invoice ────────────────────
  if coalesce(array_length(s.job_ids, 1), 0) = 0 then
    select min(created_at), coalesce(bool_or(settle_by_name_only), false) into was_at, was_mark
      from public.credit_entries
     where invoice_no = p_invoice_no and job_id is null and kind = 'Charge';

    delete from public.credit_entries
     where invoice_no = p_invoice_no and job_id is null and kind = 'Charge';

    if bill - received > 0.005 then
      acct := s.credit_account_id;

      if acct is null and coalesce(btrim(s.customer_phone), '') <> '' then
        select id into acct
          from public.credit_accounts
         where holder_kind = 'Customer'
           and public.normalise_phone(phone) = public.normalise_phone(s.customer_phone);
      end if;

      if acct is null then
        insert into public.credit_accounts (holder_kind, name, phone, auto_opened)
        values ('Customer',
                coalesce(nullif(btrim(s.customer), ''), 'Walk-in customer'),
                nullif(btrim(s.customer_phone), ''),
                true)
        returning id into acct;
      end if;

      insert into public.credit_entries (account_id, kind, amount, occurred_on, due_on, invoice_no, note, created_by, created_at, settle_by_name_only)
      select acct, 'Charge', round(bill - received, 2), coalesce(s.sold_on, current_date),
             coalesce(s.sold_on, current_date) + a.terms_days,
             p_invoice_no,
             'Balance outstanding on ' || p_invoice_no,
             auth.uid(),
             coalesce(was_at, now()),
             was_at is null or was_mark
        from public.credit_accounts a
       where a.id = acct;

      update public.sales set credit_account_id = acct where invoice_no = p_invoice_no;
    end if;
  end if;

  -- The recalculation above ran as each entry changed; once more now that the
  -- corrected charge is in place, so the invoice ends where the cashier put it.
  if acct is null then
    select credit_account_id into acct from public.sales where invoice_no = p_invoice_no;
  end if;
  perform public.sync_invoice_paid_for_account(acct);

  -- ── The trace ────────────────────────────────────────────────────────────
  foreach v_job in array coalesce(s.job_ids, '{}')
  loop
    select status into v_status from public.repair_jobs where id = v_job;
    insert into public.repair_job_events (job_id, from_status, to_status, note, changed_by)
    values (
      v_job, v_status, v_status,
      format('Payment on %s corrected to %s received%s', p_invoice_no, received,
             case when coalesce(btrim(coalesce(p_note, '')), '') = '' then '' else ' — ' || btrim(p_note) end),
      auth.uid()
    );
  end loop;
end $$;


-- ── 1. Assign every un-named payment, once ─────────────────────────────────

do $$
declare
  a     record;
  p     record;
  q     record;
  inv   record;
  pool  numeric;
  need  numeric;
  take  numeric;
begin
  create temp table if not exists _pin (invoice_no text primary key, open_ numeric not null, first_on date) on commit drop;
  create temp table if not exists _pay (id bigint primary key, remaining numeric not null, ord bigserial) on commit drop;

  for a in
    select distinct account_id from public.credit_entries
     where invoice_no is null and kind in ('Payment', 'Refund') and account_id is not null
  loop
    truncate _pin;
    truncate _pay;

    -- What each invoice still owes after anything that names it. Invoices
    -- corrected from paid to credit are left out: only a payment naming them
    -- settles them.
    insert into _pin (invoice_no, open_, first_on)
    select e.invoice_no,
           coalesce(sum(e.amount) filter (where e.kind = 'Charge'), 0)
             - coalesce(sum(e.amount) filter (where e.kind in ('Payment', 'Refund', 'Write-off')), 0),
           min(e.occurred_on) filter (where e.kind = 'Charge')
      from public.credit_entries e
     where e.account_id = a.account_id and e.invoice_no is not null
     group by e.invoice_no
    having coalesce(sum(e.amount) filter (where e.kind = 'Charge'), 0) > 0
       and not coalesce(bool_or(e.settle_by_name_only) filter (where e.kind = 'Charge'), false);

    pool := 0;
    for p in
      select * from public.credit_entries
       where account_id = a.account_id and invoice_no is null and kind in ('Payment', 'Refund')
       order by occurred_on, created_at, id
    loop
      insert into _pay (id, remaining) values (p.id, p.amount);
      pool := pool + p.amount;

      -- Whole invoices only, oldest first, sold on or before this payment.
      loop
        select * into inv from _pin
         where open_ > 0.005 and first_on <= p.occurred_on
         order by first_on, invoice_no
         limit 1;
        exit when not found or inv.open_ > pool + 0.005;

        need := inv.open_;
        for q in select * from _pay where remaining > 0.005 order by ord loop
          exit when need <= 0.005;
          take := least(q.remaining, need);
          insert into public.credit_entries
                 (account_id, kind, amount, occurred_on, invoice_no, method, note, created_by, created_at, auto_allocated)
          select e.account_id, e.kind, round(take, 2), e.occurred_on, inv.invoice_no, e.method,
                 concat_ws(' · ', nullif(e.note, ''), 'Assigned to ' || inv.invoice_no || ' from an un-named payment'),
                 e.created_by, e.created_at, true
            from public.credit_entries e where e.id = q.id;
          update _pay set remaining = remaining - take where id = q.id;
          need := need - take;
        end loop;

        pool := pool - inv.open_;
        update _pin set open_ = 0 where invoice_no = inv.invoice_no;
      end loop;
    end loop;

    -- What is left of each payment stays on account; a payment used up in
    -- full is replaced by its assigned lines.
    for q in select * from _pay loop
      if q.remaining <= 0.005 then
        delete from public.credit_entries where id = q.id;
      elsif q.remaining < (select amount from public.credit_entries where id = q.id) - 0.005 then
        update public.credit_entries set amount = round(q.remaining, 2) where id = q.id;
      end if;
    end loop;
  end loop;
end $$;

-- ── Put every account right now ───────────────────────────────────────────
do $$
declare a record;
begin
  for a in select distinct account_id from public.credit_entries where account_id is not null loop
    perform public.sync_invoice_paid_for_account(a.account_id);
  end loop;
end $$;

-- ── Putting money on account against invoices, on purpose ──────────────────
--
-- Money on account is no longer spread onto invoices by itself. When the
-- cashier wants it to clear invoices — Settle Credit offers it — this assigns
-- it, oldest un-named money first, to exactly the invoices and amounts given:
--   p_rows: [{ "invoice_no": "INV-000057", "amount": 2700 }, ...]
-- Same permission as recording a payment. Returns the amount assigned.

create or replace function public.apply_money_on_account(p_account uuid, p_rows jsonb)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  r      jsonb;
  q      record;
  want   numeric;
  take   numeric;
  total  numeric := 0;
  owed   numeric;
begin
  if not (public.is_staff() and public.module_can_write('Customers')) then
    raise exception using errcode = '42501', message = 'Recording payments needs Customers access.';
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Expected a list of { invoice_no, amount }.';
  end if;

  for r in select * from jsonb_array_elements(p_rows) loop
    want := round(coalesce((r->>'amount')::numeric, 0), 2);
    continue when want <= 0.005 or coalesce(r->>'invoice_no', '') = '';

    -- Never more than the invoice still owes.
    select coalesce(sum(amount) filter (where kind = 'Charge'), 0)
           - coalesce(sum(amount) filter (where kind in ('Payment', 'Refund', 'Write-off')), 0)
      into owed
      from public.credit_entries
     where account_id = p_account and invoice_no = r->>'invoice_no';
    want := least(want, greatest(owed, 0));

    for q in
      select * from public.credit_entries
       where account_id = p_account and invoice_no is null and kind = 'Payment'
       order by occurred_on, created_at, id
       for update
    loop
      exit when want <= 0.005;
      take := least(q.amount, want);
      insert into public.credit_entries (account_id, kind, amount, occurred_on, invoice_no, method, note, created_by, created_at)
      values (q.account_id, 'Payment', take, q.occurred_on, r->>'invoice_no', q.method,
              concat_ws(' · ', nullif(q.note, ''), 'Money on account applied to ' || (r->>'invoice_no')),
              q.created_by, q.created_at);
      if q.amount - take <= 0.005 then
        delete from public.credit_entries where id = q.id;
      else
        update public.credit_entries set amount = q.amount - take where id = q.id;
      end if;
      want  := want - take;
      total := total + take;
    end loop;
  end loop;

  return round(total, 2);
end $$;

revoke all on function public.apply_money_on_account(uuid, jsonb) from public;
grant execute on function public.apply_money_on_account(uuid, jsonb) to authenticated;
