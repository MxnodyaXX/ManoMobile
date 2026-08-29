"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { currentWorkRules, useWorkRules, DEFAULT_WORK_RULES, type WorkRules } from "@/lib/settings/workRules";

/**
 * Per-technician repair permissions.
 *
 * Three of these mirror a shop-wide rule and are tri-state: null means "follow
 * the shop", which is not the same as false. Two are person-only permissions
 * about what an individual is trusted to do.
 *
 * Jobs record their technician by *name*, so the resolver below keys on name.
 * That is the same weakness noted in lib/repair/technicians.ts; when jobs carry
 * a profile id this should key on that instead.
 */

export interface StaffRuleOverride {
  profileId: string;
  allowMultipleActiveJobs: boolean | null;
  maxActiveJobs: number | null;
  requireStartBeforeFinish: boolean | null;
  canClaimUnassigned: boolean;
  canTransferToAgent: boolean;
  /** True: this person's part requests skip Admin approval and deduct stock
   *  immediately. False (default): every request needs Admin sign-off. */
  canUsePartsWithoutApproval: boolean;
  /** How this person's labour is costed against a job. See LABOUR_MODES. */
  labourCostMode: LabourCostMode;
  /** Rupees when the mode is "fixed", percent when "percentage". */
  labourCostValue: number;
  /** True for the one technician new repairs are pre-assigned to. Set through
   *  setDefaultTechnician(), never by writing this field directly — only the
   *  database can swap it without briefly having two. */
  isDefaultTechnician: boolean;
}

/**
 * The technician enters their charge when they complete a job — only they know
 * what the work was worth. This rate pre-fills that box, so somebody on a flat
 * rate is not retyping the same figure a hundred times a day. It is a default,
 * never a substitute: the entered amount is what gets recorded.
 */
export type LabourCostMode = "none" | "fixed" | "percentage" | "custom";

export const LABOUR_MODES: { id: LabourCostMode; label: string; blurb: string }[] = [
  { id: "none",       label: "No default",    blurb: "The box starts at zero; they type what they are charging." },
  { id: "fixed",      label: "Fixed per job",  blurb: "Pre-filled with the same amount on every job." },
  { id: "percentage", label: "Percentage",     blurb: "Pre-filled with a share of what the job was charged." },
  { id: "custom",     label: "Always ask",     blurb: "The box starts empty — nothing is suggested." },
];

/** What actually applies to one technician, after merging with the shop rule. */
export interface EffectiveRules extends WorkRules {
  canClaimUnassigned: boolean;
  canTransferToAgent: boolean;
  canUsePartsWithoutApproval: boolean;
  labourCostMode: LabourCostMode;
  labourCostValue: number;
  isDefaultTechnician: boolean;
  /** True when this person has at least one explicit override. */
  hasOverrides: boolean;
}

export const blankOverride = (profileId: string): StaffRuleOverride => ({
  profileId,
  allowMultipleActiveJobs: null,
  maxActiveJobs: null,
  requireStartBeforeFinish: null,
  canClaimUnassigned: true,
  canTransferToAgent: true,
  canUsePartsWithoutApproval: false,
  labourCostMode: "none",
  labourCostValue: 0,
  isDefaultTechnician: false,
});

interface RuleRow {
  profile_id: string;
  allow_multiple_active_jobs: boolean | null;
  max_active_jobs: number | null;
  require_start_before_finish: boolean | null;
  can_claim_unassigned: boolean;
  can_transfer_to_agent: boolean;
  can_use_parts_without_approval: boolean;
  labour_cost_mode: LabourCostMode;
  labour_cost_value: number | string;
  is_default_technician: boolean;
}

const rowToOverride = (r: RuleRow): StaffRuleOverride => ({
  profileId: r.profile_id,
  allowMultipleActiveJobs: r.allow_multiple_active_jobs,
  maxActiveJobs: r.max_active_jobs,
  requireStartBeforeFinish: r.require_start_before_finish,
  canClaimUnassigned: r.can_claim_unassigned,
  canTransferToAgent: r.can_transfer_to_agent,
  canUsePartsWithoutApproval: r.can_use_parts_without_approval,
  labourCostMode: r.labour_cost_mode ?? "none",
  // numeric(12,2) arrives as a string over PostgREST.
  labourCostValue: Number(r.labour_cost_value ?? 0),
  isDefaultTechnician: !!r.is_default_technician,
});

