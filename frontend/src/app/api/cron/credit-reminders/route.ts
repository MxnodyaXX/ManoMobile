import { createClient } from "@supabase/supabase-js";
import { sendSms, normaliseLkNumber, getSmsConfig } from "@/lib/sms/textlk";
import {
  CREDIT_REMINDER_PURPOSE,
  daysUntilCreditDue,
  isCreditReminderDueToday,
  renderCreditReminder,
  type CreditReminderAccount,
} from "@/lib/sms/creditReminders";

/**
 * GET /api/cron/credit-reminders — the automatic half of the credit balance
 * reminder (see CreditCustomers.tsx / AllCustomers.tsx's "Notify" button for
 * the manual half, which sends the same message by hand through the same
 * /api/sms/send route).
 *
 * Closely mirrors app/api/cron/pickup-reminders: no signed-in user exists in
 * a cron trigger, so this authenticates against CRON_SECRET and talks to
 * Supabase with the service-role key, bypassing RLS by necessity.
 *
 * Runs once a day (see vercel.json, offset from pickup-reminders' schedule).
 * Texts every Customer-kind credit account (never a dealer — see
 * AllCustomers.tsx's own comments on why dealers are a different concept)
 * that has a phone on file, an outstanding balance, and is exactly 7, 2 or 1
 * day(s) before its due date, on the due date itself, or any number of days
 * past it — see lib/sms/creditReminders.ts for exactly how "due date" is
 * worked out (first_charge_on + terms_days, the same arithmetic
 * v_credit_accounts already uses for its own Overdue status) and why the
 * "every day once overdue" half of that has no cap.
 *
 * A second check against sms_messages skips anything already reminded in the
 * last ~20 hours, in case the same run is ever triggered twice — same
 * dedupe window pickup-reminders uses, and for the same reason.
 */

export const dynamic = "force-dynamic";

interface AccountRow {
  id: string;
  holder_kind: string;
  name: string;
  phone: string | null;
  balance: number | string;
  first_charge_on: string | null;
  terms_days: number | string;
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

  // Credit customers only — never dealers, which are settled through a
  // different relationship (cash returns, not SMS chasing).
  const { data: rows, error: accountsError } = await admin
    .from("v_credit_accounts")
    .select("id, holder_kind, name, phone, balance, first_charge_on, terms_days")
    .eq("holder_kind", "Customer")
    .not("phone", "is", null)
    .gt("balance", 0.005);
  if (accountsError) {
    return Response.json({ ok: false, error: accountsError.message }, { status: 500 });
  }

  const today = new Date();
  const eligible = ((rows ?? []) as AccountRow[]).filter(r =>
    isCreditReminderDueToday(daysUntilCreditDue(r.first_charge_on, Number(r.terms_days) || 0, today)),
  );

  if (eligible.length === 0) {
    return Response.json({ ok: true, checked: (rows ?? []).length, eligible: 0, sent: 0, skipped: 0, failed: 0 });
  }

  // Belt-and-braces against a duplicate trigger: skip anything already
  // reminded in roughly the last day.
  const twentyHoursAgoIso = new Date(Date.now() - 20 * 3_600_000).toISOString();
  const { data: recentReminders } = await admin
    .from("sms_messages")
    .select("account_id")
    .eq("purpose", CREDIT_REMINDER_PURPOSE)
    .gte("created_at", twentyHoursAgoIso);
  const alreadyReminded = new Set((recentReminders ?? []).map(r => r.account_id as string));

  let sent = 0, skipped = 0, failed = 0;

  for (const row of eligible) {
    if (alreadyReminded.has(row.id)) { skipped++; continue; }

    const recipient = normaliseLkNumber(row.phone ?? "");
    if (!recipient) { skipped++; continue; }

    const account: CreditReminderAccount = {
      id: row.id,
      name: row.name,
      phone: row.phone,
      balance: Number(row.balance) || 0,
      firstChargeOn: row.first_charge_on,
      termsDays: Number(row.terms_days) || 0,
    };

    const message = renderCreditReminder(account, today);
    if (!message || !message.trim()) { skipped++; continue; }

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
      account_id: row.id,
      purpose: CREDIT_REMINDER_PURPOSE,
      sent_by: null,
      sent_by_name: "System (credit reminder)",
    });

    if (result.ok) sent++; else failed++;
  }

  return Response.json({ ok: true, checked: (rows ?? []).length, eligible: eligible.length, sent, skipped, failed });
}
