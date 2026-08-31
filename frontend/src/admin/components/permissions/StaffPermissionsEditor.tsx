"use client";

import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import {
  fetchStaffRules, saveStaffRule, blankOverride, setDefaultTechnician,
  CASHIER_PERMISSIONS, LABOUR_MODES, type StaffRuleOverride,
} from "@/lib/settings/staffRules";
import { useWorkRules } from "@/lib/settings/workRules";
import { describeRate } from "@/lib/repair/labour";
import { useModuleAccessMatrix, type Access, type RoleName } from "@/lib/settings/moduleAccess";

const AA = "#a78bfa";
const TA = "#34d399";
const ff = "'Plus Jakarta Sans', sans-serif";

/**
 * One person's permissions, editable wherever their record is.
 *
 * The Permissions page lists everybody side by side, which is the right shape
 * for comparing a bench. This is the other need: an admin who has just opened
 * one person to fix their phone number should be able to set what they may do
 * without going and finding them again on a second screen.
 *
 * Which switches appear follows the role, because the two sets are unrelated —
 * a technician's rules are about how they work, a cashier's are about
 * authority. Admin and Accounts get neither: an Admin is never limited by
 * these, and Accounts has no counter or bench actions to gate.
 */

function Toggle({ value, onChange, disabled, on = "Allowed", off = "Denied" }: {
  value: boolean; onChange: (v: boolean) => void; disabled?: boolean; on?: string; off?: string;
}) {
  return (
    <div style={{ display: "flex", gap: 3, background: "var(--bg-secondary)", padding: 3, borderRadius: 8, border: "1px solid var(--border)", flexShrink: 0 }}>
      {[true, false].map(v => {
        const active = value === v;
        const colour = v ? TA : "#f87171";
        return (
          <button
            key={String(v)}
            type="button"
            onClick={() => onChange(v)}
            disabled={disabled}
            style={{
              padding: "4px 11px", borderRadius: 6, fontSize: 11, fontWeight: active ? 700 : 500,
              border: `1px solid ${active ? `${colour}55` : "transparent"}`,
              background: active ? `${colour}18` : "transparent",
              color: active ? colour : "var(--text-muted)",
              cursor: disabled ? "not-allowed" : "pointer", fontFamily: ff, transition: "all 0.15s",
            }}
          >
            {v ? on : off}
          </button>
        );
      })}
    </div>
  );
}

function TriState({ value, onChange, disabled }: {
  value: boolean | null; onChange: (v: boolean | null) => void; disabled?: boolean;
}) {
  return (
    <div style={{ display: "flex", gap: 3, background: "var(--bg-secondary)", padding: 3, borderRadius: 8, border: "1px solid var(--border)", flexShrink: 0 }}>
      {([{ l: "Shop", v: null }, { l: "Yes", v: true }, { l: "No", v: false }] as const).map(o => {
        const active = value === o.v;
        const colour = o.v === null ? AA : o.v ? TA : "#f87171";
        return (
          <button
            key={o.l}
            type="button"
            onClick={() => onChange(o.v)}
            disabled={disabled}
            style={{
              padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: active ? 700 : 500,
              border: `1px solid ${active ? `${colour}55` : "transparent"}`,
              background: active ? `${colour}18` : "transparent",
              color: active ? colour : "var(--text-muted)",
              cursor: disabled ? "not-allowed" : "pointer", fontFamily: ff, transition: "all 0.15s",
            }}
          >
            {o.l}
          </button>
        );
      })}
    </div>
  );
}

/** Person-level technician rules. The shop-wide ones stay on the Permissions
 *  page, since changing those from inside one person's record would edit
 *  everybody without saying so. */
const TECH_TOGGLES: { key: "canClaimUnassigned" | "canTransferToAgent" | "canUsePartsWithoutApproval"; label: string }[] = [
  { key: "canClaimUnassigned",         label: "Take unassigned jobs from the pool" },
  { key: "canTransferToAgent",         label: "Send devices to an external agent" },
  { key: "canUsePartsWithoutApproval", label: "Use repair parts without approval" },
];

