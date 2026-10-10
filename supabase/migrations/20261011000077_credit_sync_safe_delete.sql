-- ============================================================================
-- Mano Mobile — fix: "DELETE requires a WHERE clause" when correcting a payment
--
-- 20261011000076 cleared its scratch table with a bare DELETE. Supabase runs
-- requests from the app with safe-update protection on, which refuses any
-- DELETE without a WHERE — so correcting a payment (which re-raises a credit
-- charge and so runs this function) failed with that message. Applying the
-- migration itself worked only because the SQL editor does not have it on.
--
-- Same function, cleared with TRUNCATE instead. Nothing else changes.
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
