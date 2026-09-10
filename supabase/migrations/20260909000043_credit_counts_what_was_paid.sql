-- ============================================================================
-- Mano Mobile — a repair paid for in cash is not a debt
--
-- Eleven invoices went out, ten of them settled in full in cash. Every one of
-- those ten opened a credit account in the customer's name and charged them
-- the whole bill again. The sales ledger was right; the credit ledger was
-- inventing money owed.
--
-- ── What actually went wrong ────────────────────────────────────────────────
-- post_repair_balance_to_credit decides what is outstanding from
--
--     estimated_cost - advance_paid
--
-- and the repair till never wrote advance_paid. It recorded what it took in
-- handover.balanceSettled and left the other column at whatever intake had put
-- there — usually nothing. So RM-003, billed 4,500 and paid 4,500 in notes,
-- read as 4,500 unpaid, and the Delivered trigger did exactly what it is for.
--
-- Two writers, two different ideas of which column means "paid". The till is
-- fixed to write advance_paid (see RepairSales' markIssued), which is the real
-- correction. This is the half that makes the function refuse to be fooled
-- again by a client that forgets.
--
-- ── Why greatest() and not a sum ────────────────────────────────────────────
-- The two columns overlap in one path and not the other: issuing an instant
-- job writes the full amount into BOTH advance_paid and balanceSettled, while
-- the repair till used to write it into balanceSettled alone. Adding them
-- would double-count the first case and hide a real debt; taking the larger
-- cannot do either. It is a floor under the truth, not a replacement for the
-- till writing it correctly.
--
-- Money already forgiven is subtracted too. written_off is the shop deciding
-- not to collect, which is the definition of not outstanding — it was being
-- charged to the customer's account regardless.
-- ============================================================================

create or replace function public.post_repair_balance_to_credit(p_job_id text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  j           public.repair_jobs;
  received    numeric(12,2);
  outstanding numeric(12,2);
  acct        uuid;
  dealer      public.repair_dealers;
begin
  select * into j from public.repair_jobs where id = p_job_id;
  if not found then
    return null;
  end if;

  -- Everything this job has been paid, however the till recorded it.
  received := greatest(
    coalesce(j.advance_paid, 0),
    coalesce((j.handover ->> 'balanceSettled')::numeric, 0)
  );

  outstanding := round(
    coalesce(j.estimated_cost, 0) - coalesce(j.written_off, 0) - received,
    2
  );

  -- Rounding noise on a numeric is not a debt.
  if outstanding <= 0.005 then
    return null;
  end if;

  -- Already charged: the unique index would reject it anyway, but returning the
  -- existing account is more useful than raising at the caller.
  select account_id into acct
    from public.credit_entries
   where job_id = p_job_id and kind = 'Charge'
   limit 1;
  if acct is not null then
    return acct;
  end if;

  if j.dealer_id is not null then
    select * into dealer from public.repair_dealers where id = j.dealer_id;
    -- An in-house "dealer" is the shop itself, so its jobs are walk-ins.
    if found and not coalesce(dealer.in_house, false) then
      select id into acct from public.credit_accounts where dealer_id = dealer.id;
      if acct is null then
        insert into public.credit_accounts (holder_kind, name, phone, address, dealer_id, auto_opened)
        values ('Dealer', dealer.name, dealer.contact, dealer.address, dealer.id, true)
        returning id into acct;
      end if;
    end if;
  end if;

  if acct is null then
    if coalesce(btrim(j.phone), '') <> '' then
      select id into acct
        from public.credit_accounts
       where holder_kind = 'Customer'
         and public.normalise_phone(phone) = public.normalise_phone(j.phone);
    end if;

    if acct is null then
      insert into public.credit_accounts (holder_kind, name, phone, email, auto_opened)
      values ('Customer', coalesce(nullif(btrim(j.customer_name), ''), 'Walk-in customer'),
              nullif(btrim(j.phone), ''), nullif(btrim(j.customer_email), ''), true)
      returning id into acct;
    end if;
  end if;

  insert into public.credit_entries (account_id, kind, amount, occurred_on, due_on, job_id, note, created_by)
  select acct, 'Charge', outstanding, current_date,
         current_date + a.terms_days,
         p_job_id,
         'Balance outstanding on ' || p_job_id || ' at handover',
         auth.uid()
    from public.credit_accounts a
   where a.id = acct
  on conflict do nothing;

  return acct;
end $$;

comment on function public.post_repair_balance_to_credit(text) is
  'Raises a credit charge for what a delivered repair still owes. Counts money recorded as an advance OR as settled at handover — whichever is larger, never their sum — and treats anything written off as not owed.';
