import { createClient } from "@supabase/supabase-js";

/**
 * GET /api/auth/roster — who can sign in, grouped by role.
 *
 * The login screen at / asks you to pick a role, then a person, then type their
 * password. Picking a person means listing them, and at that moment there is no
 * session — `profiles` is behind RLS, so the browser cannot read it. This route
 * uses the service key to answer that one question.
 *
 * What it deliberately does NOT return is the email address. Names on a staff
 * login screen are the same disclosure a Windows lock screen makes and the app
 * has always shown them in its pickers; a list of live mailboxes is a different
 * thing entirely. /api/auth/login takes the profile id instead, and resolves
 * the address server-side.
 *
 * Inactive and suspended staff are left out: an account somebody has been
 * removed from should not still be offered a password box.
 */

export interface RosterEntry {
  id: string;
  fullName: string;
  role: "Admin" | "Cashier" | "Technician" | "Accounts";
  speciality: string | null;
  staffId: string | null;
}

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    // Not an error: with Supabase unconfigured the app runs on local data and
    // the login screen falls back to letting people straight through.
    return Response.json({ ok: true, configured: false, staff: [] });
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await admin
    .from("profiles")
    .select("id, full_name, role, speciality, staff_id, status")
    .eq("status", "Active")
    .order("full_name");

  if (error) {
    return Response.json({ ok: false, error: `Could not load staff: ${error.message}` }, { status: 500 });
  }

  const staff: RosterEntry[] = (data ?? [])
    // A profile with no name has nothing to show on a card, and jobs are
    // matched to a technician by name — an unnamed one could never own any.
    .filter((r) => ((r.full_name as string | null) ?? "").trim() !== "")
    .map((r) => ({
      id: r.id as string,
      fullName: (r.full_name as string).trim(),
      role: r.role as RosterEntry["role"],
      speciality: ((r.speciality as string | null) ?? "").trim() || null,
      staffId: (r.staff_id as string | null) ?? null,
    }));

  return Response.json({ ok: true, configured: true, staff });
}
