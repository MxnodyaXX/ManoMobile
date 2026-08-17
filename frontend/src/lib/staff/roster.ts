"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

/**
 * Staff of a given role, read from the `profiles` directory.
 *
 * The role-picker screens (technician / accounts / admin) used to hold their own
 * hard-coded name lists, which meant the app could offer a login for someone who
 * does not work here. Every roster now comes from the same table.
 */

export type StaffRoleName = "Admin" | "Cashier" | "Technician" | "Accounts";

export interface StaffMemberLite {
  id: string;
  name: string;
  speciality: string | null;
}

export function useStaffByRole(role: StaffRoleName) {
  const configured = isSupabaseConfigured();
  const [staff, setStaff] = useState<StaffMemberLite[]>([]);
  const [loading, setLoading] = useState(configured);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // `loading` already starts false when unconfigured — setting it here
    // would just cascade an extra render.
    if (!configured) return;
    let active = true;
    (async () => {
      const { data, error } = await getSupabaseBrowserClient()
        .from("profiles")
        .select("id, full_name, speciality, status")
        .eq("role", role)
        .eq("status", "Active")
        .order("full_name");

      if (!active) return;
      if (error) {
        setError(error.message);
      } else {
        setStaff(
          (data as { id: string; full_name: string | null; speciality: string | null }[])
            .filter(r => (r.full_name ?? "").trim() !== "")
            .map(r => ({ id: r.id, name: r.full_name!.trim(), speciality: r.speciality })),
        );
      }
      setLoading(false);
    })();
    return () => { active = false; };
  }, [configured, role]);

  return { staff, loading, error, configured };
}
