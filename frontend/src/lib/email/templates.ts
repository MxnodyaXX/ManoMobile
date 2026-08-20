import type { RepairJob } from "@/cashier/contexts/RepairContext";
import { smsValues } from "@/lib/sms/templates";
import { SHOP_DETAILS } from "@/lib/shop";

/**
 * Customer email wording and rendering.
 *
 * Bodies live in `email_templates` so an Admin can reword without a deploy.
 * Tokens are the same {placeholders} the SMS templates use — deliberately, so
 * an admin who has edited one already understands the other — plus a few that
 * only make sense with room to breathe (IMEI, full address).
 *
 * Unlike SMS there is no GSM-alphabet restriction here: email is UTF-8 and a
 * curly quote costs nothing. What email does need, and SMS does not, is HTML
 * escaping — a customer named "Ben & Co <Repairs>" must not be able to break
 * the markup of their own receipt.
 */

export type JobEmailEvent = "created" | "issued" | "finished";

export const JOB_EMAIL_EVENTS: JobEmailEvent[] = ["created", "issued", "finished"];

export const JOB_EMAIL_LABEL: Record<JobEmailEvent, string> = {
  created: "Job Receipt",
  issued: "Device Collected",
  finished: "Ready For Collection",
};

export const JOB_EMAIL_PURPOSE: Record<JobEmailEvent, string> = {
  created: "job-receipt",
  issued: "device-collected",
  finished: "ready-for-collection",
};

export const JOB_EMAIL_TRIGGER: Record<JobEmailEvent, string> = {
  created: "Sent when a new repair job is saved at the counter — this is the customer's receipt.",
  issued: "Sent when the device is handed back to the customer.",
  finished: "Sent when the technician marks the repair finished. Off by default, since the shop already texts this.",
};

export const EMAIL_VARIABLES: { token: string; description: string }[] = [
  { token: "customer_name", description: "Customer's first name" },
  { token: "customer_full_name", description: "Customer's full name" },
  { token: "device", description: "Brand and model, e.g. Xiaomi Redmi 9C" },
  { token: "job_number", description: "Job number, e.g. RM-016" },
  { token: "imei", description: "Device IMEI, if recorded" },
  { token: "fault", description: "Reported fault" },
  { token: "technician", description: "Assigned technician" },
  { token: "estimated_price", description: "Quoted cost, or the final bill once completed" },
  { token: "paid_amount", description: "Amount already paid" },
  { token: "due_amount", description: "Balance still owed" },
  { token: "estimated_completion", description: "Expected ready date" },
  { token: "shop_name", description: "Shop name" },
  { token: "shop_phone", description: "Shop phone number" },
  { token: "shop_address", description: "Shop address" },
];

/** Which tokens make sense per event. */
export const JOB_EMAIL_VARIABLES: Record<JobEmailEvent, string[]> = {
  created: ["customer_name", "device", "job_number", "imei", "fault", "estimated_price", "technician", "paid_amount", "due_amount", "estimated_completion", "shop_name", "shop_phone", "shop_address"],
  issued: ["customer_name", "device", "job_number", "imei", "fault", "estimated_price", "paid_amount", "due_amount", "shop_name", "shop_phone", "shop_address"],
  finished: ["customer_name", "device", "job_number", "fault", "estimated_price", "due_amount", "shop_name", "shop_phone", "shop_address"],
};

/**
 * Escape before substitution, never after — escaping the finished document
 * would destroy the template's own markup along with the customer's name.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function emailValues(job: RepairJob): Record<string, string> {
  return {
    // The SMS resolver already handles first names, money, dates and the
    // "To be assigned" / "To be diagnosed" fallbacks. Reusing it keeps the two
    // channels saying the same thing about the same job.
    ...smsValues(job),
    imei: (job.imei || "").trim() || "Not recorded",
    shop_name: SHOP_DETAILS.name,
    shop_phone: SHOP_DETAILS.phone,
    shop_address: SHOP_DETAILS.address,
  };
}

/** Substitute {tokens}. Unknown tokens are left visible rather than blanked,
 *  so a typo in a template shows up instead of leaving a silent gap. */
export function renderEmail(body: string, job: RepairJob): string {
  const values = emailValues(job);
  return (body || "").replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in values ? escapeHtml(values[key]) : whole,
  );
}

/**
 * Wrap the template body in a minimal shell. Kept plain on purpose: email
 * clients strip half of modern CSS, and a receipt that renders reliably in
 * Gmail, Outlook and a phone beats one that looks better in exactly one.
 */
export function wrapEmailHtml(inner: string): string {
  return `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;color:#111">
<div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e3e5e8;border-radius:10px;padding:24px">
${inner}
</div>
</body></html>`;
}
