-- ============================================================================
-- Mano Mobile — what a POS Cashier may do
--
-- Follows 20260916000053, which added the enum value this file uses.
--
-- ── Module access ──────────────────────────────────────────────────────────
-- role_module_access treats a missing row as "allowed", so a role with no rows
-- could do everything. Every module is therefore seeded: Sales / POS in full,
-- Inventory and Customers to look at (a product's price and a customer's
-- balance are on the screen), Cash Register in full (a cash sale goes into the
-- till), and nothing else.
--
-- ── Credit sales ───────────────────────────────────────────────────────────
-- The POS can leave part of a bill on a customer's or dealer's account. That
-- is a Charge in credit_entries, and inserting a Charge by hand is an Admin
-- Cashier's privilege (see 20260901000010). A POS sale is not a hand-raised
-- charge — it is the unpaid part of an invoice that was just issued, the same
-- thing correct_sale_payment() posts for a corrected invoice — so it goes
-- through a definer function that checks the invoice it names, takes the
-- amount from the sale row rather than the caller, and raises it once.
-- ============================================================================

insert into public.role_module_access (role, module, access) values
  ('POS Cashier','Dashboard','none'),
  ('POS Cashier','Sales / POS','full'),
  ('POS Cashier','Repairs','none'),
  ('POS Cashier','Inventory','view'),
  ('POS Cashier','Customers','view'),
  ('POS Cashier','Cash Register','full'),
  ('POS Cashier','Sales Reports','none'),
  ('POS Cashier','Repair Reports','none'),
  ('POS Cashier','Financial Reports','none'),
  ('POS Cashier','General Ledger','none'),
  ('POS Cashier','AR / AP','none'),
  ('POS Cashier','Staff Management','none'),
  ('POS Cashier','Suppliers','none'),
  ('POS Cashier','Purchase Orders','none'),
  ('POS Cashier','Device Registry','none'),
  ('POS Cashier','Notifications','none'),
  ('POS Cashier','System Settings','none')
on conflict (role, module) do nothing;

-- ── Opening an account from the till ───────────────────────────────────────
--
-- A new customer or dealer who is taking goods on credit needs an account to
-- carry it. credit_accounts inserts are Admin Cashier only by policy; the POS
-- opens one through here instead, with the same shape the repair side uses.
-- Returns the account to use — an existing one when the phone (or dealer)
-- already has one, so the same person never ends up with two.

create or replace function public.pos_open_account(
  p_kind      text,
  p_name      text,
  p_phone     text default null,
  p_address   text default null,
  p_dealer_id bigint default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  acct uuid;
  kind credit_holder_kind;
begin
  if not (public.is_staff() and public.module_can_write('Sales / POS')) then
    raise exception using errcode = '42501', message = 'Opening an account needs Sales / POS access.';
  end if;
  if coalesce(btrim(p_name), '') = '' then
    raise exception 'A name is needed to open an account.';
  end if;
  kind := case when lower(coalesce(p_kind, '')) = 'dealer'
               then 'Dealer'::credit_holder_kind
               else 'Customer'::credit_holder_kind end;

  if p_dealer_id is not null then
    select id into acct from public.credit_accounts
     where holder_kind = 'Dealer' and dealer_id = p_dealer_id
     limit 1;
  end if;
  if acct is null and coalesce(btrim(p_phone), '') <> '' then
    select id into acct from public.credit_accounts
     where holder_kind = kind
       and public.normalise_phone(phone) = public.normalise_phone(p_phone)
     limit 1;
  end if;
  if acct is null then
    insert into public.credit_accounts (holder_kind, name, phone, address, dealer_id, auto_opened)
    values (kind, btrim(p_name), nullif(btrim(p_phone), ''), nullif(btrim(p_address), ''), p_dealer_id, false)
    returning id into acct;
  end if;
  return acct;
end $$;

comment on function public.pos_open_account(text, text, text, text, bigint) is
  'Opens (or finds) the credit account a POS sale can be left on. Any Sales / POS writer may call it; the account is a real one, not auto-opened.';

-- ── The unpaid part of a POS invoice ───────────────────────────────────────

create or replace function public.pos_post_credit(
  p_invoice_no text,
  p_account_id uuid
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  s    public.sales;
  owed numeric(12,2);
begin
  if not (public.is_staff() and public.module_can_write('Sales / POS')) then
    raise exception using errcode = '42501', message = 'Posting to an account needs Sales / POS access.';
  end if;

  select * into s from public.sales where invoice_no = p_invoice_no;
  if not found then
    raise exception 'There is no invoice %.', p_invoice_no;
  end if;
  if s.status = 'Voided' then
    raise exception 'Invoice % is voided.', p_invoice_no;
  end if;
  if not exists (select 1 from public.credit_accounts where id = p_account_id) then
    raise exception 'That account does not exist.';
  end if;

  -- What the invoice itself says is unpaid. Never an amount the caller typed.
  owed := round(greatest(coalesce(s.total, 0) - coalesce(s.paid, 0), 0), 2);
  if owed <= 0.005 then
    return 0;
  end if;

  -- Raised once: a retry of a request that already landed changes nothing.
  if exists (select 1 from public.credit_entries
              where invoice_no = p_invoice_no and job_id is null and kind = 'Charge') then
    return owed;
  end if;

  insert into public.credit_entries (account_id, kind, amount, occurred_on, due_on, invoice_no, note, created_by)
  select p_account_id, 'Charge', owed, coalesce(s.sold_on, current_date),
         coalesce(s.sold_on, current_date) + a.terms_days,
         p_invoice_no,
         'Balance outstanding on ' || p_invoice_no,
         auth.uid()
    from public.credit_accounts a
   where a.id = p_account_id;

  update public.sales set credit_account_id = p_account_id where invoice_no = p_invoice_no;
  return owed;
end $$;

comment on function public.pos_post_credit(text, uuid) is
  'Puts the unpaid part of a POS invoice on a credit account as one Charge. The amount is read from the sale, and a second call for the same invoice is a no-op.';
