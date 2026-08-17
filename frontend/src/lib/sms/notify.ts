"use client";

import type { RepairJob } from "@/cashier/contexts/RepairContext";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { sendSms } from "@/lib/sms/client";
import { JOB_SMS_PURPOSE, renderTemplate, type JobSmsEvent } from "@/lib/sms/templates";
import { templateFor } from "@/lib/sms/templatesApi";

/**
 * Automatic customer notifications for the repair lifecycle.
 *
 * Deliberately fire-and-forget: a gateway outage, a missing template or a slow
 * network must never stop a job being taken in or marked finished. Failures go
 * to the console, and the server route records every attempt in sms_messages,
 * so an undelivered message can be found afterwards — but the counter is never
 * blocked by one.
 */
export function notifyJobEvent(event: JobSmsEvent, job: RepairJob): void {
  // Demo mode has no session, so a send would only 401.
  if (!isSupabaseConfigured()) return;
  if (!job?.phone?.trim()) return;

  void (async () => {
    try {
      const template = await templateFor(event);
      // An Admin switched this message off; staff can still send it by hand.
      if (!template.isActive) return;

      const message = renderTemplate(template.body, job);
      if (!message.trim()) return;

      const result = await sendSms({
        to: job.phone,
        message,
        jobId: job.id,
        purpose: JOB_SMS_PURPOSE[event],
      });
      if (!result.ok) {
        console.error(`Customer SMS (${event}) for ${job.id} was not sent:`, result.error);
      }
    } catch (e) {
      console.error(`Customer SMS (${event}) for ${job.id} failed:`, e);
    }
  })();
}
