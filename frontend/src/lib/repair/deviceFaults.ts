"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

/**
 * The admin-managed Device Faults checklist (Admin Control -> Device Faults),
 * shown on New Repair -> Step 2. Was a hardcoded array in NewRepairForm.tsx;
 * now a real table so an admin can add/rename/remove faults without a code
 * change — see migration 20260821000002_device_faults.sql.
 */

export interface DeviceFault {
  id: string;
  label: string;
  sortOrder: number;
}

interface FaultRow {
  id: number;
  label: string;
  sort_order: number | string;
}

const num = (v: number | string | null | undefined) => (v == null ? 0 : Number(v));

function toFault(row: FaultRow): DeviceFault {
  return { id: String(row.id), label: row.label, sortOrder: num(row.sort_order) };
}

const COLUMNS = "id, label, sort_order";

/** Used only when Supabase isn't configured, or the table hasn't been
 *  migrated/seeded yet — so intake never shows a blank checklist. Matches
 *  what was hardcoded before this table existed. */
export const FALLBACK_FAULTS: readonly string[] = [
  "Screen Cracked / Broken", "Screen Not Displaying", "Touch Not Working",
  "Battery Draining Fast", "Won't Turn On / Dead", "Charging Port Faulty",
  "Speaker / Mic Issue", "Camera Not Working", "Software / Bootloop",
  "Water Damage", "Overheating", "Signal / Network Issue",
];

export async function fetchDeviceFaults(): Promise<DeviceFault[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await getSupabaseBrowserClient()
    .from("device_faults")
    .select(COLUMNS)
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });

  if (error) throw new Error(error.message);
  return (data as FaultRow[] | null)?.map(toFault) ?? [];
}

/** New faults land at the end of the list — sort_order one past the current
 *  highest, so they don't need a value from the caller. */
export async function createDeviceFault(label: string, afterSortOrder: number): Promise<DeviceFault> {
  const { data, error } = await getSupabaseBrowserClient()
    .from("device_faults")
    .insert({ label: label.trim(), sort_order: afterSortOrder + 10 })
    .select(COLUMNS)
    .single();

  if (error) {
    if (error.code === "23505") throw new Error(`"${label.trim()}" is already in the list.`);
    throw new Error(error.message);
  }
  return toFault(data as FaultRow);
}

export async function updateDeviceFault(id: string, label: string): Promise<DeviceFault> {
  const { data, error } = await getSupabaseBrowserClient()
    .from("device_faults")
    .update({ label: label.trim() })
    .eq("id", Number(id))
    .select(COLUMNS)
    .single();

  if (error) {
    if (error.code === "23505") throw new Error(`"${label.trim()}" is already in the list.`);
    throw new Error(error.message);
  }
  return toFault(data as FaultRow);
}

export async function deleteDeviceFault(id: string): Promise<void> {
  const { error } = await getSupabaseBrowserClient()
    .from("device_faults")
    .delete()
    .eq("id", Number(id));
  if (error) throw new Error(error.message);
}

export function useDeviceFaults() {
  const configured = isSupabaseConfigured();
  const [faults, setFaults] = useState<DeviceFault[]>([]);
  const [loading, setLoading] = useState(configured);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!configured) { setLoading(false); return; }
    try {
      setFaults(await fetchDeviceFaults());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [configured]);

  useEffect(() => { void reload(); }, [reload]);

  return { faults, loading, error, configured, reload };
}
