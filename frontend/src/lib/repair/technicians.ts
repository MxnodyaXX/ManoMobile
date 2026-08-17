"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

/**
 * The technician roster, read from the staff directory (`profiles` where
 * role = 'Technician').
 *
 * One source for both sides of the app. A job records its technician as a plain
 * name string and each technician's queue is `jobs.filter(j => j.technician ===
 * me)`, so intake and the technician screens must offer identical names — when
 * they were two separate hard-coded lists, assigned jobs matched nobody and
 * disappeared from every queue.
 *
 * Name-matching is still the weak link: renaming a technician orphans their
 * jobs. Storing profile ids on jobs is the durable fix.
 */

export interface Technician {
  /** profiles.id (uuid) — or the fallback's synthetic id when offline. */
  id: string;
  name: string;
  speciality: string;
  available: boolean;
}

interface ProfileRow {
  id: string;
  full_name: string | null;
  speciality: string | null;
  status: "Active" | "Inactive" | "Suspended";
}

export async function fetchTechnicians(): Promise<Technician[]> {
  const { data, error } = await getSupabaseBrowserClient()
    .from("profiles")
    .select("id, full_name, speciality, status")
    .eq("role", "Technician")
    .order("full_name");

  if (error) throw new Error(`Could not load technicians: ${error.message}`);

  return (data as ProfileRow[])
    // A profile with no name cannot be matched against a job's technician
    // field, so it would be a dead entry in the picker.
    .filter((r) => (r.full_name ?? "").trim() !== "")
    .map((r) => ({
      id: r.id,
      name: r.full_name!.trim(),
      speciality: (r.speciality ?? "").trim() || "Repair Technician",
      // Suspended/inactive staff stay visible but cannot be assigned work.
      available: r.status === "Active",
    }));
}

export interface TechniciansState {
  technicians: Technician[];
  loading: boolean;
  error: string | null;
  /** "database" once profiles are being read; "fallback" in demo mode. */
  source: "database" | "fallback";
}

/** Loads the roster once per mount. Safe to call outside RepairProvider. */
export function useTechnicians(): TechniciansState {
  const configured = isSupabaseConfigured();
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [loading, setLoading] = useState(configured);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!configured) return;
    let active = true;
    (async () => {
      try {
        const rows = await fetchTechnicians();
        if (active) setTechnicians(rows);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [configured]);

  return { technicians, loading, error, source: configured ? "database" : "fallback" };
}
