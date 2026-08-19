"use client";

import { useState } from "react";
import { AlertCircle, Users } from "lucide-react";
import { useStaff } from "@/lib/staff/api";
import { useWorkRules } from "@/lib/settings/workRules";
import {
  useStaffRules, mergeRules, blankOverride, LABOUR_MODES,
  type StaffRuleOverride,
} from "@/lib/settings/staffRules";
import { describeRate } from "@/lib/repair/labour";
import { useToast } from "@/lib/ui/toast";

const AA = "#a78bfa";
const TA = "#34d399";
const ff = "'Plus Jakarta Sans', sans-serif";

/**
 * Tri-state control: Shop / Yes / No.
 *
 * "Shop" is a real third state, not a default — it means this technician
 * follows whatever the shop rule is now and whatever it changes to later.
 * Collapsing it to a checkbox would lose that.
 */
function TriState({ value, onChange, disabled }: {
  value: boolean | null;
  onChange: (v: boolean | null) => void;
  disabled?: boolean;
}) {
  const options: { label: string; v: boolean | null }[] = [
    { label: "Shop", v: null },
    { label: "Yes", v: true },
    { label: "No", v: false },
  ];
  return (
    <div style={{ display: "flex", gap: 3, background: "var(--bg-secondary)", padding: 3, borderRadius: 8, border: "1px solid var(--border)" }}>
      {options.map(o => {
        const active = value === o.v;
        const colour = o.v === null ? AA : o.v ? TA : "#f87171";
        return (
          <button
            key={o.label}
            onClick={() => onChange(o.v)}
            disabled={disabled}
            style={{
              padding: "4px 11px", borderRadius: 6, fontSize: 11, fontWeight: active ? 700 : 500,
              border: `1px solid ${active ? `${colour}55` : "transparent"}`,
              background: active ? `${colour}18` : "transparent",
              color: active ? colour : "var(--text-muted)",
              cursor: disabled ? "not-allowed" : "pointer", fontFamily: ff, transition: "all 0.15s",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function YesNo({ value, onChange, disabled }: { value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div style={{ display: "flex", gap: 3, background: "var(--bg-secondary)", padding: 3, borderRadius: 8, border: "1px solid var(--border)" }}>
      {[true, false].map(v => {
        const active = value === v;
        const colour = v ? TA : "#f87171";
        return (
          <button
            key={String(v)}
            onClick={() => onChange(v)}
            disabled={disabled}
            style={{
              padding: "4px 13px", borderRadius: 6, fontSize: 11, fontWeight: active ? 700 : 500,
              border: `1px solid ${active ? `${colour}55` : "transparent"}`,
              background: active ? `${colour}18` : "transparent",
              color: active ? colour : "var(--text-muted)",
              cursor: disabled ? "not-allowed" : "pointer", fontFamily: ff, transition: "all 0.15s",
            }}
          >
            {v ? "Allowed" : "Denied"}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Repair permissions, one row per technician.
 *
 * Ten technicians can work under ten different sets of rules, so this lists
 * every one of them with what actually applies — including the effective
 * outcome in words, so an admin never has to work out what "Shop + limit 3"
 * resolves to.
 */
export default function TechnicianPermissions() {
  const { staff, loading: staffLoading, configured } = useStaff();
  const { rules: shopRules, loading: shopLoading } = useWorkRules();
  const { overrides, loading: rulesLoading, error, save } = useStaffRules();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, StaffRuleOverride>>({});

  const technicians = staff.filter(s => s.role === "Technician");
  const loading = staffLoading || shopLoading || rulesLoading;

  const ruleFor = (profileId: string): StaffRuleOverride =>
    drafts[profileId] ?? overrides.find(o => o.profileId === profileId) ?? blankOverride(profileId);

  const apply = async (next: StaffRuleOverride) => {
    setBusy(next.profileId);
    setSaveError(null);
    setDrafts(d => ({ ...d, [next.profileId]: next }));
    try {
      await save(next);
      toast.success("Permission saved");
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
      // Drop the draft so the row falls back to what is actually stored — a
      // switch must never show a permission that failed to save.
      setDrafts(d => {
        const rest = { ...d };
        delete rest[next.profileId];
        return rest;
      });
    } finally {
      setBusy(null);
    }
  };

  const label: React.CSSProperties = { fontSize: 11.5, color: "var(--text-secondary)", fontFamily: ff };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, fontFamily: ff, marginBottom: 26 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <div style={{ width: 30, height: 30, borderRadius: 9, background: `${AA}14`, border: `1px solid ${AA}35`, display: "flex", alignItems: "center", justifyContent: "center", color: AA }}>
          <Users size={14} />
        </div>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>Repair Permissions by Technician</h2>
          <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Each technician can work under their own rules. <strong>Shop</strong> follows the rule above and changes with it.
          </p>
        </div>
      </div>

      {(!configured || error || saveError) && (
        <div style={{ display: "flex", gap: 9, padding: "11px 14px", borderRadius: 10, background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.4)" }}>
          <AlertCircle size={15} color="#fbbf24" style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.55 }}>
            {!configured
              ? "Connect Supabase to set per-technician permissions."
              : saveError ?? `${error} — run migration 20260816000007_staff_work_rules.sql.`}
          </p>
        </div>
      )}

      {loading ? (
        <p style={{ fontSize: 12.5, color: "var(--text-muted)", padding: "8px 2px" }}>Loading technicians…</p>
      ) : technicians.length === 0 ? (
        <div style={{ padding: "26px 18px", borderRadius: 12, background: "var(--bg-card)", border: "1px solid var(--border)", textAlign: "center" }}>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 4 }}>No technicians yet</p>
          <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Add them under Staff, then set what each one may do here.</p>
        </div>
      ) : technicians.map(tech => {
        const rule = ruleFor(tech.id);
        const effective = mergeRules(shopRules, rule);
        const saving = busy === tech.id;

        return (
          <div key={tech.id} style={{
            padding: "14px 16px", borderRadius: 12, background: "var(--bg-card)",
            border: `1px solid ${effective.hasOverrides ? `${AA}40` : "var(--border)"}`,
            opacity: tech.status === "Active" ? 1 : 0.6,
          }}>
            {/* Who */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: `${TA}14`, border: `1px solid ${TA}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: TA }}>
                {tech.fullName.charAt(0).toUpperCase() || "?"}
              </div>
              <div style={{ flex: 1, minWidth: 160 }}>
                <p style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text-primary)" }}>{tech.fullName}</p>
                <p style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  {tech.speciality || "Repair Technician"}{tech.status !== "Active" ? ` · ${tech.status}` : ""}
                </p>
              </div>
              {effective.hasOverrides && (
                <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 9px", borderRadius: 20, background: `${AA}14`, color: AA, border: `1px solid ${AA}35` }}>
                  Custom rules
                </span>
              )}
              {saving && <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Saving…</span>}
            </div>

            {/* Rules */}
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <span style={{ ...label, flex: 1, minWidth: 190 }}>Work on several jobs at once</span>
                <TriState
                  value={rule.allowMultipleActiveJobs}
                  disabled={saving}
                  onChange={v => apply({ ...rule, allowMultipleActiveJobs: v, maxActiveJobs: v === false ? null : rule.maxActiveJobs })}
                />
                {effective.allowMultipleActiveJobs && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>max</span>
                    <input
                      type="number"
                      min={1}
                      placeholder={shopRules.maxActiveJobs ? String(shopRules.maxActiveJobs) : "∞"}
                      value={rule.maxActiveJobs ?? ""}
                      disabled={saving}
                      onChange={e => setDrafts(d => ({ ...d, [tech.id]: { ...rule, maxActiveJobs: e.target.value ? Number(e.target.value) : null } }))}
                      onBlur={() => apply(ruleFor(tech.id))}
                      style={{
                        width: 66, padding: "5px 8px", borderRadius: 7, border: "1px solid var(--border)",
                        background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 12, fontFamily: ff, outline: "none",
                      }}
                    />
                  </div>
                )}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <span style={{ ...label, flex: 1, minWidth: 190 }}>Must press Start before finishing</span>
                <TriState
                  value={rule.requireStartBeforeFinish}
                  disabled={saving}
                  onChange={v => apply({ ...rule, requireStartBeforeFinish: v })}
                />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <span style={{ ...label, flex: 1, minWidth: 190 }}>Take unassigned jobs from the pool</span>
                <YesNo value={rule.canClaimUnassigned} disabled={saving} onChange={v => apply({ ...rule, canClaimUnassigned: v })} />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <span style={{ ...label, flex: 1, minWidth: 190 }}>Send devices to an external agent</span>
                <YesNo value={rule.canTransferToAgent} disabled={saving} onChange={v => apply({ ...rule, canTransferToAgent: v })} />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <span style={{ ...label, flex: 1, minWidth: 190 }}>Use repair parts without approval</span>
                <YesNo value={rule.canUsePartsWithoutApproval} disabled={saving} onChange={v => apply({ ...rule, canUsePartsWithoutApproval: v })} />
              </div>

              {/* What their work costs the shop — the missing half of profit */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 9, borderTop: "1px dashed var(--border)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <span style={{ ...label, flex: 1, minWidth: 190 }}>Default charge per job</span>
                  <div style={{ display: "flex", gap: 3, background: "var(--bg-secondary)", padding: 3, borderRadius: 8, border: "1px solid var(--border)", flexWrap: "wrap" }}>
                    {LABOUR_MODES.map(m => {
                      const active = rule.labourCostMode === m.id;
                      return (
                        <button
                          key={m.id}
                          title={m.blurb}
                          disabled={saving}
                          onClick={() => apply({
                            ...rule,
                            labourCostMode: m.id,
                            // A rate left over from another mode would be read
                            // as rupees where percent was meant, so it resets.
                            labourCostValue: m.id === "fixed" || m.id === "percentage" ? rule.labourCostValue : 0,
                          })}
                          style={{
                            padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: active ? 700 : 500,
                            border: `1px solid ${active ? `${AA}55` : "transparent"}`,
                            background: active ? `${AA}18` : "transparent",
                            color: active ? AA : "var(--text-muted)",
                            cursor: saving ? "not-allowed" : "pointer", fontFamily: ff, transition: "all 0.15s",
                          }}
                        >
                          {m.label}
                        </button>
                      );
                    })}
                  </div>

                  {(rule.labourCostMode === "fixed" || rule.labourCostMode === "percentage") && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        {rule.labourCostMode === "fixed" ? "Rs." : "%"}
                      </span>
                      <input
                        type="number"
                        min={0}
                        max={rule.labourCostMode === "percentage" ? 100 : undefined}
                        step={rule.labourCostMode === "percentage" ? 1 : 50}
                        value={rule.labourCostValue || ""}
                        disabled={saving}
                        onChange={e => setDrafts(d => ({ ...d, [tech.id]: { ...rule, labourCostValue: Number(e.target.value) || 0 } }))}
                        onBlur={() => apply(ruleFor(tech.id))}
                        style={{
                          width: 82, padding: "5px 8px", borderRadius: 7, border: "1px solid var(--border)",
                          background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 12, fontFamily: ff, outline: "none",
                        }}
                      />
                    </div>
                  )}
                </div>

                <p style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.5 }}>
                  {rule.labourCostMode === "none"
                    ? "Their charge box starts at zero on each job — they type what they are charging."
                    : rule.labourCostMode === "custom"
                      ? "Their charge box starts empty, so they must think about it on every job."
                      : `Their charge box is pre-filled with ${describeRate(rule.labourCostMode, rule.labourCostValue).toLowerCase()}, and they can change it. Only affects jobs completed from now on.`}
                  {" "}This technician always enters what they are charging when they finish a job; this only sets what the box starts at.
                </p>
              </div>
            </div>

            {/* What this adds up to, in words */}
            <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 11, paddingTop: 10, borderTop: "1px solid var(--border)", lineHeight: 1.5 }}>
              {tech.fullName.split(" ")[0]} can work on{" "}
              <strong style={{ color: "var(--text-secondary)" }}>
                {effective.allowMultipleActiveJobs
                  ? effective.maxActiveJobs ? `up to ${effective.maxActiveJobs} jobs` : "any number of jobs"
                  : "one job"}
              </strong>{" "}
              at a time,{" "}
              {effective.canClaimUnassigned ? "can take unassigned jobs" : "cannot take unassigned jobs"},{" "}
              {effective.canTransferToAgent ? "can send devices out" : "cannot send devices out"},{" "}
              {effective.requireStartBeforeFinish ? "must start a job before finishing it" : "can finish a job without starting it"}, and{" "}
              {effective.canUsePartsWithoutApproval ? "can pull repair parts without approval" : "needs Admin approval to use repair parts"}.{" "}
              Their charge box starts at{" "}
              <strong style={{ color: "var(--text-secondary)" }}>
                {describeRate(effective.labourCostMode, effective.labourCostValue).toLowerCase()}
              </strong>.
            </p>
          </div>
        );
      })}
    </div>
  );
}
