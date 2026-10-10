"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Wrench, Building2, Repeat, Banknote, CheckCircle, Truck, Undo2, Check, PackageCheck } from "lucide-react";
import { useRepair, IN_HOUSE_DEALER } from "@/cashier/contexts/RepairContext";
import { useCashRegister } from "@/cashier/contexts/CashRegisterContext";
import { useDevices } from "@/cashier/contexts/DevicesContext";
import { useAuth } from "@/lib/auth/AuthContext";
import { fetchSaleByInvoiceNo } from "@/lib/sales/api";
import type { SaleTx } from "@/cashier/contexts/SalesContext";
import type { CoverageItem } from "@/lib/warranty/lookup";
import {
  RESOLUTIONS, REPLACE_TO, REFUND_TO, createDeviceClaim, updateDeviceClaim, refundDeviceClaim, previewInvoiceRefund,
  type DeviceClaim, type DeviceClaimResolution, type RefundMethod, type RefundSplit, type ClaimGroup,
} from "@/lib/warranty/deviceClaims";
import ReplaceDeviceModal from "@/cashier/components/sales/ReplaceDeviceModal";

/**
 * A warranty claim on a phone the shop sold.
 *
 * The cashier records what is wrong, then picks how it is settled. Each
 * choice also decides where the faulty phone goes, so nobody has to answer
 * that twice:
 *   Repair at the shop               — a free warranty repair job for the bench
 *   Return to company · new phone    — replacement from stock; faulty phone to the company
 *   Return to company · refund       — price refunded; faulty phone to the company
 *   Return to company · wait         — the company repairs it; tracked until back
 *   Replace · back in the rack       — replacement from stock; returned phone into stock
 *   Full cash refund                 — price paid back in cash; phone into stock
 */

const ff = "'Plus Jakarta Sans', sans-serif";
const rs = (n: number) => `Rs. ${Math.round(n).toLocaleString("en-LK")}`;
const ICON: Record<DeviceClaimResolution, typeof Wrench> = {
  repair_shop: Wrench, company_replace: Truck, company_refund: Undo2, repair_company: Building2, replace: Repeat, refund: Banknote,
};

const GROUPS: { id: ClaimGroup; title: string; sub: string; color: string; icon: typeof Wrench }[] = [
  { id: "shop",    title: "Fix it here",           sub: "Our bench repairs it",                        color: "#3b82f6", icon: Wrench },
  { id: "company", title: "Return to the company", sub: "The faulty phone goes back to the supplier",  color: "#8b5cf6", icon: Truck },
  { id: "stock",   title: "Keep it in the shop",   sub: "The returned phone goes back into stock",     color: "#10b981", icon: PackageCheck },
];

