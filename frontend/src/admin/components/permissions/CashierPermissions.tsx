"use client";

import { useState } from "react";
import { AlertCircle, Store, ShieldCheck } from "lucide-react";
import { useStaff } from "@/lib/staff/api";
import {
  useStaffRules, blankOverride, CASHIER_PERMISSIONS, type StaffRuleOverride,
} from "@/lib/settings/staffRules";
import { useToast } from "@/lib/ui/toast";

const CC = "#6355ff";
const TA = "#34d399";
const ff = "'Plus Jakarta Sans', sans-serif";

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
 * What each cashier may do at the counter.
 *
 * The technician list next to this one is about how somebody works; this is
 * about authority — cancelling jobs, settling for less than the quote, letting
 * stock off the shelf, seeing the shop's takings. Until now none of it was
 * gated by anything beyond being signed in.
 *
 * Every switch here corresponds to a check in the code. Two of them
 * (approving parts, editing the catalogue) are enforced in the database as
 * well, because those actions are reachable through the API without going
 * near a button this screen can hide.
 *
 * The admin-cashier tick sits above them because it is a different kind of
 * thing: the five below take authority away from somebody who has it by
 * default, while that one hands over the shop's settings screen. It starts off
 * for everyone.
 */
export default function CashierPermissions() {
  const { staff, loading: staffLoading, configured } = useStaff();
  const { overrides, loading: rulesLoading, error, save } = useStaffRules();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, StaffRuleOverride>>({});

  const cashiers = staff.filter(s => s.role === "Cashier");
  const loading = staffLoading || rulesLoading;

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
      // Fall back to what is actually stored — a switch must never show a
      // permission that failed to save.
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
        <div style={{ width: 30, height: 30, borderRadius: 9, background: `${CC}14`, border: `1px solid ${CC}35`, display: "flex", alignItems: "center", justifyContent: "center", color: CC }}>
          <Store size={14} />
        </div>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>Counter Permissions by Cashier</h2>
          <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
            What each cashier may do. An Admin is never limited by these.
          </p>
        </div>
      </div>

      {(!configured || error || saveError) && (
        <div style={{ display: "flex", gap: 9, padding: "11px 14px", borderRadius: 10, background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.4)" }}>
          <AlertCircle size={15} color="#fbbf24" style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.55 }}>
            {!configured ? "Connect Supabase to set counter permissions." : saveError ?? error}
          </p>
        </div>
      )}

      {loading ? (
        <p style={{ fontSize: 12.5, color: "var(--text-muted)", padding: "8px 2px" }}>Loading cashiers…</p>
      ) : cashiers.length === 0 ? (
        <div style={{ padding: "26px 18px", borderRadius: 12, background: "var(--bg-card)", border: "1px solid var(--border)", textAlign: "center" }}>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 4 }}>No cashiers yet</p>
          <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Add them under Staff with the role <strong>Cashier</strong>, then set what each one may do here.
          </p>
        </div>
      ) : cashiers.map(c => {
        const rule = ruleFor(c.id);
        const saving = busy === c.id;
        const denied = CASHIER_PERMISSIONS.filter(p => !rule[p.key]);

        return (
          <div key={c.id} style={{
            padding: "14px 16px", borderRadius: 12, background: "var(--bg-card)",
            border: `1px solid ${denied.length ? `${CC}40` : "var(--border)"}`,
            opacity: c.status === "Active" ? 1 : 0.6,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: `${CC}14`, border: `1px solid ${CC}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: CC }}>
                {c.fullName.charAt(0).toUpperCase() || "?"}
              </div>
              <div style={{ flex: 1, minWidth: 160 }}>
                <p style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text-primary)" }}>{c.fullName}</p>
                <p style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  Cashier{c.status !== "Active" ? ` · ${c.status}` : ""}
                </p>
              </div>
              {rule.isAdminCashier && (
                <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 9px", borderRadius: 20, background: `${TA}14`, color: TA, border: `1px solid ${TA}40` }}>
                  Admin cashier
                </span>
              )}
              {denied.length > 0 && (
                <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 9px", borderRadius: 20, background: `${CC}14`, color: CC, border: `1px solid ${CC}35` }}>
                  {denied.length} restricted
                </span>
              )}
              {saving && <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Saving…</span>}
            </div>

            <div style={{
              display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
              padding: "10px 12px", marginBottom: 11, borderRadius: 10,
              background: rule.isAdminCashier ? `${TA}0e` : "var(--bg-secondary)",
              border: `1px solid ${rule.isAdminCashier ? `${TA}40` : "var(--border)"}`,
            }}>
              <ShieldCheck size={15} style={{ color: rule.isAdminCashier ? TA : "var(--text-muted)", flexShrink: 0 }} />
              <span style={{ ...label, flex: 1, minWidth: 220, color: "var(--text-primary)", fontWeight: 600 }}>
                Admin cashier
                <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>
                  {" "}· Opens Admin Control — dealers, brands, suppliers, the parts catalogue,
                  device faults, barcode design and the counter PIN. Hidden from every other cashier.
                </span>
              </span>
              <YesNo
                value={rule.isAdminCashier}
                disabled={saving}
                onChange={v => apply({ ...rule, isAdminCashier: v })}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {CASHIER_PERMISSIONS.map(p => (
                <div key={p.key} style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <span style={{ ...label, flex: 1, minWidth: 220 }}>
                    {p.label}
                    <span style={{ color: "var(--text-muted)" }}> · {p.blurb}</span>
                  </span>
                  <YesNo
                    value={rule[p.key]}
                    disabled={saving}
                    onChange={v => apply({ ...rule, [p.key]: v })}
                  />
                </div>
              ))}
            </div>

            <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 11, paddingTop: 10, borderTop: "1px solid var(--border)", lineHeight: 1.5 }}>
              {denied.length === 0
                ? `${c.fullName.split(" ")[0]} can do everything at the counter.`
                : <>{c.fullName.split(" ")[0]} cannot {denied.map(p => p.label.toLowerCase()).join(", ")}.</>}
              {rule.isAdminCashier
                ? " Admin Control is open to them."
                : " Admin Control is hidden from them."}
            </p>
          </div>
        );
      })}
    </div>
  );
}
