"use client";

import { useEffect, useState } from "react";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { fetchJobs } from "@/lib/repair/api";
import type { RepairJob } from "@/cashier/contexts/RepairContext";

export type FigurePeriod = "Daily" | "Weekly" | "Monthly" | "Yearly" | "All";

export interface IssuedFigures {
  /** Value of jobs issued to customers in the period — repair income. */
  repairIncome: number;
  /** Money actually taken against those jobs. */
  collected: number;
  totalJobs: number;
  /** No sales backend yet, so this is honestly zero rather than invented. */
  salesRevenue: number;
  /**
   * IDs of the jobs counted above. This hook is deliberately independent of
   * RepairProvider/PartsContext (see below), so it can't compute a real
   * parts-cost figure itself — callers that ARE inside <PartsProvider> use
   * these ids to look up each job's actual approved part requests instead
   * of inventing a number.
   */
  issuedJobIds: string[];
}

const EMPTY: IssuedFigures = { repairIncome: 0, collected: 0, totalJobs: 0, salesRevenue: 0, issuedJobIds: [] };

/** Exported so any other period-filtered view buckets dates the same way. */
export function periodStart(period: FigurePeriod): Date {
  const d = new Date();
  if (period === "Daily")   return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (period === "Weekly")  { const w = new Date(d); w.setDate(d.getDate() - 6); w.setHours(0, 0, 0, 0); return w; }
  if (period === "Monthly") return new Date(d.getFullYear(), d.getMonth(), 1);
  if (period === "Yearly")  return new Date(d.getFullYear(), 0, 1);
  return new Date(0);
}

/** When the customer took the device away — the moment the money is earned. */
export const issuedOn = (j: RepairJob) => j.handover?.handedOverAt ?? j.completedAt ?? j.createdAt;

export function computeIssuedFigures(jobs: RepairJob[], period: FigurePeriod): IssuedFigures {
  const from = periodStart(period);
  const issued = jobs.filter(j => j.status === "Delivered" && new Date(issuedOn(j)) >= from);
  return {
    repairIncome: issued.reduce((sum, j) => sum + j.estimatedCost, 0),
    collected:    issued.reduce((sum, j) => sum + j.advancePaid, 0),
    totalJobs:    issued.length,
    salesRevenue: 0,
    issuedJobIds: issued.map(j => j.id),
  };
}

/**
 * Dashboard figures read straight from the database.
 *
 * Deliberately independent of RepairProvider: the page shell that owns the
 * period filter renders above the providers, so a context-based hook there
 * would silently read an empty job list and report zero revenue.
 */
export function useIssuedFigures(period: FigurePeriod): IssuedFigures {
  const [jobs, setJobs] = useState<RepairJob[]>([]);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let active = true;
    fetchJobs()
      .then(rows => { if (active) setJobs(rows); })
      .catch(() => { /* the dashboard degrades to zeros rather than breaking */ });
    return () => { active = false; };
  }, []);

  return jobs.length ? computeIssuedFigures(jobs, period) : EMPTY;
}
