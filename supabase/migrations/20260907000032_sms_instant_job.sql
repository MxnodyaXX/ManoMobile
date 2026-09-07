-- ============================================================================
-- Instant repair SMS
--
-- A sixth customer message, and the only one some customers ever get.
--
-- A normal repair texts them three times: received, started, ready. An instant
-- job has none of those moments — all three happened before the record
-- existed, while the customer stood at the counter. So this one message has to
-- carry everything the other three would have said between them: what was
-- wrong, who fixed it, what was fitted, what it costs, and the tracking link,
-- which is their receipt until the printed one is in their hand.
--
-- {parts_used} is supplied by the form rather than read off the job: the parts
-- live in part_requests, and the row itself does not know them.
--
-- Same `on conflict do nothing` as the original seed — re-running this must
-- never clobber wording an Admin has since edited.
-- ============================================================================

insert into public.sms_templates (event, name, body) values
('instant', 'Instant Repair Done',
'Hi {customer_name},
your {device} has been repaired and is ready.

Job Number - {job_number}
Fault - {fault}
Repaired By - {technician}
Parts Used - {parts_used}

Repair Charge - {total}
Technician Charge - {technician_charge}
Paid Amount - {paid_amount}
Due Amount - {due_amount}

View your invoice and job history - {track_link}

Thank you for choosing {shop}.

For any other information contact {contact}.')
on conflict (event) do nothing;