export default function StaffPermissionsEditor({ profileId, role, onDirty }: {
  profileId: string;
  role: string;
  /** Told when there are unsaved changes, so the parent can warn or save. */
  onDirty?: (dirty: boolean) => void;
}) {
  const { rules: shopRules } = useWorkRules();
  // What this person's ROLE may open. Read-only here on purpose: the grid is
  // per role, so changing a cell inside one person's record would silently
  // move every colleague who shares that role.
  const { matrix: moduleMatrix } = useModuleAccessMatrix();
  const [rule, setRule] = useState<StaffRuleOverride | null>(null);
  const [saved, setSaved] = useState<StaffRuleOverride | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const rows = await fetchStaffRules();
        if (!active) return;
        const mine = rows.find(r => r.profileId === profileId) ?? blankOverride(profileId);
        setRule(mine);
        setSaved(mine);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [profileId]);

  const dirty = !!rule && !!saved && JSON.stringify(rule) !== JSON.stringify(saved);
  useEffect(() => { onDirty?.(dirty); }, [dirty, onDirty]);

  const apply = async (next: StaffRuleOverride) => {
    setRule(next);
    setBusy(true);
    setError(null);
    try {
      await saveStaffRule(next);
      setSaved(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      // Snap back to what is stored — a switch must never sit showing a
      // permission the database refused.
      setRule(saved);
    } finally {
      setBusy(false);
    }
  };

  /**
   * The main technician moves through its own database function: setting one
   * clears whoever held it before, and a partial unique index rejects any
   * moment with two. Two rows change, so the set is re-read afterwards rather
   * than one field being patched locally.
   */
  const makeDefault = async (on: boolean) => {
    if (!rule) return;
    setBusy(true);
    setError(null);
    try {
      await setDefaultTechnician(on ? profileId : null);
      const rows = await fetchStaffRules();
      const mine = rows.find(r => r.profileId === profileId) ?? blankOverride(profileId);
      setRule(mine);
      setSaved(mine);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const isCashier = role === "Cashier";
  const isTech = role === "Technician";

  const row = (label: string, control: React.ReactNode, hint?: string) => (
    <div key={label} style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <span style={{ flex: 1, minWidth: 190, fontSize: 11.5, color: "var(--text-secondary)", fontFamily: ff }}>
        {label}
        {hint && <span style={{ color: "var(--text-muted)" }}> · {hint}</span>}
      </span>
      {control}
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <ShieldCheck size={13} color={AA} />
        <span style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: ff }}>
          Permissions
        </span>
        {busy && <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: ff }}>Saving…</span>}
      </div>

      {error && (
        <p style={{ fontSize: 11.5, color: "#f87171", lineHeight: 1.5, fontFamily: ff }}>{error}</p>
      )}

      {loading ? (
        <p style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: ff }}>Loading permissions…</p>
      ) : !rule ? null : !isCashier && !isTech ? (
        <p style={{ fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.55, fontFamily: ff }}>
          {role === "Admin"
            ? "An Admin is never limited by these permissions."
            : "This role has no counter or bench permissions to set."}
        </p>
      ) : (
        <>
          {isCashier && (
            <>
              {/* First, because it is the one that hands over a whole screen
                  rather than adjusting what they may do on the ones they have. */}
              {row(
                "Admin cashier",
                <Toggle value={rule.isAdminCashier} disabled={busy}
                  onChange={v => apply({ ...rule, isAdminCashier: v })} />,
                rule.isAdminCashier
                  ? "Opens Admin Control — dealers, brands, suppliers, parts and barcode design"
                  : "Admin Control is hidden from them",
              )}
              {CASHIER_PERMISSIONS.map(p =>
                row(p.label, <Toggle value={rule[p.key]} disabled={busy} onChange={v => apply({ ...rule, [p.key]: v })} />),
              )}
            </>
          )}

          {isTech && (
            <>
              {row(
                "Work on several jobs at once",
                <TriState value={rule.allowMultipleActiveJobs} disabled={busy}
                  onChange={v => apply({ ...rule, allowMultipleActiveJobs: v, maxActiveJobs: v === false ? null : rule.maxActiveJobs })} />,
                "Shop follows the shop-wide rule",
              )}
              {rule.allowMultipleActiveJobs !== false && row(
                "Most jobs at once",
                <input
                  type="number"
                  min={1}
                  placeholder={shopRules.maxActiveJobs ? String(shopRules.maxActiveJobs) : "No limit"}
                  value={rule.maxActiveJobs ?? ""}
                  disabled={busy}
                  onChange={e => setRule({ ...rule, maxActiveJobs: e.target.value ? Number(e.target.value) : null })}
                  onBlur={() => rule && apply(rule)}
                  style={{
                    width: 86, padding: "5px 8px", borderRadius: 7, border: "1px solid var(--border)",
                    background: "var(--bg-secondary)", color: "var(--text-primary)",
                    fontSize: 12, fontFamily: ff, outline: "none", flexShrink: 0,
                  }}
                />,
                "blank means no cap",
              )}
              {row(
                "Must press Start before finishing",
                <TriState value={rule.requireStartBeforeFinish} disabled={busy}
                  onChange={v => apply({ ...rule, requireStartBeforeFinish: v })} />,
              )}
              {TECH_TOGGLES.map(t =>
                row(t.label, <Toggle value={rule[t.key]} disabled={busy} onChange={v => apply({ ...rule, [t.key]: v })} />),
              )}
              {row(
                "Main technician",
                <Toggle value={rule.isDefaultTechnician} disabled={busy}
                  on="Yes" off="No" onChange={makeDefault} />,
                "new repairs are pre-assigned to them",
              )}

              {/* What pre-fills their charge box when they finish a job —
                  never a substitute for the amount they actually enter. */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 9, borderTop: "1px dashed var(--border)" }}>
                {row(
                  "Default charge per job",
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <div style={{ display: "flex", gap: 3, background: "var(--bg-secondary)", padding: 3, borderRadius: 8, border: "1px solid var(--border)", flexWrap: "wrap" }}>
                      {LABOUR_MODES.map(m => {
                        const active = rule.labourCostMode === m.id;
                        return (
                          <button
                            key={m.id}
                            type="button"
                            title={m.blurb}
                            disabled={busy}
                            onClick={() => apply({
                              ...rule,
                              labourCostMode: m.id,
                              // A rate left over from another mode would be
                              // read as rupees where percent was meant.
                              labourCostValue: m.id === "fixed" || m.id === "percentage" ? rule.labourCostValue : 0,
                            })}
                            style={{
                              padding: "4px 9px", borderRadius: 6, fontSize: 10.5, fontWeight: active ? 700 : 500,
                              border: `1px solid ${active ? `${AA}55` : "transparent"}`,
                              background: active ? `${AA}18` : "transparent",
                              color: active ? AA : "var(--text-muted)",
                              cursor: busy ? "not-allowed" : "pointer", fontFamily: ff,
                            }}
                          >
                            {m.label}
                          </button>
                        );
                      })}
                    </div>
                    {(rule.labourCostMode === "fixed" || rule.labourCostMode === "percentage") && (
                      <>
                        <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: ff }}>
                          {rule.labourCostMode === "fixed" ? "Rs." : "%"}
                        </span>
                        <input
                          type="number"
                          min={0}
                          max={rule.labourCostMode === "percentage" ? 100 : undefined}
                          value={rule.labourCostValue || ""}
                          disabled={busy}
                          onChange={e => setRule({ ...rule, labourCostValue: Number(e.target.value) || 0 })}
                          onBlur={() => rule && apply(rule)}
                          style={{
                            width: 78, padding: "5px 8px", borderRadius: 7, border: "1px solid var(--border)",
                            background: "var(--bg-secondary)", color: "var(--text-primary)",
                            fontSize: 12, fontFamily: ff, outline: "none",
                          }}
                        />
                      </>
                    )}
                  </div>,
                )}
                <p style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.5, fontFamily: ff }}>
                  Their charge box starts at {describeRate(rule.labourCostMode, rule.labourCostValue).toLowerCase()}.
                  They always enter what they are charging when finishing a job; this only sets what the box starts at.
                </p>
              </div>
            </>
          )}

          <p style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.5, fontFamily: ff }}>
            Saved as you switch them — separately from the details above.
            {isTech && " Shop-wide rules stay on the Permissions page, since changing those here would edit everyone."}
          </p>
        </>
      )}

      {/* Every role has module access, including the two with no per-person
          switches — Accounts in particular is defined almost entirely by it. */}
      <ModuleAccessSummary role={role} matrix={moduleMatrix} />
    </div>
  );
}


