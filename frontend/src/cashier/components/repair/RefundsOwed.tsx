"use client";

import { useState } from "react";
import { RotateCcw, CheckCircle2, AlertCircle, Store, User } from "lucide-react";
import { useRepair } from "@/cashier/contexts/RepairContext";
import { useMyPermissions } from "@/lib/settings/staffRules";
import { useOwedRefunds, refundRepairAdvance, type JobRefund } from "@/lib/accounts/cashReturns";
import { useToast } from "@/lib/ui/toast";

const ff = "'Plus Jakarta Sans', sans-serif";
const rs = (n: number) => `Rs. ${Math.round(n).toLocaleString("en-LK")}`;

/**
 * Money the shop owes back, in one list.
 *
 * Every figure here was already in the database and on no screen. A Cash
 * Return posts the moment a technician marks it; a returned job keeps whatever
 * advance it was holding. Both were only visible if a cashier happened to open
 * that particular job in Sales — so Rs. 6,811 across two jobs sat unnoticed,
 * one of them since before the refund flow existed.
 *
 * A debt the shop owes needs somewhere it is counted, not somewhere it can be
 * found. This is that place.
 *
 * The two kinds settle differently and the list says which is which:
 *
 *   walk-in / in-house  notes out of the till, recorded in cash_returns
 *   external dealer     a deduction on their next bill, no cash moves
 *
 * refund_repair_advance decides that from the job, so neither this screen nor
 * the person using it has to.
 */
