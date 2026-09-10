-- ============================================================================
-- Mano Mobile — take back the debts the shop never was owed
--
-- NOT A MIGRATION. Nothing runs this for you. Paste it into the SQL editor.
--
-- Ten repairs were paid for in cash, in full, at the counter. Every one of them
-- also opened a credit account in the customer's name and charged them the
-- whole bill a second time — see 20260909000043 for how. The sales ledger was
-- right the whole time; this clears up after the credit one.
--
-- ── How it decides ──────────────────────────────────────────────────────────
-- Only by what an invoice says. A charge is removed where a sale covering that
-- job records the money as received — the invoice is the shop's own account of
-- what came in, and it is the only evidence here that is not the thing being
-- corrected.
--
-- Deliberately NOT recomputed from the job row. On a job with an intake advance
-- and a settlement, the two columns overlap in a way the row alone cannot
-- resolve, and guessing would either leave a false debt or erase a real one.
-- Where there is no invoice, the charge is left exactly as it is: RM-009 and
-- RM-014 were handed over without going through the till, and money may well
-- be owed on them. That is a question for the shop, not for this script.
--
-- ── How to run it ───────────────────────────────────────────────────────────
--   1. Run it as it is. dry_run is true: it does the whole job, then fails on
--      purpose and shows you every charge it would remove in the error DETAIL.
--   2. If that list is right, set dry_run := false and run it again.
--   3. Check the Credit screen — the affected accounts should read zero.
--
-- One DO block, because the SQL editor commits between statements and a
-- half-finished repair of the books is worse than the books as they stand.
-- ============================================================================

do $$
declare
  dry_run boolean := true;   -- ← set to false to actually apply it

  r        record;
  summary  text := '';
  n_ent    int := 0;
  n_acct   int := 0;
  n_job    int := 0;
begin
  -- ── The charges an invoice contradicts ────────────────────────────────────
  for r in
    select e.id,
           e.job_id,
           e.amount,
           a.name          as holder,
           s.invoice_no,
           s.total         as billed,
           s.paid          as collected
      from public.credit_entries e
      join public.credit_accounts a on a.id = e.account_id
      join public.sales s on s.job_ids @> array[e.job_id]
     where e.kind = 'Charge'
       and e.job_id is not null
       -- Settled in full. A part-paid invoice leaves a real balance, and that
       -- charge is doing its job.
       and coalesce(s.paid, 0) >= coalesce(s.total, 0) - 0.005
     order by e.id
  loop
    summary := summary || format(
      '%s  %s  charged %s  — %s collected %s of %s%s',
      lpad('#' || r.id, 5), rpad(r.job_id, 7), r.amount,
      r.invoice_no, r.collected, r.billed, chr(10)
    );

    delete from public.credit_entries where id = r.id;
    n_ent := n_ent + 1;

    /**
     * And put the job's own figures right.
     *
     * The charge was raised because advance_paid said nothing had been paid.
     * Deleting the entry without correcting that leaves the same false debt
     * one Delivered transition away from being raised all over again — and
     * leaves every screen that reads the column still showing a balance the
     * customer does not owe.
     */
    update public.repair_jobs
       set advance_paid = greatest(coalesce(advance_paid, 0), r.collected)
     where id = r.job_id
       and coalesce(advance_paid, 0) < r.collected;
    if found then
      n_job := n_job + 1;
    end if;
  end loop;

  -- ── Accounts opened only to hold those charges ────────────────────────────
  --
  -- auto_opened marks an account the system created on its own, so removing an
  -- empty one takes back only what the system did. An account somebody entered
  -- by hand stays, empty or not: it is a relationship, not a side effect.
  delete from public.credit_accounts a
   where a.auto_opened
     and not exists (select 1 from public.credit_entries e where e.account_id = a.id);
  get diagnostics n_acct = row_count;

  if n_ent = 0 then
    raise exception 'Nothing to correct — no credit charge is contradicted by an invoice.';
  end if;

  if dry_run then
    raise exception using
      message = format('DRY RUN - nothing was changed. %s false charge(s), %s job figure(s), %s empty auto-opened account(s):', n_ent, n_job, n_acct),
      detail  = summary,
      hint    = 'Set dry_run := false on the first line of the block and run it again to apply this.';
  end if;

  raise notice 'Removed % false charge(s), corrected % job(s), closed % empty account(s).', n_ent, n_job, n_acct;
end $$;


-- ── Run these afterwards to check ───────────────────────────────────────────

-- Every account and what it is now owed. The cash customers should be gone.
select name, holder_kind, balance, status
  from public.v_credit_accounts
 order by balance desc;

-- Anything still charged, with the invoice beside it. What is left should be
-- work that genuinely has not been paid for.
select e.job_id, e.amount, a.name, s.invoice_no, s.total, s.paid
  from public.credit_entries e
  join public.credit_accounts a on a.id = e.account_id
  left join public.sales s on s.job_ids @> array[e.job_id]
 where e.kind = 'Charge'
 order by e.id;
