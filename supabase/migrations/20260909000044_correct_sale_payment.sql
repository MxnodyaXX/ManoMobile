-- ============================================================================
-- Mano Mobile — the invoice that says paid when it was not
--
-- A cashier rings up a repair as settled in cash. It was not: the customer is
-- taking it on account and will pay next week. The shop now has an invoice
-- claiming money it never received, a job whose figures agree with that
-- invoice, and no charge on anybody's account. Three records, all wrong, all
-- wrong in the same direction, and nothing in the app can put any of them
-- right — the only tool was Void, which throws the invoice away and burns its
-- number for a mistake in one field.
--
-- ── Why one function ────────────────────────────────────────────────────────
-- Correcting this by hand means the invoice, the job's received total and the
-- credit ledger all have to move together. Any two of the three agreeing while
-- the third does not is worse than the original error, because it looks
-- settled. So it is one call that does all three or none of them.
--
-- ── What it is not ──────────────────────────────────────────────────────────
-- Not a way to change what was billed. The total stands: the customer was
-- charged what they were charged, and an invoice whose amount can be edited
-- after the fact is not an invoice. This changes only how much of it came in
-- and how — which is the thing that was actually entered wrongly.
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
  -- Deliberately not called job_id: repair_job_events has a column of that
  -- name, and inside the INSERT below Postgres cannot tell a variable from a
  -- column it is writing to. It says so — "column reference is ambiguous" —
  -- and refuses the whole function.
  v_job    text;
  v_status job_status;
begin
  -- The same people who may cancel a delivered job or settle a refund. This is
  -- the counter's own senior correction, not an Admin-only act — but it is not
  -- the cashier who made the mistake either.
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

  /**
   * The jobs on the invoice, brought back into line.
   *
   * advance_paid is every rupee a job has received, and handover.balanceSettled
   * is the part of it taken at handover. Correcting the receipt means replacing
   * that part — subtract what was recorded, add what actually came in — rather
   * than overwriting the total and losing whatever was taken as an advance at
   * intake weeks earlier.
   *
   * Spread largest-owed first, the same way the till allocates it, so a
   * part-payment across three phones leaves the debt on the last one instead of
   * smeared across all three.
   */
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
    -- so what is raised next is derived from the corrected row and nothing is
    -- left behind describing a state that no longer exists.
    delete from public.credit_entries
     where job_id = j.id and kind = 'Charge';

    perform public.post_repair_balance_to_credit(j.id);
  end loop;

  -- Whatever charge that just raised belongs to this invoice.
  perform public.stamp_invoice_on_credit_charges(p_invoice_no, coalesce(s.job_ids, '{}'));

  -- Said in the job's own history, because a correction that leaves no trace is
  -- indistinguishable from the mistake never having happened.
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
  'Corrects how much of an invoice was actually received, and moves the job figures and the credit charge with it. Never changes what was billed.';

revoke all on function public.correct_sale_payment(text, numeric, text, text) from public;
grant execute on function public.correct_sale_payment(text, numeric, text, text) to authenticated;
