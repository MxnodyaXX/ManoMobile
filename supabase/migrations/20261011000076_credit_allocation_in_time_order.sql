-- ============================================================================
-- Mano Mobile — a payment settles what was owed WHEN it was paid
--
-- The bug: INV-044 and INV-049 were recorded as paid, then corrected to credit
-- with nothing received. The invoice after them on the same account flipped
-- to "Part paid" although nothing about it had changed.
--
-- Why: 20261008000071 worked out every invoice's "paid" from the ledger, and
-- spent payments that name no invoice on the OLDEST open invoices first, by
-- sale date. The correction raised a brand-new charge for INV-044 — dated on
-- its sale day, so older than the next invoice. The next recalculation handed
-- the account's earlier, un-named payments to INV-044 first; the invoice they
-- had always been paying was left short, and showed Part paid. Money paid
-- weeks ago was being moved onto a debt that did not exist when it was paid.
--
-- The fix: entries are replayed in the order they were recorded. A payment
-- that names no invoice settles only what was on the account at that moment,
-- oldest first; anything left over waits for the next charge. A charge raised
-- later — by a correction — can no longer take money that was paid before it
-- existed.
--
-- correct_sale_payment re-raises an invoice's charge by deleting and
-- inserting it. It now keeps the original charge's recorded time, so
-- correcting the amount on an invoice that was already on credit does not
-- push it to the back of the queue and shift its payments elsewhere.
--
-- Every account is replayed once at the end, which puts INV-044, INV-049 and
-- the invoice after them right straight away.
-- ============================================================================

create or replace function public.sync_invoice_paid_for_account(p_account uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  e     record;
  inv   record;
  pool  numeric := 0;   -- received, not yet matched to anything owed
  open_ numeric;
  take  numeric;
begin
  if p_account is null then return; end if;

  create temp table if not exists _credit_sync (
    invoice_no  text primary key,
    charged     numeric not null default 0,
    settled     numeric not null default 0,
    written_off numeric not null default 0,
    first_on    date
  ) on commit drop;
  truncate _credit_sync;

  for e in
    select * from public.credit_entries
     where account_id = p_account
     order by created_at, id
  loop
    if e.kind = 'Charge' and e.invoice_no is not null then
      insert into _credit_sync (invoice_no, charged, first_on)
      values (e.invoice_no, e.amount, e.occurred_on)
      on conflict (invoice_no) do update
        set charged  = _credit_sync.charged + excluded.charged,
            first_on = least(_credit_sync.first_on, excluded.first_on);

    elsif e.kind in ('Payment', 'Refund') then
      if e.invoice_no is null then
        pool := pool + e.amount;
      else
        select * into inv from _credit_sync where invoice_no = e.invoice_no;
        if not found then
          -- Paid against an invoice before its charge was recorded: keep it
          -- on that invoice for when the charge arrives.
          insert into _credit_sync (invoice_no, settled) values (e.invoice_no, e.amount);
        else
          open_ := greatest(inv.charged - inv.settled - inv.written_off, 0);
          take  := least(open_, e.amount);
          update _credit_sync set settled = settled + take where invoice_no = e.invoice_no;
          -- More than that invoice owed: the rest is money on account.
          pool := pool + (e.amount - take);
        end if;
      end if;

    elsif e.kind = 'Write-off' and e.invoice_no is not null then
      insert into _credit_sync (invoice_no, written_off) values (e.invoice_no, e.amount)
      on conflict (invoice_no) do update set written_off = _credit_sync.written_off + excluded.written_off;
    end if;

    -- Money on account goes to whatever is owed right now, oldest first.
    if pool > 0.005 then
      for inv in
        select * from _credit_sync
         where charged - settled - written_off > 0.005
         order by first_on nulls last, invoice_no
      loop
        exit when pool <= 0.005;
        take := least(inv.charged - inv.settled - inv.written_off, pool);
        update _credit_sync set settled = settled + take where invoice_no = inv.invoice_no;
        pool := pool - take;
      end loop;
    end if;
  end loop;

  -- An invoice's paid = what was taken at the counter (its total less what
  -- went on the account) + what has since been settled against it.
  update public.sales s
     set paid = v.new_paid
    from (
      select c.invoice_no,
             least(sl.total, greatest(0, round((sl.total - c.charged) + least(c.settled, c.charged), 2))) as new_paid
        from _credit_sync c
        join public.sales sl on sl.invoice_no = c.invoice_no
       where c.charged > 0
    ) v
   where s.invoice_no = v.invoice_no
     and s.status <> 'Voided'
     and s.paid is distinct from v.new_paid;
end $$;

comment on function public.sync_invoice_paid_for_account(uuid) is
  'Recomputes sales.paid for every invoice charged to one credit account by replaying its ledger in the order it was recorded: named payments settle their invoice, un-named ones settle what was owed at that moment, oldest first. Write-offs are never counted as paid.';

-- ── Correcting a payment keeps the charge's place in time ──────────────────

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
  -- When the charge being replaced was first recorded. The new one takes the
  -- same moment, so payments made since still find it.
  was_at   timestamptz;
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

    select min(created_at) into was_at
      from public.credit_entries where job_id = j.id and kind = 'Charge';

    delete from public.credit_entries
     where job_id = j.id and kind = 'Charge';

    perform public.post_repair_balance_to_credit(j.id);

    if was_at is not null then
      update public.credit_entries set created_at = was_at
       where job_id = j.id and kind = 'Charge';
    end if;
  end loop;

  perform public.stamp_invoice_on_credit_charges(p_invoice_no, coalesce(s.job_ids, '{}'));

  -- ── Everything else: the balance rides on the invoice ────────────────────
  if coalesce(array_length(s.job_ids, 1), 0) = 0 then
    select min(created_at) into was_at
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

      insert into public.credit_entries (account_id, kind, amount, occurred_on, due_on, invoice_no, note, created_by, created_at)
      select acct, 'Charge', round(bill - received, 2), coalesce(s.sold_on, current_date),
             coalesce(s.sold_on, current_date) + a.terms_days,
             p_invoice_no,
             'Balance outstanding on ' || p_invoice_no,
             auth.uid(),
             coalesce(was_at, now())
        from public.credit_accounts a
       where a.id = acct;

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

-- ── Put every account right now ───────────────────────────────────────────
do $$
declare a record;
begin
  for a in select distinct account_id from public.credit_entries where account_id is not null loop
    perform public.sync_invoice_paid_for_account(a.account_id);
  end loop;
end $$;
