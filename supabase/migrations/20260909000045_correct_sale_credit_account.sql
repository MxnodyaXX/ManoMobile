-- ============================================================================
-- Mano Mobile — a corrected sale with no repair behind it
--
-- 20260909000044 corrects what an invoice actually took, and puts the balance
-- on account by re-posting each repair job. That covers a repair invoice and
-- nothing else: an accessory sale, a handset sale or a quotation has no jobs,
-- so the loop had nothing to walk and the correction quietly recorded the
-- invoice as unpaid with the debt sitting nowhere.
--
-- Unpaid and owed by nobody is the worst of the three states this feature
-- exists to prevent. So where there is no job to carry the balance, the
-- invoice carries it itself.
--
-- ── Whose account ──────────────────────────────────────────────────────────
-- The one the sale already names, if it names one — a sale rung up against a
-- credit customer knows exactly whose it is. Failing that the phone number,
-- which is what the repair side matches on too, so the same person does not
-- end up with one account from the counter and another from the bench. Only
-- if neither exists is an account opened, and it is marked auto_opened like
-- every other account the system opens on its own behalf.
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
  -- Deliberately not called job_id: repair_job_events has a column of that
  -- name, and inside the INSERT below Postgres cannot tell a variable from a
  -- column it is writing to.
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
  --
  -- advance_paid is every rupee a job has received and handover.balanceSettled
  -- is the part taken at handover, so correcting the receipt replaces that part
  -- rather than overwriting the total and losing an advance taken at intake.
  -- Largest owed first, the same way the till allocates it.
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

    -- The old charge described the old figures. Removed rather than adjusted,
    -- so what is raised next is derived from the corrected row.
    delete from public.credit_entries
     where job_id = j.id and kind = 'Charge';

    perform public.post_repair_balance_to_credit(j.id);
  end loop;

  perform public.stamp_invoice_on_credit_charges(p_invoice_no, coalesce(s.job_ids, '{}'));

  -- ── Everything else: the balance rides on the invoice ────────────────────
  --
  -- No jobs, so nothing above ran. Cleared and re-raised the same way, so
  -- correcting an invoice twice leaves one charge rather than two.
  if coalesce(array_length(s.job_ids, 1), 0) = 0 then
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

      insert into public.credit_entries (account_id, kind, amount, occurred_on, due_on, invoice_no, note, created_by)
      select acct, 'Charge', round(bill - received, 2), coalesce(s.sold_on, current_date),
             coalesce(s.sold_on, current_date) + a.terms_days,
             p_invoice_no,
             'Balance outstanding on ' || p_invoice_no,
             auth.uid()
        from public.credit_accounts a
       where a.id = acct;

      -- Written back so the invoice and the ledger name the same account. A
      -- sale that put money on somebody's tab and does not say whose is the
      -- thing this whole function exists to stop.
      update public.sales set credit_account_id = acct where invoice_no = p_invoice_no;
    end if;
  end if;

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

comment on function public.correct_sale_payment(text, numeric, text, text) is
  'Corrects how much of an invoice was actually received, and moves the job figures and the credit ledger with it — through the repair jobs where there are any, and against the invoice itself where there are not. Never changes what was billed.';
