import { createClient } from "@supabase/supabase-js";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/**
 * POST /api/staff/password — set a staff member's password.
 *
 * ── Where passwords actually live ───────────────────────────────────────────
 * Nowhere in `public`. Supabase Auth keeps them in auth.users.encrypted_password
 * as bcrypt hashes, which is why `profiles` has no password column and must
 * never grow one: a password column in a table the app can read would mean an
 * RLS mistake, a leaked anon key, or a stray SELECT * hands somebody every
 * login in the shop. The Table Editor only shows the public schema, so they
 * look absent — they are under Authentication → Users in the dashboard.
 *
 * What was genuinely missing is this route. A password could only ever be set
 * at account creation ("Editing never touches the password"), so an account
 * whose password nobody remembered — or one created straight in Supabase — was
 * permanently unreachable. There was no way back in.
 *
 * Only the service-role key can change another user's password, so this runs on
 * the server behind the same two gates as staff creation.
 */

interface Body {
  profileId?: string;
  password?: string;
}

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    return Response.json(
      { ok: false, error: "Setting a password needs SUPABASE_SERVICE_ROLE_KEY on the server. Add it to .env.local locally, and to the project's environment variables when deployed." },
      { status: 503 },
    );
  }

  // ── Gate 1: signed in ──
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ ok: false, error: "Sign in first." }, { status: 401 });

  // ── Gate 2: an Admin ──
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if ((me as { role?: string } | null)?.role !== "Admin") {
    return Response.json({ ok: false, error: "Only an Admin can change a password." }, { status: 403 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json({ ok: false, error: "Malformed request." }, { status: 400 });
  }

  const profileId = (body.profileId ?? "").trim();
  const password = body.password ?? "";

  if (!profileId) return Response.json({ ok: false, error: "Which staff member?" }, { status: 400 });
  if (password.length < 8) {
    return Response.json({ ok: false, error: "Password must be at least 8 characters." }, { status: 400 });
  }

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  // profiles.id is the auth user's id — the handle_new_user trigger sets it
  // that way — so no lookup is needed to get from one to the other.
  const { error } = await admin.auth.admin.updateUserById(profileId, { password });

  if (error) {
    return Response.json(
      { ok: false, error: /user not found/i.test(error.message)
        ? "That staff member has no login account. Their profile exists but there is nothing to sign in with."
        : error.message },
      { status: 400 },
    );
  }

  return Response.json({ ok: true });
}
