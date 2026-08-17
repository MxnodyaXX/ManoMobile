import type { RepairJob } from "@/cashier/contexts/RepairContext";

/**
 * Customer SMS wording and rendering.
 *
 * Bodies are stored in the database (`sms_templates`) so an Admin can reword a
 * message without a deploy. The defaults below are the same text the migration
 * seeds; they are the fallback when the table has not been created yet, or when
 * a template row is missing.
 *
 * Rendered output is forced to plain ASCII. A curly quote, an em dash or an
 * ellipsis pushes the whole message off the GSM alphabet onto UCS-2, where a
 * part is 70 characters instead of 160 — one stray character pasted into a
 * template would roughly quadruple the cost of every message that uses it.
 */

/** Shop name in the message body (the Sender ID is configured separately). */
export const SHOP = "Mano Mobile";

/** Printed at the foot of the default templates. */
export const SHOP_CONTACT = "0717537383";

export type JobSmsEvent = "created" | "started" | "paused" | "finished";

export const JOB_SMS_EVENTS: JobSmsEvent[] = ["created", "started", "paused", "finished"];

export const JOB_SMS_LABEL: Record<JobSmsEvent, string> = {
  created: "Job Received",
  started: "Repair Started",
  paused: "Repair On Hold",
  finished: "Ready For Collection",
};

export const JOB_SMS_PURPOSE: Record<JobSmsEvent, string> = {
  created: "job-received",
  started: "repair-started",
  paused: "repair-on-hold",
  finished: "ready-for-collection",
};

/** When each message is sent — shown next to the editor so wording matches timing. */
export const JOB_SMS_TRIGGER: Record<JobSmsEvent, string> = {
  created: "Sent the moment a new repair job is saved at the counter.",
  started: "Sent when a technician starts the repair (assigned or self-taken).",
  paused: "Sent when a technician puts the job on hold, including the reason.",
  finished: "Sent when the technician marks the repair finished.",
};

// ─── Placeholders ────────────────────────────────────────────────────────────

/** Every token the editor offers, with what it resolves to. */
export const SMS_VARIABLES: { token: string; description: string }[] = [
  { token: "customer_name", description: "Customer's first name" },
  { token: "customer_full_name", description: "Customer's full name" },
  { token: "device", description: "Brand and model, e.g. Xiaomi Redmi 9C" },
  { token: "job_number", description: "Job number, e.g. RM-009" },
  { token: "fault", description: "Reported fault" },
  { token: "technician", description: "Assigned technician" },
  { token: "estimated_price", description: "Quoted repair cost" },
  { token: "total", description: "Total charge" },
  { token: "paid_amount", description: "Advance already paid" },
  { token: "due_amount", description: "Balance still owed" },
  { token: "estimated_completion", description: "Expected ready date" },
  { token: "pause_reason", description: "Why the job is on hold" },
  { token: "shop", description: "Shop name" },
  { token: "contact", description: "Shop contact number" },
];

/** Which tokens make sense per event — the rest would render as fallback text. */
export const JOB_SMS_VARIABLES: Record<JobSmsEvent, string[]> = {
  created: ["customer_name", "device", "job_number", "fault", "estimated_price", "technician", "paid_amount", "due_amount", "estimated_completion", "shop", "contact"],
  started: ["customer_name", "device", "job_number", "fault", "technician", "estimated_completion", "shop", "contact"],
  paused: ["customer_name", "device", "job_number", "pause_reason", "technician", "shop", "contact"],
  finished: ["customer_name", "device", "job_number", "fault", "technician", "total", "paid_amount", "due_amount", "shop", "contact"],
};

// ─── Formatting helpers ──────────────────────────────────────────────────────

const firstName = (full: string) => (full || "").trim().split(/\s+/)[0] || "there";
const device = (job: RepairJob) => [job.brand, job.model].filter(Boolean).join(" ").trim() || "device";
const money = (n: number) => `Rs. ${Math.max(0, Math.round(n)).toLocaleString("en-LK")}`;