/**
 * Point at the migration that actually adds a missing column.
 *
 * This screen used to name one hard-coded file whatever went wrong, which sent
 * people to a migration that was already applied while the real one sat unrun.
 * An error that names the wrong fix is worse than one that names none.
 */
function migrationHint(message: string): string {
  const byColumn: [string, string][] = [
    ["can_use_parts_without_approval", "20260819000009_parts_approval_permission.sql"],
    ["labour_cost_mode",               "20260819000013_technician_labour_cost.sql"],
    ["labour_cost_value",              "20260819000013_technician_labour_cost.sql"],
    ["is_default_technician",          "20260825000004_default_technician.sql"],
  ];
  const hit = byColumn.find(([col]) => message.includes(col));
  if (hit) return ` — run migration ${hit[1]}.`;
  if (/does not exist|Could not find/i.test(message)) {
    return " — a migration has not been run. Apply anything newer than your database from supabase/migrations/.";
  }
  return "";
}

export async function fetchStaffRules(): Promise<StaffRuleOverride[]> {
  const { data, error } = await getSupabaseBrowserClient()
    .from("staff_work_rules")
    .select("profile_id, allow_multiple_active_jobs, max_active_jobs, require_start_before_finish, can_claim_unassigned, can_transfer_to_agent, can_use_parts_without_approval, labour_cost_mode, labour_cost_value, is_default_technician");

  if (error) throw new Error(`Could not load technician permissions: ${error.message}${migrationHint(error.message)}`);
  return (data as RuleRow[]).map(rowToOverride);
}

export async function saveStaffRule(rule: StaffRuleOverride): Promise<void> {
  const { data: { user } } = await getSupabaseBrowserClient().auth.getUser();
  const { error } = await getSupabaseBrowserClient()
    .from("staff_work_rules")
    .upsert({
      profile_id: rule.profileId,
      allow_multiple_active_jobs: rule.allowMultipleActiveJobs,
      max_active_jobs: rule.maxActiveJobs,
      require_start_before_finish: rule.requireStartBeforeFinish,
      can_claim_unassigned: rule.canClaimUnassigned,
      can_transfer_to_agent: rule.canTransferToAgent,
      can_use_parts_without_approval: rule.canUsePartsWithoutApproval,
      labour_cost_mode: rule.labourCostMode,
      labour_cost_value: rule.labourCostValue,
      // is_default_technician is deliberately absent: writing it here could
      // leave two rows true, which the unique index rejects. It moves only
      // through setDefaultTechnician().
      updated_by: user?.id ?? null,
    });

  if (error) {
    throw new Error(
      error.code === "42501"
        ? "Only an Admin can change technician permissions."
        : `Could not save the permission: ${error.message}`,
    );
  }
  cache = null;
}

/** Merge one person's overrides over the shop rules. */
export function mergeRules(shop: WorkRules, override?: StaffRuleOverride | null): EffectiveRules {
  if (!override) {
    return {
      ...shop, canClaimUnassigned: true, canTransferToAgent: true,
      canUsePartsWithoutApproval: false, labourCostMode: "none", labourCostValue: 0,
      isDefaultTechnician: false, hasOverrides: false,
    };
  }
  const hasOverrides =
    override.allowMultipleActiveJobs !== null ||
    override.maxActiveJobs !== null ||
    override.requireStartBeforeFinish !== null ||
    !override.canClaimUnassigned ||
    !override.canTransferToAgent ||
    override.canUsePartsWithoutApproval ||
    override.labourCostMode !== "none";

  return {
    allowMultipleActiveJobs: override.allowMultipleActiveJobs ?? shop.allowMultipleActiveJobs,
    maxActiveJobs: override.maxActiveJobs ?? shop.maxActiveJobs,
    requireStartBeforeFinish: override.requireStartBeforeFinish ?? shop.requireStartBeforeFinish,
    canClaimUnassigned: override.canClaimUnassigned,
    canTransferToAgent: override.canTransferToAgent,
    canUsePartsWithoutApproval: override.canUsePartsWithoutApproval,
    labourCostMode: override.labourCostMode,
    labourCostValue: override.labourCostValue,
    isDefaultTechnician: override.isDefaultTechnician,
    hasOverrides,
  };
}

// ─── Enforcement read path ───────────────────────────────────────────────────

let cache: { at: number; byName: Map<string, StaffRuleOverride> } | null = null;
const CACHE_MS = 60_000;

