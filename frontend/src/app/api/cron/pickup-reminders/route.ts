import { createClient } from "@supabase/supabase-js";
import { sendSms, normaliseLkNumber, getSmsConfig } from "@/lib/sms/textlk";
import { renderTemplate, DEFAULT_SMS_BODIES, JOB_SMS_PURPOSE } from "@/lib/sms/templates";
import type { RepairJob } from "@/cashier/contexts/RepairContext";

/**
 * GET /api/cron/pickup-reminders — the automatic half of the pickup
 * reminder (see JobsTable's "Send Reminder" button for the manual half,
 * which sends the same SMS event by hand).
 *
 * Runs once a day (see vercel.json). No signed-in user exists in a cron
 * trigger, so this can't reuse /api/sms/send's session-based auth or the
 * browser-only template/job readers everything else in the app uses —
 * it authenticates itself against CRON_SECRET and talks to Supabase with
 * the service-role key instead, bypassing RLS entirely by necessity.
 *
 * Finds every job still sitting on the shelf (status Completed, not yet
 * Delivered) for a Mano Mobile customer, and texts the ones that are
 * exactly on a 7-day multiple since completion — 7, 14, 21 days — so it's
 * a weekly nudge, not a message every single day. A second check against
 * sms_messages skips anything already reminded in the last 20 hours, in
 * case the same run is ever triggered twice.
 */

export const dynamic = "force-dynamic";

interface JobRow {
  id: string;
  customer_name: string;
  phone: string | null;
  brand: string;
  model: string;
  issue: string;
  technician: string;
  status: string;
  priority: string;
  estimated_cost: number | string;
  advance_paid: number | string;
  created_at: string;
  completed_at: string | null;
  dealer_id: number | null;
}

interface DealerRow {
  id: number;
  in_house: boolean;
}

/** Whole days since completion — mirrors smsValues' own daysSinceCompleted,
 *  duplicated rather than imported since this is what decides who gets
 *  texted at all, before rendering is even reached. */
function daysSince(iso: string | null): number {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  if (isNaN(t)) return 0;
  return Math.max(0, Math.floor((Date.now() - t) / 86_400_000));
}

function siteOrigin(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "";
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return Response.json({ ok: false, error: "CRON_SECRET is not set — see docs/SMS-SETUP.md." }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return Response.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const { senderId, configured: smsConfigured } = getSmsConfig();
  if (!smsConfigured) {
    return Response.json({ ok: false, error: "SMS is not configured (TEXTLK_API_TOKEN / TEXTLK_SENDER_ID)." }, { status: 503 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return Response.json({ ok: false, error: "SUPABASE_SERVICE_ROLE_KEY is not set." }, { status: 503 });
  }
  const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  // Every job still waiting for pickup, at least a week finished.
  const sevenDaysAgoIso = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const { data: rows, error: jobsError } = await admin
    .from("repair_jobs")
    .select("id, customer_name, phone, brand, model, issue, technician, status, priority, estimated_cost, advance_paid, created_at, completed_at, dealer_id")
    .eq("status", "Completed")
    .not("phone", "is", null)
    .lte("completed_at", sevenDaysAgoIso);
  if (jobsError) {
    return Response.json({ ok: false, error: jobsError.message }, { status: 500 });
  }

  // Only a Mano Mobile customer — an outside dealer's job has no end
  // customer of ours to remind; the dealer already knows their own device.
  const { data: dealerRows } = await admin.from("repair_dealers").select("id, in_house");
  const inHouseIds = new Set(((dealerRows ?? []) as DealerRow[]).filter(d => d.in_house).map(d => d.id));
  const eligible = ((rows ?? []) as JobRow[])
    .filter(r => r.dealer_id == null || inHouseIds.has(r.dealer_id))
    .filter(r => daysSince(r.completed_at) % 7 === 0);

  if (eligible.length === 0) {
    return Response.json({ ok: true, checked: (rows ?? []).length, sent: 0, skipped: 0, failed: 0 });
  }

  // Belt-and-braces against a duplicate trigger: skip anything already
  // reminded in roughly the last day.
  const twentyHoursAgoIso = new Date(Date.now() - 20 * 3_600_000).toISOString();
  const { data: recentReminders } = await admin
    .from("sms_messages")
    .select("job_id")
    .eq("purpose", JOB_SMS_PURPOSE.reminder)
    .gte("created_at", twentyHoursAgoIso);
  const alreadyReminded = new Set((recentReminders ?? []).map(r => r.job_id as string));

  const { data: templateRow } = await admin
    .from("sms_templates")
    .select("body, is_active")
    .eq("event", "reminder")
    .maybeSingle();
  if (templateRow && templateRow.is_active === false) {
    return Response.json({ ok: true, checked: (rows ?? []).length, sent: 0, skipped: eligible.length, failed: 0, note: "Pickup Reminder is switched off in Admin Control." });
  }
  const body = templateRow?.body || DEFAULT_SMS_BODIES.reminder;

  const origin = siteOrigin();
  let sent = 0, skipped = 0, failed = 0;

  for (const row of eligible) {
    if (alreadyReminded.has(row.id)) { skipped++; continue; }

    const recipient = normaliseLkNumber(row.phone ?? "");
    if (!recipient) { skipped++; continue; }

    const job: RepairJob = {
      id: row.id,
      customerName: row.customer_name,
      phone: row.phone ?? "",
      brand: row.brand,
      model: row.model,
      issue: row.issue,
      technician: row.technician,
      status: row.status as RepairJob["status"],
      priority: (row.priority || "Normal") as RepairJob["priority"],
      estimatedCost: Number(row.estimated_cost) || 0,
      advancePaid: Number(row.advance_paid) || 0,
      createdAt: row.created_at,
      estimatedCompletion: "",
      completedAt: row.completed_at ?? undefined,
    };

    const message = renderTemplate(body, job, origin);
    if (!message.trim()) { skipped++; continue; }

    const result = await sendSms(recipient, message);
    await admin.from("sms_messages").insert({
      recipient,
      recipient_raw: row.phone,
      sender_id: senderId,
      body: message,
      status: result.ok ? "Sent" : "Failed",
      provider_uid: result.uid ?? null,
      provider_status: result.providerStatus ?? null,
      cost: result.cost ?? null,
      sms_count: result.smsCount ?? null,
      error: result.error ?? null,
      job_id: row.id,
      purpose: JOB_SMS_PURPOSE.reminder,
      sent_by: null,
      sent_by_name: "System (pickup reminder)",
    });

    if (result.ok) sent++; else failed++;
  }

  return Response.json({ ok: true, checked: (rows ?? []).length, eligible: eligible.length, sent, skipped, failed });
}