function niceDate(iso?: string) {
  if (!iso) return "To be confirmed";
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? "To be confirmed"
    : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

const technicianOf = (job: RepairJob) => {
  const t = (job.technician ?? "").trim();
  return !t || t.toLowerCase() === "unassigned" ? "To be assigned" : t;
};

const faultOf = (job: RepairJob) => (job.issue || "").trim() || "To be diagnosed";

/**
 * Replace characters outside the GSM 03.38 alphabet. Cheaper to transliterate
 * than to pay UCS-2 rates because someone pasted a smart quote.
 */
export function toGsmSafe(text: string): string {
  return (text || "")
    .replace(/[‘’‛′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[–—−]/g, "-")
    .replace(/…/g, "...")
    .replace(/[•·]/g, "-")
    .replace(/ /g, " ")
    .replace(/[​-‍﻿]/g, "");
}

/** Keep a free-text reason from running away with the bill. */
function trimReason(text: string, max = 90) {
  const t = toGsmSafe(text || "").trim().replace(/\s+/g, " ");
  return t.length <= max ? t : `${t.slice(0, max - 3).trimEnd()}...`;
}

// ─── Rendering ───────────────────────────────────────────────────────────────

/** Values for every token, for one job. */
export function smsValues(job: RepairJob): Record<string, string> {
  const dueAmount = Math.max(0, job.estimatedCost - job.advancePaid);
  return {
    customer_name: firstName(job.customerName),
    customer_full_name: (job.customerName || "").trim() || "Customer",
    device: device(job),
    job_number: job.id,
    fault: faultOf(job),
    technician: technicianOf(job),
    estimated_price: money(job.estimatedCost),
    total: money(job.estimatedCost),
    paid_amount: money(job.advancePaid),
    due_amount: money(dueAmount),
    estimated_completion: niceDate(job.estimatedCompletion),
    pause_reason: trimReason(job.pauseReason || "Awaiting parts"),
    shop: SHOP,
    contact: SHOP_CONTACT,
  };
}

/**
 * Substitute {tokens} in a template body.
 *
 * An unknown token is left visible as `{token}` rather than blanked: a typo in
 * the editor then shows up in the preview instead of silently sending a message
 * with a hole in it.
 */
export function renderTemplate(body: string, job: RepairJob): string {
  const values = smsValues(job);
  const filled = (body || "").replace(/\{(\w+)\}/g, (whole, token: string) =>
    Object.prototype.hasOwnProperty.call(values, token) ? values[token] : whole,
  );
  return toGsmSafe(filled).trim();
}

// ─── Defaults (mirror supabase/migrations/…_sms_templates.sql) ───────────────

export const DEFAULT_SMS_BODIES: Record<JobSmsEvent, string> = {
  created: `Hi {customer_name},
we have received your {device} for repair.

Job Number - {job_number}
Fault - {fault}
Estimated Price - {estimated_price}
Assigned Technician - {technician}

Paid Amount - {paid_amount}
Due Amount - {due_amount}

Estimated Completion - {estimated_completion}

We will keep you updated. Thank you for choosing {shop}.

For any other information contact {contact}.`,

  started: `Hi {customer_name},
work has now started on your {device}.

Job Number - {job_number}
Fault - {fault}
Assigned Technician - {technician}
Estimated Completion - {estimated_completion}

We will notify you as soon as it is ready. Thank you for choosing {shop}.

For any other information contact {contact}.`,

  paused: `Hi {customer_name},
your repair has been placed on hold.

Job Number - {job_number}
Device - {device}
Reason - {pause_reason}
Assigned Technician - {technician}

We will resume as soon as possible and keep you informed. Thank you for your patience.
{shop}.

For any other information contact {contact}.`,

  finished: `Great news {customer_name}!
Your {device} has been repaired and is ready to collect.

Job Number - {job_number}
Fault - {fault}
Repaired By - {technician}

Total - {total}
Paid Amount - {paid_amount}
Due Amount - {due_amount}

Please bring this job number when collecting.
Thank you for choosing {shop}.

For any other information contact {contact}.`,
};

/** Render an event using the built-in wording (used when the table has no row). */
export function jobSmsBody(event: JobSmsEvent, job: RepairJob): string {
  return renderTemplate(DEFAULT_SMS_BODIES[event], job);
}

/** A representative job for previewing template wording. Never saved or sent. */
export const SAMPLE_JOB: RepairJob = {
  id: "RM-009",
  customerName: "Manodya Perera",
  phone: "0771234567",
  brand: "Xiaomi",
  model: "Redmi 9C",
  issue: "Screen Damage",
  technician: "Kamal",
  status: "Non-Issued",
  priority: "Normal",
  estimatedCost: 25000,
  advancePaid: 5000,
  createdAt: "2026-08-16",
  estimatedCompletion: "2026-08-22",
  pauseReason: "Waiting for the charging port module to arrive from our supplier",
};
