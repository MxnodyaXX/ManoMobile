"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Wrench, Building2, Repeat, Banknote, CheckCircle } from "lucide-react";
import { useRepair, IN_HOUSE_DEALER } from "@/cashier/contexts/RepairContext";
import { useCashRegister } from "@/cashier/contexts/CashRegisterContext";
import { useDevices } from "@/cashier/contexts/DevicesContext";
import { useAuth } from "@/lib/auth/AuthContext";
import { fetchSaleByInvoiceNo } from "@/lib/sales/api";
import type { SaleTx } from "@/cashier/contexts/SalesContext";
import type { CoverageItem } from "@/lib/warranty/lookup";
import {
  RESOLUTIONS, createDeviceClaim, updateDeviceClaim, refundDeviceClaim, previewInvoiceRefund,
  type DeviceClaim, type DeviceClaimResolution, type RefundMethod, type RefundSplit,
} from "@/lib/warranty/deviceClaims";
import ReplaceDeviceModal from "@/cashier/components/sales/ReplaceDeviceModal";

/**
 * A warranty claim on a phone the shop sold.
 *
 * The cashier records what is wrong, then picks how it is settled:
 *   Repair at the shop    — a free warranty repair job is opened for the bench
 *   Send to the company   — recorded as with the company, tracked until back
 *   Replace the phone     — the replacement flow opens with the phone and fault
 *   Full refund           — the price paid comes back out of the till and the
 *                           phone goes to resale stock or back to the company
 */

const ff = "'Plus Jakarta Sans', sans-serif";
const rs = (n: number) => `Rs. ${Math.round(n).toLocaleString("en-LK")}`;
const ICON: Record<DeviceClaimResolution, typeof Wrench> = {
  repair_shop: Wrench, repair_company: Building2, replace: Repeat, refund: Banknote,
};

const REASONS = ["No power / dead", "Display fault", "Charging fault", "Network / signal fault", "Camera fault", "Speaker / mic fault", "Battery draining fast"];

const input: React.CSSProperties = { width: "100%", boxSizing: "border-box", padding: "9px 12px", borderRadius: 9, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 13, outline: "none", fontFamily: ff };
const label: React.CSSProperties = { fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)", display: "block", marginBottom: 6, fontFamily: ff };

