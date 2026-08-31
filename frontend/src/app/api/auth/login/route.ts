import { createClient } from "@supabase/supabase-js";

/**
 * POST /api/auth/login — sign in as a chosen profile.
 *
 * The login screen knows a profile id and a password, never an email; see
 * /api/auth/roster for why. This resolves the address with the service key and
 * then verifies the password through the ordinary anon-key sign-in, so a wrong
 * password fails exactly as it would anywhere else — the service key is used to
 * look somebody up, never to let them in.
 *
 * The session comes back in the body rather than as a Set-Cookie header. The
 * browser client then calls setSession() with it, which writes the cookies
 * through the same code path the rest of the app reads them from — one place
 * that owns the session instead of two that must agree. These cookies are not
 * httpOnly in this stack anyway (the browser client has to read them), so the
 * body carries nothing the page could not already see.
 */

interface Body {
  profileId?: string;
  password?: string;
}

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anonKey || !serviceKey) {
    return Response.json(
      { ok: false, error: "Sign-in needs NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY in .env.local. See docs/BACKEND-SETUP.md." },
      { status: 503 },
    );
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json({ ok: false, error: "Malformed request." }, { status: 400 });
  }

  const profileId = (body.profileId ?? "").trim();
  const password = body.password ?? "";
  if (!profileId) return Response.json({ ok: false, error: "Choose who you are first." }, { status: 400 });
  if (!password)  return Response.json({ ok: false, error: "Enter your password." }, { status: 400 });

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: profile, error: lookupError } = await admin
    .from("profiles")
    .select("id, full_name, email, role, status")
    .eq("id", profileId)
    .maybeSingle();

  if (lookupError) {
    return Response.json({ ok: false, error: `Could not look up that account: ${lookupError.message}` }, { status: 500 });
  }
  if (!profile || profile.status !== "Active") {
    // Same wording as a wrong password on purpose: whether an account exists is
    // not something an unauthenticated caller should be able to probe for.
    return Response.json({ ok: false, error: "Wrong password." }, { status: 401 });
  }

  // profiles.email can be blank on rows created before the trigger filled it in,
  // so fall back to the auth record, which always has one.
  let email = ((profile.email as string | null) ?? "").trim();
  if (!email) {
    const { data: authUser } = await admin.auth.admin.getUserById(profileId);
    email = authUser?.user?.email ?? "";
  }
  if (!email) {
    return Response.json(
      { ok: false, error: `${profile.full_name ?? "That account"} has no email address on file, so there is nothing to sign in with. An Admin can set one under Staff.` },
      { status: 409 },
    );
  }

  const anon = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: signIn, error: signInError } = await anon.auth.signInWithPassword({ email, password });

  if (signInError || !signIn.session) {
    const raw = signInError?.message ?? "Wrong password.";
    return Response.json(
      { ok: false, error: /invalid login credentials/i.test(raw) ? "Wrong password." : raw },
      { status: 401 },
    );
  }

  await admin.from("profiles").update({ last_login: new Date().toISOString() }).eq("id", profileId);

  return Response.json({
    ok: true,
    role: profile.role,
    fullName: profile.full_name,
    session: {
      access_token: signIn.session.access_token,
      refresh_token: signIn.session.refresh_token,
    },
  });
}
