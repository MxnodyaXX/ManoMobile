"use client";

import type { RepairJob } from "@/cashier/contexts/RepairContext";
import type { LabourCostMode, EffectiveRules } from "@/lib/settings/staffRules";

/**
 * What a job cost the shop in labour.
 *
 * Two sources, in this order:
 *
 *  1. `job.labourCost` — what the technician entered when they completed the
 *     job. This is the real figure and never changes.
 *  2. Their current default rate, as an estimate, for jobs completed before
 *     labour costing existed. Flagged as estimated wherever it is shown, since
 *     a default says nothing about what was actually charged for that job.
 *
 * Recomputing (1) from the current rate would rewrite history every time a
 * rate is renegotiated, which is the one thing a cost figure must not do.
 */

export interface LabourCost {
  amount: number;
  /** False when this came off the job; true when derived from today's rate. */
  estimated: boolean;
  mode: LabourCostMode;
}

/** The amount a given rate produces for a job. Percentage is of the charge. */
export function labourFromRate(
  mode: LabourCostMode,
  value: number,
  charge: number,
): number {
  switch (mode) {
    case "fixed":      return Math.max(0, value);
    case "percentage": return Math.max(0, (charge * value) / 100);
    // "custom" has no formula — it is typed in per job — and "none" is zero.
    case "custom":
    case "none":
      return 0;
  }
}

export function labourForJob(job: RepairJob, rules?: EffectiveRules | null): LabourCost {
  if (typeof job.labourCost === "number") {
    return { amount: job.labourCost, estimated: false, mode: rules?.labourCostMode ?? "none" };
  }
  const mode = rules?.labourCostMode ?? "none";
  return {
    amount: labourFromRate(mode, rules?.labourCostValue ?? 0, job.estimatedCost),
    // A custom-rate job with nothing recorded has no knowable cost, so it is
    // zero — but still marked estimated so it is not mistaken for "free".
    estimated: true,
    mode,
  };
}

/** How the rate reads in one line, for a summary row. */
export function describeRate(mode: LabourCostMode, value: number): string {
  switch (mode) {
    case "fixed":      return `Rs. ${value.toLocaleString()} per job`;
    case "percentage": return `${value}% of the charge`;
    case "custom":     return "Always asked";
    case "none":       return "No default";
  }
}
