"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

/**
 * The staff directory — the `profiles` table.
 *
 * This is the same table the login pickers read, so a technician added here can
 * sign in, and a job assigned to them lands in their queue. The Admin screen
 * previously kept its own in-memory list, which is why staff added there
 * vanished on reload and never appeared anywhere else.
 *
 * Reads and edits go straight to Postgres under RLS (Admin may write any row).
 * Creating a login is different: that needs an auth user, which only the
 * service-role key can mint, so it goes through /api/staff.
 */

export type StaffRoleName = "Admin" | "Cashier" | "Technician" | "Accounts";
export type StaffStatusName = "Active" | "Inactive" | "Suspended";

export interface StaffProfile {
  id: string;
  staffId: string | null;
  fullName: string;
  email: string | null;
  phone: string | null;
  role: StaffRoleName;
  status: StaffStatusName;
  speciality: string | null;
  joinDate: string | null;
  lastLogin: string | null;
}

interface ProfileRow {
  id: string;
  staff_id: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  role: StaffRoleName;
  status: StaffStatusName;
  speciality: string | null;
  join_date: string | null;
  last_login: string | null;
}

const SELECT = "id, staff_id, full_name, email, phone, role, status, speciality, join_date, last_login";

const rowToStaff = (r: ProfileRow): StaffProfile => ({
  id: r.id,
  staffId: r.staff_id,
  fullName: (r.full_name ?? "").trim(),
  email: r.email,
  phone: r.phone,
  role: r.role,
  status: r.status,
  speciality: r.speciality,
  joinDate: r.join_date,
  lastLogin: r.last_login,
});

export async function fetchStaff(): Promise<StaffProfile[]> {
  const { data, error } = await getSupabaseBrowserClient()
    .from("profiles")
    .select(SELECT)
    .order("role")
    .order("full_name");

  if (error) throw new Error(`Could not load staff: ${error.message}`);
  return (data as ProfileRow[]).map(rowToStaff);
}

/** Edit an existing profile. RLS lets Admin write any row. */
export async function updateStaff(id: string, patch: Partial<StaffProfile>): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.fullName !== undefined) row.full_name = patch.fullName;
  if (patch.phone !== undefined) row.phone = patch.phone;
  if (patch.role !== undefined) row.role = patch.role;
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.speciality !== undefined) row.speciality = patch.speciality;
  if (patch.staffId !== undefined) row.staff_id = patch.staffId;

  const { error } = await getSupabaseBrowserClient().from("profiles").update(row).eq("id", id);
  if (error) {
    throw new Error(
      error.code === "42501"
        ? "Only an Admin can change staff records."
        : `Could not save the staff member: ${error.message}`,
    );
  }
}

export interface NewStaffInput {
  email: string;
  password: string;
  fullName: string;
  role: StaffRoleName;
  phone?: string;
  speciality?: string;
  staffId?: string;
}

/**
 * Create a staff login. Goes through the server because minting an auth user
 * requires the service-role key, which must never reach the browser.
 */
export async function createStaff(input: NewStaffInput): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("/api/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const json = (await res.json()) as { ok?: boolean; error?: string };
    return res.ok && json.ok ? { ok: true } : { ok: false, error: json.error ?? `Failed (HTTP ${res.status}).` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Set a staff member's password.
 *
 * Passwords are not in `profiles` and must never be — Supabase Auth holds them
 * as bcrypt hashes in auth.users, and only the service-role key can change
 * another user's, so this goes through the server like createStaff does.
 */
export async function setStaffPassword(profileId: string, password: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("/api/staff/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileId, password }),
    });
    const json = (await res.json()) as { ok?: boolean; error?: string };
    return res.ok && json.ok ? { ok: true } : { ok: false, error: json.error ?? `Failed (HTTP ${res.status}).` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export function useStaff() {
  const configured = isSupabaseConfigured();
  const [staff, setStaff] = useState<StaffProfile[]>([]);
  const [loading, setLoading] = useState(configured);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!configured) return;
    try {
      setStaff(await fetchStaff());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [configured]);

  useEffect(() => {
    if (!configured) return;
    let active = true;
    (async () => {
      await reload();
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, [configured, reload]);

  return { staff, loading, error, reload, configured };
}