export default function RefundsOwed() {
  const { jobs } = useRepair();
  const { isAdminCashier } = useMyPermissions();
  const { owed, reload } = useOwedRefunds();
  const toast = useToast();

  const [target, setTarget] = useState<JobRefund | null>(null);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = owed.reduce((s, r) => s + r.remaining, 0);
  const jobOf = (id: string) => jobs.find(j => j.id === id);

  const open = (r: JobRefund) => {
    setTarget(r);
    setAmount(String(r.remaining));
    setReason("");
    setError(null);
  };

  const settle = async () => {
    if (!target) return;
    const amt = parseFloat(amount) || 0;
    if (amt <= 0 || !reason.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const cr = await refundRepairAdvance(target.jobId, amt, reason.trim());
      toast.success(
        target.settlesInCash
          ? `${rs(amt)} paid back on ${target.jobId} · ${cr.ref}`
          : `${rs(amt)} taken off the dealer's bill for ${target.jobId}`,
      );
      setTarget(null);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const input: React.CSSProperties = {
    width: "100%", boxSizing: "border-box", padding: "9px 11px", borderRadius: 9,
    border: "1px solid var(--border)", background: "var(--bg-secondary)",
    color: "var(--text-primary)", fontSize: 13, fontFamily: ff, outline: "none",
  };

  if (owed.length === 0) {
    return (
      <div style={{ padding: "40px 22px", textAlign: "center", background: "var(--bg-card)", border: "1px dashed var(--border)", borderRadius: 16, fontFamily: ff }}>
        <CheckCircle2 size={30} color="#4ade80" style={{ marginBottom: 12 }} />
        <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 4 }}>Nothing owed back</p>
        <p style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
          Cash Returns and unrefunded advances appear here until they are settled.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, fontFamily: ff }}>

      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "13px 16px", borderRadius: 12, background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.4)" }}>
        <AlertCircle size={16} style={{ color: "#fbbf24", flexShrink: 0 }} />
        <p style={{ flex: 1, minWidth: 220, fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.55 }}>
          <strong style={{ color: "var(--text-primary)" }}>{rs(total)} owed back</strong> across {owed.length} job{owed.length === 1 ? "" : "s"}.
          Each one is settled either out of the till or off the dealer&apos;s bill — the job decides which.
        </p>
      </div>

      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
        {owed.map((r, i) => {
          const job = jobOf(r.jobId);
          const cash = r.settlesInCash;
          return (
            <div key={r.jobId} style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 16px", borderBottom: i < owed.length - 1 ? "1px solid var(--border)" : "none", flexWrap: "wrap" }}>
              <span style={{
                width: 30, height: 30, borderRadius: 8, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                background: cash ? "rgba(96,165,250,0.10)" : "rgba(167,139,250,0.10)",
                border: `1px solid ${cash ? "rgba(96,165,250,0.35)" : "rgba(167,139,250,0.35)"}`,
                color: cash ? "#60a5fa" : "#a78bfa",
              }}>
                {cash ? <User size={14} /> : <Store size={14} />}
              </span>

              <div style={{ flex: 1, minWidth: 190 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
                  {r.jobId}
                  <span style={{ fontWeight: 500, color: "var(--text-muted)" }}>
                    {" · "}{job ? [job.brand, job.model].filter(Boolean).join(" ") : r.customerName}
                  </span>
                </p>
                <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2, lineHeight: 1.5 }}>
                  {r.completionType === "Cash Return" ? "Cash Return" : "Unrefunded advance"}
                  {" · "}
                  {/* Said plainly, because the two are different acts: one
                      empties the till, the other only moves a number on a
                      statement. */}
                  {cash ? "pay the customer" : `deduct from ${r.customerName}'s bill`}
                  {r.refunded > 0 && ` · ${rs(r.refunded)} of ${rs(r.refundable)} already settled`}
                </p>
              </div>

              <p style={{ fontSize: 15, fontWeight: 800, color: "#fbbf24", flexShrink: 0 }}>{rs(r.remaining)}</p>

              <button
                onClick={() => open(r)}
                disabled={!isAdminCashier}
                title={isAdminCashier ? undefined : "Settling a refund needs an admin cashier"}
                style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "8px 15px", borderRadius: 9,
                  border: "1px solid var(--accent)", background: "transparent", color: "var(--accent)",
                  cursor: isAdminCashier ? "pointer" : "not-allowed", opacity: isAdminCashier ? 1 : 0.4,
                  fontSize: 12.5, fontWeight: 700, fontFamily: ff, whiteSpace: "nowrap", flexShrink: 0,
                }}
              >
                <RotateCcw size={12} /> Settle
              </button>
            </div>
          );
        })}
      </div>

      {target && (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--accent-glow)", borderRadius: 14, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
            Settle {target.jobId} — {rs(target.remaining)} owed
          </p>
          <p style={{ fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.55, marginTop: -6 }}>
            {target.settlesInCash
              ? "Paid out of the till and recorded against the job. The day's takings drop by this amount."
              : "Taken off the dealer's account as a negative line on their bill. No cash moves."}
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 10 }}>
            <input
              type="number" min={1} max={target.remaining} step="0.01" autoFocus
              value={amount} onChange={e => setAmount(e.target.value)} style={input}
            />
            <input
              value={reason} onChange={e => setReason(e.target.value)}
              placeholder="Reason — goes on the record and the dealer's statement"
              style={input}
            />
          </div>

          {error && <p style={{ fontSize: 11.5, color: "#f87171", lineHeight: 1.5 }}>{error}</p>}

          <div style={{ display: "flex", gap: 9, justifyContent: "flex-end" }}>
            <button onClick={() => setTarget(null)} style={{ padding: "9px 18px", borderRadius: 9, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer", fontSize: 12.5, fontFamily: ff }}>
              Cancel
            </button>
            <button
              onClick={settle}
              disabled={busy || !(parseFloat(amount) > 0) || reason.trim() === ""}
              style={{
                display: "flex", alignItems: "center", gap: 7, padding: "9px 20px", borderRadius: 9,
                border: "1px solid var(--accent)", background: "var(--accent)", color: "var(--accent-fg)",
                cursor: busy ? "wait" : "pointer",
                opacity: busy || !(parseFloat(amount) > 0) || reason.trim() === "" ? 0.45 : 1,
                fontSize: 12.5, fontWeight: 700, fontFamily: ff,
              }}
            >
              <CheckCircle2 size={13} />{busy ? "Recording…" : "Settle"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
