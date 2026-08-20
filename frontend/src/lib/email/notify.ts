"use client";

import type { RepairJob } from "@/cashier/contexts/RepairContext";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { sendEmail, emailTemplateFor } from "@/lib/email/client";
import {
  renderEmail, wrapEmailHtml, JOB_EMAIL_PURPOSE, type JobEmailEvent,
} from "@/lib/email/templates";

/**
 * Automatic customer emails for the repair lifecycle.
 *
 * Fire-and-forget, exactly like notifyJobEvent for SMS: a mail server timing
 * out must never stop a job being taken in or handed over. Failures go to the
 * console, and the server route records every attempt in email_messages, so an
 * undelivered receipt can be found afterwards — the counter is never blocked.
 *
 * Most customers give only a phone number. No email address is the normal case,
 * not an error, so it returns quietly.
 */
export function notifyJobEmail(event: JobEmailEvent, job: RepairJob): void {
  if (!isSupabaseConfigured()) return;
  if (!job?.customerEmail?.trim()) return;

  void (async () => {
    try {
      const template = await emailTemplateFor(event);
      // Missing row (migration not run) or switched off by an Admin.
      if (!template || !template.isActive) return;

      const subject = renderEmail(template.subject, job);
      const html = wrapEmailHtml(renderEmail(template.body, job));
      if (!subject.trim() || !html.trim()) return;

      const result = await sendEmail({
        to: job.customerEmail!.trim(),
        subject,
        html,
        jobId: job.id,
        purpose: JOB_EMAIL_PURPOSE[event],
      });
      if (!result.ok) {
        console.error(`Customer email (${event}) for ${job.id} was not sent:`, result.error);
      }
    } catch (e) {
      console.error(`Customer email (${event}) for ${job.id} failed:`, e);
    }
  })();
}
