"use client";

import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { RepairJob } from "@/cashier/contexts/RepairContext";

/**
 * A customer chasing their repair.
 *
 * The counter takes the question; the bench is the only place it can be
 * answered. This is the wire between the two — see migration 20260909000042
 * for why it is two timestamps rather than a flag.
 */

/**
 * Is somebody still waiting on an answer for this job?
 *
 * Outstanding while the last question is newer than the last acknowledgement.
 * A technician who marks it seen and then gets asked again is looking at a new
 * inquiry, not the same one twice — which is the whole reason a boolean would
 * not do.
 */
export function hasOpenInquiry(job: Pick<RepairJob, "inquiryAt" | "inquirySeenAt">): boolean {
  if (!job.inquiryAt) return false;
  if (!job.inquirySeenAt) return true;
  return new Date(job.inquiryAt).getTime() > new Date(job.inquirySeenAt).getTime();
}

/** What the bench is told, in the words the shop uses. */
export const INQUIRY_MESSAGE = "Customer inquiry received for this job. Please check the job status.";

/**
 * The two ways a customer chases a repair, and what each is called.
 *
 * They are the same fact — somebody asked — recorded at different stages, and
 * they read differently because the answer the technician owes is different:
 * one is "when will you start", the other "how far have you got".
 */
export function inquiryLabel(job: Pick<RepairJob, "status">): string {
  return job.status === "Non-Issued"
    ? "Send Reminder to Technician"
    : "Urgent — Customer Visited for an Update";
}

export async function recordInquiry(jobId: string, note?: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const { error } = await getSupabaseBrowserClient()
    .rpc("record_customer_inquiry", { p_job_id: jobId, p_note: note ?? null });
  if (error) {
    throw new Error(
      // undefined_function: the migration has not been run yet.
      error.code === "42883"
        ? "Customer inquiries need migration 20260909000042 — run it and try again."
        : error.message,
    );
  }
}

export async function acknowledgeInquiry(jobId: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const { error } = await getSupabaseBrowserClient()
    .rpc("acknowledge_customer_inquiry", { p_job_id: jobId });
  if (error) throw new Error(error.message);
}
