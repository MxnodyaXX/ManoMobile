"use client";

import { useState, useRef, useMemo } from "react";
import { useIsMobile } from "@/cashier/hooks/useIsMobile";
import { useCashRegister } from "@/cashier/contexts/CashRegisterContext";
import ExportButtons from "@/cashier/components/shared/ExportButtons";
import { exportToPdf, exportToExcel, exportToPng } from "@/cashier/utils/exportUtils";
import { useRepair } from "@/cashier/contexts/RepairContext";
import type { JobStatus, RepairJob } from "@/cashier/contexts/RepairContext";
export type { JobStatus, RepairJob } from "@/cashier/contexts/RepairContext";
import { createPortal } from "react-dom";
import {
  Search, Filter, ChevronDown, MoreHorizontal,
  CheckCircle, Clock, AlertCircle, XCircle, Wrench,
  X, CheckSquare, Send, Printer, ShieldCheck, CreditCard,
  Truck, Ban, FileText, Package,
} from "lucide-react";

interface FinishJobData {
  actionTaken: string;
  checkedBy: string[];
  jobStatus: JobStatus;
  advance: number;
  totalPrice: number;
  partsCost: number;
  warranty: string;
}

interface IssueInvoiceData {
  job: RepairJob;
  name: string;
  phone: string;
  nic: string;
  email: string;
  imei: string;
  discount: number;
  paidAmount: number;
  dueAmount: number;
  isCredit: boolean;
  adminApprover: string;
  warranty: string;
  invoiceNo: string;
  createdAt: string;
}


// ─── Config ───────────────────────────────────────────────────────────────────

const statusConfig: Record<JobStatus, { color: string; bg: string; border: string; icon: any }> = {
  "Non-Issued": { color: "#94a3b8", bg: "rgba(148,163,184,0.08)", border: "rgba(148,163,184,0.2)", icon: Clock },
  "Issued":     { color: "#60a5fa", bg: "rgba(96,165,250,0.08)",  border: "rgba(96,165,250,0.2)",  icon: Wrench },
  "Pending":    { color: "#fbbf24", bg: "rgba(251,191,36,0.08)",  border: "rgba(251,191,36,0.2)",  icon: AlertCircle },
  "Completed":  { color: "#4ade80", bg: "rgba(74,222,128,0.08)",  border: "rgba(74,222,128,0.2)",  icon: CheckCircle },
  "Delivered":  { color: "#a78bfa", bg: "rgba(167,139,250,0.08)", border: "rgba(167,139,250,0.2)", icon: Truck },
  "Cancelled":  { color: "#f87171", bg: "rgba(248,113,113,0.08)", border: "rgba(248,113,113,0.2)", icon: XCircle },
};

const priorityColor: Record<string, string> = {
  Low: "#94a3b8", Normal: "#60a5fa", High: "#fbbf24", Urgent: "#f87171",
};

const labelSt: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, color: "var(--text-muted)",
  letterSpacing: "0.08em", textTransform: "uppercase",
  display: "block", marginBottom: 5,
  fontFamily: "'Plus Jakarta Sans', sans-serif",
};

const inputSt: React.CSSProperties = {
  width: "100%", padding: "8px 10px", borderRadius: 8,
  border: "1px solid var(--border)", background: "var(--bg-primary)",
  color: "var(--text-primary)", fontSize: 12, outline: "none",
  fontFamily: "'Plus Jakarta Sans', sans-serif", boxSizing: "border-box",
};

const invTd: React.CSSProperties = {
  padding: "4px 7px", border: "1px solid #ccc", fontSize: 10.5, fontStyle: "italic",
};

const CANCEL_REASONS = [
  "Customer cancelled — changed mind",
  "Customer cancelled — no budget",
  "Parts unavailable",
  "Customer no-show",
  "Device beyond repair",
  "Duplicate entry",
  "Other",
];

// ─── Shared block ─────────────────────────────────────────────────────────────

function InfoBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--bg-primary)", border: "1px solid var(--border)", borderRadius: 9, padding: "10px 12px" }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 5, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        {label}
      </div>
      {children}
    </div>
  );
}

// ─── Intake Slip Modal ────────────────────────────────────────────────────────

