import { getSupabaseServerClient } from "@/lib/supabase/server";
import { sendMail, getSmtpConfig, looksLikeEmail } from "@/lib/email/smtp";

/**
 * POST /api/email/send — send one customer email and log it.
 *
 * Same shape as /api/sms/send, and for the same reason: the SMTP password is a
 * credential. Anything in the client bundle is public, so the browser asks this
 * route to send rather than sending itself.
 *
 * Every request must carry a signed-in staff session. The insert into
 * email_messages runs as that user, so RLS decides whether their role may send.
 */

interface SendBody {
  to?: string;
  subject?: string;
  html?: string;
  jobId?: string;
  purpose?: string;
}

export async function POST(request: Request) {
  const smtp = getSmtpConfig();
  if (!smtp.configured) {
    return Response.json(
      { ok: false, error: "Email is not set up. Add SMTP_HOST, SMTP_USER and SMTP_PASSWORD to .env.local and restart the server." },
      { status: 503 },
    );
  }

  // ── Who is asking ──
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ ok: false, error: "Sign in before sending email." }, { status: 401 });
  }

  // ── What they are asking for ──
  let body: SendBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Malformed request." }, { status: 400 });
  }

  const to = (body.to ?? "").trim();
  const subject = (body.subject ?? "").trim();
  const html = body.html ?? "";

  if (!looksLikeEmail(to)) {
    return Response.json({ ok: false, error: `"${to}" is not a valid email address.` }, { status: 400 });
  }
  if (!subject || !html.trim()) {
    return Response.json({ ok: false, error: "Subject and body are both required." }, { status: 400 });
  }

  // ── Who it comes from ──
  // Read server-side rather than trusted from the request: the sending identity
  // is an Admin setting, and a client must not be able to spoof it per send.
  const { data: settings } = await supabase
    .from("email_settings")
    .select("from_name, from_email, reply_to, enabled")
    .eq("id", true)
    .maybeSingle();

  if (!settings?.enabled) {
    return Response.json(
      { ok: false, error: "Customer email is switched off in Admin -> Notifications." },
      { status: 503 },
    );
  }

  const fromEmail = (settings.from_email ?? "").trim();
  if (!looksLikeEmail(fromEmail)) {
    return Response.json(
      { ok: false, error: "No valid sending address is set in Admin -> Notifications." },
      { status: 503 },
    );
  }

  const fromName = (settings.from_name ?? "").trim();
  const from = fromName ? `"${fromName.replace(/"/g, "")}" <${fromEmail}>` : fromEmail;

  const result = await sendMail({
    from,
    replyTo: (settings.reply_to ?? "").trim() || undefined,
    to,
    subject,
    html,
  });

  // Logged either way. An email nobody received is exactly the thing you need
  // a record of, so a failure is a row with status 'failed', not a silence.
  await supabase.from("email_messages").insert({
    to_address: to,
    subject,
    job_id: body.jobId ?? null,
    purpose: body.purpose ?? null,
    status: result.ok ? "sent" : "failed",
    error: result.ok ? null : (result.error ?? "Unknown error"),
    sent_by: user.id,
  });

  return result.ok
    ? Response.json({ ok: true })
    : Response.json({ ok: false, error: result.error }, { status: 502 });
}
