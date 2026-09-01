-- ============================================================================
-- Mano Mobile — forgiving a residual at the counter
--
-- A repair comes to Rs. 700, the customer hands over Rs. 500, and the shop
-- decides the last Rs. 200 is not worth chasing. Until now the only route was
-- the credit account: the handover trigger saw money outstanding and raised a
-- charge, opening an account for somebody who owes nothing and never will.
--
-- The obvious workarounds are both lies:
--
--   advance_paid = estimated_cost  — says the customer paid Rs. 700. Every
--                                    takings figure in the shop then overstates
--                                    by Rs. 200.
--   estimated_cost = 500           — says the job was quoted at Rs. 500. The
--                                    invoice says 700, and the two disagree
--                                    forever with no record of why.
--
-- So the job gets a third number. Billed 700, paid 500, written off 200,
-- outstanding 0 — each of which is true, and the shop can still see exactly how
-- much it gave away.
-- ============================================================================

alter table public.repair_jobs
  add column if not exists written_off numeric(12,2) not null default 0;

comment on column public.repair_jobs.written_off is
  'Part of this job''s bill the shop gave up on at handover. Reduces what is owed without pretending it was paid or that the price was lower.';

-- Outstanding now means: billed, less what was paid, less what was forgiven.
create or replace function public.post_repair_balance_to_credit(p_job_id text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  j           public.repair_jobs;
  outstanding numeric(12,2);
  acct        uuid;
  dealer      public.repair_dealers;
begin
  select * into j from public.repair_jobs where id = p_job_id;
  if not found then
    return null;
  end if;

  outstanding := round(
    coalesce(j.estimated_cost, 0)
    - coalesce(j.advance_paid, 0)
    - coalesce(j.written_off, 0), 2);

  -- Rounding noise on a numeric is not a debt. Neither is a balance the shop
  -- has already written off — that is the whole point of the column.
  if outstanding <= 0.005 then
    return null;
  end if;

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

-- ── The other half of the record ────────────────────────────────────────────
--
-- 20260901000016 said bad_debt is "never edited directly", meaning nobody types
-- a number into it — it is always the consequence of a decision recorded
-- somewhere else. A counter write-off is such a decision, made at the moment
-- the sale is written, so the sale carries it from the start and credit
-- write-offs add to it later. Still derived, still not a free-text figure.
comment on column public.sales.bad_debt is
  'How much of this invoice the shop gave up on: set when a residual is written off at the counter, and increased by credit write-offs naming this invoice. Never typed in as a standalone figure.';
