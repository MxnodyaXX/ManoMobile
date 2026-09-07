-- ============================================================================
-- Mano Mobile — a dealer's Cash Return should not wait for the handover
--
-- post_cash_return_to_dealer fires from the Delivered trigger. That was right
-- for the charge it sits beside: a repair is billed when the device goes back,
-- so the charge belongs at handover.
--
-- A Cash Return is the opposite. The technician decides at completion that the
-- shop owes money, and the shop owes it from that moment — whether or not the
-- device has been collected, and whether or not it ever is. RM-047 has sat
-- Completed since 6 September with Rs. 5,811 owed to Thirasara Max, posted
-- nowhere, because it was never Delivered.
--
-- So the deduction now fires on Completed as well. The charge still waits for
-- Delivered; only money going the other way moves earlier.
--
-- Both paths stay idempotent — post_cash_return_to_dealer returns early if the
-- job already has a Refund entry — so a job that completes and is then
-- delivered posts once, not twice.
-- ============================================================================

create or replace function public.tg_post_delivered_job_to_credit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- The bill: raised when the device goes back, because that is when the shop
  -- has finished earning it.
  if new.status = 'Delivered' and old.status is distinct from 'Delivered' then
    -- Never let a credit-posting problem block the handover itself. The phone
    -- is going back to its owner either way; a missing charge is a reconciling
    -- item, a failed handover is a customer standing at the counter.
    begin
      perform public.post_repair_balance_to_credit(new.id);
    exception when others then
      raise warning 'Could not post % to credit: %', new.id, sqlerrm;
    end;
  end if;

  -- The deduction: owed from the moment the technician says so. Completed or
  -- Delivered, whichever the job reaches first — the function itself refuses a
  -- second posting, so a job passing through both still posts once.
  if new.status in ('Completed', 'Delivered')
     and old.status is distinct from new.status then
    begin
      perform public.post_cash_return_to_dealer(new.id);
    exception when others then
      raise warning 'Could not post the Cash Return on % to the dealer: %', new.id, sqlerrm;
    end;
  end if;

  return new;
end $$;

drop trigger if exists trg_post_delivered_job_to_credit on public.repair_jobs;
create trigger trg_post_delivered_job_to_credit
  after update on public.repair_jobs
  for each row execute function public.tg_post_delivered_job_to_credit();

-- ── The ones already sitting unposted ───────────────────────────────────────
--
-- Jobs completed before this migration never reached the trigger. Posting them
-- now is the difference between a dealer's statement that is right and one
-- that is quietly short by whatever the shop owes them.
do $$
declare
  j record;
begin
  for j in
    select id from public.repair_jobs
     where completion_type = 'Cash Return'
       and coalesce(cash_return_amount, 0) > 0
       and status in ('Completed', 'Delivered')
  loop
    begin
      perform public.post_cash_return_to_dealer(j.id);
    exception when others then
      raise warning 'Backfill skipped % : %', j.id, sqlerrm;
    end;
  end loop;
end $$;
