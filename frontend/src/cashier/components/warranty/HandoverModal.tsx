"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { X, Truck, ShieldCheck, CheckCircle } from "lucide-react";
import { useRepair, type RepairJob, type HandoverRecord } from "@/cashier/contexts/RepairContext";
import { useWarranty } from "@/cashier/contexts/WarrantyContext";
import SignaturePad from "@/cashier/components/shared/SignaturePad";

const ff = "'Plus Jakarta Sans', sans-serif";
const STAFF = "Cashier";

const labelSt: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.08em",
  textTransform: "uppercase", display: "block", marginBottom: 5, fontFamily: ff,
};
const inputSt: React.CSSProperties = {
  width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)",
  background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 12.5, outline: "none",
  fontFamily: ff, boxSizing: "border-box",
};

export default function HandoverModal({ job, onClose, onDone }: {
  job: RepairJob;
  onClose: () => void;
  onDone: () => void;
}) {
  const { updateJob } = useRepair();
  const { getWarrantyForJob, activateWarranty } = useWarranty();
  const warranty = getWarrantyForJob(job.id);

  const balance = Math.max(0, job.estimatedCost - job.advancePaid);
  const [isOwner, setIsOwner]         = useState(true);
  const [collectedBy, setCollectedBy] = useState(job.customerName);
  const [relationship, setRelationship] = useState("");
  const [idVerified, setIdVerified]   = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<HandoverRecord["paymentMethod"]>("Cash");
  const [paidNow, setPaidNow]         = useState(String(balance));
  const [overrideReason, setOverrideReason] = useState("");
  const [returned, setReturned]       = useState<Set<string>>(new Set(job.receivedItems ?? []));
  const [signature, setSignature]     = useState("");
  const [done, setDone]               = useState(false);

  const effectivePaid = parseFloat(paidNow) || 0;
  const balanceCleared = effectivePaid >= balance;
  const overrideOk     = overrideReason.trim().length > 3;
  const canConfirm = signature.trim() !== "" && idVerified && (balanceCleared || overrideOk);

  const toggleItem = (item: string) =>
    setReturned(prev => { const n = new Set(prev); n.has(item) ? n.delete(item) : n.add(item); return n; });

  const confirm = () => {
    if (!canConfirm) return;
    const nowISO = new Date().toISOString();
    const handover: HandoverRecord = {
      collectedBy: isOwner ? job.customerName : collectedBy,
      relationship: isOwner ? "Owner" : relationship || "Authorized",
      idVerified,
      balanceSettled: effectivePaid,
      paymentMethod,
      releaseWithBalanceOverride: !balanceCleared ? { approvedByStaff: STAFF, reason: overrideReason.trim() } : undefined,
      handoverSignature: signature,
      warrantyCardIssued: !!warranty,
      handedOverBy: STAFF,
      handedOverAt: nowISO,
    };
    updateJob(job.id, { status: "Delivered", advancePaid: job.advancePaid + effectivePaid, handover });
    // Activate the warranty — the clock starts NOW, on collection. Fire-and-
    // forget like updateJob above: the handover confirmation the user is
    // waiting on doesn't block on this, a failure is just logged.
    if (job.warrantyId) {
      activateWarranty(job.warrantyId, nowISO)
        .catch(err => console.error(`Could not activate warranty ${job.warrantyId}:`, err));
    }
    setDone(true);
    setTimeout(onDone, 1300);
  };

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 1100, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(5px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, width: "min(560px, calc(100vw - 24px))", maxHeight: "92vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,0.55)" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "13px 18px", borderBottom: "1px solid var(--border)", background: "var(--bg-secondary)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(167,139,250,0.12)", border: "1px solid rgba(167,139,250,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Truck size={14} color="#a78bfa" />
            </div>
            <div>
              <p style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>Device Handover</p>
              <p style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: ff }}>{job.id} · {job.brand} {job.model}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={14} /></button>
        </div>

        {done ? (
          <div style={{ padding: "40px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
            <CheckCircle size={48} color="#a78bfa" />
            <p style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>Device Handed Over</p>
            <p style={{ fontSize: 12.5, color: "var(--text-muted)", fontFamily: ff, textAlign: "center" }}>
              Job marked Delivered{warranty ? ` · Warranty ${warranty.id} is now active` : ""}.
            </p>
          </div>
        ) : (
          <>
            <div style={{ padding: "16px 18px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 14 }}>

              {/* Payment */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 9 }}>
                {[
                  { k: "Total", v: `Rs. ${job.estimatedCost.toLocaleString()}`, c: "var(--text-primary)" },
                  { k: "Advance", v: `Rs. ${job.advancePaid.toLocaleString()}`, c: "#4ade80" },
                  { k: "Balance", v: `Rs. ${balance.toLocaleString()}`, c: balance > 0 ? "#f87171" : "#4ade80" },
                ].map(x => (
                  <div key={x.k} style={{ background: "var(--bg-primary)", border: "1px solid var(--border)", borderRadius: 9, padding: "9px 11px", textAlign: "center" }}>
                    <p style={{ fontSize: 9.5, color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4, fontFamily: ff }}>{x.k}</p>
                    <p style={{ fontSize: 13, fontWeight: 700, color: x.c, fontFamily: ff }}>{x.v}</p>
                  </div>
                ))}
              </div>

              {balance > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <label style={labelSt}>Collect Now (Rs.)</label>
                    <input type="number" min={0} value={paidNow} onChange={e => setPaidNow(e.target.value)} style={inputSt} />
                  </div>
                  <div>
                    <label style={labelSt}>Payment Method</label>
                    <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as HandoverRecord["paymentMethod"])} style={{ ...inputSt, cursor: "pointer" }}>
                      {["Cash", "Card", "Bank Transfer", "Online"].map(m => <option key={m}>{m}</option>)}
                    </select>
                  </div>
                </div>
              )}

              {balance > 0 && !balanceCleared && (
                <div>
                  <label style={labelSt}>⚠ Release-with-balance override reason</label>
                  <input value={overrideReason} onChange={e => setOverrideReason(e.target.value)} placeholder="Reason for releasing before full payment…" style={{ ...inputSt, borderColor: "rgba(251,191,36,0.5)" }} />
                </div>
              )}

              {/* Collector */}
              <div>
                <label style={labelSt}>Collected By</label>
                <div style={{ display: "flex", gap: 8, marginBottom: isOwner ? 0 : 8 }}>
                  {[{ k: true, l: "Owner" }, { k: false, l: "Someone else" }].map(o => (
                    <button key={o.l} onClick={() => setIsOwner(o.k)} style={{
                      flex: 1, padding: "8px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                      border: `1px solid ${isOwner === o.k ? "var(--accent)" : "var(--border)"}`,
                      background: isOwner === o.k ? "var(--accent-dim)" : "transparent",
                      color: isOwner === o.k ? "var(--accent)" : "var(--text-secondary)", cursor: "pointer", fontFamily: ff,
                    }}>{o.l}</button>
                  ))}
                </div>
                {!isOwner && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 8 }}>
                    <input value={collectedBy} onChange={e => setCollectedBy(e.target.value)} placeholder="Collector name" style={inputSt} />
                    <input value={relationship} onChange={e => setRelationship(e.target.value)} placeholder="Relationship + NIC" style={inputSt} />
                  </div>
                )}
              </div>

              {/* Returned items */}
              {(job.receivedItems?.length ?? 0) > 0 && (
                <div>
                  <label style={labelSt}>Items Returned With Device</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {job.receivedItems!.map(item => {
                      const on = returned.has(item);
                      return (
                        <button key={item} onClick={() => toggleItem(item)} style={{
                          display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 7, fontSize: 11.5,
                          border: `1px solid ${on ? "var(--accent)" : "var(--border)"}`, background: on ? "var(--accent-dim)" : "transparent",
                          color: on ? "var(--accent)" : "var(--text-muted)", cursor: "pointer", fontFamily: ff,
                        }}>{on ? "✓" : "○"} {item}</button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ID + Warranty note */}
              <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 9, border: `1px solid ${idVerified ? "rgba(74,222,128,0.3)" : "var(--border)"}`, background: idVerified ? "rgba(74,222,128,0.05)" : "var(--bg-primary)", cursor: "pointer" }}>
                <div onClick={() => setIdVerified(v => !v)} style={{ width: 18, height: 18, borderRadius: 5, border: `2px solid ${idVerified ? "#4ade80" : "var(--border)"}`, background: idVerified ? "#4ade80" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {idVerified && <span style={{ color: "#000", fontSize: 11, fontWeight: 700 }}>✓</span>}
                </div>
                <span style={{ fontSize: 12, color: idVerified ? "#4ade80" : "var(--text-secondary)", fontFamily: ff }}>Identity verified — handing to the rightful collector</span>
              </label>

              {warranty && (
                <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "10px 12px", borderRadius: 9, background: "rgba(167,139,250,0.07)", border: "1px solid rgba(167,139,250,0.25)" }}>
                  <ShieldCheck size={14} color="#a78bfa" style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: 11.5, color: "var(--text-secondary)", fontFamily: ff }}>
                    Warranty <strong style={{ color: "#a78bfa" }}>{warranty.id}</strong> ({warranty.durationDays} days, {warranty.scope}) will <strong>activate now</strong> and a warranty card will be issued.
                  </span>
                </div>
              )}

              <SignaturePad value={signature} onChange={setSignature} height={120} label="Customer Handover Signature *" />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "12px 18px", borderTop: "1px solid var(--border)", background: "var(--bg-secondary)", flexShrink: 0 }}>
              <button onClick={onClose} style={{ padding: "8px 18px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer", fontFamily: ff }}>Cancel</button>
              <button onClick={confirm} disabled={!canConfirm} style={{
                display: "flex", alignItems: "center", gap: 6, padding: "8px 18px", borderRadius: 8, fontSize: 12, fontWeight: 700,
                border: "1px solid #a78bfa", background: canConfirm ? "#a78bfa" : "var(--border)",
                color: canConfirm ? "#fff" : "var(--text-muted)", cursor: canConfirm ? "pointer" : "not-allowed", fontFamily: ff,
              }}><Truck size={13} /> Confirm Handover</button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