function IntakeSlipModal({ job, onClose }: { job: RepairJob; onClose: () => void }) {
  const slipRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    if (!slipRef.current) return;
    const el = document.createElement("div");
    el.id = "__slip__";
    el.innerHTML = slipRef.current.outerHTML;
    document.body.appendChild(el);
    const st = document.createElement("style");
    st.id = "__slip_style__";
    st.textContent = `
      @page { size: A5 portrait; margin: 10mm; }
      #__slip__ { display: none; }
      @media print {
        body { visibility: hidden; }
        #__slip__ { display: block !important; visibility: visible; position: fixed; top: 0; left: 0; width: 100%; }
        #__slip__ * { visibility: visible; }
      }
    `;
    document.head.appendChild(st);
    window.print();
    setTimeout(() => {
      document.getElementById("__slip__")?.remove();
      document.getElementById("__slip_style__")?.remove();
    }, 500);
  };

  const d = new Date(job.createdAt);

  if (typeof document === "undefined") return null;
  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 1010, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, width: "min(620px, calc(100vw - 24px))", maxHeight: "90vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,0.55)" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 18px", borderBottom: "1px solid var(--border)", background: "var(--bg-secondary)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <FileText size={15} color="var(--accent)" />
            <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              Job Intake Slip — {job.id}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handlePrint} style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 14px", borderRadius: 7, fontSize: 11, fontWeight: 600, border: "1px solid var(--accent)", background: "var(--accent)", color: "var(--accent-fg)", cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              <Printer size={12} /> Print Slip
            </button>
            <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <X size={14} />
            </button>
          </div>
        </div>

        <div style={{ overflowY: "auto", padding: 20 }}>
          <div ref={slipRef} style={{ background: "#ffffff", padding: "28px 32px", fontFamily: "Arial, Helvetica, sans-serif", color: "#000", fontSize: 11 }}>

            <div style={{ textAlign: "center", borderBottom: "2px solid #000", paddingBottom: 12, marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontWeight: 900, fontSize: 18, letterSpacing: "0.05em" }}>MANO MOBILE CENTRE</h2>
              <p style={{ margin: "4px 0 0", fontSize: 10, color: "#555" }}>Repair Intake Job Card</p>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14, gap: 20 }}>
              <div style={{ flex: 1 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10.5 }}>
                  <tbody>
                    {[
                      ["Job ID", job.id],
                      ["Date", `${d.toLocaleDateString("en-US", { weekday: "short", year: "numeric", month: "short", day: "numeric" })}`],
                      ["Dealer", job.dealer || "MANO MOBILE"],
                      ["Priority", job.priority],
                    ].map(([k, v]) => (
                      <tr key={k}>
                        <td style={{ padding: "3px 8px 3px 0", fontWeight: 700, whiteSpace: "nowrap", width: 80 }}>{k}:</td>
                        <td style={{ padding: "3px 0" }}>{v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ border: "1px solid #000", padding: "6px 12px", textAlign: "center", minWidth: 110 }}>
                <p style={{ fontSize: 9, fontWeight: 700, marginBottom: 4 }}>EST. COMPLETION</p>
                <p style={{ fontSize: 12, fontWeight: 700 }}>{job.estimatedCompletion}</p>
              </div>
            </div>

            <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #999", marginBottom: 12, fontSize: 10.5 }}>
              <thead>
                <tr style={{ background: "#f0f0f0" }}>
                  <th colSpan={2} style={{ padding: "5px 8px", borderBottom: "1px solid #999", textAlign: "left", fontWeight: 700 }}>CUSTOMER INFORMATION</th>
                  <th colSpan={2} style={{ padding: "5px 8px", borderBottom: "1px solid #999", borderLeft: "1px solid #999", textAlign: "left", fontWeight: 700 }}>DEVICE INFORMATION</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: "3px 8px", fontWeight: 700, width: 80 }}>Name</td>
                  <td style={{ padding: "3px 8px", borderRight: "1px solid #999" }}>{job.customerName}</td>
                  <td style={{ padding: "3px 8px", fontWeight: 700, width: 70 }}>Model</td>
                  <td style={{ padding: "3px 8px" }}>{job.brand} {job.model}</td>
                </tr>
                <tr style={{ background: "#fafafa" }}>
                  <td style={{ padding: "3px 8px", fontWeight: 700 }}>Contact</td>
                  <td style={{ padding: "3px 8px", borderRight: "1px solid #999" }}>{job.phone}</td>
                  <td style={{ padding: "3px 8px", fontWeight: 700 }}>IMEI</td>
                  <td style={{ padding: "3px 8px", fontFamily: "monospace" }}>{job.imei || "—"}</td>
                </tr>
                <tr>
                  <td style={{ padding: "3px 8px", fontWeight: 700 }}>Technician</td>
                  <td style={{ padding: "3px 8px", borderRight: "1px solid #999" }}>{job.technician}</td>
                  <td style={{ padding: "3px 8px", fontWeight: 700 }}>Fault</td>
                  <td style={{ padding: "3px 8px" }}>{job.issue}</td>
                </tr>
              </tbody>
            </table>

            <div style={{ marginBottom: 12 }}>
              <p style={{ fontWeight: 700, marginBottom: 5, fontSize: 10.5 }}>ITEMS RECEIVED WITH DEVICE:</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {["SIM Card", "Back Cover", "Charger", "Data Cable", "Earphones", "Memory Card", "Battery"].map(item => {
                  const has = (job.receivedItems || []).includes(item);
                  return (
                    <span key={item} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, border: "1px solid #ccc", padding: "2px 8px", borderRadius: 4 }}>
                      <span style={{ display: "inline-block", width: 10, height: 10, border: "1px solid #666", background: has ? "#000" : "#fff", borderRadius: 2 }} />
                      {item}
                    </span>
                  );
                })}
              </div>
            </div>

            <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #999", marginBottom: 14, fontSize: 10.5 }}>
              <tbody>
                <tr style={{ background: "#f0f0f0" }}>
                  <th style={{ padding: "4px 8px", textAlign: "left", fontWeight: 700 }}>Estimated Cost</th>
                  <th style={{ padding: "4px 8px", textAlign: "left", fontWeight: 700, borderLeft: "1px solid #999" }}>Advance Paid</th>
                  <th style={{ padding: "4px 8px", textAlign: "left", fontWeight: 700, borderLeft: "1px solid #999" }}>Balance Due</th>
                </tr>
                <tr>
                  <td style={{ padding: "4px 8px" }}>Rs. {job.estimatedCost.toLocaleString()}</td>
                  <td style={{ padding: "4px 8px", borderLeft: "1px solid #999" }}>Rs. {job.advancePaid.toLocaleString()}</td>
                  <td style={{ padding: "4px 8px", borderLeft: "1px solid #999", fontWeight: 700 }}>Rs. {(job.estimatedCost - job.advancePaid).toLocaleString()}</td>
                </tr>
              </tbody>
            </table>

            <div style={{ borderTop: "1px dashed #999", paddingTop: 10, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
              <div>
                <p style={{ fontSize: 9, color: "#666", maxWidth: 260, lineHeight: 1.4 }}>
                  Please keep this slip safe. Present it when collecting your device. Mano Mobile is not responsible for pre-existing damage not noted at intake.
                </p>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ borderTop: "1px solid #000", width: 120, marginBottom: 4 }} />
                <p style={{ fontSize: 9, fontWeight: 700 }}>Customer Signature</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Cancel Job Modal ─────────────────────────────────────────────────────────