/**
 * Which screens this person's role can open, from the Permissions grid.
 *
 * Shown, not editable. The grid is keyed by role rather than by person, so a
 * switch here would move every colleague sharing that role without saying so —
 * the same reason the shop-wide technician rules stay on the Permissions page.
 */
function ModuleAccessSummary({ role, matrix }: {
  role: string;
  matrix: Record<string, Partial<Record<RoleName, Access>>>;
}) {
  const rows = Object.entries(matrix)
    .map(([module, byRole]) => ({ module, access: byRole[role as RoleName] }))
    .filter((r): r is { module: string; access: Access } => !!r.access)
    .sort((a, b) => a.module.localeCompare(b.module));

  if (rows.length === 0) return null;

  const cfg: Record<Access, { label: string; color: string }> = {
    full: { label: "Full", color: "#34d399" },
    view: { label: "View", color: "#60a5fa" },
    none: { label: "No access", color: "var(--text-muted)" },
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7, paddingTop: 11, borderTop: "1px dashed var(--border)" }}>
      <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: ff }}>
        Screens the {role} role can open
      </span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
        {rows.map(r => (
          <span
            key={r.module}
            title={`${r.module}: ${cfg[r.access].label}`}
            style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              padding: "3px 9px", borderRadius: 20, fontSize: 10.5, fontFamily: ff,
              background: "var(--bg-secondary)", border: "1px solid var(--border)",
              color: r.access === "none" ? "var(--text-muted)" : "var(--text-secondary)",
              opacity: r.access === "none" ? 0.6 : 1,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: cfg[r.access].color, flexShrink: 0 }} />
            {r.module}
          </span>
        ))}
      </div>
      <p style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.5, fontFamily: ff }}>
        Set per role on the Permissions page — changing one here would move everybody with this role.
      </p>
    </div>
  );
}
