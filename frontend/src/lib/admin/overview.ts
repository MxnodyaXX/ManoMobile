"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

/**
 * Numbers for the admin dashboard, read from the database.
 *
 * Every figure here is counted from a real table. The dashboard previously read
 * an in-memory context that nothing ever wrote to, so it reported zeros for a
 * shop with staff and live jobs in it.
 *
 * Tables that do not exist yet (migrations not run) are tolerated one by one:
 * a missing sms_messages should cost you the SMS tile, not the whole page.
 */

export interface AdminOverview {
  staffTotal: number;
  staffActive: number;
  staffByRole: Record<string, number>;

  jobsTotal: number;
  jobsToday: number;
  jobsInProgress: number;
  jobsAwaitingCollection: number;
  jobsUnassigned: number;
  jobsByStatus: Record<string, number>;
  outstandingValue: number;

  smsToday: number;
  smsFailed: number;
  smsAvailable: boolean;

  dealers: number;
  agents: number;

  recentJobs: { id: string; customer: string; device: string; status: string; technician: string; createdAt: string }[];

  /** Tables the query could not read — surfaced as a setup hint, not an error. */
  missing: string[];
}

const EMPTY: AdminOverview = {
  staffTotal: 0, staffActive: 0, staffByRole: {},
  jobsTotal: 0, jobsToday: 0, jobsInProgress: 0, jobsAwaitingCollection: 0,
  jobsUnassigned: 0, jobsByStatus: {}, outstandingValue: 0,
  smsToday: 0, smsFailed: 0, smsAvailable: false,
  dealers: 0, agents: 0, recentJobs: [], missing: [],
};

const isToday = (iso: string) => (iso ?? "").slice(0, 10) === new Date().toISOString().slice(0, 10);

export async function fetchAdminOverview(): Promise<AdminOverview> {
  const supabase = getSupabaseBrowserClient();
  const missing: string[] = [];
  const out: AdminOverview = { ...EMPTY, staffByRole: {}, jobsByStatus: {}, recentJobs: [], missing };

  // ── Staff ──
  const staffRes = await supabase.from("profiles").select("id, role, status");
  if (staffRes.error) {
    missing.push("profiles");
  } else {
    const rows = (staffRes.data ?? []) as { role: string; status: string }[];
    out.staffTotal = rows.length;
    out.staffActive = rows.filter(r => r.status === "Active").length;
    for (const r of rows) out.staffByRole[r.role] = (out.staffByRole[r.role] ?? 0) + 1;
  }

  // ── Repair jobs ──
  const jobsRes = await supabase
    .from("repair_jobs")
    .select("id, customer_name, brand, model, status, technician, created_at, estimated_cost, advance_paid")
    .order("created_at", { ascending: false });

  if (jobsRes.error) {
    missing.push("repair_jobs");
  } else {
    const rows = (jobsRes.data ?? []) as {
      id: string; customer_name: string; brand: string; model: string; status: string;
      technician: string; created_at: string; estimated_cost: number | string; advance_paid: number | string;
    }[];

    out.jobsTotal = rows.length;
    out.jobsToday = rows.filter(r => isToday(r.created_at)).length;
    out.jobsInProgress = rows.filter(r => r.status === "Issued").length;
    out.jobsAwaitingCollection = rows.filter(r => r.status === "Completed").length;
    out.jobsUnassigned = rows.filter(r =>
      r.status === "Non-Issued" && (!r.technician || r.technician.toLowerCase() === "unassigned")).length;

    for (const r of rows) out.jobsByStatus[r.status] = (out.jobsByStatus[r.status] ?? 0) + 1;

    // Money still owed, full stop — including a job already handed to the
    // customer with a balance left on it. Delivery isn't the same event as
    // getting paid, so it can't be what drops a job out of this figure; only
    // Cancelled (no service rendered, nothing owed) does.
    out.outstandingValue = rows
      .filter(r => r.status !== "Cancelled")
      .reduce((sum, r) => sum + Math.max(0, Number(r.estimated_cost) - Number(r.advance_paid)), 0);

    out.recentJobs = rows.slice(0, 6).map(r => ({
      id: r.id,
      customer: r.customer_name,
      device: [r.brand, r.model].filter(Boolean).join(" "),
      status: r.status,
      technician: r.technician,
      createdAt: r.created_at,
    }));
  }

  // ── SMS log (optional table) ──
  const smsRes = await supabase.from("sms_messages").select("status, created_at");
  if (smsRes.error) {
    missing.push("sms_messages");
  } else {
    const rows = (smsRes.data ?? []) as { status: string; created_at: string }[];
    out.smsAvailable = true;
    out.smsToday = rows.filter(r => isToday(r.created_at)).length;
    out.smsFailed = rows.filter(r => r.status === "Failed").length;
  }

  // ── Reference counts (optional) ──
  const dealersRes = await supabase.from("repair_dealers").select("id");
  if (dealersRes.error) missing.push("repair_dealers");
  else out.dealers = (dealersRes.data ?? []).length;

  const agentsRes = await supabase.from("repair_agents").select("id");
  if (agentsRes.error) missing.push("repair_agents");
  else out.agents = (agentsRes.data ?? []).length;

  return out;
}

export function useAdminOverview() {
  const configured = isSupabaseConfigured();
  const [data, setData] = useState<AdminOverview>(EMPTY);
  const [loading, setLoading] = useState(configured);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!configured) return;
    try {
      setData(await fetchAdminOverview());
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

  return { data, loading, error, reload, configured };
}
