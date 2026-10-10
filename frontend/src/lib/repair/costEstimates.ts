"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Estimated costs for repairs finished before costs were recorded.
 * See migration 20261009000073 — Admin only, enforced in the database.
 */

export interface CostEstimate {
  jobId: string;
  /** Parts + technician together. Null clears the estimate. */
  cost: number | null;
}

/** Saves estimates for one or many jobs in one call. Returns how many changed. */
export async function saveCostEstimates(rows: CostEstimate[]): Promise<number> {
  if (rows.length === 0) return 0;
  const { data, error } = await getSupabaseBrowserClient().rpc("set_repair_cost_estimates", {
    p_rows: rows.map(r => ({ job_id: r.jobId, cost: r.cost })),
  });
  if (error) {
    if (/set_repair_cost_estimates/.test(error.message) && /not find|does not exist/i.test(error.message)) {
      throw new Error("Estimated costs need migration 20261009000073_repair_cost_estimates.sql applied first.");
    }
    throw new Error(error.message);
  }
  return Number(data ?? 0);
}
