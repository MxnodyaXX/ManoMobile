-- ============================================================================
-- Instant repair: the two ways a visit ends
--
-- 20260907000032 added one message for instant jobs. In practice there are two
-- endings, and they are not the same news:
--
--   paid and collected  the customer walked out with the phone. The message is
--                       a thank-you and a receipt.
--   saved but not paid  the payment was not taken — the sheet was closed, the
--                       customer stepped out to find cash. The device is still
--                       on the shelf, and the message has to say so.
--
-- One wording covering both would have to be vague about the only thing that
-- matters: whether they have their phone.
--
-- 'instant' keeps its row and becomes the ready-to-collect wording; the new
-- 'instant_settled' is the completed visit. Both are seeded with
-- `on conflict do nothing`, so an Admin's edits survive a re-run — which also
-- means the 'instant' body below is NOT applied to an existing installation.
-- The update after the insert handles that, and only where the wording is
-- still exactly what 32 shipped.
-- ============================================================================

insert into public.sms_templates (event, name, body) values
('instant_settled', 'Instant Repair Collected',
'Thank you for your patience, {customer_name}.
your {device} has been repaired and handed back to you today.

Job Number - {job_number}
Fault - {fault}
Repaired By - {technician}
Parts Used - {parts_used}

Total - {total}
Paid Amount - {paid_amount}
Due Amount - {due_amount}

View your invoice and job history - {track_link}

It was a pleasure to help. Thank you for choosing {shop}.

For any other information contact {contact}.')
on conflict (event) do nothing;

-- ── Retitling the one that already exists ───────────────────────────────────
--
-- Only where nobody has touched it. A shop that has already reworded this
-- message meant what it wrote, and a migration that "improves" it would be
-- editing their words without asking.
update public.sms_templates
   set name = 'Instant Repair Ready',
       body = replace(body,
                      'has been repaired and is ready.',
                      'has been repaired and is ready to collect.')
 where event = 'instant'
   and body like '%has been repaired and is ready.%';
