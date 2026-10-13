-- ============================================================================
-- Mano Mobile — a corrected repair invoice keeps its date
--
-- INV-000004 was sold on 08 Sep 2026, but after its payment was corrected it
-- vanished from the account when filtered to "Last month".
--
-- Why: correcting a repair invoice re-raises each job's charge through
-- post_repair_balance_to_credit, the routine handovers use — and it dates the
-- charge today (and the due date today + terms). So a correction made on
-- 10 Oct moved an 08 Sep bill to 10 Oct: wrong month on the account, wrong
-- due date, wrong place on a statement. Non-repair invoices already kept their
-- sale date.
--
-- The fix: a corrected charge keeps the date it was first charged on (or the
-- invoice's sale date when there was none), and the due date moves with it.
-- Charges a correction already moved are put back: any repair charge dated
-- AFTER its invoice's sale day. A handover charges the job before or as the
-- invoice is made, never days after it — only a correction did that.
-- ============================================================================

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
  -- The day the replaced charge was dated: a correction changes how much was
  -- received, not when the invoice was raised.
  was_on   date;
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

    select min(created_at), coalesce(bool_or(settle_by_name_only), false), min(occurred_on) into was_at, was_mark, was_on
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

    -- The handover routine dates a charge today. Put it back on the day it was
    -- first charged, or the invoice's sale day, with the due date moving too
    -- so the terms still run from when the bill was raised.
    update public.credit_entries
       set due_on      = case when due_on is null then null
                              else due_on - (occurred_on - coalesce(was_on, s.sold_on, occurred_on)) end,
           occurred_on = coalesce(was_on, s.sold_on, occurred_on)
     where job_id = j.id and kind = 'Charge';
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

-- ── Put back the charges corrections already moved ─────────────────────────
update public.credit_entries ce
   set due_on      = case when ce.due_on is null then null else ce.due_on - (ce.occurred_on - s.sold_on) end,
       occurred_on = s.sold_on
  from public.sales s
 where ce.kind = 'Charge'
   and ce.job_id is not null
   and ce.invoice_no = s.invoice_no
   and ce.occurred_on > s.sold_on;
