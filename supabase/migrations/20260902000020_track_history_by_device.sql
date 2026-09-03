-- ============================================================================
-- Mano Mobile — "previous repairs on this device" should mean the device
--
-- track_job_history() matched on repair_jobs.phone and called the result "this
-- device". On a walk-in that is nearly right: one person, usually one handset.
--
-- On a dealer job it is badly wrong. The phone number on a Phone House job is
-- Phone House's own switchboard, shared by every device they have ever sent in
-- — so a customer opening the tracking link for one Samsung A04e was shown
-- seven unrelated repairs, other people's handsets among them, under a heading
-- promising they were all the same phone.
--
-- ── What identifies a device ────────────────────────────────────────────────
-- The IMEI, and nothing else. It is the only field that survives the phone
-- changing hands, the customer changing number, or a dealer sending it in on
-- somebody else's behalf.
--
-- Where the IMEI is missing — still most jobs, since it is not printed on the
-- outside of most handsets — the honest fallback is narrower than a phone
-- number: the same contact AND the same brand and model. That can still be two
-- identical handsets from one dealer, so it is returned labelled as a weaker
-- match and the page says so rather than claiming certainty it does not have.
-- ============================================================================

drop function if exists public.track_job_history(text);

create or replace function public.track_job_history(p_job_id text)
returns table (
  id             text,
  brand          text,
  model          text,
  issue          text,
  status         text,
  estimated_cost numeric,
  completed_at   date,
  created_at     date,
  -- 'imei'   this is certainly the same handset
  -- 'device' same customer, same make and model — probably, not certainly
  matched_on     text
)
language sql
security definer
set search_path = public
stable
as $$
  with me as (
    select j.phone,
           j.brand,
           j.model,
           nullif(regexp_replace(coalesce(j.imei, ''), '[^0-9]', '', 'g'), '') as imei_digits
      from public.repair_jobs j
     where j.id = p_job_id
  )
  select h.id, h.brand, h.model, h.issue, h.status, h.estimated_cost,
         h.completed_at::date, h.created_at::date,
         case when (select imei_digits from me) is not null then 'imei' else 'device' end
    from public.repair_jobs h, me
   where h.id <> p_job_id
     and (
       -- The device itself, when we know it.
       (me.imei_digits is not null
        and nullif(regexp_replace(coalesce(h.imei, ''), '[^0-9]', '', 'g'), '') = me.imei_digits)

       -- Otherwise the same customer's handset of the same make and model.
       -- Never phone alone: that is the bug this migration exists to fix.
       or (me.imei_digits is null
           and me.phone is not null and me.phone <> ''
           and h.phone = me.phone
           and h.brand = me.brand
           and h.model = me.model)
     )
   order by h.created_at desc
   limit 10;
$$;

comment on function public.track_job_history(text) is
  'Earlier repairs on the same handset. Matches on IMEI where the job has one; otherwise same customer plus same brand and model, flagged as the weaker match. Same trust boundary as track_job(): you must already hold one exact job id.';

grant execute on function public.track_job_history(text) to anon, authenticated;
