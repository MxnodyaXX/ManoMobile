"use client";

import { useState } from "react";
import { AlertCircle, Wrench } from "lucide-react";
import { useWorkRules, type WorkRules } from "@/lib/settings/workRules";
import { useToast } from "@/lib/ui/toast";

const AA = "#a78bfa";
const TA = "#34d399";
const ff = "'Plus Jakarta Sans', sans-serif";

/** Labelled on/off switch — "is this rule in force?" should never be a guess. */
function RuleSwitch({ on, busy, onChange }: { on: boolean; busy: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      disabled={busy}
      style={{
        display: "flex", alignItems: "center", gap: 9, padding: "6px 12px 6px 8px", borderRadius: 22,
        cursor: busy ? "wait" : "pointer", opacity: busy ? 0.6 : 1, flexShrink: 0,
        background: on ? "rgba(52,211,153,0.1)" : "var(--bg-secondary)",
        border: `1px solid ${on ? "rgba(52,211,153,0.4)" : "var(--border)"}`,
        fontFamily: ff, transition: "all 0.18s",
      }}
    >
      <span style={{ width: 34, height: 19, borderRadius: 12, position: "relative", background: on ? TA : "var(--border)", transition: "background 0.18s" }}>
        <span style={{ position: "absolute", top: 2.5, left: on ? 17 : 2.5, width: 14, height: 14, borderRadius: "50%", background: "#fff", transition: "left 0.18s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }} />
      </span>
      <span style={{ fontSize: 11.5, fontWeight: 700, color: on ? TA : "var(--text-muted)" }}>
        {busy ? "Saving..." : on ? "On" : "Off"}
      </span>
    </button>
  );
}

/**
 * Technician work rules.
 *
 * These change what the technician screens allow, so each one says plainly what
 * happens when it is on and when it is off — an admin should not have to test a
 * rule on a live job to find out what it does.
 */
export default function WorkRulesCard() {
  const { rules, loading, error, save, configured } = useWorkRules();
  const [draft, setDraft] = useState<WorkRules>(rules);
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Adopt the loaded values once they arrive, derived during render rather than
  // in an effect (which would cascade an extra render each time).
  const [lastLoaded, setLastLoaded] = useState(rules);
  if (lastLoaded !== rules) {
    setLastLoaded(rules);
    setDraft(rules);
  }

  const apply = async (next: WorkRules, key: string) => {
    setBusy(key);
    setSaveError(null);
    const previous = draft;
    setDraft(next);
    try {
      await save(next);
      toast.success("Work rule saved");
    } catch (e) {
      setDraft(previous); // never leave a switch showing a rule that did not save
      setSaveError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const row = (
    key: string,
    title: string,
    onText: string,
    offText: string,
    value: boolean,
    onToggle: () => void,
    extra?: React.ReactNode,
  ) => (
    <div style={{ padding: "14px 16px", borderRadius: 12, background: "var(--bg-card)", border: "1px solid var(--border)" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>{title}</p>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.55 }}>
            {value ? onText : offText}
          </p>
          {extra}
        </div>
        <RuleSwitch on={value} busy={busy === key} onChange={onToggle} />
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, fontFamily: ff, marginBottom: 26 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <div style={{ width: 30, height: 30, borderRadius: 9, background: `${AA}14`, border: `1px solid ${AA}35`, display: "flex", alignItems: "center", justifyContent: "center", color: AA }}>
          <Wrench size={14} />
        </div>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>Technician Work Rules</h2>
          <p style={{ fontSize: 12, color: "var(--text-muted)" }}>How the bench is allowed to work. Applies to every technician.</p>
        </div>
      </div>

      {(!configured || error || saveError) && (
        <div style={{ display: "flex", gap: 9, padding: "11px 14px", borderRadius: 10, background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.4)" }}>
          <AlertCircle size={15} color="#fbbf24" style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.55 }}>
            {!configured
              ? "Connect Supabase to change these rules."
              : saveError ?? `${error} — run the work rules migration (20260816000006_work_rules.sql).`}
          </p>
        </div>
      )}

      {loading ? (
        <p style={{ fontSize: 12.5, color: "var(--text-muted)", padding: "8px 2px" }}>Loading rules…</p>
      ) : (
        <>
          {row(
            "multi",
            "Work on several jobs at once",
            "A technician can have any number of repairs in progress at the same time.",
            "A technician must finish or pause their current repair before starting another.",
            draft.allowMultipleActiveJobs,
            () => apply({ ...draft, allowMultipleActiveJobs: !draft.allowMultipleActiveJobs }, "multi"),
            draft.allowMultipleActiveJobs ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
                <label style={{ fontSize: 11.5, color: "var(--text-muted)" }}>Limit at once:</label>
                <input
                  type="number"
                  min={1}
                  placeholder="No limit"
                  value={draft.maxActiveJobs ?? ""}
                  onChange={e => setDraft(d => ({ ...d, maxActiveJobs: e.target.value ? Number(e.target.value) : null }))}
                  onBlur={() => apply(draft, "multi")}
                  style={{
                    width: 96, padding: "6px 9px", borderRadius: 7, border: "1px solid var(--border)",
                    background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 12, fontFamily: ff, outline: "none",
                  }}
                />
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>blank = unlimited</span>
              </div>
            ) : null,
          )}

          {row(
            "start",
            "Require Start before finishing",
            "A repair must be started in the system before it can be marked finished.",
            "A technician can mark a repair finished without starting it first — suited to a busy bench where work begins before anyone touches a screen.",
            draft.requireStartBeforeFinish,
            () => apply({ ...draft, requireStartBeforeFinish: !draft.requireStartBeforeFinish }, "start"),
          )}
        </>
      )}
    </div>
  );
}
