import { createClient } from "@supabase/supabase-js";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/**
 * POST /api/staff — create a staff login.
 *
 * Adding a staff member means creating an auth user, and only the service-role
 * key can do that. That key bypasses RLS entirely, so it lives here on the
 * server and never in a NEXT_PUBLIC_ variable.
 *
 * Two gates before it is used:
 *   1. the caller must be signed in;
 *   2. their profile role must be Admin.
 * Without both, this endpoint would let anyone mint themselves an account.
 */

interface Body {
  email?: string;
  password?: string;
  fullName?: string;
  role?: "Admin" | "Cashier" | "Technician" | "Accounts";
  phone?: string;
  speciality?: string;
  staffId?: string;
}

const VALID_ROLES = ["Admin", "Cashier", "Technician", "Accounts"];

export async function POST(request: Request) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!url || !serviceKey) {
    return Response.json(
      { ok: false, error: "Staff accounts need SUPABASE_SERVICE_ROLE_KEY in .env.local (server only). See docs/BACKEND-SETUP.md." },
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
    return Response.json({ ok: false, error: "Only an Admin can add staff." }, { status: 403 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json({ ok: false, error: "Malformed request." }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  const fullName = (body.fullName ?? "").trim();
  const role = body.role ?? "Cashier";

  if (!email || !email.includes("@")) return Response.json({ ok: false, error: "A valid email is required." }, { status: 400 });
  if (password.length < 8) return Response.json({ ok: false, error: "Password must be at least 8 characters." }, { status: 400 });
  if (!fullName) return Response.json({ ok: false, error: "Full name is required — jobs are matched to a technician by name." }, { status: 400 });
  if (!VALID_ROLES.includes(role)) return Response.json({ ok: false, error: `Unknown role "${role}".` }, { status: 400 });

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  // The handle_new_user trigger creates the profile row from this metadata.
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, role },
  });

  if (createError || !created?.user) {
    const msg = createError?.message ?? "Could not create the account.";
    return Response.json(
      { ok: false, error: /already/i.test(msg) ? `${email} already has an account.` : msg },
      { status: 400 },
    );
  }

  // Fill in the fields the trigger cannot know, and make sure the role stuck.
  const { error: profileError } = await admin
    .from("profiles")
    .update({
      full_name: fullName,
      email,
      role,
      phone: body.phone ?? null,
      speciality: body.speciality ?? null,
      staff_id: body.staffId ?? null,
      status: "Active",
    })
    .eq("id", created.user.id);

  if (profileError) {
    // The login exists but is not usable as staff — say so rather than
    // reporting success and leaving a half-made account behind.
    return Response.json(
      { ok: false, error: `Account created but the staff profile failed: ${profileError.message}` },
      { status: 500 },
    );
  }

  return Response.json({ ok: true, id: created.user.id });
}