export default function PhoneClaimModal({ item, onClose, onDone }: {
  item: CoverageItem;
  onClose: () => void;
  onDone: (claim: DeviceClaim | null, message: string) => void;
}) {
  const { addJob } = useRepair();
  const { addEntry } = useCashRegister();
  const { devices, reload: reloadDevices } = useDevices();
  const { profile } = useAuth();
  const me = profile?.fullName?.trim() || "Cashier";
  const device = devices.find(d => d.id === item.deviceId);

  const [issue, setIssue] = useState("");
  const [preset, setPreset] = useState("");
  const [resolution, setResolution] = useState<DeviceClaimResolution | "">("");
  const [company, setCompany] = useState(device?.supplier ?? "");
  const [expectedBack, setExpectedBack] = useState("");
  const [disposition, setDisposition] = useState<"resell" | "return_to_company">("return_to_company");
  const [notes, setNotes] = useState("");
  const [method, setMethod] = useState<RefundMethod>("Cash");
  // How the refund splits — off their credit first, the rest handed back.
  // Fetched once the refund option is picked; null shows the plain amount.
  const [split, setSplit] = useState<RefundSplit | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Replace: the claim is written first, then the replacement flow opens.
  const [replaceFor, setReplaceFor] = useState<{ claim: DeviceClaim; tx: SaleTx } | null>(null);

  const reported = [preset, issue.trim()].filter(Boolean).join(" — ");
  const refundAmount = item.soldPrice ?? 0;

  useEffect(() => {
    if (resolution !== "refund" || !item.invoiceNo) return;
    let live = true;
    previewInvoiceRefund(item.invoiceNo, refundAmount).then(s => { if (live) setSplit(s); });
    return () => { live = false; };
  }, [resolution, item.invoiceNo, refundAmount]);
  const creditPart = split?.credit ?? 0;
  const payoutPart = split ? split.payout : refundAmount;
  const ready = !!reported && !!resolution && !busy && (resolution !== "repair_company" || company.trim() !== "");

  const base = () => ({
    invoiceNo: item.invoiceNo!, deviceId: item.deviceId!, imei: item.detail.replace(/^IMEI\s*/, ""),
    deviceName: item.title, customer: item.customer, customerPhone: item.phone,
    soldOn: item.startsOn, warrantyUntil: item.expiresOn, reportedIssue: reported, notes, handledBy: me,
  });

  const submit = async () => {
    if (!ready || !resolution) return;
    setBusy(true); setError(null);
    try {
      if (resolution === "repair_shop") {
        // A free warranty job, Mano Mobile's own, high priority.
        const today = new Date().toISOString().slice(0, 10);
        const job = await addJob({
          customerName: item.customer || "Customer", phone: item.phone || "",
          brand: device?.brand ?? "", model: device?.name ?? item.title,
          imei: device?.imei ?? base().imei,
          issue: `[Warranty claim · ${item.invoiceNo}] ${reported}`,
          technician: "Unassigned", status: "Non-Issued", priority: "High",
          estimatedCost: 0, originalEstimate: 0, advancePaid: 0,
          createdAt: today, estimatedCompletion: today,
          dealer: IN_HOUSE_DEALER,
        });
        const claim = await createDeviceClaim({ ...base(), resolution, status: "In repair", jobId: job.id });
        onDone(claim, `Claim ${claim.id} opened — warranty repair job ${job.id} created, no charge.`);
        return;
      }

      if (resolution === "repair_company") {
        const claim = await createDeviceClaim({ ...base(), resolution, status: "At company", companyName: company, expectedBack });
        onDone(claim, `Claim ${claim.id} — ${item.title} recorded as sent to ${company}.`);
        return;
      }

      if (resolution === "replace") {
        const sale = await fetchSaleByInvoiceNo(item.invoiceNo!);
        if (!sale) throw new Error(`Invoice ${item.invoiceNo} could not be found.`);
        const claim = await createDeviceClaim({ ...base(), resolution, status: "Open" });
        setReplaceFor({ claim, tx: sale });
        setBusy(false);
        return;
      }

      // Full refund: record the claim; the database takes the phone back,
      // cancels whatever is still owed on credit, and marks the invoice. Only
      // the part actually paid is handed back — and only cash leaves the drawer.
      const claim = await createDeviceClaim({ ...base(), resolution, status: "Open" });
      const done = await refundDeviceClaim(claim.id, disposition, refundAmount, method);
      if (done.payout > 0.005 && method === "Cash") {
        addEntry("out", `Warranty refund — ${item.invoiceNo} (${claim.id})`, done.payout);
      }
      void reloadDevices();
      const parts = [
        done.credit > 0.005 ? `${rs(done.credit)} taken off their credit balance` : "",
        done.payout > 0.005
          ? method === "Cash" ? `${rs(done.payout)} paid back in cash — take it from the drawer`
            : `${rs(done.payout)} to be paid back by ${method.toLowerCase()}`
          : "",
      ].filter(Boolean);
      onDone(
        { ...claim, status: "Completed", refundAmount, refundCreditAmount: done.credit, refundMethod: done.payout > 0.005 ? method : null },
        `Claim ${claim.id} refunded — ${parts.join("; ")}.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  if (typeof document === "undefined") return null;

  if (replaceFor) {
    return (
      <ReplaceDeviceModal
        tx={replaceFor.tx}
        presetDeviceId={item.deviceId}
        presetReason={reported}
        onReplaced={rec => {
          void updateDeviceClaim(replaceFor.claim.id, {
            status: "Completed", resolvedAt: new Date().toISOString(),
            replacementDeviceId: rec.replacementDeviceId, replacementImei: rec.replacementImei,
          }).catch(() => { /* the swap itself is what matters; the claim can be closed by hand */ });
        }}
        onClose={() => onDone(replaceFor.claim, `Claim ${replaceFor.claim.id} — replacement recorded.`)}
      />
    );
  }

  return createPortal(
    <div onClick={e => { if (e.target === e.currentTarget && !busy) onClose(); }} style={{ position: "fixed", inset: 0, zIndex: 1100, background: "rgba(8,10,14,0.62)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ width: "min(720px, calc(100vw - 24px))", maxHeight: "calc(100vh - 32px)", display: "flex", flexDirection: "column", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 18, overflow: "hidden", fontFamily: ff, boxShadow: "0 30px 80px rgba(0,0,0,0.45)" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)" }}>Warranty claim — {item.title}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
              {item.detail} · {item.invoiceNo} · {item.customer}{item.phone ? ` · ${item.phone}` : ""}
            </div>
            <div style={{ fontSize: 12, color: "#16a34a", fontWeight: 700, marginTop: 4, display: "flex", alignItems: "center", gap: 5 }}>
              <CheckCircle size={13} /> Under warranty until {item.expiresOn} · {item.label}
            </div>
          </div>
          <button onClick={onClose} disabled={busy} style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer", display: "grid", placeItems: "center" }}><X size={14} /></button>
        </div>

        <div style={{ padding: 20, overflowY: "auto", display: "flex", flexDirection: "column", gap: 18 }}>
          {/* What's wrong */}
          <div>
            <span style={label}>1 · What is wrong with it? *</span>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
              {REASONS.map(r => (
                <button key={r} type="button" onClick={() => setPreset(preset === r ? "" : r)} style={{
                  padding: "6px 11px", borderRadius: 99, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: ff,
                  border: `1px solid ${preset === r ? "var(--accent)" : "var(--border)"}`, background: preset === r ? "var(--accent-dim)" : "transparent",
                  color: preset === r ? "var(--accent)" : "var(--text-secondary)",
                }}>{r}</button>
              ))}
            </div>
            <input value={issue} onChange={e => setIssue(e.target.value)} placeholder="Describe the fault the customer reports…" style={input} />
          </div>

          {/* How it is settled */}
          <div>
            <span style={label}>2 · How will it be settled? *</span>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
              {RESOLUTIONS.map(r => {
                const Icon = ICON[r.id];
                const on = resolution === r.id;
                return (
                  <button key={r.id} type="button" onClick={() => setResolution(r.id)} style={{
                    textAlign: "left", padding: 12, borderRadius: 12, cursor: "pointer", fontFamily: ff,
                    border: `1.5px solid ${on ? "var(--accent)" : "var(--border)"}`, background: on ? "var(--accent-dim)" : "transparent",
                  }}>
                    <Icon size={18} color={on ? "var(--accent)" : "var(--text-muted)"} />
                    <div style={{ fontSize: 13, fontWeight: 800, color: on ? "var(--accent)" : "var(--text-primary)", marginTop: 6 }}>{r.label}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2, lineHeight: 1.4 }}>{r.blurb}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Per resolution */}
          {resolution === "repair_shop" && (
            <div style={note("var(--accent)")}>
              A <b>free warranty repair job</b> will be opened for {item.title} (high priority, unassigned) with the fault above.
              The technician finishes it as normal; mark it <b>FOC</b> at completion.
            </div>
          )}

          {resolution === "repair_company" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <span style={label}>Company / supplier *</span>
                <input value={company} onChange={e => setCompany(e.target.value)} placeholder="Who repairs it" style={input} />
              </div>
              <div>
                <span style={label}>Expected back</span>
                <input type="date" value={expectedBack} onChange={e => setExpectedBack(e.target.value)} style={input} />
              </div>
            </div>
          )}

          {resolution === "replace" && (
            <div style={note("var(--accent)")}>
              The replacement window opens next with this phone and fault filled in — pick the unit to hand over and
              whether this one goes back to stock or to the company. Any price difference is handled there.
            </div>
          )}

          {resolution === "refund" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", borderRadius: 12, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)" }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-secondary)" }}>Full refund — the price paid</span>
                <span style={{ fontSize: 20, fontWeight: 800, color: "#dc2626" }}>{rs(refundAmount)}</span>
              </div>
              <div>
                <span style={label}>The phone that comes back goes</span>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {([["return_to_company", "Back to the company", "Set aside to return to the supplier"], ["resell", "Into resale stock", "Flagged as a customer return"]] as const).map(([v, t, s]) => (
                    <button key={v} type="button" onClick={() => setDisposition(v)} style={{
                      textAlign: "left", padding: 11, borderRadius: 10, cursor: "pointer", fontFamily: ff,
                      border: `1.5px solid ${disposition === v ? "var(--accent)" : "var(--border)"}`, background: disposition === v ? "var(--accent-dim)" : "transparent",
                    }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: disposition === v ? "var(--accent)" : "var(--text-primary)" }}>{t}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{s}</div>
                    </button>
                  ))}
                </div>
              </div>
              {/* Where the money goes: off what they owe first, then back to them. */}
              <div style={{ borderRadius: 12, border: "1px solid var(--border)", overflow: "hidden" }}>
                {creditPart > 0.005 && (
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", borderBottom: "1px solid var(--border)", fontSize: 12.5 }}>
                    <span style={{ color: "var(--text-secondary)" }}>Off their credit balance <span style={{ color: "var(--text-muted)" }}>(still owed on {item.invoiceNo})</span></span>
                    <b style={{ color: "#2563eb" }}>{rs(creditPart)}</b>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", fontSize: 12.5 }}>
                  <span style={{ color: "var(--text-secondary)" }}>Handed back to the customer</span>
                  <b style={{ color: payoutPart > 0.005 ? "#dc2626" : "var(--text-muted)" }}>{rs(payoutPart)}</b>
                </div>
              </div>

              {payoutPart > 0.005 ? (
                <div>
                  <span style={label}>Pay it back by</span>
                  <div style={{ display: "flex", gap: 6 }}>
                    {(["Cash", "Card", "Bank Transfer"] as RefundMethod[]).map(m => (
                      <button key={m} type="button" onClick={() => setMethod(m)} style={{
                        flex: 1, padding: "9px 6px", borderRadius: 10, fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: ff,
                        border: `1.5px solid ${method === m ? "var(--accent)" : "var(--border)"}`, background: method === m ? "var(--accent-dim)" : "transparent",
                        color: method === m ? "var(--accent)" : "var(--text-secondary)",
                      }}>{m}</button>
                    ))}
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 6 }}>
                    {method === "Cash" ? "Taken out of the cash drawer." : `Recorded as returned by ${method.toLowerCase()} — not taken from the drawer.`}
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 11.5, color: "#2563eb" }}>Nothing to hand back — the whole refund clears what they still owe on credit.</div>
              )}
              <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>Recorded on {item.invoiceNo} as returned.</div>
            </div>
          )}

          {resolution && resolution !== "replace" && (
            <div>
              <span style={label}>Notes</span>
              <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Anything worth keeping — accessories received, condition…" style={input} />
            </div>
          )}

          {error && <div style={{ padding: "10px 12px", borderRadius: 9, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", color: "#dc2626", fontSize: 12.5 }}>{error}</div>}
        </div>

        <div style={{ padding: "14px 20px", borderTop: "1px solid var(--border)", display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} disabled={busy} style={{ padding: "10px 18px", borderRadius: 10, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: ff }}>Cancel</button>
          <button onClick={() => void submit()} disabled={!ready} style={{
            padding: "10px 22px", borderRadius: 10, border: "none", fontSize: 13, fontWeight: 700, fontFamily: ff,
            background: ready ? (resolution === "refund" ? "#dc2626" : "var(--accent)") : "var(--border)",
            color: ready ? "#fff" : "var(--text-muted)", cursor: ready ? "pointer" : "not-allowed",
          }}>
            {busy ? "Working…"
              : !reported ? "Describe the fault"
              : !resolution ? "Choose how it is settled"
              : resolution === "repair_shop" ? "Open warranty repair job"
              : resolution === "repair_company" ? (company.trim() ? "Record as sent to company" : "Name the company")
              : resolution === "replace" ? "Continue to replacement"
              : payoutPart > 0.005 ? `Refund ${rs(refundAmount)} · ${rs(payoutPart)} by ${method}` : `Refund ${rs(refundAmount)} off credit`}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

const note = (c: string): React.CSSProperties => ({
  fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.55, padding: "11px 13px", borderRadius: 10,
  background: "var(--bg-secondary)", borderLeft: `3px solid ${c}`,
});
