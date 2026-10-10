-- ============================================================================
-- Mano Mobile — an invoice corrected to credit stays unpaid until paid for
--
-- After 20261011000076, correcting INV-000044 from "Rs. 350 received" to
-- "nothing received, on credit" still showed it as paid Rs. 350.
--
-- Why: 076 replayed the ledger in the order it was recorded. Earlier
-- corrections (before 076) had re-created their charges with a new timestamp,
-- so some payments found nothing owed at the moment they were made — that
-- money was carried forward "on account" and flowed into the next new charge,
-- which was INV-000044's. The invoice the cashier had just said was unpaid was
-- immediately paid off again by money that was never meant for it.
--
-- The rule now — what a cashier means by a correction:
--
--   * A charge raised by changing a paid invoice to credit is settled ONLY by
--     a payment that names that invoice. Payments that name no invoice (the
--     older ones, from before payments were recorded per invoice) keep paying
--     the invoices they always paid, oldest sale first, exactly as before the
--     correction — so no other invoice moves.
--   * Everything else is as in 20261008000071: named payments settle their
--     invoice; un-named ones settle the oldest invoices first.
--
-- Settle Credit records every payment against named invoices, so a corrected
-- invoice is paid off the normal way when the customer pays for it.
--
-- Existing charges are marked when they were clearly raised after the sale
-- (more than an hour later) — which is what INV-000044's and INV-000049's
-- were. Every account is then worked out again.
-- ============================================================================

alter table public.credit_entries
  add column if not exists settle_by_name_only boolean not null default false;

comment on column public.credit_entries.settle_by_name_only is
  'Charge raised by correcting a paid invoice to credit. Settled only by payments that name its invoice, never by un-named payments on the account.';

-- Charges raised well after their sale: corrections from paid to credit.
update public.credit_entries ce
   set settle_by_name_only = true
  from public.sales s
 where ce.kind = 'Charge'
   and ce.invoice_no = s.invoice_no
   and ce.created_at > s.created_at + interval '1 hour'
   and not ce.settle_by_name_only;

-- ── The recalculation ──────────────────────────────────────────────────────

create or replace function public.sync_invoice_paid_for_account(p_account uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  inv     record;
  pool    numeric;
  open_   numeric;
  take    numeric;
  settled numeric;
begin
  if p_account is null then return; end if;

  -- Money received against the account without naming an invoice.
  select coalesce(sum(amount), 0) into pool
    from public.credit_entries
   where account_id = p_account and invoice_no is null and kind in ('Payment', 'Refund');

  for inv in
    select e.invoice_no,
           sum(e.amount) filter (where e.kind = 'Charge')                             as charged,
           coalesce(sum(e.amount) filter (where e.kind in ('Payment', 'Refund')), 0) as paid_named,
           coalesce(sum(e.amount) filter (where e.kind = 'Write-off'), 0)            as written_off,
           min(e.occurred_on) filter (where e.kind = 'Charge')                        as first_on,
           coalesce(bool_or(e.settle_by_name_only) filter (where e.kind = 'Charge'), false) as name_only
      from public.credit_entries e
     where e.account_id = p_account and e.invoice_no is not null
     group by e.invoice_no
    having coalesce(sum(e.amount) filter (where e.kind = 'Charge'), 0) > 0
     order by min(e.occurred_on) filter (where e.kind = 'Charge'), e.invoice_no
  loop
    open_   := inv.charged - inv.paid_named - inv.written_off;
    settled := inv.paid_named;
    if open_ < 0 then
      -- Paid more than this invoice owed: the extra is money on account.
      pool    := pool - open_;
      settled := settled + open_;
      open_   := 0;
    end if;

    -- Un-named money never settles a corrected invoice.
    take := case when inv.name_only then 0 else least(open_, greatest(pool, 0)) end;
    pool := pool - take;
    settled := settled + take;

    update public.sales s
       set paid = least(s.total, greatest(0, round((s.total - inv.charged) + settled, 2)))
     where s.invoice_no = inv.invoice_no
       and s.status <> 'Voided'
       and s.paid is distinct from least(s.total, greatest(0, round((s.total - inv.charged) + settled, 2)));
  end loop;
end $$;

comment on function public.sync_invoice_paid_for_account(uuid) is
  'Recomputes sales.paid for every invoice charged to one credit account: named payments settle their invoice; un-named ones settle the oldest invoices first, except invoices corrected from paid to credit, which only named payments settle. Write-offs are never counted as paid.';

-- ── Corrections mark the charges they raise ────────────────────────────────
--
-- A charge raised where there was none (paid → credit) is marked. One that
-- replaces an existing charge (credit amount changed) keeps the old charge's
-- recorded time and its mark, so its standing does not change.

create or replace function public.tg_mark_correction_charge()
returns trigger
language plpgsql
as $$
begin
  if new.kind = 'Charge' and current_setting('mano.correcting_payment', true) = 'raise' then
    new.settle_by_name_only := true;
  end if;
  return new;
end $$;

drop trigger if exists trg_mark_correction_charge on public.credit_entries;
create trigger trg_mark_correction_charge
  before insert on public.credit_entries
  for each row execute function public.tg_mark_correction_charge();

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

-- ── Put every account right now ───────────────────────────────────────────
do $$
declare a record;
begin
  for a in select distinct account_id from public.credit_entries where account_id is not null loop
    perform public.sync_invoice_paid_for_account(a.account_id);
  end loop;
end $$;
