-- ============================================================================
-- Mano Mobile — money taken at the counter that the job never recorded
--
-- NOT A MIGRATION. Nothing runs this for you. Paste it into the SQL editor.
--
-- The repair till used to write what it collected into handover.balanceSettled
-- and leave advance_paid alone. Two places for one fact, and only one of them
-- filled in — so a repair paid for in full still read as entirely unpaid
-- everywhere advance_paid is used: the balance column in All Jobs, the figures
-- on a reprinted invoice, and the arithmetic behind a credit charge.
--
-- The same till also wrote the WHOLE invoice into balanceSettled on every job
-- it covered, so INV-000013 — two phones, 14,000 between them — says 14,000
-- was collected on each of them.
--
-- Both are fixed in the till. These are the jobs it got to first.
--
-- ── Why this works from the invoice, not the job ────────────────────────────
-- The obvious repair is "copy balanceSettled into advance_paid". On a
-- single-job invoice that is right. On INV-000013 it would record 14,000
-- against a 9,000 repair and 14,000 against a 5,000 one — 28,000 received on a
-- 14,000 bill, which is worse than the state being corrected.
--
-- So the invoice is the authority on how much came in, and it is shared out
-- across the jobs it covers: each takes what it owes, largest first, until the
-- money runs out. Exactly what the till does now. On a part-paid invoice that
-- leaves the last job owing, which is the job the credit charge belongs to.
-- ============================================================================

do $$
declare
  dry_run boolean := true;   -- ← set to false to actually apply it

  -- Prefixed, and not called `j`. The queries below alias repair_jobs as `j`,
  -- and plpgsql resolves a name to its own variable first — so a record called
  -- `j` makes `j.id` inside the SQL mean the unassigned variable rather than
  -- the table, and Postgres refuses with "record is not assigned yet".
  v_inv   record;
  v_job   record;
  left_   numeric(12,2);
  owed    numeric(12,2);
  share   numeric(12,2);
  summary text := '';
  n_inv   int := 0;
  n_job   int := 0;
begin
  -- Only invoices that cover a job whose figures disagree with them. An
  -- invoice whose jobs already add up is left alone entirely.
  for v_inv in
    select s.invoice_no, s.job_ids, coalesce(s.paid, 0) as collected, coalesce(s.total, 0) as billed
      from public.sales s
     where s.status <> 'Voided'
       and coalesce(array_length(s.job_ids, 1), 0) > 0
       and exists (
         select 1 from public.repair_jobs j
          where j.id = any (s.job_ids)
            and coalesce((j.handover ->> 'balanceSettled')::numeric, 0)
                > coalesce(j.advance_paid, 0) + 0.005
       )
     order by s.invoice_no
  loop
    left_ := v_inv.collected;
    n_inv := n_inv + 1;
    summary := summary || format('%s — collected %s of %s%s',
                                 v_inv.invoice_no, v_inv.collected, v_inv.billed, chr(10));

    for v_job in
      select id, coalesce(estimated_cost, 0) as bill, coalesce(written_off, 0) as forgiven,
             coalesce(advance_paid, 0) as recorded
        from public.repair_jobs
       where id = any (v_inv.job_ids)
       order by coalesce(estimated_cost, 0) desc
    loop
      -- What this job was short of, before the receipt is applied. advance_paid
      -- is left in place where it holds a genuine intake advance.
      owed  := greatest(v_job.bill - v_job.forgiven - v_job.recorded, 0);
      share := round(least(owed, greatest(left_, 0)), 2);
      left_ := left_ - share;

      summary := summary || format('   %s  bill %s  ·  had %s  ·  takes %s%s',
                                   rpad(v_job.id, 8), v_job.bill, v_job.recorded, share, chr(10));

      update public.repair_jobs
         set advance_paid = v_job.recorded + share,
             -- And stop every line claiming the whole invoice.
             handover = jsonb_set(handover, '{balanceSettled}', to_jsonb(share))
       where id = v_job.id;

      n_job := n_job + 1;
    end loop;

    if left_ > 0.005 then
      summary := summary || format('   (%s of this invoice could not be placed on any job)%s',
                                   left_, chr(10));
    end if;
  end loop;

  if n_job = 0 then
    raise exception 'Nothing to correct — every job already records what its invoice collected.';
  end if;

  if dry_run then
    raise exception using
      message = format('DRY RUN - nothing was changed. %s invoice(s), %s job(s):', n_inv, n_job),
      detail  = summary,
      hint    = 'Set dry_run := false on the first line of the block and run it again to apply this.';
  end if;

  raise notice 'Corrected % job(s) across % invoice(s).', n_job, n_inv;
end $$;


-- ── Afterwards ──────────────────────────────────────────────────────────────
--
-- Per invoice: what it billed, what it collected, and what its jobs now say
-- they received. The last two columns should match.
select s.invoice_no,
       s.total                                   as billed,
       s.paid                                    as collected,
       sum(j.advance_paid)                       as jobs_say_received,
       string_agg(j.id, ', ' order by j.id)      as jobs
  from public.sales s
  join public.repair_jobs j on j.id = any (s.job_ids)
 where s.status <> 'Voided'
 group by s.invoice_no, s.total, s.paid
 order by s.invoice_no;
