-- ============================================================================
-- Pickup reminder SMS
--
-- A fifth customer SMS event, alongside created/started/paused/finished: a
-- completed job that's still sitting on the shelf days after "Ready For
-- Collection" went out. Sent by a cashier's own click (Non-Issued list), or
-- automatically once a day by the pickup-reminders cron job for anything
-- Completed 7+ days ago, repeating weekly until it's finally collected.
--
-- Same `on conflict do nothing` as the original seed: re-running this must
-- never clobber wording an Admin has since edited.
-- ============================================================================

insert into public.sms_templates (event, name, body) values
('reminder', 'Pickup Reminder',
'Hi {customer_name},
this is a reminder that your {device} has been ready for collection for {days_waiting} days now.

Job Number - {job_number}
Fault - {fault}
Due Amount - {due_amount}

View your invoice and job history - {track_link}

Please collect it at your earliest convenience. Thank you for choosing {shop}.

For any other information contact {contact}.')
on conflict (event) do nothing;