function CancelJobModal({ job, onClose, onCancel }: {
  job: RepairJob;
  onClose: () => void;
  onCancel: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [custom, setCustom] = useState("");

  const finalReason = reason === "Other" ? custom.trim() : reason;
  const canSubmit = reason !== "" && (reason !== "Other" || custom.trim() !== "");

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 1010, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "var(--bg-card)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: 14, width: "min(480px, calc(100vw - 24px))", boxShadow: "0 24px 64px rgba(0,0,0,0.55)", display: "flex", flexDirection: "column", overflow: "hidden" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderBottom: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Ban size={14} color="#f87171" />
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Cancel Job</p>
              <p style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{job.id} · {job.brand} {job.model} · {job.customerName}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={14} />
          </button>
        </div>

        <div style={{ padding: "18px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ padding: "12px 14px", borderRadius: 10, background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.2)" }}>
            <p style={{ fontSize: 12, color: "#f87171", fontFamily: "'Plus Jakarta Sans', sans-serif", lineHeight: 1.5 }}>
              ⚠ This action will permanently cancel the job. If an advance was paid, ensure it is refunded and recorded separately.
            </p>
          </div>

          <div>
            <label style={labelSt}>Cancellation Reason *</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {CANCEL_REASONS.map(r => (
                <label key={r} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 8, border: `1px solid ${reason === r ? "rgba(248,113,113,0.4)" : "var(--border)"}`, background: reason === r ? "rgba(248,113,113,0.06)" : "transparent", cursor: "pointer", transition: "all 0.15s" }}>
                  <div style={{ width: 14, height: 14, borderRadius: "50%", border: `2px solid ${reason === r ? "#f87171" : "var(--border)"}`, background: reason === r ? "#f87171" : "transparent", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {reason === r && <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#fff" }} />}
                  </div>
                  <span onClick={() => setReason(r)} style={{ fontSize: 12.5, color: reason === r ? "#f87171" : "var(--text-secondary)", fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: reason === r ? 600 : 400 }}>{r}</span>
                </label>
              ))}
            </div>
          </div>

          {reason === "Other" && (
            <div>
              <label style={labelSt}>Custom Reason</label>
              <textarea value={custom} onChange={e => setCustom(e.target.value)} placeholder="Describe the reason for cancellation..."
                style={{ ...inputSt, resize: "vertical", minHeight: 72 }} />
            </div>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "12px 18px", borderTop: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
          <button onClick={onClose} style={{ padding: "8px 18px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            Keep Job
          </button>
          <button onClick={() => canSubmit && onCancel(finalReason)} disabled={!canSubmit}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 18px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "1px solid #f87171", background: "#f87171", color: "#fff", cursor: canSubmit ? "pointer" : "not-allowed", opacity: canSubmit ? 1 : 0.45, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            <Ban size={12} /> Cancel Job
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Pickup Confirm Modal ─────────────────────────────────────────────────────

function PickupModal({ job, onClose, onConfirm }: {
  job: RepairJob;
  onClose: () => void;
  onConfirm: (paidNow: number) => void;
}) {
  const balance = job.estimatedCost - job.advancePaid;
  const [paidNow, setPaidNow] = useState(balance.toString());
  const [idVerified, setIdVerified] = useState(false);
  const effectivePaid = parseFloat(paidNow) || 0;
  const remaining = Math.max(0, balance - effectivePaid);
  const canConfirm = idVerified && effectivePaid >= balance;

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 1010, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "var(--bg-card)", border: "1px solid rgba(167,139,250,0.3)", borderRadius: 14, width: "min(480px, calc(100vw - 24px))", boxShadow: "0 24px 64px rgba(0,0,0,0.55)", display: "flex", flexDirection: "column", overflow: "hidden" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderBottom: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Truck size={14} color="#a78bfa" />
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Device Pickup</p>
              <p style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{job.id} · {job.brand} {job.model}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={14} />
          </button>
        </div>

        <div style={{ padding: "18px", display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Customer summary */}
          <div style={{ background: "var(--bg-primary)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px" }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "'Plus Jakarta Sans', sans-serif", marginBottom: 8 }}>Customer</p>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{job.customerName}</p>
                <p style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{job.phone}</p>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>{job.brand} {job.model}</p>
                {job.jobWarranty && <p style={{ fontSize: 11, color: "#4ade80", fontWeight: 600 }}>{job.jobWarranty}</p>}
              </div>
            </div>
          </div>

          {/* Balance */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            {[
              { label: "Total Cost", value: `Rs. ${job.estimatedCost.toLocaleString()}`, color: "var(--text-primary)" },
              { label: "Advance Paid", value: `Rs. ${job.advancePaid.toLocaleString()}`, color: "#4ade80" },
              { label: "Balance Due", value: `Rs. ${balance.toLocaleString()}`, color: balance > 0 ? "#f87171" : "#4ade80" },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ background: "var(--bg-primary)", border: "1px solid var(--border)", borderRadius: 9, padding: "10px 12px", textAlign: "center" }}>
                <p style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 5, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{label}</p>
                <p style={{ fontSize: 13, fontWeight: 700, color, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{value}</p>
              </div>
            ))}
          </div>

          {balance > 0 && (
            <div>
              <label style={labelSt}>Amount Collected Now (Rs.)</label>
              <input type="number" min={0} value={paidNow} onChange={e => setPaidNow(e.target.value)} style={inputSt} />
              {remaining > 0 && (
                <p style={{ fontSize: 11, color: "#fbbf24", marginTop: 5, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  ⚠ Remaining due: Rs. {remaining.toLocaleString()} — this will become a credit balance.
                </p>
              )}
            </div>
          )}

          {/* ID verification */}
          <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 10, border: `1px solid ${idVerified ? "rgba(74,222,128,0.3)" : "var(--border)"}`, background: idVerified ? "rgba(74,222,128,0.05)" : "var(--bg-primary)", cursor: "pointer", transition: "all 0.15s" }}>
            <div onClick={() => setIdVerified(v => !v)} style={{ width: 18, height: 18, borderRadius: 5, border: `2px solid ${idVerified ? "#4ade80" : "var(--border)"}`, background: idVerified ? "#4ade80" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s" }}>
              {idVerified && <span style={{ color: "#000", fontSize: 11, fontWeight: 700 }}>✓</span>}
            </div>
            <span style={{ fontSize: 12.5, color: idVerified ? "#4ade80" : "var(--text-secondary)", fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: idVerified ? 600 : 400 }}>
              Customer identity verified — device handed over to rightful owner
            </span>
          </label>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "12px 18px", borderTop: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
          <button onClick={onClose} style={{ padding: "8px 18px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            Cancel
          </button>
          <button onClick={() => canConfirm && onConfirm(effectivePaid)} disabled={!canConfirm}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 18px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "1px solid #a78bfa", background: "#a78bfa", color: "#fff", cursor: canConfirm ? "pointer" : "not-allowed", opacity: canConfirm ? 1 : 0.45, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            <Truck size={12} /> Confirm Pickup
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Job Details Modal ────────────────────────────────────────────────────────

function JobDetailsModal({ job, onClose, onFinishJob, onIssueJob, onCancelJob, onPickup, onPrintSlip }: {
  job: RepairJob;
  onClose: () => void;
  onFinishJob: () => void;
  onIssueJob: () => void;
  onCancelJob: () => void;
  onPickup: () => void;
  onPrintSlip: () => void;
}) {
  const isMobile = useIsMobile();

  const sc      = statusConfig[job.status];
  const StatusIcon = sc.icon;
  const balance = job.estimatedCost - job.advancePaid;

  const d = new Date(job.createdAt);
  const dayName   = d.toLocaleDateString("en-US", { weekday: "long" });
  const monthName = d.toLocaleDateString("en-US", { month: "long" });

  const faultRows = [
    ["Display",   "Touch pad",   "Software",        "No signal",       "Mic fault",       "Speaker"],
    ["Key pad",   "Battery low", "Key stuck",       "Insert SIM",      "Earpiece fault",  "Water damage"],
    ["No power",  "Charging",    "Signal drop",     "Hands free mark", "Short"],
  ];

  const fieldBox: React.CSSProperties = { padding: "7px 10px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 12, fontFamily: "'Plus Jakarta Sans', sans-serif", minHeight: 33, display: "flex", alignItems: "center" };
  const secHead: React.CSSProperties  = { fontSize: 10, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.1em", textTransform: "uppercase" as const, marginBottom: 10, fontFamily: "'Plus Jakarta Sans', sans-serif" };

  const canCancel = !["Completed", "Delivered", "Cancelled"].includes(job.status);

  if (typeof document === "undefined") return null;
  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, width: "100%", maxWidth: 1240, maxHeight: "calc(100vh - 40px)", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,0.55)" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 18px", borderBottom: "1px solid var(--border)", background: "var(--bg-secondary)", flexShrink: 0, flexWrap: isMobile ? "wrap" : undefined, gap: isMobile ? 8 : 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: "var(--accent)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{job.id}</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 9px", borderRadius: 7, background: sc.bg, border: `1px solid ${sc.border}`, color: sc.color, fontSize: 11, fontWeight: 600, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              <StatusIcon size={9} strokeWidth={2.5} />{job.status}
            </span>
            <span style={{ fontSize: 11, fontWeight: 600, color: priorityColor[job.priority], fontFamily: "'Plus Jakarta Sans', sans-serif" }}>● {job.priority}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: isMobile ? "wrap" : undefined, justifyContent: isMobile ? "flex-end" : undefined }}>
            <button onClick={onPrintSlip} style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 7, fontSize: 11.5, fontWeight: 600, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              <FileText size={11} strokeWidth={2} />Intake Slip
            </button>
            {job.status === "Non-Issued" && (
              <button onClick={onIssueJob} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "1px solid #60a5fa", background: "#60a5fa", color: "#fff", cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                <Send size={12} strokeWidth={2.2} />Issue Job
              </button>
            )}
            {job.status === "Pending" && (
              <button onClick={onFinishJob} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "1px solid var(--accent)", background: "var(--accent)", color: "var(--accent-fg)", cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                <CheckSquare size={12} strokeWidth={2.2} />Mark Finished
              </button>
            )}
            {job.status === "Completed" && (
              <button onClick={onPickup} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "1px solid #a78bfa", background: "#a78bfa", color: "#fff", cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                <Truck size={12} strokeWidth={2.2} />Confirm Pickup
              </button>
            )}
            {canCancel && (
              <button onClick={onCancelJob} style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 7, fontSize: 11.5, fontWeight: 600, border: "1px solid rgba(248,113,113,0.4)", background: "rgba(248,113,113,0.08)", color: "#f87171", cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                <Ban size={11} />Cancel
              </button>
            )}
            <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>

          {/* Job detail */}
          <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>

            <div>
              <div style={secHead}>Job details</div>
              <div style={{ marginBottom: 8 }}>
                <label style={labelSt}>Dealer</label>
                <div style={{ ...fieldBox, color: "var(--text-secondary)" }}>{job.dealer || "MANO MOBILE CENTRE"}</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10, marginBottom: 8 }}>
                <div>
                  <label style={labelSt}>Internal number</label>
                  <div style={{ ...fieldBox, color: "var(--accent)", fontWeight: 600 }}>{job.id}</div>
                </div>
                <div>
                  <label style={labelSt}>Dealer Job number</label>
                  <div style={{ ...fieldBox, color: "var(--text-muted)", fontStyle: "italic" }}>—</div>
                </div>
              </div>
              <div>
                <label style={labelSt}>Agent</label>
                <div style={{ ...fieldBox, color: "var(--text-secondary)" }}>{job.technician}</div>
              </div>
            </div>

            <div>
              <div style={secHead}>Owner data</div>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={labelSt}>Name</label>
                  <div style={{ ...fieldBox, fontWeight: 600 }}>{job.customerName}</div>
                </div>
                <div>
                  <label style={labelSt}>Contact no.</label>
                  <div style={{ ...fieldBox, color: "var(--text-secondary)" }}>{job.phone}</div>
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10 }}>
              <div>
                <label style={labelSt}>Accepted date</label>
                <div style={{ ...fieldBox, color: "var(--text-secondary)" }}>{dayName}, {monthName} {d.getDate()}, {d.getFullYear()}</div>
              </div>
              <div>
                <label style={labelSt}>Model</label>
                <div style={{ ...fieldBox, fontWeight: 600 }}>{job.brand} {job.model}</div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10 }}>
              <div>
                <label style={labelSt}>Accepted by</label>
                <div style={{ ...fieldBox, color: "var(--text-muted)", fontStyle: "italic" }}>—</div>
              </div>
              <div>
                <label style={labelSt}>IMEI no.</label>
                <div style={{ ...fieldBox, color: "var(--text-secondary)", fontFamily: "monospace" }}>{job.imei || "—"}</div>
              </div>
            </div>

            {job.cancelReason && (
              <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.2)" }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: "#f87171", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 5 }}>Cancellation Reason</p>
                <p style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{job.cancelReason}</p>
              </div>
            )}

            <div>
              <label style={labelSt}>Select repair warranty (Optional)</label>
              <div style={{ ...fieldBox, color: job.jobWarranty ? "var(--text-primary)" : "var(--text-muted)" }}>{job.jobWarranty || "— SELECT —"}</div>
            </div>

            <div>
              <div style={secHead}>Submission details</div>
              <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "10px 14px", background: "var(--bg-secondary)" }}>
                <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 8 : 18, flexWrap: "wrap", marginBottom: 8, alignItems: isMobile ? "flex-start" : "center" }}>
                  <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
                    {["Equipment", "Antenna", "Back cover", "Other issue"].map(item => (
                      <label key={item} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--text-secondary)", cursor: "default", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                        <input type="checkbox" disabled readOnly style={{ accentColor: "var(--accent)" }} />{item}
                      </label>
                    ))}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: isMobile ? undefined : "auto" }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>Warranty</span>
                    {(["Yes", "No"] as const).map(opt => (
                      <label key={opt} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--text-secondary)", cursor: "default", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                        <input type="radio" disabled readOnly checked={opt === "No"} style={{ accentColor: "var(--accent)" }} />{opt}
                      </label>
                    ))}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 18 }}>
                  {["Battery", "Charger", "SIM card"].map(item => (
                    <label key={item} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--text-secondary)", cursor: "default", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                      <input type="checkbox" disabled readOnly style={{ accentColor: "var(--accent)" }} />{item}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <div style={secHead}>Fault type</div>
              <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "10px 14px", background: "var(--bg-secondary)", display: "flex", flexDirection: "column", gap: 8 }}>
                {faultRows.map((row, ri) => (
                  <div key={ri} style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                    {row.map(fault => {
                      const checked = job.issue.toLowerCase().includes(fault.toLowerCase());
                      return (
                        <label key={fault} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: checked ? "var(--text-primary)" : "var(--text-secondary)", fontWeight: checked ? 600 : 400, cursor: "default", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                          <input type="checkbox" disabled readOnly checked={checked} style={{ accentColor: "var(--accent)" }} />{fault}
                        </label>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Issue Job Modal ──────────────────────────────────────────────────────────

function IssueJobModal({ job, onClose, onIssued }: {
  job: RepairJob;
  onClose: () => void;
  onIssued: (data: Omit<IssueInvoiceData, "job" | "invoiceNo" | "createdAt">) => void;
}) {
  const [name,          setName]          = useState(job.customerName);
  const [phone,         setPhone]         = useState(job.phone);
  const [nic,           setNic]           = useState("");
  const [email,         setEmail]         = useState("");
  const [imei,          setImei]          = useState(job.imei || "");
  const [discount,      setDiscount]      = useState("0");
  const [payingNow,     setPayingNow]     = useState("");
  const [adminApprover, setAdminApprover] = useState("");
  const [warranty,      setWarranty]      = useState("NO WARRANTY [NORMAL]");

  const discountAmt      = parseFloat(discount) || 0;
  const lineTotal        = Math.max(0, job.estimatedCost - discountAmt);
  const netDue           = Math.max(0, lineTotal - job.advancePaid);
  const payingNowDisplay = payingNow === "" ? netDue.toString() : payingNow;
  const effectivePaying  = parseFloat(payingNowDisplay) || 0;
  const effectiveDue     = Math.max(0, netDue - effectivePaying);
  const effectiveCredit  = effectiveDue > 0;
  const canIssue         = !!name && !!phone && (!effectiveCredit || !!adminApprover.trim());

  const fields = [
    { label: "Full Name",  value: name,  set: setName,  placeholder: "Customer name" },
    { label: "Phone",      value: phone, set: setPhone, placeholder: "07X XXX XXXX" },
    { label: "NIC",        value: nic,   set: setNic,   placeholder: "XXXXXXXXX V" },
    { label: "Email",      value: email, set: setEmail, placeholder: "Optional" },
    { label: "IMEI No.",   value: imei,  set: setImei,  placeholder: "15-digit IMEI" },
  ];

  const handleIssue = () => {
    onIssued({ name, phone, nic, email, imei, discount: discountAmt, paidAmount: job.advancePaid + effectivePaying, dueAmount: effectiveDue, isCredit: effectiveCredit, adminApprover: adminApprover.trim(), warranty });
  };

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 1001, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, width: "min(720px, calc(100vw - 24px))", maxHeight: "92vh", boxShadow: "0 24px 64px rgba(0,0,0,0.5)", display: "flex", flexDirection: "column", overflow: "hidden" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderBottom: "1px solid var(--border)", background: "var(--bg-secondary)", flexShrink: 0 }}>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Issue This Job</p>
            <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{job.id} · {job.brand} {job.model} · {job.issue}</p>
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={14} />
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", overflowY: "auto", flex: 1 }}>
          <div style={{ padding: "16px 18px", borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 11 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Customer Information</p>
            {fields.map(f => (
              <div key={f.label}>
                <label style={labelSt}>{f.label}</label>
                <input value={f.value} onChange={(e) => f.set(e.target.value)} placeholder={f.placeholder} style={inputSt} />
              </div>
            ))}
          </div>

          <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 11 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Bill Summary</p>

            <div style={{ background: "var(--bg-primary)", border: "1px solid var(--border)", borderRadius: 9, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 5 }}>
              {[{ k: "Device", v: `${job.brand} ${job.model}` }, { k: "Issue", v: job.issue }, { k: "Technician", v: job.technician }, { k: "Priority", v: job.priority }].map(r => (
                <div key={r.k} style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5 }}>
                  <span style={{ color: "var(--text-muted)" }}>{r.k}</span>
                  <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{r.v}</span>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[{ k: "Estimated Cost", v: `Rs. ${job.estimatedCost.toLocaleString()}` }, { k: "Advance Paid", v: `Rs. ${job.advancePaid.toLocaleString()}` }].map(r => (
                <div key={r.k} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ color: "var(--text-muted)" }}>{r.k}</span>
                  <span style={{ color: "var(--text-primary)" }}>{r.v}</span>
                </div>
              ))}

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
                <span style={{ color: "var(--text-muted)" }}>Discount</span>
                <input type="number" min={0} value={discount} onChange={(e) => setDiscount(e.target.value)}
                  style={{ width: 90, padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 12, outline: "none", textAlign: "right" }} />
              </div>

              <div style={{ borderTop: "1px solid var(--border)", marginTop: 2, paddingTop: 7, display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700 }}>
                <span style={{ color: "var(--text-primary)" }}>Line Total</span>
                <span style={{ color: "var(--accent)" }}>Rs. {lineTotal.toLocaleString()}</span>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5 }}>
                <span style={{ color: "var(--text-muted)" }}>Balance After Advance</span>
                <span style={{ color: "var(--text-secondary)" }}>Rs. {netDue.toLocaleString()}</span>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
                <span style={{ color: "var(--text-muted)" }}>Paid Amount</span>
                <input type="number" min={0} max={netDue} value={payingNowDisplay} onChange={(e) => setPayingNow(e.target.value)}
                  style={{ width: 110, padding: "4px 8px", borderRadius: 6, border: `1px solid ${effectiveCredit ? "rgba(251,191,36,0.5)" : "var(--border)"}`, background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 12, outline: "none", textAlign: "right" }} />
              </div>

              {effectiveCredit ? (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 10px", borderRadius: 8, background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.3)", marginTop: 2 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <CreditCard size={12} color="#fbbf24" strokeWidth={2.2} />
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: "#fbbf24" }}>CREDIT PAYMENT</span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#fbbf24" }}>Rs. {effectiveDue.toLocaleString()} due</span>
                </div>
              ) : (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 10px", borderRadius: 8, background: "rgba(74,222,128,0.07)", border: "1px solid rgba(74,222,128,0.25)", marginTop: 2 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <CheckCircle size={12} color="#4ade80" strokeWidth={2.2} />
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: "#4ade80" }}>FULLY SETTLED</span>
                  </div>
                </div>
              )}
            </div>

            {effectiveCredit && (
              <div style={{ background: "rgba(251,191,36,0.05)", border: "1px solid rgba(251,191,36,0.3)", borderRadius: 10, padding: "12px 13px", display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <ShieldCheck size={13} color="#fbbf24" strokeWidth={2.2} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#fbbf24", letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Admin Approval Required</span>
                </div>
                <p style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  Credit balance of <strong style={{ color: "#fbbf24" }}>Rs. {effectiveDue.toLocaleString()}</strong>. Admin must approve.
                </p>
                <div>
                  <label style={{ ...labelSt, color: "#fbbf24" }}>Approving Admin Name</label>
                  <input value={adminApprover} onChange={(e) => setAdminApprover(e.target.value)} placeholder="Enter admin name"
                    style={{ ...inputSt, border: "1px solid rgba(251,191,36,0.4)", background: "var(--bg-primary)" }} />
                </div>
              </div>
            )}

            <div>
              <label style={labelSt}>Warranty</label>
              <select value={warranty} onChange={(e) => setWarranty(e.target.value)} style={{ ...inputSt, cursor: "pointer" }}>
                {["NO WARRANTY [NORMAL]", "NO WARRANTY [RETURN]", "NO WARRANTY [FOC]", "1 MONTH WARRANTY [NORMAL]", "3 MONTHS WARRANTY [NORMAL]", "6 MONTHS WARRANTY [NORMAL]", "1 YEAR WARRANTY [NORMAL]"].map(w => (
                  <option key={w} value={w}>{w}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "12px 18px", borderTop: "1px solid var(--border)", background: "var(--bg-secondary)", flexShrink: 0 }}>
          <button onClick={onClose} style={{ padding: "8px 18px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Cancel</button>
          <button onClick={handleIssue} disabled={!canIssue}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 18px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: `1px solid ${effectiveCredit ? "#fbbf24" : "#60a5fa"}`, background: effectiveCredit ? "#fbbf24" : "#60a5fa", color: effectiveCredit ? "#000" : "#fff", cursor: canIssue ? "pointer" : "not-allowed", opacity: canIssue ? 1 : 0.45, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            {effectiveCredit ? <ShieldCheck size={12} strokeWidth={2.2} /> : <Send size={12} strokeWidth={2.2} />}
            {effectiveCredit ? "Approve & Issue" : "Issue Job"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Repair Invoice Preview ───────────────────────────────────────────────────

function RepairInvoicePreview({ data, onClose }: { data: IssueInvoiceData; onClose: () => void }) {
  const invoiceRef = useRef<HTMLDivElement>(null);
  const lineTotal = data.job.estimatedCost - data.discount;
  const paymentType = data.isCredit ? "CREDIT" : "CASH / FULL";

  const handlePrint = () => {
    if (!invoiceRef.current) return;
    const printDiv = document.createElement("div");
    printDiv.id = "__rp__";
    printDiv.innerHTML = invoiceRef.current.outerHTML;
    document.body.appendChild(printDiv);
    const styleEl = document.createElement("style");
    styleEl.id = "__rp_style__";
    styleEl.textContent = `
      @page { size: A4 portrait; margin: 15mm; }
      #__rp__ { display: none; }
      @media print {
        body { visibility: hidden; }
        #__rp__ { display: block !important; visibility: visible; position: fixed; top: 0; left: 0; width: 100%; }
        #__rp__ * { visibility: visible; }
      }
    `;
    document.head.appendChild(styleEl);
    window.print();
    setTimeout(() => {
      document.getElementById("__rp__")?.remove();
      document.getElementById("__rp_style__")?.remove();
    }, 500);
  };

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 1002, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, width: "min(780px, calc(100vw - 24px))", maxHeight: "90vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,0.5)" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 18px", borderBottom: "1px solid var(--border)", background: "var(--bg-secondary)", flexShrink: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            Invoice Preview — {data.invoiceNo}
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handlePrint} style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 14px", borderRadius: 7, fontSize: 11, fontWeight: 600, border: "1px solid var(--accent)", background: "var(--accent)", color: "var(--accent-fg)", cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              <Printer size={12} /> Print
            </button>
            <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <X size={14} />
            </button>
          </div>
        </div>

        <div style={{ overflowY: "auto", padding: 20 }}>
          <div ref={invoiceRef} style={{ background: "#ffffff", padding: "36px 44px", fontFamily: "Arial, Helvetica, sans-serif", color: "#000000" }}>
            <h1 style={{ textAlign: "center", fontWeight: 900, textDecoration: "underline", fontSize: 22, margin: 0, letterSpacing: "0.05em" }}>SALES INVOICE</h1>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 22 }}>
              <table style={{ borderCollapse: "collapse" }}>
                <tbody>
                  <tr>
                    <td style={{ padding: "3px 10px", fontWeight: 700, fontSize: 11, textAlign: "right", whiteSpace: "nowrap" }}>INVOICE NUMBER:</td>
                    <td style={{ padding: "4px 12px", background: "#e0e0e0", border: "1px solid #aaa", minWidth: 180, fontWeight: 700, fontSize: 13 }}>{data.invoiceNo}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: "3px 10px", fontWeight: 700, fontSize: 11, textAlign: "right", whiteSpace: "nowrap" }}>DATE and CREATED BY:</td>
                    <td style={{ padding: "4px 12px", background: "#e0e0e0", border: "1px solid #aaa", fontWeight: 700, fontSize: 11 }}>{data.createdAt} | MANOMOBILE</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p style={{ marginTop: 18, fontSize: 13, fontWeight: 700 }}>CUSTOMER NAME: {data.name.toUpperCase()}</p>
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 14, fontSize: 10.5, border: "1px solid #999" }}>
              <thead>
                <tr style={{ background: "#f0f0f0" }}>
                  {["No.", "Item type", "Item name", "IMEI no.", "Warranty", "Quantity", "Advance", "Unit price", "Discount", "Line total"].map(h => (
                    <th key={h} style={{ padding: "5px 7px", border: "1px solid #999", fontWeight: 700, fontStyle: "italic", textAlign: "left", whiteSpace: "nowrap", fontSize: 10.5 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={invTd}>1.</td>
                  <td style={invTd}>Repair</td>
                  <td style={invTd}>{data.job.id} | {data.job.brand} | {data.job.model}</td>
                  <td style={invTd}>{data.imei || "—"}</td>
                  <td style={invTd}>{data.warranty}</td>
                  <td style={{ ...invTd, textAlign: "right" }}>1</td>
                  <td style={{ ...invTd, textAlign: "right" }}>{data.job.advancePaid}</td>
                  <td style={{ ...invTd, textAlign: "right" }}>{data.job.estimatedCost}</td>
                  <td style={{ ...invTd, textAlign: "right" }}>{data.discount}</td>
                  <td style={{ ...invTd, textAlign: "right", fontWeight: 700, fontStyle: "normal" }}>{lineTotal}</td>
                </tr>
              </tbody>
            </table>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
              <div style={{ width: 280, display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ borderTop: "2px solid #000", paddingTop: 6, display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700 }}>
                  <span>TOTAL</span><span>Rs. {lineTotal.toLocaleString()}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                  <span style={{ color: "#555" }}>Paid Amount</span>
                  <span style={{ fontWeight: 600 }}>Rs. {data.paidAmount.toLocaleString()}</span>
                </div>
                {data.isCredit ? (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, background: "#fff8e1", border: "1px solid #f59e0b", borderRadius: 4, padding: "3px 6px", marginTop: 2 }}>
                    <span style={{ fontWeight: 700, color: "#b45309" }}>CREDIT DUE</span>
                    <span style={{ fontWeight: 700, color: "#b45309" }}>Rs. {data.dueAmount.toLocaleString()}</span>
                  </div>
                ) : (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, background: "#f0fdf4", border: "1px solid #4ade80", borderRadius: 4, padding: "3px 6px", marginTop: 2 }}>
                    <span style={{ fontWeight: 700, color: "#166534" }}>SETTLED</span>
                    <span style={{ fontWeight: 700, color: "#166534" }}>✓</span>
                  </div>
                )}
              </div>
            </div>
            <div style={{ marginTop: 18, display: "flex", gap: 32, fontSize: 11 }}>
              <div>
                <span style={{ fontWeight: 700 }}>Payment Type: </span>
                <span style={{ fontWeight: 700, color: data.isCredit ? "#b45309" : "#166534", background: data.isCredit ? "#fff8e1" : "#f0fdf4", border: `1px solid ${data.isCredit ? "#f59e0b" : "#4ade80"}`, borderRadius: 4, padding: "2px 8px" }}>{paymentType}</span>
              </div>
              {data.isCredit && data.adminApprover && (
                <div>
                  <span style={{ fontWeight: 700 }}>Credit Approved By: </span>
                  <span style={{ textTransform: "uppercase", fontWeight: 700 }}>{data.adminApprover}</span>
                </div>
              )}
            </div>
            <p style={{ marginTop: 20, fontSize: 10, color: "#666", textAlign: "center" }}>
              This is a computer-generated invoice. No signature required.
            </p>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Finish Job Modal ─────────────────────────────────────────────────────────

function FinishJobModal({ job, onClose, onFinish }: {
  job: RepairJob;
  onClose: () => void;
  onFinish: (data: FinishJobData) => void;
}) {
  const [actionTaken,    setActionTaken]    = useState("");
  const [checkedByInput, setCheckedByInput] = useState("");
  const [checkedByList,  setCheckedByList]  = useState<string[]>([]);
  const [jobStatus,      setJobStatus]      = useState<JobStatus | "">("");
  const [advance,        setAdvance]        = useState(job.advancePaid.toString());
  const [totalPrice,     setTotalPrice]     = useState(job.estimatedCost.toString());
  const [partsCost,      setPartsCost]      = useState("0");
  const [warranty,       setWarranty]       = useState("");

  const addCheckedBy = () => {
    const name = checkedByInput.trim().toUpperCase();
    if (name && !checkedByList.includes(name)) { setCheckedByList(prev => [...prev, name]); setCheckedByInput(""); }
  };

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 1001, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, width: "min(520px, calc(100vw - 24px))", boxShadow: "0 24px 64px rgba(0,0,0,0.5)", display: "flex", flexDirection: "column", overflow: "hidden" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderBottom: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Finish Job</p>
            <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{job.id} · {job.brand} {job.model} · {job.customerName}</p>
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={14} />
          </button>
        </div>

        <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", gap: 14 }}>
            <div style={{ flex: 1 }}>
              <label style={labelSt}>Action taken</label>
              <textarea value={actionTaken} onChange={(e) => setActionTaken(e.target.value)} placeholder="Describe the action taken..." rows={5}
                style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 12, resize: "none", fontFamily: "'Plus Jakarta Sans', sans-serif", outline: "none", boxSizing: "border-box" }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelSt}>Checked by</label>
              <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                <input value={checkedByInput} onChange={(e) => setCheckedByInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCheckedBy(); } }}
                  placeholder="Name"
                  style={{ flex: 1, padding: "7px 10px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 12, outline: "none", fontFamily: "'Plus Jakarta Sans', sans-serif" }} />
                <button onClick={addCheckedBy} style={{ padding: "7px 12px", borderRadius: 7, fontSize: 11, fontWeight: 700, border: "1px solid var(--accent)", background: "var(--accent)", color: "var(--accent-fg)", cursor: "pointer" }}>add</button>
              </div>
              <div style={{ border: "1px solid var(--border)", borderRadius: 8, minHeight: 80, padding: "6px 10px", background: "var(--bg-primary)" }}>
                {checkedByList.length === 0
                  ? <p style={{ fontSize: 11, color: "var(--text-muted)", fontStyle: "italic", paddingTop: 2 }}>No names added</p>
                  : checkedByList.map((n, i) => <p key={i} style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", padding: "2px 0" }}>{n}</p>)
                }
              </div>
            </div>
          </div>

          <div>
            <label style={labelSt}>Job status</label>
            <select value={jobStatus} onChange={(e) => setJobStatus(e.target.value as JobStatus)}
              style={{ ...inputSt, cursor: "pointer", color: jobStatus ? "var(--text-primary)" : "var(--text-muted)" }}>
              <option value="">-- Select --</option>
              {(["Pending", "Completed", "Cancelled"] as JobStatus[]).map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <div><label style={labelSt}>Advance</label><input type="number" min={0} value={advance} onChange={(e) => setAdvance(e.target.value)} style={inputSt} /></div>
            <div><label style={labelSt}>Total price</label><input type="number" min={0} value={totalPrice} onChange={(e) => setTotalPrice(e.target.value)} style={inputSt} /></div>
            <div><label style={labelSt}>Parts cost</label><input type="number" min={0} value={partsCost} onChange={(e) => setPartsCost(e.target.value)} style={inputSt} /></div>
          </div>

          <div>
            <label style={labelSt}>Warranty (Optional)</label>
            <select value={warranty} onChange={(e) => setWarranty(e.target.value)} style={{ ...inputSt, cursor: "pointer", color: warranty ? "var(--text-primary)" : "var(--text-muted)" }}>
              <option value="">-- SELECT --</option>
              {["1 Month", "3 Months", "6 Months", "1 Year", "2 Years"].map(w => <option key={w} value={w}>{w}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "12px 18px", borderTop: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
          <button onClick={onClose} style={{ padding: "8px 18px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer" }}>Cancel</button>
          <button onClick={() => onFinish({ actionTaken, checkedBy: checkedByList, jobStatus: jobStatus as JobStatus, advance: parseFloat(advance) || 0, totalPrice: parseFloat(totalPrice) || 0, partsCost: parseFloat(partsCost) || 0, warranty })}
            disabled={!jobStatus}
            style={{ padding: "8px 18px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "1px solid var(--accent)", background: "var(--accent)", color: "var(--accent-fg)", cursor: jobStatus ? "pointer" : "not-allowed", opacity: jobStatus ? 1 : 0.5 }}>
            Finish job
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Jobs Table ───────────────────────────────────────────────────────────────

interface JobsTableProps {
  filterStatus?: JobStatus | "All";
  title: string;
}

export default function JobsTable({ filterStatus = "All" }: JobsTableProps) {
  const { addEntry } = useCashRegister();
  const { jobs: allJobs, updateJob } = useRepair();
  const isMobile = useIsMobile();
  const [search,         setSearch]         = useState("");
  const [showFilters,    setShowFilters]    = useState(false);
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [brandFilter,    setBrandFilter]    = useState("All");
  const [searchFocused,  setSearchFocused]  = useState(false);
  const [detailsJob,     setDetailsJob]     = useState<RepairJob | null>(null);
  const [finishJob,      setFinishJob]      = useState<RepairJob | null>(null);
  const [issueJobTarget, setIssueJobTarget] = useState<RepairJob | null>(null);
  const [invoiceData,    setInvoiceData]    = useState<IssueInvoiceData | null>(null);
  const [cancelJob,      setCancelJob]      = useState<RepairJob | null>(null);
  const [pickupJob,      setPickupJob]      = useState<RepairJob | null>(null);
  const [intakeSlipJob,  setIntakeSlipJob]  = useState<RepairJob | null>(null);

  const jobs = useMemo(() => allJobs.filter(j => {
    const matchStatus   = filterStatus === "All" || j.status === filterStatus;
    const matchSearch   = !search || j.customerName.toLowerCase().includes(search.toLowerCase()) || j.id.toLowerCase().includes(search.toLowerCase()) || j.model.toLowerCase().includes(search.toLowerCase()) || j.brand.toLowerCase().includes(search.toLowerCase());
    const matchPriority = priorityFilter === "All" || j.priority === priorityFilter;
    const matchBrand    = brandFilter === "All" || j.brand === brandFilter;
    return matchStatus && matchSearch && matchPriority && matchBrand;
  }), [allJobs, filterStatus, search, priorityFilter, brandFilter]);

  const handleFinish = (data: FinishJobData) => {
    const job = allJobs.find(j => j.id === finishJob!.id);
    updateJob(finishJob!.id, {
      status: data.jobStatus,
      advancePaid: data.advance,
      estimatedCost: data.totalPrice,
      jobWarranty: data.warranty || job?.jobWarranty,
    });
    setFinishJob(null);
  };

  const handleCancel = (reason: string) => {
    updateJob(cancelJob!.id, { status: "Cancelled", cancelReason: reason });
    setCancelJob(null);
    setDetailsJob(null);
  };

  const handlePickup = (paidNow: number) => {
    if (paidNow > 0) {
      addEntry("in", `Cash — Repair Pickup (${pickupJob!.id})`, paidNow);
    }
    const job = allJobs.find(j => j.id === pickupJob!.id);
    updateJob(pickupJob!.id, {
      status: "Delivered",
      advancePaid: (job?.advancePaid ?? 0) + paidNow,
    });
    setPickupJob(null);
    setDetailsJob(null);
  };

  const openFinish    = (job: RepairJob) => { setDetailsJob(null); setFinishJob(job); };
  const openIssueJob  = (job: RepairJob) => { setDetailsJob(null); setIssueJobTarget(job); };
  const openCancel    = (job: RepairJob) => { setDetailsJob(null); setCancelJob(job); };
  const openPickup    = (job: RepairJob) => { setDetailsJob(null); setPickupJob(job); };
  const openIntakeSlip = (job: RepairJob) => { setDetailsJob(null); setIntakeSlipJob(job); };

  const handleIssueComplete = (data: Omit<IssueInvoiceData, "job" | "invoiceNo" | "createdAt">) => {
    const invoiceNo = Date.now().toString().slice(-10).padStart(10, "0");
    const createdAt = new Date().toLocaleString("en-US", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: true });
    updateJob(issueJobTarget!.id, {
      status: "Issued",
      imei: data.imei,
      jobWarranty: data.warranty,
      advancePaid: data.paidAmount,
    });
    setInvoiceData({ job: issueJobTarget!, ...data, invoiceNo, createdAt });
    setIssueJobTarget(null);
  };

  // Count stats
  const stats = useMemo(() => {
    const base = filterStatus === "All" ? allJobs : allJobs.filter(j => j.status === filterStatus);
    const nonIssued  = allJobs.filter(j => j.status === "Non-Issued").length;
    const pending    = allJobs.filter(j => j.status === "Pending").length;
    const completed  = allJobs.filter(j => j.status === "Completed").length;
    return { nonIssued, pending, completed, total: base.length };
  }, [allJobs, filterStatus]);

  const tableRef  = useRef<HTMLDivElement>(null);
  const JOB_HEADERS = ["Job ID", "Customer", "Phone", "Brand", "Model", "Issue", "Technician", "Status", "Priority", "Est. Cost (Rs.)", "Advance (Rs.)"];
  const jobRows     = () => jobs.map(j => [j.id, j.customerName, j.phone, j.brand, j.model, j.issue, j.technician, j.status, j.priority, j.estimatedCost, j.advancePaid]);
  const jobFilename = `repair-jobs-${new Date().toISOString().slice(0, 10)}`;

  return (
    <div ref={tableRef} style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Quick stat chips */}
      {filterStatus === "All" && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[
            { label: "Unassigned", value: stats.nonIssued, color: "#94a3b8" },
            { label: "Pending",    value: stats.pending,   color: "#fbbf24" },
            { label: "Ready",      value: stats.completed, color: "#4ade80" },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 8, background: "var(--bg-card)", border: "1px solid var(--border)" }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: color, display: "inline-block" }} />
              <span style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{label}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Toolbar */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {/* Row 1: Search + Filters */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ position: "relative", flex: 1 }}>
            <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: searchFocused ? "var(--accent)" : "var(--text-muted)", transition: "color 0.18s", pointerEvents: "none" }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} onFocus={() => setSearchFocused(true)} onBlur={() => setSearchFocused(false)}
              placeholder="Search by name, ID, device..."
              style={{ width: "100%", background: "var(--bg-card)", border: `1px solid ${searchFocused ? "var(--accent)" : "var(--border)"}`, borderRadius: 10, padding: "10px 14px 10px 36px", fontSize: 13.5, color: "var(--text-primary)", outline: "none", fontFamily: "'Plus Jakarta Sans', sans-serif", transition: "border-color 0.18s" }} />
          </div>
          <button onClick={() => setShowFilters(!showFilters)}
            style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 14px", borderRadius: 10, border: `1px solid ${showFilters ? "var(--accent-glow)" : "var(--border)"}`, background: showFilters ? "var(--accent-dim)" : "var(--bg-card)", color: showFilters ? "var(--accent)" : "var(--text-secondary)", fontSize: 13, cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif", transition: "all 0.18s", whiteSpace: "nowrap" }}>
            <Filter size={14} />{!isMobile && "Filters"}
            <ChevronDown size={13} style={{ transform: showFilters ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }} />
          </button>
        </div>
        {/* Row 2: Count + Export */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, padding: "4px 12px", borderRadius: 8, background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
            {jobs.length} {jobs.length === 1 ? "job" : "jobs"}
          </span>
          <div style={{ marginLeft: "auto" }}>
            <ExportButtons
              onPdf={()   => exportToPdf("Repair Jobs", JOB_HEADERS, jobRows(), jobFilename)}
              onExcel={()  => exportToExcel(jobFilename, "Repair Jobs", JOB_HEADERS, jobRows())}
              onPng={() => { if (!tableRef.current) return; return exportToPng(tableRef.current, jobFilename); }}
            />
          </div>
        </div>
      </div>

      {showFilters && (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 20px", display: "flex", gap: 20, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div>
            <label style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" as const, fontFamily: "'Plus Jakarta Sans', sans-serif", display: "block", marginBottom: 6 }}>Priority</label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {["All", "Low", "Normal", "High", "Urgent"].map(p => (
                <button key={p} onClick={() => setPriorityFilter(p)} style={{ padding: "5px 12px", borderRadius: 8, fontSize: 12, border: `1px solid ${priorityFilter === p ? "var(--accent-glow)" : "var(--border)"}`, background: priorityFilter === p ? "var(--accent-dim)" : "transparent", color: priorityFilter === p ? "var(--accent)" : "var(--text-secondary)", cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif", transition: "all 0.15s" }}>{p}</button>
              ))}
            </div>
          </div>
          <div>
            <label style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" as const, fontFamily: "'Plus Jakarta Sans', sans-serif", display: "block", marginBottom: 6 }}>Brand</label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {["All", "Apple", "Samsung", "Xiaomi", "Oppo", "OnePlus", "Huawei"].map(b => (
                <button key={b} onClick={() => setBrandFilter(b)} style={{ padding: "5px 12px", borderRadius: 8, fontSize: 12, border: `1px solid ${brandFilter === b ? "var(--accent-glow)" : "var(--border)"}`, background: brandFilter === b ? "var(--accent-dim)" : "transparent", color: brandFilter === b ? "var(--accent)" : "var(--text-secondary)", cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif", transition: "all 0.15s" }}>{b}</button>
              ))}
            </div>
          </div>
          <button onClick={() => { setPriorityFilter("All"); setBrandFilter("All"); }} style={{ padding: "6px 14px", borderRadius: 8, fontSize: 12, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Clear</button>
        </div>
      )}

      {/* Table */}
      <div className="table-scroll" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["Job ID", "Customer", "Device", "Issue", "Technician", "Status", "Priority", "Est. Cost", "Advance", "Balance", "Date", ""].map((h, i) => (
                  <th key={i} style={{ padding: "12px 14px", textAlign: i >= 7 && i <= 9 ? "right" : "left", fontSize: 11, color: "var(--text-secondary)", fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase" as const, whiteSpace: "nowrap", fontFamily: "'Plus Jakarta Sans', sans-serif", background: "var(--bg-secondary)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {jobs.length === 0 ? (
                <tr><td colSpan={12} style={{ padding: "48px 16px", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>No jobs found</td></tr>
              ) : jobs.map((job, i) => {
                const sc = statusConfig[job.status];
                const StatusIcon = sc.icon;
                const balance = job.estimatedCost - job.advancePaid;
                return (
                  <tr key={job.id} style={{ borderBottom: i < jobs.length - 1 ? "1px solid var(--border)" : "none", transition: "background 0.15s" }}
                    onMouseEnter={(e) => (e.currentTarget as HTMLTableRowElement).style.background = "var(--bg-card-hover)"}
                    onMouseLeave={(e) => (e.currentTarget as HTMLTableRowElement).style.background = "transparent"}>
                    <td style={{ padding: "13px 14px" }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{job.id}</span>
                    </td>
                    <td style={{ padding: "13px 14px" }}>
                      <p style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>{job.customerName}</p>
                      <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{job.phone}</p>
                    </td>
                    <td style={{ padding: "13px 14px" }}>
                      <p style={{ fontSize: 12.5, color: "var(--text-primary)" }}>{job.brand} {job.model}</p>
                    </td>
                    <td style={{ padding: "13px 14px" }}>
                      <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{job.issue}</span>
                    </td>
                    <td style={{ padding: "13px 14px" }}>
                      <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{job.technician}</span>
                    </td>
                    <td style={{ padding: "13px 14px" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 8, background: sc.bg, border: `1px solid ${sc.border}`, color: sc.color, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>
                        <StatusIcon size={9} strokeWidth={2.5} />{job.status}
                      </span>
                    </td>
                    <td style={{ padding: "13px 14px" }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: priorityColor[job.priority] }}>● {job.priority}</span>
                    </td>
                    <td style={{ padding: "13px 14px", textAlign: "right" }}>
                      <span style={{ fontSize: 12.5, color: "var(--text-primary)" }}>Rs. {job.estimatedCost.toLocaleString()}</span>
                    </td>
                    <td style={{ padding: "13px 14px", textAlign: "right" }}>
                      {job.advancePaid > 0 ? (
                        <span style={{ fontSize: 12, fontWeight: 600, color: "#4ade80" }}>Rs. {job.advancePaid.toLocaleString()}</span>
                      ) : <span style={{ fontSize: 12, color: "var(--text-muted)" }}>—</span>}
                    </td>
                    <td style={{ padding: "13px 14px", textAlign: "right" }}>
                      <span style={{ fontSize: 12.5, color: balance > 0 ? "#f87171" : "#4ade80", fontWeight: 600 }}>Rs. {balance.toLocaleString()}</span>
                    </td>
                    <td style={{ padding: "13px 14px" }}>
                      <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{job.createdAt}</span>
                    </td>
                    <td style={{ padding: "13px 14px" }}>
                      <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                        <button onClick={() => setIntakeSlipJob(job)}
                          title="Print intake slip"
                          style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}
                          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-active)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)"; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)"; }}>
                          <FileText size={12} />
                        </button>
                        <button onClick={() => setDetailsJob(job)}
                          title="View details"
                          style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}
                          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--accent-glow)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--accent)"; (e.currentTarget as HTMLButtonElement).style.background = "var(--accent-dim)"; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)"; (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}>
                          <MoreHorizontal size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
      </div>

      {/* Modals */}
      {detailsJob && (
        <JobDetailsModal
          job={detailsJob}
          onClose={() => setDetailsJob(null)}
          onFinishJob={() => openFinish(detailsJob)}
          onIssueJob={() => openIssueJob(detailsJob)}
          onCancelJob={() => openCancel(detailsJob)}
          onPickup={() => openPickup(detailsJob)}
          onPrintSlip={() => openIntakeSlip(detailsJob)}
        />
      )}
      {finishJob && <FinishJobModal job={finishJob} onClose={() => setFinishJob(null)} onFinish={handleFinish} />}
      {issueJobTarget && <IssueJobModal job={issueJobTarget} onClose={() => setIssueJobTarget(null)} onIssued={handleIssueComplete} />}
      {invoiceData && <RepairInvoicePreview data={invoiceData} onClose={() => setInvoiceData(null)} />}
      {cancelJob && <CancelJobModal job={cancelJob} onClose={() => setCancelJob(null)} onCancel={handleCancel} />}
      {pickupJob && <PickupModal job={pickupJob} onClose={() => setPickupJob(null)} onConfirm={handlePickup} />}
      {intakeSlipJob && <IntakeSlipModal job={intakeSlipJob} onClose={() => setIntakeSlipJob(null)} />}
    </div>
  );
}