/** Entry, hover and select motion for the claim window. Respects reduced motion. */
const MOTION = `
@keyframes pcIn { from { opacity: 0; transform: translateY(8px) scale(0.985); } to { opacity: 1; transform: none; } }
@keyframes pcModal { from { opacity: 0; transform: translateY(14px) scale(0.97); } to { opacity: 1; transform: none; } }
@keyframes pcPop { 0% { transform: scale(0); } 60% { transform: scale(1.25); } 100% { transform: scale(1); } }
@keyframes pcDetail { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }
.pc-modal { animation: pcModal 0.32s cubic-bezier(0.22, 1, 0.36, 1) both; }
.pc-in { animation: pcIn 0.4s cubic-bezier(0.22, 1, 0.36, 1) both; }
.pc-opt { transition: transform 0.18s ease, box-shadow 0.2s ease, border-color 0.2s ease, background 0.25s ease; }
.pc-opt:hover { transform: translateY(-2px); border-color: var(--c) !important; box-shadow: 0 10px 24px rgba(0,0,0,0.08); }
.pc-opt:active { transform: translateY(0) scale(0.985); }
.pc-opt .pc-ico { transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.25s, color 0.25s; }
.pc-opt:hover .pc-ico, .pc-on .pc-ico { transform: scale(1.08) rotate(-4deg); }
.pc-check { animation: pcPop 0.32s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
.pc-detail { animation: pcDetail 0.3s cubic-bezier(0.22, 1, 0.36, 1) both; }
@media (prefers-reduced-motion: reduce) {
  .pc-modal, .pc-in, .pc-check, .pc-detail { animation: none; }
  .pc-opt, .pc-opt .pc-ico { transition: none; }
  .pc-opt:hover, .pc-opt:hover .pc-ico, .pc-on .pc-ico { transform: none; }
}
`;

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
  // Where the faulty phone goes follows from the kind of claim.
  const refundTo = resolution ? REFUND_TO[resolution] : undefined;
  const replaceTo = resolution ? REPLACE_TO[resolution] : undefined;
  const isRefund = !!refundTo;
  // "Full cash refund" is cash by definition; a company refund can go back any way.
  const cashOnly = resolution === "refund";
  const payMethod: RefundMethod = cashOnly ? "Cash" : method;

  useEffect(() => {
    if (!isRefund || !item.invoiceNo) return;
    let live = true;
    previewInvoiceRefund(item.invoiceNo, refundAmount).then(s => { if (live) setSplit(s); });
    return () => { live = false; };
  }, [isRefund, item.invoiceNo, refundAmount]);
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

      if (replaceTo) {
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
      const done = await refundDeviceClaim(claim.id, refundTo ?? "resell", refundAmount, payMethod);
      if (done.payout > 0.005 && payMethod === "Cash") {
        addEntry("out", `Warranty refund — ${item.invoiceNo} (${claim.id})`, done.payout);
      }
      void reloadDevices();
      const parts = [
        done.credit > 0.005 ? `${rs(done.credit)} taken off their credit balance` : "",
        done.payout > 0.005
          ? payMethod === "Cash" ? `${rs(done.payout)} paid back in cash — take it from the drawer`
            : `${rs(done.payout)} to be paid back by ${payMethod.toLowerCase()}`
          : "",
      ].filter(Boolean);
      onDone(
        { ...claim, status: "Completed", refundAmount, refundCreditAmount: done.credit, refundMethod: done.payout > 0.005 ? payMethod : null },
        `Claim ${claim.id} refunded — ${parts.join("; ")}. The phone ${refundTo === "resell" ? "is back in stock" : "is set aside to return to the company"}.`,
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
        presetDisposition={replaceTo}
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
      <style>{MOTION}</style>
      <div className="pc-modal" style={{ width: "min(720px, calc(100vw - 24px))", maxHeight: "calc(100vh - 32px)", display: "flex", flexDirection: "column", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 18, overflow: "hidden", fontFamily: ff, boxShadow: "0 30px 80px rgba(0,0,0,0.45)" }}>
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
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {GROUPS.map((g, gi) => {
                const GroupIcon = g.icon;
                const groupOn = RESOLUTIONS.some(r => r.group === g.id && r.id === resolution);
                return (
                  <div key={g.id} className="pc-in" style={{ animationDelay: `${gi * 70}ms` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8 }}>
                      <span style={{
                        width: 24, height: 24, borderRadius: 7, display: "grid", placeItems: "center", flexShrink: 0,
                        background: `${g.color}1a`, border: `1px solid ${g.color}40`, transition: "transform 0.25s",
                        transform: groupOn ? "scale(1.08)" : undefined,
                      }}>
                        <GroupIcon size={13} color={g.color} />
                      </span>
                      <span style={{ fontSize: 12.5, fontWeight: 800, color: "var(--text-primary)" }}>{g.title}</span>
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{g.sub}</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 9 }}>
                      {RESOLUTIONS.filter(r => r.group === g.id).map((r, i) => {
                        const Icon = ICON[r.id];
                        const on = resolution === r.id;
                        return (
                          <button
                            key={r.id} type="button" onClick={() => setResolution(r.id)}
                            className={`pc-opt pc-in${on ? " pc-on" : ""}`}
                            aria-pressed={on}
                            style={{
                              ["--c" as string]: g.color,
                              animationDelay: `${gi * 70 + (i + 1) * 45}ms`,
                              position: "relative", display: "flex", gap: 11, alignItems: "flex-start",
                              textAlign: "left", padding: "13px 13px 13px 12px", borderRadius: 14, cursor: "pointer", fontFamily: ff,
                              border: `1.5px solid ${on ? g.color : "var(--border)"}`,
                              background: on ? `linear-gradient(135deg, ${g.color}1f, ${g.color}08)` : "var(--bg-card)",
                              boxShadow: on ? `0 8px 22px ${g.color}26, 0 0 0 3px ${g.color}1a` : "0 1px 2px rgba(0,0,0,0.04)",
                            } as React.CSSProperties}
                          >
                            <span className="pc-ico" style={{
                              width: 36, height: 36, borderRadius: 11, flexShrink: 0, display: "grid", placeItems: "center",
                              background: on ? g.color : `${g.color}14`, color: on ? "#fff" : g.color,
                            }}>
                              <Icon size={17} />
                            </span>
                            <span style={{ flex: 1, minWidth: 0, paddingRight: 16 }}>
                              <span style={{ display: "block", fontSize: 13, fontWeight: 800, color: on ? g.color : "var(--text-primary)", transition: "color 0.2s" }}>{r.label}</span>
                              <span style={{ display: "block", fontSize: 11, color: "var(--text-muted)", marginTop: 3, lineHeight: 1.45 }}>{r.blurb}</span>
                            </span>
                            {on && (
                              <span className="pc-check" style={{ position: "absolute", top: 9, right: 9, width: 18, height: 18, borderRadius: 99, background: g.color, display: "grid", placeItems: "center" }}>
                                <Check size={11} color="#fff" strokeWidth={3} />
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Per resolution — keyed so each choice slides its details in. */}
          <div key={resolution || "none"} className="pc-detail" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
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

          {replaceTo && (
            <div style={note("var(--accent)")}>
              The replacement window opens next with this phone and fault filled in — pick the unit to hand over.
              The faulty phone {replaceTo === "resell" ? <b>goes back into stock</b> : <b>is set aside to return to the company</b>}. Any price difference is handled there.
            </div>
          )}

          {isRefund && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", borderRadius: 12, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)" }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-secondary)" }}>Full refund — the price paid</span>
                <span style={{ fontSize: 20, fontWeight: 800, color: "#dc2626" }}>{rs(refundAmount)}</span>
              </div>
              <div style={note(refundTo === "resell" ? "#16a34a" : "#7c3aed")}>
                The phone that comes back {refundTo === "resell" ? <b>goes back into stock</b> : <b>is set aside to return to the company</b>}.
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

              {payoutPart > 0.005 && cashOnly ? (
                <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>Paid back in cash, taken out of the cash drawer.</div>
              ) : payoutPart > 0.005 ? (
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
          </div>

          {resolution && !replaceTo && (
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
            background: ready ? (isRefund ? "#dc2626" : "var(--accent)") : "var(--border)",
            color: ready ? "#fff" : "var(--text-muted)", cursor: ready ? "pointer" : "not-allowed",
          }}>
            {busy ? "Working…"
              : !reported ? "Describe the fault"
              : !resolution ? "Choose how it is settled"
              : resolution === "repair_shop" ? "Open warranty repair job"
              : resolution === "repair_company" ? (company.trim() ? "Record as sent to company" : "Name the company")
              : replaceTo ? "Continue to replacement"
              : payoutPart > 0.005 ? `Refund ${rs(refundAmount)} · ${rs(payoutPart)} by ${payMethod}` : `Refund ${rs(refundAmount)} off credit`}
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
