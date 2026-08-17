"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

/**
 * Shop-wide work rules (the single row in `app_settings`).
 *
 * How a shop runs varies: a bench handling 100 devices a day works several at
 * once and does not stop to press Start on each; a smaller shop may want one
 * job at a time and every start recorded. Admin decides; everyone else reads.
 */

export interface WorkRules {
  /** May a technician have more than one job in progress at once? */
  allowMultipleActiveJobs: boolean;
  /** Optional cap when multiple are allowed. Null = no limit. */
  maxActiveJobs: number | null;
  /** Must a job be started in the system before it can be marked finished? */
  requireStartBeforeFinish: boolean;
}

/** Permissive by default — matches a busy bench, and never blocks work that a
 *  missing settings row should not be blocking. */
export const DEFAULT_WORK_RULES: WorkRules = {
  allowMultipleActiveJobs: true,
  maxActiveJobs: null,
  requireStartBeforeFinish: true,
};

interface SettingsRow {
  allow_multiple_active_jobs: boolean;
  max_active_jobs: number | null;
  require_start_before_finish: boolean;
}

export async function fetchWorkRules(): Promise<WorkRules> {
  const { data, error } = await getSupabaseBrowserClient()
    .from("app_settings")
    .select("allow_multiple_active_jobs, max_active_jobs, require_start_before_finish")
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Could not load work rules: ${error.message}`);
  if (!data) return DEFAULT_WORK_RULES;

  const row = data as SettingsRow;
  return {
    allowMultipleActiveJobs: row.allow_multiple_active_jobs,
    maxActiveJobs: row.max_active_jobs,
    requireStartBeforeFinish: row.require_start_before_finish,
  };
}

export async function saveWorkRules(rules: WorkRules): Promise<void> {
  const { data: { user } } = await getSupabaseBrowserClient().auth.getUser();
  const { error } = await getSupabaseBrowserClient()
    .from("app_settings")
    .upsert({
      id: true,
      allow_multiple_active_jobs: rules.allowMultipleActiveJobs,
      max_active_jobs: rules.allowMultipleActiveJobs ? rules.maxActiveJobs : null,
      require_start_before_finish: rules.requireStartBeforeFinish,
      updated_by: user?.id ?? null,
    });

  if (error) {
    throw new Error(
      error.code === "42501"
        ? "Only an Admin can change the work rules."
        : `Could not save the work rules: ${error.message}`,
    );
  }
  cached = null;
}

// ─── Read path for enforcement ───────────────────────────────────────────────

let cached: { at: number; rules: WorkRules } | null = null;
const CACHE_MS = 60_000;

/**
 * The rules, for code that needs to decide whether an action is allowed.
 * Never throws: an unreachable settings row falls back to the permissive
 * defaults rather than stopping a technician from working.
 */
export async function currentWorkRules(): Promise<WorkRules> {
  if (!isSupabaseConfigured()) return DEFAULT_WORK_RULES;
  if (!cached || Date.now() - cached.at > CACHE_MS) {
    try {
      cached = { at: Date.now(), rules: await fetchWorkRules() };
    } catch {
      return DEFAULT_WORK_RULES;
    }
  }
  return cached.rules;
}

export function useWorkRules() {
  const configured = isSupabaseConfigured();
  const [rules, setRules] = useState<WorkRules>(DEFAULT_WORK_RULES);
  const [loading, setLoading] = useState(configured);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!configured) return;
    try {
      setRules(await fetchWorkRules());
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

  const save = useCallback(async (next: WorkRules) => {
    await saveWorkRules(next);
    setRules(next);
  }, []);

  return { rules, loading, error, reload, save, configured };
}
