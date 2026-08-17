import { getSupabaseServerClient } from "@/lib/supabase/server";
import { sendSms, normaliseLkNumber, getSmsConfig } from "@/lib/sms/textlk";

/**
 * POST /api/sms/send — send one SMS through Text.lk and log it.
 *
 * Why a route handler rather than calling the gateway from the browser: the API
 * token is a spending credential. Anything reaching the client bundle is public,
 * so the token lives only here, and the browser gets to ask for a send — not to
 * perform one.
 *
 * Every request must carry a signed-in staff session. The insert into
 * sms_messages runs as that user, so RLS decides whether their role may send.
 */

interface SendBody {
  to?: string;
  message?: string;
  jobId?: string;
  purpose?: string;
}

export async function POST(request: Request) {
  const { senderId, configured } = getSmsConfig();
  if (!configured) {
    return Response.json(
      { ok: false, error: "SMS is not set up. Add TEXTLK_API_TOKEN and TEXTLK_SENDER_ID to .env.local and restart the server." },
      { status: 503 },
    );
  }

  // ── Who is asking ──
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ ok: false, error: "Sign in before sending messages." }, { status: 401 });
  }

  // ── What they are asking for ──
  let body: SendBody;
  try {
    body = (await request.json()) as SendBody;
  } catch {
    return Response.json({ ok: false, error: "Malformed request body." }, { status: 400 });
  }

  const message = (body.message ?? "").trim();
  if (!message) {
    return Response.json({ ok: false, error: "The message is empty." }, { status: 400 });
  }
  // Text.lk bills per 160-character part; a runaway string is a runaway bill.
  if (message.length > 1000) {
    return Response.json({ ok: false, error: "Message is too long (max 1000 characters)." }, { status: 400 });
  }

  const rawTo = (body.to ?? "").trim();
  const recipient = normaliseLkNumber(rawTo);
  if (!recipient) {
    return Response.json(
      { ok: false, error: `"${rawTo}" is not a recognisable Sri Lankan mobile number. Expected 07XXXXXXXX or 94XXXXXXXXX.` },
      { status: 400 },
    );
  }

  // ── Send, then record the outcome either way ──
  const result = await sendSms(recipient, message);

  const { data: profile } = await supabase
    .from("profiles").select("full_name").eq("id", user.id).maybeSingle();

  const { error: logError } = await supabase.from("sms_messages").insert({
    recipient,
    recipient_raw: rawTo,
    sender_id: senderId,
    body: message,
    status: result.ok ? "Sent" : "Failed",
    provider_uid: result.uid ?? null,
    provider_status: result.providerStatus ?? null,
    cost: result.cost ?? null,
    sms_count: result.smsCount ?? null,
    error: result.error ?? null,
    job_id: body.jobId ?? null,
    purpose: body.purpose ?? null,
    sent_by: user.id,
    sent_by_name: (profile as { full_name?: string } | null)?.full_name ?? user.email ?? null,
  });

  // A failed log must not be reported as a failed send — the customer did get
  // the message, and saying otherwise invites a duplicate.
  if (logError) console.error("SMS sent but could not be logged:", logError.message);

  if (!result.ok) {
    return Response.json({ ok: false, error: result.error }, { status: 502 });
  }

  return Response.json({
    ok: true,
    uid: result.uid,
    cost: result.cost,
    smsCount: result.smsCount,
    recipient,
    logged: !logError,
  });
}