/** Overrides keyed by technician name, since that is what a job records. */
async function overridesByName(): Promise<Map<string, StaffRuleOverride>> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.byName;

  const supabase = getSupabaseBrowserClient();
  const [{ data: profiles }, rules] = await Promise.all([
    supabase.from("profiles").select("id, full_name").eq("role", "Technician"),
    fetchStaffRules(),
  ]);

  const byId = new Map(rules.map(r => [r.profileId, r]));
  const byName = new Map<string, StaffRuleOverride>();
  for (const p of (profiles ?? []) as { id: string; full_name: string | null }[]) {
    const rule = byId.get(p.id);
    const name = (p.full_name ?? "").trim().toLowerCase();
    if (name && rule) byName.set(name, rule);
  }
  cache = { at: Date.now(), byName };
  return byName;
}

/**
 * The rules in force for one technician.
 *
 * Never throws: if permissions cannot be read, the shop defaults apply rather
 * than the bench grinding to a halt.
 */
export async function rulesForTechnician(technicianName: string): Promise<EffectiveRules> {
  const shop = await currentWorkRules();
  // Unlike the other two fallback flags above, this one stays false (needs
  // approval) even without Supabase — the local approval workflow itself
  // still works fine offline, so there's no reason to silently bypass it
  // just because the permission couldn't be read.
  if (!isSupabaseConfigured()) {
    return {
      ...shop, canClaimUnassigned: true, canTransferToAgent: true,
      canUsePartsWithoutApproval: false, labourCostMode: "none", labourCostValue: 0,
      isDefaultTechnician: false, hasOverrides: false,
    };
  }
  try {
    const byName = await overridesByName();
    return mergeRules(shop, byName.get((technicianName || "").trim().toLowerCase()));
  } catch {
    return {
      ...DEFAULT_WORK_RULES, ...shop,
      canClaimUnassigned: true, canTransferToAgent: true, canUsePartsWithoutApproval: false,
      // No rate could be read, so nothing is costed — better than guessing an
      // amount and writing it onto a job as if it were agreed.
      labourCostMode: "none", labourCostValue: 0,
      isDefaultTechnician: false, hasOverrides: false,
    };
  }
}

// ─── Admin editor hook ───────────────────────────────────────────────────────

export function useStaffRules() {
  const configured = isSupabaseConfigured();
  const [overrides, setOverrides] = useState<StaffRuleOverride[]>([]);
  const [loading, setLoading] = useState(configured);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!configured) return;
    try {
      setOverrides(await fetchStaffRules());
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

  const save = useCallback(async (rule: StaffRuleOverride) => {
    await saveStaffRule(rule);
    setOverrides(prev => {
      const rest = prev.filter(p => p.profileId !== rule.profileId);
      return [...rest, rule];
    });
  }, []);

  return { overrides, loading, error, reload, save, configured };
}

/**
 * A synchronous rate lookup by technician name, for views that price many jobs
 * at once. The async rulesForTechnician() is right for one decision at a time;
 * a dashboard listing fifty jobs cannot await once per row.
 */
export function useTechnicianRates(): (technicianName: string) => EffectiveRules | null {
  const { rules: shop } = useWorkRules();
  const [byName, setByName] = useState<Map<string, StaffRuleOverride>>(new Map());

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let active = true;
    overridesByName()
      .then(m => { if (active) setByName(new Map(m)); })
      .catch(() => { /* nothing is costed rather than guessed */ });
    return () => { active = false; };
  }, []);

  return useCallback(
    (technicianName: string) => {
      const override = byName.get((technicianName || "").trim().toLowerCase());
      return override ? mergeRules(shop, override) : null;
    },
    [byName, shop],
  );
}

/**
 * Nominate the main technician, or pass null to have none.
 *
 * Goes through the database function because clearing the previous default and
 * setting the new one must happen together — the unique index rejects a moment
 * with two, so doing it from here in two calls fails outright.
 */
export async function setDefaultTechnician(profileId: string | null): Promise<void> {
  const { error } = await getSupabaseBrowserClient()
    .rpc("set_default_technician", { p_profile_id: profileId });

  if (error) {
    throw new Error(
      error.code === "42501" || /Only an Admin/i.test(error.message)
        ? "Only an Admin can set the main technician."
        : `Could not set the main technician: ${error.message}`,
    );
  }
  cache = null;
}
