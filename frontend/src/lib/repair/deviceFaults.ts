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
    if (error.code === "42501") throw new Error(NOT_ALLOWED);
    throw new Error(error.message);
  }
  return toFault(data as FaultRow);
}

/**
 * Row-level security does not raise an error when it filters a write out — an
 * UPDATE or DELETE the caller may not make simply matches no rows. Without
 * checking for that, a refused delete looked like a delete that "didn't work"
 * and a refused edit surfaced as a cryptic "no rows returned". This names it.
 */
const NOT_ALLOWED =
  "You don't have permission to change the fault list. An Admin, or an Admin Cashier with catalogue rights on Repairs, can — "
  + "and if that is you, run migration 20260929000063_device_faults_admin_cashier.sql.";

export async function updateDeviceFault(id: string, label: string): Promise<DeviceFault> {
  const { data, error } = await getSupabaseBrowserClient()
    .from("device_faults")
    .update({ label: label.trim() })
    .eq("id", Number(id))
    .select(COLUMNS);

  if (error) {
    if (error.code === "23505") throw new Error(`"${label.trim()}" is already in the list.`);
    throw new Error(error.message);
  }
  const rows = (data ?? []) as FaultRow[];
  if (rows.length === 0) throw new Error(NOT_ALLOWED);
  return toFault(rows[0]);
}

export async function deleteDeviceFault(id: string): Promise<void> {
  const { data, error } = await getSupabaseBrowserClient()
    .from("device_faults")
    .delete()
    .eq("id", Number(id))
    .select("id");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error(NOT_ALLOWED);
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
