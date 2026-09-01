"use client";

import { useState, useRef, useMemo } from "react";
import { useCashRegister } from "@/cashier/contexts/CashRegisterContext";
import { useSales } from "@/cashier/contexts/SalesContext";
import {
  Search, ArrowLeft, Printer, ChevronDown,
  Building2, CheckCircle, Clock, Wrench, TrendingUp, AlertCircle,
  CreditCard, X, BookUser, Undo2,
} from "lucide-react";
import { createPortal } from "react-dom";
import CreditCustomerPicker, { type POSCreditCustomer } from "./CreditCustomerPicker";
import JobIssuePrintable, { type IssueInvoiceData } from "@/cashier/components/repair/JobIssuePrintable";
import { useRepair, findDealer, isInHouseDealer, dealerKey } from "@/cashier/contexts/RepairContext";
import type { RepairJob } from "@/cashier/contexts/RepairContext";
import { fetchNextInvoiceNo } from "@/lib/sales/invoiceNo";
import InvoiceNoBadge from "@/cashier/components/sales/InvoiceNoBadge";
import { usePersistInvoiceDocument } from "@/lib/sales/invoiceDoc";
import { useAuth } from "@/lib/auth/AuthContext";
import { useMyPermissions } from "@/lib/settings/staffRules";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CompletedRepair {
  id: string;
  dealer: string;
  customerName: string;
  brand: string;
  model: string;
  imei: string;
  warranty: string;
  advance: number;
  unitPrice: number;
  discount: number;
  /** Only actually shown for an outside dealer's jobs — see the Step 2 table,
   *  where the customer/advance columns swap for these plus a fault column. */
  issue: string;
  createdAt: string;
  completedAt?: string;
}

interface DealerProfile {
  phone: string;
  address: string;
  since: string;
  stats: { total: number; completed: number; pending: number; inProgress: number };
  totalEarned: number;
  outstanding: number;
}

// ─── Live data only ───────────────────────────────────────────────────────────

const COMPLETED_REPAIRS: CompletedRepair[] = [];

/** Dealer stats are computed from live jobs; no canned figures. */
const DEALER_PROFILES: Record<string, Pick<DealerProfile, "stats" | "totalEarned" | "outstanding">> = {};

const fmtDate = (d?: string) => {
  if (!d) return "—";
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? d : dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const invTh: React.CSSProperties = {
  padding: "5px 7px", border: "1px solid #999",
  fontWeight: 700, fontStyle: "italic", textAlign: "left",
  whiteSpace: "nowrap", fontSize: 10.5, background: "#f0f0f0",
};
const invTd: React.CSSProperties = {
  padding: "4px 7px", border: "1px solid #ccc", fontSize: 10.5, fontStyle: "italic",
};

const stepLabel: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: "var(--text-secondary)",
  letterSpacing: "0.07em", textTransform: "uppercase",
  fontFamily: "'Plus Jakarta Sans', sans-serif", marginBottom: 14,
};

const cardHead: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: "var(--text-muted)",
  letterSpacing: "0.1em", textTransform: "uppercase",
  fontFamily: "'Plus Jakarta Sans', sans-serif", marginBottom: 12,
};

const inputSt: React.CSSProperties = {
  width: "100%", padding: "8px 10px", borderRadius: 8,
  border: "1px solid var(--border)", background: "var(--bg-primary)",
  color: "var(--text-primary)", fontSize: 12.5, outline: "none",
  fontFamily: "'Plus Jakarta Sans', sans-serif", boxSizing: "border-box",
};

// A field filled from the dealer registry. Read-only rather than disabled: a
// disabled input is skipped by the keyboard and greys the text out, and this
// text is the answer, not an unavailable one.
/**
 * What an invoice was billed from, frozen at the moment it was generated.
 *
 * Every field here is derived from `invoiceable`, which only keeps jobs with
 * status "Completed". Issuing the jobs moves them to "Delivered" and they all
 * go empty or zero — so anything that runs after that point (the invoice
 * preview, the credit confirmation, recording the sale) has to read this and
 * never the live values.
 */
interface BilledSnapshot {
  repairs: CompletedRepair[];
  totalAdvance: number;
  effectiveReceived: number;
  finalDue: number;
  grandTotal: number;
  totalDiscount: number;
  lineDiscounts: number;
  invoiceDiscount: number;
  badDebt: number;
  payMethod: "Cash" | "Card" | "Bank Transfer";
  cardRef: string;
  isCredit: boolean;
  customerName: string;
  customerPhone: string;
  dealerId: number | null;
  creditAccountId: string | null;
}

const lockedSt: React.CSSProperties = {
  background: "var(--bg-secondary)",
  borderColor: "var(--accent-glow)",
  cursor: "default",
};

const labelSt: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, color: "var(--text-muted)",
  letterSpacing: "0.08em", textTransform: "uppercase",
  display: "block", marginBottom: 5,
  fontFamily: "'Plus Jakarta Sans', sans-serif",
};

const fmtRs = (n: number) => `Rs. ${Math.max(0, n).toLocaleString("en-LK")}`;

// ─── Credit Record Confirm Modal ─────────────────────────────────────────────

function CreditRecordConfirmModal({ dealer, dueAmount, onConfirm, onSkip, onCancel }: {
  dealer: string;
  dueAmount: number;
  onConfirm: () => void;
  onSkip: () => void;
  onCancel: () => void;
}) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      onClick={onCancel}
      style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
    >
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 460, background: "var(--bg-card)", borderRadius: 16, border: "1px solid rgba(251,191,36,0.35)", boxShadow: "0 32px 80px rgba(0,0,0,0.5)", display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <BookUser size={16} color="#fbbf24" />
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Outstanding Amount Detected</p>
              <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Create a credit record for this dealer?</p>
            </div>
          </div>
          <button onClick={onCancel} style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid var(--border)", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", flexShrink: 0 }}>
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ padding: "12px 14px", borderRadius: 10, background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.25)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <p style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Dealer</p>
              <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif", marginTop: 2 }}>{dealer}</p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Credit Due</p>
              <p style={{ fontSize: 18, fontWeight: 800, color: "#fbbf24", fontFamily: "'Plus Jakarta Sans', sans-serif", marginTop: 2 }}>Rs. {dueAmount.toLocaleString()}</p>
            </div>
          </div>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: "'Plus Jakarta Sans', sans-serif", lineHeight: 1.6 }}>
            The total invoice amount exceeds what has been paid. You can create a credit record against <strong style={{ color: "var(--text-primary)" }}>{dealer}</strong>'s account for the outstanding balance, or skip and generate the invoice without recording the credit.
          </p>
        </div>

        {/* Footer */}
        <div style={{ padding: "12px 20px", borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 8 }}>
          <button
            onClick={onConfirm}
            style={{ width: "100%", padding: "10px", borderRadius: 9, border: "none", background: "#fbbf24", color: "#000", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}
          >
            <BookUser size={14} />Create Credit Record &amp; Generate Invoice
          </button>
          <button
            onClick={onSkip}
            style={{ width: "100%", padding: "10px", borderRadius: 9, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            Generate Without Credit Record
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Invoice View ─────────────────────────────────────────────────────────────

function InvoiceView({ invoiceNo, createdAt, dealer, customer, isCredit, amountReceivedNow, dueAmount, totalAdvance, invoiceDiscount = 0, creditRecordMade, repairs, onBack }: {
  invoiceNo: string;
  createdAt: string;
  dealer: string;
  customer: { name: string; phone: string; nic: string };
  isCredit: boolean;
  amountReceivedNow: number;
  dueAmount: number;
  totalAdvance: number;
  /** Taken off the bill as a whole, on top of any per-line discounts. */
  invoiceDiscount?: number;
  creditRecordMade: boolean;
  repairs: CompletedRepair[];
  onBack: () => void;
}) {
  const { dealers } = useRepair();
  const invoiceRef = useRef<HTMLDivElement>(null);
  const lineTotals  = repairs.reduce((s, r) => s + r.unitPrice - r.discount, 0);
  const grandTotal  = Math.max(0, lineTotals - invoiceDiscount);
  const paidAmount  = totalAdvance + amountReceivedNow;
  const paymentType = isCredit ? "CREDIT" : "CASH / FULL";
  // Mano Mobile's own customers get the job-receipt template; external dealers get a sales invoice.
  const isManoMobile = isInHouseDealer(dealers, dealer);
  const dealerRecord = findDealer(dealers, dealer);
  const today = new Date().toISOString().slice(0, 10);
  const mapToJob = (r: CompletedRepair): RepairJob => ({
    id: r.id,
    customerName: customer.name || r.customerName,
    phone: customer.phone || "—",
    brand: r.brand,
    model: r.model,
    issue: "Repair",
    technician: "—",
    status: "Completed",
    priority: "Normal",
    estimatedCost: r.unitPrice - r.discount,
    advancePaid: r.advance,
    createdAt: today,
    estimatedCompletion: today,
    completedAt: today,
    imei: r.imei,
    jobWarranty: r.warranty,
    dealer: r.dealer,
  });

  // One IssueInvoiceData per device — this invoice can bundle several repairs
  // under one invoice number, but the Job Issue Invoice template is a
  // per-job document, so each device gets its own page under that shared
  // number. Its own discount/advance are known exactly; the extra cash paid
  // today (amountReceivedNow) is a whole-invoice figure with no clean per-
  // device split, so it isn't attributed to any single page here.
  const mapToIssueData = (r: CompletedRepair): IssueInvoiceData => {
    const due = Math.max(0, r.unitPrice - r.discount - r.advance);
    return {
      job: mapToJob(r),
      name: customer.name || r.customerName,
      phone: customer.phone,
      nic: customer.nic,
      email: "",
      imei: r.imei,
      discount: r.discount,
      paidAmount: r.advance,
      dueAmount: due,
      isCredit: due > 0,
      adminApprover: "",
      warranty: r.warranty,
      invoiceNo,
      createdAt,
    };
  };

  // Paper size is part of the document: an in-house repair slip is A5, a dealer
  // invoice A4. Stored alongside the markup so a reprint months later comes out
  // the same shape rather than on whatever the reprinting screen defaults to.
  const pageCss = `@page { size: ${isManoMobile ? "A5 landscape" : "A4 landscape"}; margin: ${isManoMobile ? "0" : "12mm"}; }`;

  // Keep the invoice exactly as it was rendered here. Invoice History shows
  // this, not a summary rebuilt from figures that may since have moved.
  usePersistInvoiceDocument(invoiceNo, invoiceRef, pageCss);

  const handlePrint = () => {
    if (!invoiceRef.current) return;
    const printDiv = document.createElement("div");
    printDiv.id = "__rp_inv__";
    printDiv.innerHTML = invoiceRef.current.outerHTML;
    document.body.appendChild(printDiv);
    const styleEl = document.createElement("style");
    styleEl.id = "__rp_inv_style__";
    styleEl.textContent = `
      @page { size: ${isManoMobile ? "A5 landscape" : "A4 landscape"}; margin: ${isManoMobile ? "0" : "12mm"}; }
      #__rp_inv__ { display: none; }
      @media print {
        body { visibility: hidden; }
        #__rp_inv__ { display: block !important; visibility: visible; position: fixed; top: 0; left: 0; width: 100%; }
        #__rp_inv__ * { visibility: visible; }
      }
    `;
    document.head.appendChild(styleEl);
    window.print();
    setTimeout(() => {
      document.getElementById("__rp_inv__")?.remove();
      document.getElementById("__rp_inv_style__")?.remove();
    }, 500);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, flex: 1, minHeight: 0, overflowY: "auto", paddingRight: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button
          onClick={onBack}
          style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 16px", borderRadius: 9, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-secondary)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif", transition: "all 0.15s" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--accent-glow)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--accent)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)"; }}
        >
          <ArrowLeft size={13} /> Back
        </button>
        <button
          onClick={handlePrint}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 18px", borderRadius: 9, border: "1px solid var(--accent)", background: "var(--accent)", color: "var(--accent-fg)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          <Printer size={13} /> Print Invoice
        </button>
      </div>

      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
        {isManoMobile ? (
          /* Mano Mobile → the Job Issue Invoice template, one page per device */
          <div ref={invoiceRef} style={{ background: "#ffffff" }}>
            {repairs.map((r, i) => (
              <div key={r.id} style={{ pageBreakAfter: i < repairs.length - 1 ? "always" : "auto", borderBottom: i < repairs.length - 1 ? "2px dashed #bbb" : "none" }}>
                <JobIssuePrintable data={mapToIssueData(r)} />
              </div>
            ))}
          </div>
        ) : (
        <div ref={invoiceRef} style={{ background: "#ffffff", padding: "36px 44px", fontFamily: "Arial, Helvetica, sans-serif", color: "#000000" }}>

          <h1 style={{ textAlign: "center", fontWeight: 900, textDecoration: "underline", fontSize: 24, margin: 0, letterSpacing: "0.06em" }}>
            SALES INVOICE
          </h1>

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 22 }}>
            <table style={{ borderCollapse: "collapse" }}>
              <tbody>
                <tr>
                  <td style={{ padding: "3px 10px", fontWeight: 700, fontSize: 11, textAlign: "right", whiteSpace: "nowrap" }}>INVOICE NUMBER:</td>
                  <td style={{ padding: "4px 14px", background: "#e0e0e0", border: "1px solid #aaa", minWidth: 180, fontWeight: 700, fontSize: 14 }}>{invoiceNo}</td>
                </tr>
                <tr>
                  <td style={{ padding: "3px 10px", fontWeight: 700, fontSize: 11, textAlign: "right", whiteSpace: "nowrap" }}>DATE and CREATED BY:</td>
                  <td style={{ padding: "4px 14px", background: "#e0e0e0", border: "1px solid #aaa", fontWeight: 700, fontSize: 11 }}>{createdAt} | MANOMOBILE</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 18, display: "flex", gap: 48 }}>
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#555" }}>DEALER</p>
              <p style={{ fontSize: 13, fontWeight: 700 }}>{dealerRecord?.name ?? dealer}</p>
              {dealerRecord?.address && <p style={{ fontSize: 11, color: "#555", marginTop: 1 }}>{dealerRecord.address}</p>}
              {dealerRecord?.contact && <p style={{ fontSize: 11, color: "#555", marginTop: 1 }}>Tel: {dealerRecord.contact}</p>}
            </div>
            {customer.name && (
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#555" }}>CUSTOMER</p>
                <p style={{ fontSize: 13, fontWeight: 700 }}>{customer.name.toUpperCase()}</p>
                {customer.phone && <p style={{ fontSize: 11, color: "#555", marginTop: 1 }}>Tel: {customer.phone}</p>}
                {customer.nic   && <p style={{ fontSize: 11, color: "#555", marginTop: 1 }}>NIC: {customer.nic}</p>}
              </div>
            )}
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 16, border: "1px solid #999" }}>
            <thead>
              <tr>
                <th style={invTh}>No.</th>
                <th style={invTh}>Item type</th>
                <th style={invTh}>Item name</th>
                <th style={invTh}>IMEI no.</th>
                <th style={invTh}>Warranty</th>
                <th style={{ ...invTh, textAlign: "right" as const }}>Qty</th>
                <th style={{ ...invTh, textAlign: "right" as const }}>Advance</th>
                <th style={{ ...invTh, textAlign: "right" as const }}>Unit price</th>
                <th style={{ ...invTh, textAlign: "right" as const }}>Discount</th>
                <th style={{ ...invTh, textAlign: "right" as const }}>Line total</th>
              </tr>
            </thead>
            <tbody>
              {repairs.map((r, i) => {
                const lineTotal = r.unitPrice - r.discount;
                return (
                  <tr key={r.id}>
                    <td style={invTd}>{i + 1}.</td>
                    <td style={invTd}>Repair</td>
                    <td style={invTd}>{r.id} | {r.brand} | {r.model}</td>
                    <td style={invTd}>{r.imei || "—"}</td>
                    <td style={invTd}>{r.warranty}</td>
                    <td style={{ ...invTd, textAlign: "right" as const }}>1</td>
                    <td style={{ ...invTd, textAlign: "right" as const }}>{r.advance.toLocaleString()}</td>
                    <td style={{ ...invTd, textAlign: "right" as const }}>{r.unitPrice.toLocaleString()}</td>
                    <td style={{ ...invTd, textAlign: "right" as const }}>{r.discount > 0 ? r.discount.toLocaleString() : "—"}</td>
                    <td style={{ ...invTd, textAlign: "right" as const, fontWeight: 700, fontStyle: "normal" }}>{lineTotal.toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
            <div style={{ width: 280, display: "flex", flexDirection: "column", gap: 3 }}>
              {/* Named on the invoice rather than folded into the total, so the
                  customer can see the concession they were given. */}
              {invoiceDiscount > 0 && (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                    <span style={{ color: "#555" }}>Sub Total</span>
                    <span style={{ fontWeight: 600 }}>Rs. {lineTotals.toLocaleString()}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                    <span style={{ color: "#555" }}>Invoice Discount</span>
                    <span style={{ fontWeight: 600 }}>− Rs. {invoiceDiscount.toLocaleString()}</span>
                  </div>
                </>
              )}
              <div style={{ borderTop: "2px solid #000", paddingTop: 5, display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700 }}>
                <span>TOTAL</span><span>Rs. {grandTotal.toLocaleString()}</span>
              </div>
              {totalAdvance > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                  <span style={{ color: "#555" }}>Advance (previously paid)</span>
                  <span style={{ fontWeight: 600 }}>Rs. {totalAdvance.toLocaleString()}</span>
                </div>
              )}
              {amountReceivedNow > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                  <span style={{ color: "#555" }}>Amount Received Now</span>
                  <span style={{ fontWeight: 600 }}>Rs. {amountReceivedNow.toLocaleString()}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, borderTop: "1px solid #e0e0e0", paddingTop: 3, marginTop: 1 }}>
                <span style={{ color: "#555" }}>Total Paid</span>
                <span style={{ fontWeight: 700 }}>Rs. {paidAmount.toLocaleString()}</span>
              </div>
              {isCredit ? (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, background: "#fff8e1", border: "1px solid #f59e0b", borderRadius: 4, padding: "3px 6px", marginTop: 2 }}>
                  <span style={{ fontWeight: 700, color: "#b45309" }}>CREDIT DUE</span>
                  <span style={{ fontWeight: 700, color: "#b45309" }}>Rs. {dueAmount.toLocaleString()}</span>
                </div>
              ) : (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, background: "#f0fdf4", border: "1px solid #4ade80", borderRadius: 4, padding: "3px 6px", marginTop: 2 }}>
                  <span style={{ fontWeight: 700, color: "#166534" }}>SETTLED</span>
                  <span style={{ fontWeight: 700, color: "#166534" }}>✓</span>
                </div>
              )}
            </div>
          </div>

          <div style={{ marginTop: 14, display: "flex", gap: 16, flexWrap: "wrap", fontSize: 11, alignItems: "center" }}>
            <span>
              <span style={{ fontWeight: 700 }}>Payment Type: </span>
              <span style={{ fontWeight: 700, color: isCredit ? "#b45309" : "#166534", background: isCredit ? "#fff8e1" : "#f0fdf4", border: `1px solid ${isCredit ? "#f59e0b" : "#4ade80"}`, borderRadius: 4, padding: "2px 8px" }}>{paymentType}</span>
            </span>
            {creditRecordMade && (
              <span style={{ fontWeight: 700, color: "#92400e", background: "#fef3c7", border: "1px solid #fcd34d", borderRadius: 4, padding: "2px 8px" }}>
                CREDIT RECORD CREATED — {dealer}
              </span>
            )}
          </div>

          <p style={{ marginTop: 28, fontSize: 9.5, color: "#888", textAlign: "center" }}>
            This is a computer-generated invoice. No signature required.
          </p>
        </div>
        )}
      </div>
    </div>
  );
}

// ─── Repair Sales Main ────────────────────────────────────────────────────────

export default function RepairSales() {
  const { addEntry } = useCashRegister();
  const { addSale } = useSales();
  /**
   * May this person settle below the agreed price?
   *
   * The one permission that defaults OFF, because it is the one that costs the
   * shop money. Without it the Discount column stays read-only text — the
   * cashier can see what was taken off, they just cannot take it off.
   */
  const { can: mayDo } = useMyPermissions();
  const mayDiscount = mayDo("canDiscount");
  // Whose till the invoice came off, for the sales ledger.
  const { profile } = useAuth();
  const { updateJob, jobs, dealers } = useRepair();
  const [view,           setView]           = useState<"search" | "invoice">("search");
  const [showIssuedMsg,  setShowIssuedMsg]  = useState(false);
  const [selectedDealer, setSelectedDealer] = useState("");
  const [checkedIds,     setCheckedIds]     = useState<Set<string>>(new Set());
  const [search,         setSearch]         = useState("");

  // Step 3 — Customer Info
  const [custName,  setCustName]  = useState("");
  const [custPhone, setCustPhone] = useState("");
  const [custNic,   setCustNic]   = useState("");
  /**
   * Bill the dealer instead of the end customer.
   *
   * On a dealer job the shop's customer IS the dealer — Phone House sends the
   * phone, Phone House pays. Their name and number were being retyped on every
   * invoice, which is both wasted keystrokes and a source of "Phone house",
   * "PhoneHouse" and a mistyped number ending up on three invoices for the same
   * account. Ticking this fills the fields from the dealer registry and locks
   * them, so all of it says the same thing.
   */
  const [billToDealer, setBillToDealer] = useState(false);
  // What was typed by hand before the tick, so unticking gives it back rather
  // than throwing away a half-entered customer.
  const manualCustomer = useRef({ name: "", phone: "", nic: "" });

  /**
   * How the money came in.
   *
   * Every other till in the app asks this; the repair counter recorded "Cash"
   * on everything, so a card-paid repair was indistinguishable from a cash one
   * in the sales ledger and in the day's takings.
   */
  const [payMethod, setPayMethod] = useState<"Cash" | "Card" | "Bank Transfer">("Cash");
  const [cardRef,   setCardRef]   = useState("");

  // Step 3 — Amount received now
  const [amountReceived, setAmountReceived] = useState("");

  // Step 3 — Credit customer (Mano Mobile + due)
  const [selectedCreditCustomer, setSelectedCreditCustomer] = useState<POSCreditCustomer | null>(null);

  // Credit record confirmation (non-Mano Mobile + due)
  const [showCreditConfirm,  setShowCreditConfirm]  = useState(false);
  const [creditRecordMade,   setCreditRecordMade]   = useState(false);
  /**
   * Money taken off a line, keyed by job.
   *
   * Held here rather than written onto the job, because a discount is a fact
   * about this invoice, not about the repair. The job keeps recording what it
   * was quoted at — which is also what the handover credit charge is computed
   * from — so lowering a price at the counter can never leave the invoice and
   * the customer's balance disagreeing about the same job.
   */
  const [rowDiscounts, setRowDiscounts] = useState<Record<string, number>>({});
  /**
   * Forgive the residual instead of putting it on account.
   *
   * Rs. 200 left on a Rs. 700 repair is not worth opening a credit account for,
   * and doing so leaves a customer on the ledger owing money nobody will ever
   * chase. Ticking this settles the job and records the gap as bad debt, so the
   * shop still sees what it gave away.
   */
  const [writeOffBalance, setWriteOffBalance] = useState(false);
  /**
   * A discount on the bill as a whole, on top of anything taken off individual
   * jobs.
   *
   * The two are different concessions and both happen: Rs. 100 off a screen
   * because the part came cheaper, and then Rs. 200 off the whole invoice
   * because it is a regular customer with four phones in. Folding the second
   * into the first would spread it across lines it was never about, and the
   * printed invoice would no longer match what was actually agreed.
   */
  const [invDiscount, setInvDiscount] = useState("");
  const [invDiscountMode, setInvDiscountMode] = useState<"Rs" | "%">("Rs");
  const [custMatchOpen, setCustMatchOpen] = useState(false);

  // A frozen copy of the billing figures at the moment the invoice is
  // generated. markIssued() flips the selected jobs' status to "Delivered",
  // which — because `invoiceable` only keeps status === "Completed" — drops
  // them out of the live `selectedRepairs`/`grandTotal`/etc. the instant
  // status updates land, leaving InvoiceView with an empty invoice. Snapshot
  // everything before that flip so the preview keeps showing what was billed.
  const [invoiceSnapshot, setInvoiceSnapshot] = useState<BilledSnapshot | null>(null);

  // Assigned for real (from the shared invoice_no_seq sequence) only once a
  // sale is actually completed — see fetchNextInvoiceNo's own comment for why
  // this can't just run on mount.
  const [invoiceNo, setInvoiceNo] = useState<string | null>(null);
  const [invoicing, setInvoicing] = useState(false);
  const createdAt = useMemo(() => new Date().toLocaleString("en-US", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: true }), []);

  // Dealers managed in Admin Control, plus any legacy dealer still attached to
  // a repair row so historic work stays invoiceable.
  const dealerOptions = useMemo(() => {
    const names = dealers.map(d => d.name);
    const known = new Set(names.map(n => dealerKey(dealers, n)));
    const extra = [...COMPLETED_REPAIRS.map(r => r.dealer), ...jobs.map(j => j.dealer ?? "")]
      .filter(n => n && !known.has(dealerKey(dealers, n)));
    return [...names, ...Array.from(new Set(extra)).sort()];
  }, [dealers, jobs]);

  // Repaired-and-awaiting-collection jobs from the live register, shaped like
  // the invoice rows, plus the demo rows that aren't in the register.
  const invoiceable: CompletedRepair[] = useMemo(() => {
    const live: CompletedRepair[] = jobs
      .filter(j => j.status === "Completed")
      .map(j => ({
        id: j.id,
        dealer: findDealer(dealers, j)?.name ?? j.dealer ?? "",
        customerName: j.customerName,
        brand: j.brand,
        model: j.model,
        imei: j.imei ?? "",
        warranty: j.jobWarranty || "NO WARRANTY [NORMAL]",
        advance: j.advancePaid,
        unitPrice: j.estimatedCost,
        // Was hard-coded 0, so the column rendered a dash on every row and
        // sales.discount recorded "none given" whatever happened at the counter.
        // Applied here so grandTotal, totalDiscount, netDue and the invoice all
        // follow from one place.
        discount: Math.min(rowDiscounts[j.id] ?? 0, j.estimatedCost),
        issue: j.issue,
        createdAt: j.createdAt,
        completedAt: j.completedAt,
      }));
    const liveIds = new Set(live.map(r => r.id));
    return [
      ...live,
      ...COMPLETED_REPAIRS.filter(r => !liveIds.has(r.id))
        .map(r => ({ ...r, discount: Math.min(rowDiscounts[r.id] ?? r.discount, r.unitPrice) })),
    ];
  }, [jobs, dealers, rowDiscounts]);

  const q = search.toLowerCase();
  const dealerRepairs = invoiceable.filter(r =>
    !!selectedDealer && dealerKey(dealers, r.dealer) === dealerKey(dealers, selectedDealer) &&
    (!search || r.id.toLowerCase().includes(q) ||
      r.brand.toLowerCase().includes(q) ||
      r.model.toLowerCase().includes(q) ||
      r.imei.includes(search) ||
      r.customerName.toLowerCase().includes(q))
  );

  const selectedRepairs = invoiceable.filter(r => checkedIds.has(r.id));

  // Billing calculations
  const lineSubtotal  = selectedRepairs.reduce((s, r) => s + r.unitPrice, 0);
  const lineDiscounts = selectedRepairs.reduce((s, r) => s + r.discount, 0);
  // What the lines come to before anything is taken off the bill as a whole.
  const afterLines    = lineSubtotal - lineDiscounts;

  // Clamped to the bill: a percentage cannot exceed 100 and an amount cannot
  // exceed what is left, or the invoice ends up owing the customer money.
  const invDiscountAmt = Math.max(0, Math.min(
    invDiscountMode === "%"
      ? Math.round(afterLines * Math.min(100, parseFloat(invDiscount) || 0)) / 100
      : parseFloat(invDiscount) || 0,
    afterLines,
  ));

  const grandTotal    = afterLines - invDiscountAmt;
  const totalAdvance  = selectedRepairs.reduce((s, r) => s + r.advance, 0);
  // Everything the customer was let off, whichever level it was given at —
  // this is what sales.discount records and what the margin reports read.
  const totalDiscount = lineDiscounts + invDiscountAmt;
  const netDue        = Math.max(0, grandTotal - totalAdvance);

  // Amount received now — empty defaults to full net due (no credit)
  const receivedDisplay   = amountReceived === "" ? netDue.toString() : amountReceived;
  const effectiveReceived = parseFloat(receivedDisplay) || 0;
  const finalDue          = Math.max(0, netDue - effectiveReceived);
  const isCredit          = finalDue > 0;
  const isManoMobile      = isInHouseDealer(dealers, selectedDealer);
  // Written off means nothing goes on account, so there is no account to pick
  // — the customer section goes back to plain name and number.
  const useCreditPicker   = isManoMobile && isCredit && !writeOffBalance;

  // Identity comes from the Admin Control registry; the stats come from live
  // jobs, falling back to the canned figures for the demo-only dealers.
  const dealerProfile: DealerProfile | undefined = useMemo(() => {
    if (!selectedDealer) return undefined;
    const record  = findDealer(dealers, selectedDealer);
    const canned  = DEALER_PROFILES[selectedDealer];
    const key     = dealerKey(dealers, selectedDealer);
    const mine    = jobs.filter(j => dealerKey(dealers, j) === key);
    const live = {
      stats: {
        total:      mine.length,
        completed:  mine.filter(j => j.status === "Completed" || j.status === "Delivered").length,
        pending:    mine.filter(j => j.status === "Pending").length,
        inProgress: mine.filter(j => j.status === "Issued").length,
      },
      totalEarned: mine.filter(j => j.status === "Delivered").reduce((s, j) => s + j.estimatedCost, 0),
      outstanding: mine.filter(j => j.status === "Completed").reduce((s, j) => s + Math.max(0, j.estimatedCost - j.advancePaid), 0),
    };
    const figures = mine.length > 0 || !canned ? live : canned;
    return {
      phone:   record?.contact || "—",
      address: record?.address || "",
      since:   record?.joinedAt ? new Date(record.joinedAt).getFullYear().toString() : "—",
      ...figures,
    };
  }, [selectedDealer, dealers, jobs]);

  /**
   * Fill the customer fields from the dealer registry, or hand back what was
   * typed before.
   *
   * Only offered for an outside dealer. On a Mano Mobile job the "dealer" is
   * the shop itself, so billing it to the shop would name us as our own
   * customer.
   */
  const dealerRecord   = selectedDealer ? findDealer(dealers, selectedDealer) : undefined;
  const canBillDealer  = !!selectedDealer && !isManoMobile;

  const toggleBillToDealer = (on: boolean) => {
    if (on) {
      manualCustomer.current = { name: custName, phone: custPhone, nic: custNic };
      setCustName(dealerRecord?.name ?? selectedDealer);
      setCustPhone(dealerRecord?.contact ?? "");
      // A dealer is a business; an NIC belongs to a person.
      setCustNic("");
    } else {
      setCustName(manualCustomer.current.name);
      setCustPhone(manualCustomer.current.phone);
      setCustNic(manualCustomer.current.nic);
    }
    setBillToDealer(on);
  };

  /**
   * Everyone the shop has taken a repair from.
   *
   * There is no customers table — a customer exists as a name and a number on
   * each job — so this is built from the jobs themselves, one entry per phone
   * number with the most recent spelling of the name. Without it a returning
   * customer is retyped every visit, which is both slower and how one person
   * ends up on the books three times under three spellings.
   */
  const knownCustomers = useMemo(() => {
    const byPhone = new Map<string, { name: string; phone: string; email?: string; jobs: number }>();
    // Oldest first, so the newest spelling of a name wins.
    for (const j of [...jobs].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
      const phone = (j.phone ?? "").replace(/\D/g, "");
      const name = (j.customerName ?? "").trim();
      if (!phone || !name) continue;
      const prev = byPhone.get(phone);
      byPhone.set(phone, {
        name,
        phone: j.phone,
        email: j.customerEmail || prev?.email,
        jobs: (prev?.jobs ?? 0) + 1,
      });
    }
    return [...byPhone.values()];
  }, [jobs]);

  // Matched on whichever field is being typed. Hidden once the name is already
  // filled in from a match, so it does not hover over a finished form.
  const custQuery = `${custName} ${custPhone}`.trim().toLowerCase();
  const custMatches = custQuery.length < 3 ? [] : knownCustomers.filter(c =>
    c.name.toLowerCase().includes(custName.trim().toLowerCase() || "\u0000") ||
    (custPhone.trim() && c.phone.replace(/\D/g, "").includes(custPhone.replace(/\D/g, ""))),
  ).slice(0, 5);

  const showStep3 = !!selectedDealer && checkedIds.size > 0;

  const canGenerate = showStep3 &&
    (useCreditPicker ? !!selectedCreditCustomer : !!custName.trim()) &&
    true;

  // Effective customer for invoice
  const invoiceCustomer = useCreditPicker && selectedCreditCustomer
    ? { name: selectedCreditCustomer.name, phone: selectedCreditCustomer.phone ?? "", nic: selectedCreditCustomer.nic ?? "" }
    : { name: custName, phone: custPhone, nic: custNic };

  const toggleCheck = (id: string) => {
    setCheckedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
    setAmountReceived("");
    setSelectedCreditCustomer(null);
  };

  /** Header checkbox — selects every row currently listed for this dealer
   *  (i.e. whatever the search box has left visible), or clears the lot if
   *  they're already all checked. */
  const allChecked = dealerRepairs.length > 0 && dealerRepairs.every(r => checkedIds.has(r.id));
  const toggleCheckAll = () => {
    setCheckedIds(prev => {
      if (allChecked) {
        const next = new Set(prev);
        dealerRepairs.forEach(r => next.delete(r.id));
        return next;
      }
      return new Set([...prev, ...dealerRepairs.map(r => r.id)]);
    });
    setAmountReceived("");
    setSelectedCreditCustomer(null);
  };

  const handleReset = () => {
    setSelectedDealer(""); setCheckedIds(new Set()); setSearch("");
    setBillToDealer(false); manualCustomer.current = { name: "", phone: "", nic: "" };
    setCustName(""); setCustPhone(""); setCustNic(""); setAmountReceived("");
    setRowDiscounts({}); setWriteOffBalance(false); setInvDiscount("");
    setPayMethod("Cash"); setCardRef("");
    setSelectedCreditCustomer(null); setShowCreditConfirm(false); setCreditRecordMade(false);
    setInvoiceSnapshot(null); setView("search");
    setInvoiceNo(null);
  };

  const handleDealerChange = (val: string) => {
    setSelectedDealer(val); setCheckedIds(new Set()); setSearch("");
    // The filled-in details belong to the dealer being left behind.
    manualCustomer.current = { name: "", phone: "", nic: "" };
    setAmountReceived("");
    setRowDiscounts({}); setWriteOffBalance(false); setInvDiscount("");
    setPayMethod("Cash"); setCardRef("");
    setSelectedCreditCustomer(null); setShowCreditConfirm(false); setCreditRecordMade(false);
    setInvoiceSnapshot(null);
    setInvoiceNo(null);

    // Outside dealer: default to billing it to them — that's who actually
    // gets invoiced for a device they sent in, so ticking it every time was
    // just an extra click on the common case. Can't be done for Mano Mobile
    // itself (selectedDealer/dealerRecord below still reflect the dealer
    // being left, so this checks the incoming value directly).
    const billable = !!val && !isInHouseDealer(dealers, val);
    if (billable) {
      const record = findDealer(dealers, val);
      setCustName(record?.name ?? val);
      setCustPhone(record?.contact ?? "");
      setCustNic("");
    } else {
      setCustName(""); setCustPhone(""); setCustNic("");
    }
    setBillToDealer(billable);
  };

  /**
   * Record the sale from a snapshot taken before the jobs were issued.
   *
   * It MUST NOT read selectedRepairs, grandTotal or isCredit. Those are derived
   * from `invoiceable`, which only keeps status === "Completed" — so the moment
   * markIssued() flips the jobs to Delivered they are all empty or zero.
   *
   * That is not theoretical. On the dealer-credit path this is called from the
   * confirm modal, which renders after the flip has landed, and it was writing
   * sales with total 0 and no jobs attached — which in turn left every credit
   * charge with no invoice number on it, so three phones on one bill still
   * showed as three unlinked charges.
   */
  const recordRepairSale = (no: string, snap: BilledSnapshot) => {
    addSale(
      {
        invoiceNo: no,
        date: new Date().toISOString().slice(0, 10),
        customer: snap.customerName || snap.repairs[0]?.customerName || "Walk-in",
        category: "Repair",
        items: snap.repairs.map(r => `${r.brand} ${r.model}`).join(", ") || "Repair Invoice",
        total: snap.grandTotal,
        subtotal: snap.grandTotal + snap.totalDiscount,
        discountAmount: snap.totalDiscount,
        // What was billed and then forgiven, as opposed to what was knocked off
        // the price before billing. Different decisions, different reporting.
        badDebt: snap.badDebt,
        // Everything the customer has actually handed over against this bill:
        // whatever was taken as an advance at intake, plus what was taken now.
        // The rest is the balance the credit charge covers.
        paid: snap.totalAdvance + snap.effectiveReceived,
        status: "Paid",
        // Credit describes where the balance went, not how the money arrived,
        // so it only wins when there is actually a balance going on account.
        paymentMethod: snap.isCredit && snap.badDebt === 0 ? "Credit" : snap.payMethod,
        cardRef: snap.cardRef || undefined,
        cardAmount: snap.payMethod === "Card" ? snap.effectiveReceived : undefined,
        cashier: profile?.fullName?.trim() || undefined,
      },
      // What the printed invoice cannot carry: which dealer it was billed to,
      // whose account it landed on, and which jobs it covered. That last one is
      // what lets a job show the invoice it was billed on, and the reverse —
      // and what the credit charges are stamped through.
      {
        customerPhone: snap.customerPhone || null,
        dealerId: snap.dealerId,
        creditAccountId: snap.creditAccountId,
        jobIds: snap.repairs.map(r => r.id),
      },
    );
  };

  /** Everything the invoice was billed from, frozen before the jobs move. */
  const takeSnapshot = (): BilledSnapshot => ({
    repairs: selectedRepairs,
    totalAdvance,
    effectiveReceived,
    finalDue,
    grandTotal,
    totalDiscount,
    lineDiscounts,
    invoiceDiscount: invDiscountAmt,
    badDebt: writeOffBalance ? finalDue : 0,
    payMethod,
    cardRef,
    isCredit,
    customerName: invoiceCustomer.name,
    customerPhone: invoiceCustomer.phone,
    dealerId: dealerRecord ? Number(dealerRecord.id) : null,
    creditAccountId: selectedCreditCustomer?.id ?? null,
  });

  /**
   * Mark the selected repair jobs as issued (collected by the customer).
   *
   * Awaited, and awaited by both callers, because marking a job Delivered is
   * what makes the database raise its credit charge. Recording the sale then
   * stamps the invoice number onto those charges — and if the sale got there
   * first there would be nothing to stamp, so three phones on one bill would
   * stay three unlinked charges in the credit history instead of one invoice.
   *
   * Safe for jobs not present in the live repair list — updateJob simply no-ops.
   */
  const markIssued = async () => {
    const nowISO = new Date().toISOString();
    // Spread across the jobs on the invoice, largest first, so a multi-job bill
    // writes off against real lines rather than dumping it all on the first.
    const remaining = { left: writeOffBalance ? finalDue : 0 };
    const forgiven = (r: CompletedRepair) => {
      if (remaining.left <= 0) return 0;
      const owed = Math.max(0, (r.unitPrice - r.discount) - r.advance);
      const take = Math.min(owed, remaining.left);
      remaining.left -= take;
      return take;
    };
    await Promise.all([...selectedRepairs]
      .sort((a, b) => (b.unitPrice - b.discount - b.advance) - (a.unitPrice - a.discount - a.advance))
      .map(r =>
      updateJob(r.id, {
        writtenOff: forgiven(r),
        status: "Delivered",
        handover: {
          collectedBy: invoiceCustomer.name || r.customerName,
          relationship: "Owner",
          idVerified: true,
          balanceSettled: effectiveReceived,
          handoverSignature: "",
          warrantyCardIssued: false,
          handedOverBy: "Cashier",
          handedOverAt: nowISO,
        },
      }),
    ));
  };

  const handleGenerateInvoice = async () => {
    if (invoicing) return;
    setInvoicing(true);
    const no = await fetchNextInvoiceNo();
    setInvoiceNo(no);
    setInvoicing(false);
    // Snapshot before markIssued() flips these jobs to "Delivered" — see the
    // comment on invoiceSnapshot's declaration.
    const snap = takeSnapshot();
    setInvoiceSnapshot(snap);
    await markIssued();
    if (!isManoMobile && isCredit && !writeOffBalance) {
      // The sale is recorded from the confirm modal, which renders after the
      // flip — so it uses invoiceSnapshot, set just above, not live state.
      setShowCreditConfirm(true);
    } else {
      if (effectiveReceived > 0) {
        addEntry("in", `Cash — Repair Invoice ${no} (${selectedDealer})`, effectiveReceived);
      }
      recordRepairSale(no, snap);
      setView("invoice");
    }
  };

  // Mark as issued only — no print/invoice. Still a real completed sale
  // though, so it still gets a real invoice number for the books.
  const handleMarkIssued = async () => {
    if (invoicing) return;
    setInvoicing(true);
    const no = await fetchNextInvoiceNo();
    setInvoicing(false);
    const snap = takeSnapshot();
    setInvoiceSnapshot(snap);
    await markIssued();
    if (effectiveReceived > 0) {
      addEntry("in", `Cash — Repair Issued ${selectedDealer}`, effectiveReceived);
    }
    recordRepairSale(no, snap);
    setShowIssuedMsg(true);
  };

  if (view === "invoice" && invoiceSnapshot && invoiceNo) {
    return (
      <InvoiceView
        invoiceNo={invoiceNo}
        createdAt={createdAt}
        dealer={selectedDealer}
        customer={invoiceCustomer}
        isCredit={invoiceSnapshot.finalDue > 0}
        amountReceivedNow={invoiceSnapshot.effectiveReceived}
        dueAmount={invoiceSnapshot.finalDue}
        totalAdvance={invoiceSnapshot.totalAdvance}
        invoiceDiscount={invoiceSnapshot.invoiceDiscount}
        creditRecordMade={creditRecordMade}
        repairs={invoiceSnapshot.repairs}
        onBack={() => setView("search")}
      />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, flex: 1, minHeight: 0, overflowY: "auto", paddingRight: 4 }}>

      {/* Step 1 */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
        <p style={stepLabel}>Step 1 — Select a Dealer</p>
        <div style={{ position: "relative" }}>
          <select
            value={selectedDealer}
            onChange={(e) => handleDealerChange(e.target.value)}
            style={{ width: "100%", padding: "10px 36px 10px 14px", borderRadius: 9, border: "1px solid var(--border)", background: "var(--bg-primary)", color: selectedDealer ? "var(--text-primary)" : "var(--text-muted)", fontSize: 13, outline: "none", cursor: "pointer", appearance: "none", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            <option value="">— PLEASE SELECT A DEALER —</option>
            {dealerOptions.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <ChevronDown size={14} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
        </div>
      </div>

      {/* Step 2 */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <p style={stepLabel}>Step 2 — Select Finished Repairs for Invoicing</p>
          {checkedIds.size > 0 && (
            <span style={{ fontSize: 11, color: "var(--accent)", fontWeight: 600, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              {checkedIds.size} selected
            </span>
          )}
        </div>

        <div style={{ position: "relative" }}>
          <Search size={13} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by ID, brand, model, IMEI, customer..."
            disabled={!selectedDealer}
            style={{ width: "100%", padding: "9px 14px 9px 32px", borderRadius: 8, border: "1px solid var(--border)", background: selectedDealer ? "var(--bg-primary)" : "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 12.5, outline: "none", fontFamily: "'Plus Jakarta Sans', sans-serif", opacity: selectedDealer ? 1 : 0.5, boxSizing: "border-box" }}
          />
        </div>

        <div className="table-scroll" style={{ border: "1px solid var(--border)", borderRadius: 10, minHeight: 200, background: "var(--bg-primary)" }}>
          {!selectedDealer ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, color: "var(--text-muted)", fontSize: 13, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              Select a dealer to see their completed repairs
            </div>
          ) : dealerRepairs.length === 0 ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, color: "var(--text-muted)", fontSize: 13, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              No completed repairs found
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 940 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
                  {/* Advance and Balance sit after the line total because that
                      is the order the money moved: what the job was billed at,
                      what the customer already put down at intake, and what is
                      left to collect at the counter now. Without them, deciding
                      what to charge meant opening every job.

                      An outside dealer's device has no Mano Mobile customer to
                      name, and no advance of ours on record — the dealer is who
                      we billed, and what they may have taken from the end owner
                      isn't ours to show. In its place: the fault and the two
                      dates that actually matter to a dealer chasing up a job —
                      when it came in, when it was finished. */}
                  {(isManoMobile
                    ? ["", "Job ID", "Customer", "Brand / Model", "IMEI No.", "Warranty", "Unit Price", "Discount", "Line Total", "Advance Paid", "Balance"]
                    : ["", "Job ID", "Brand / Model", "IMEI No.", "Fault", "Job Accepted", "Finished", "Warranty", "Estimate", "Discount", "Line Total", "Balance"]
                  ).map((h, i) => (
                    <th key={h} style={{ padding: "9px 14px", textAlign: h === "" ? "center" : "left", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.06em", textTransform: "uppercase" as const, fontFamily: "'Plus Jakarta Sans', sans-serif", whiteSpace: "nowrap" }}>
                      {i === 0 ? (
                        <input
                          type="checkbox"
                          checked={allChecked}
                          onChange={toggleCheckAll}
                          title={allChecked ? "Deselect all" : "Select all"}
                          style={{ accentColor: "var(--accent)", width: 14, height: 14, cursor: "pointer", verticalAlign: "middle" }}
                        />
                      ) : h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dealerRepairs.map((r, i) => {
                  const checked   = checkedIds.has(r.id);
                  const lineTotal = r.unitPrice - r.discount;
                  // Never negative: an advance larger than the final bill is a
                  // refund, not a balance, and showing it as "− Rs. 200 to
                  // collect" would read as money owed to the shop.
                  const balance   = Math.max(0, lineTotal - r.advance);
                  return (
                    <tr
                      key={r.id}
                      onClick={() => toggleCheck(r.id)}
                      style={{ borderBottom: i < dealerRepairs.length - 1 ? "1px solid var(--border)" : "none", background: checked ? "var(--accent-dim)" : "transparent", cursor: "pointer", transition: "background 0.12s" }}
                      onMouseEnter={(e) => { if (!checked) (e.currentTarget as HTMLTableRowElement).style.background = "var(--bg-card-hover)"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = checked ? "var(--accent-dim)" : "transparent"; }}
                    >
                      <td style={{ padding: "11px 14px", textAlign: "center" }}>
                        <input type="checkbox" checked={checked} onChange={() => toggleCheck(r.id)} onClick={(e) => e.stopPropagation()} style={{ accentColor: "var(--accent)", width: 14, height: 14, cursor: "pointer" }} />
                      </td>
                      <td style={{ padding: "11px 14px" }}><span style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{r.id}</span></td>
                      {isManoMobile && (
                        <td style={{ padding: "11px 14px" }}><p style={{ fontSize: 12.5, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{r.customerName}</p></td>
                      )}
                      <td style={{ padding: "11px 14px" }}><p style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{r.brand} {r.model}</p></td>
                      <td style={{ padding: "11px 14px" }}><span style={{ fontSize: 11.5, color: "var(--text-muted)", fontFamily: "monospace" }}>{r.imei}</span></td>
                      {!isManoMobile && (
                        <>
                          <td style={{ padding: "11px 14px" }}><span style={{ fontSize: 11.5, color: "var(--text-secondary)", fontFamily: "'Plus Jakarta Sans', sans-serif", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }} title={r.issue}>{r.issue || "—"}</span></td>
                          <td style={{ padding: "11px 14px" }}><span style={{ fontSize: 11.5, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif", whiteSpace: "nowrap" }}>{fmtDate(r.createdAt)}</span></td>
                          <td style={{ padding: "11px 14px" }}><span style={{ fontSize: 11.5, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif", whiteSpace: "nowrap" }}>{fmtDate(r.completedAt)}</span></td>
                        </>
                      )}
                      <td style={{ padding: "11px 14px" }}><span style={{ fontSize: 11.5, color: "var(--text-secondary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{r.warranty}</span></td>
                      <td style={{ padding: "11px 14px" }}><span style={{ fontSize: 12, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Rs. {r.unitPrice.toLocaleString()}</span></td>
                      <td style={{ padding: "11px 14px" }} onClick={e => { if (mayDiscount) e.stopPropagation(); }}>
                        {mayDiscount ? (
                          <input
                            type="number"
                            min={0}
                            max={r.unitPrice}
                            value={rowDiscounts[r.id] ?? ""}
                            placeholder="0"
                            onChange={e => {
                              const v = Math.max(0, Math.min(parseFloat(e.target.value) || 0, r.unitPrice));
                              setRowDiscounts(d => {
                                if (v === 0) { const rest = { ...d }; delete rest[r.id]; return rest; }
                                return { ...d, [r.id]: v };
                              });
                            }}
                            style={{
                              width: 92, padding: "5px 8px", borderRadius: 7, fontSize: 12,
                              border: `1px solid ${r.discount > 0 ? "rgba(248,113,113,0.45)" : "var(--border)"}`,
                              background: "var(--bg-primary)",
                              color: r.discount > 0 ? "#f87171" : "var(--text-primary)",
                              fontFamily: "'Plus Jakarta Sans', sans-serif", outline: "none",
                            }}
                          />
                        ) : (
                          <span style={{ fontSize: 12, color: r.discount > 0 ? "#f87171" : "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                            {r.discount > 0 ? `− Rs. ${r.discount.toLocaleString()}` : "—"}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "11px 14px" }}><span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Rs. {lineTotal.toLocaleString()}</span></td>
                      {isManoMobile && (
                        <td style={{ padding: "11px 14px" }}>
                          <span style={{ fontSize: 12, color: r.advance > 0 ? "#4ade80" : "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                            {r.advance > 0 ? `Rs. ${r.advance.toLocaleString()}` : "—"}
                          </span>
                        </td>
                      )}
                      <td style={{ padding: "11px 14px" }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: balance > 0 ? "var(--text-primary)" : "#4ade80", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                          {balance > 0 ? `Rs. ${balance.toLocaleString()}` : "Settled"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {!mayDiscount && dealerRepairs.length > 0 && (
            <p style={{ fontSize: 11.5, color: "var(--text-muted)", padding: "10px 14px 0", lineHeight: 1.55, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              Discounts are locked for your account. An Admin can grant{" "}
              <strong>Settle below the agreed price</strong> under Permissions → Cashiers.
            </p>
          )}
        </div>
      </div>

      {/* Step 3: Billing — only when dealer selected + repairs checked */}
      {showStep3 && (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <p style={stepLabel}>Step 3 — Billing</p>
            {/* Refreshed on the assigned number, so once this bill is generated
                the panel moves on instead of still offering the number it just
                used. */}
            <InvoiceNoBadge refreshKey={invoiceNo} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))", gap: 16, alignItems: "start" }}>

            {/* ── Bill Info ── */}
            <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 10, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 0 }}>
              <div style={cardHead}>Bill Info</div>

              {/* Selected items */}
              <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 13 }}>
                {selectedRepairs.map(r => (
                  <div key={r.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                    <span style={{ color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "60%" }}>{r.id} · {r.brand} {r.model}</span>
                    <span style={{ fontWeight: 600, color: "var(--text-primary)", flexShrink: 0 }}>Rs. {(r.unitPrice - r.discount).toLocaleString()}</span>
                  </div>
                ))}
              </div>

              <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { label: "Subtotal",        value: fmtRs(lineSubtotal), color: "var(--text-primary)" },
                  // Shown apart, not summed, because they answer different
                  // questions later: what was conceded on the work, and what
                  // was conceded on the relationship.
                  { label: "Line Discounts",  value: lineDiscounts > 0 ? `− Rs. ${lineDiscounts.toLocaleString()}` : "—", color: lineDiscounts > 0 ? "#f87171" : "var(--text-muted)" },
                  { label: "Invoice Discount", value: invDiscountAmt > 0 ? `− Rs. ${invDiscountAmt.toLocaleString()}` : "—", color: invDiscountAmt > 0 ? "#f87171" : "var(--text-muted)" },
                  { label: "Net Total",       value: fmtRs(grandTotal), color: "var(--text-primary)" },
                  { label: "Advance Paid",   value: totalAdvance > 0 ? `− Rs. ${totalAdvance.toLocaleString()}` : "—", color: totalAdvance > 0 ? "#4ade80" : "var(--text-muted)" },
                ].map(row => {
                  const lead = row.label === "Net Total";
                  return (
                    <div key={row.label} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: lead ? 14 : 13, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                      <span style={{ color: lead ? "var(--text-secondary)" : "var(--text-muted)", fontWeight: lead ? 600 : 400 }}>{row.label}</span>
                      <span style={{ fontWeight: lead ? 800 : 600, color: row.color }}>{row.value}</span>
                    </div>
                  );
                })}

                {/* Discount on the whole bill */}
                {mayDiscount && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, fontSize: 13, fontFamily: "'Plus Jakarta Sans', sans-serif", marginTop: 6, marginBottom: 2 }}>
                    <span style={{ color: "var(--text-muted)" }}>Discount whole invoice</span>
                    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                      <div style={{ display: "flex", gap: 2, background: "var(--bg-primary)", border: "1px solid var(--border)", borderRadius: 6, padding: 2 }}>
                        {(["Rs", "%"] as const).map(m => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setInvDiscountMode(m)}
                            style={{
                              padding: "4px 9px", borderRadius: 5, fontSize: 12, cursor: "pointer",
                              border: "none", fontFamily: "'Plus Jakarta Sans', sans-serif",
                              fontWeight: invDiscountMode === m ? 700 : 500,
                              background: invDiscountMode === m ? "var(--accent-dim)" : "transparent",
                              color: invDiscountMode === m ? "var(--accent)" : "var(--text-muted)",
                            }}
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                      <input
                        type="number"
                        min={0}
                        max={invDiscountMode === "%" ? 100 : afterLines}
                        value={invDiscount}
                        placeholder="0"
                        onChange={e => setInvDiscount(e.target.value)}
                        style={{ width: 86, padding: "6px 9px", borderRadius: 7, border: `1px solid ${invDiscountAmt > 0 ? "rgba(248,113,113,0.45)" : "var(--border)"}`, background: "var(--bg-primary)", color: invDiscountAmt > 0 ? "#f87171" : "var(--text-primary)", fontSize: 13, outline: "none", textAlign: "right", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                      />
                    </div>
                  </div>
                )}

                {/* Balance after advance */}
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 16, fontWeight: 800, fontFamily: "'Plus Jakarta Sans', sans-serif", paddingTop: 10, borderTop: "1px solid var(--border)", marginTop: 8 }}>
                  <span style={{ color: "var(--text-secondary)" }}>Balance Due</span>
                  <span style={{ color: "var(--text-primary)" }}>Rs. {netDue.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* ── Payment ── */}
            <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 10, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={cardHead}>Payment</div>

              <div>
                <label style={labelSt}>Method</label>
                <div style={{ display: "flex", gap: 5 }}>
                  {(["Cash", "Card", "Bank Transfer"] as const).map(m => {
                    const on = payMethod === m;
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setPayMethod(m)}
                        style={{
                          flex: 1, minHeight: 34, borderRadius: 8, fontSize: 11.5, cursor: "pointer",
                          fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: on ? 700 : 500,
                          border: `1px solid ${on ? "var(--accent)" : "var(--border)"}`,
                          background: on ? "var(--accent-dim)" : "var(--bg-primary)",
                          color: on ? "var(--accent)" : "var(--text-secondary)",
                          whiteSpace: "nowrap", padding: "0 6px",
                        }}
                      >
                        {m === "Bank Transfer" ? "Transfer" : m}
                      </button>
                    );
                  })}
                </div>
              </div>

              {payMethod !== "Cash" && (
                <div>
                  <label style={labelSt}>{payMethod === "Card" ? "Card reference / last 4" : "Transfer reference"}</label>
                  <input value={cardRef} onChange={e => setCardRef(e.target.value)} placeholder="Optional" style={inputSt} />
                </div>
              )}


                {/* Amount received now — editable */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, fontSize: 13, fontFamily: "'Plus Jakarta Sans', sans-serif", marginTop: 4 }}>
                  <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>Amount Received Now</span>
                  <input
                    type="number" min={0} max={netDue}
                    value={receivedDisplay}
                    onChange={e => setAmountReceived(e.target.value)}
                    style={{ width: 120, padding: "7px 10px", borderRadius: 7, border: `1px solid ${isCredit ? "rgba(251,191,36,0.5)" : "rgba(74,222,128,0.4)"}`, background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 14, fontWeight: 700, outline: "none", textAlign: "right", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                  />
                </div>

                {/* Offered only when there is something left to forgive, and only
                    to somebody trusted to take money off a bill — it is the same
                    decision as a discount, made after billing instead of before. */}
                {isCredit && mayDiscount && (
                  <label style={{
                    display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer",
                    marginTop: 8, padding: "8px 10px", borderRadius: 8,
                    background: writeOffBalance ? "rgba(251,191,36,0.08)" : "var(--bg-primary)",
                    border: `1px solid ${writeOffBalance ? "rgba(251,191,36,0.4)" : "var(--border)"}`,
                  }}>
                    <input
                      type="checkbox"
                      checked={writeOffBalance}
                      onChange={e => setWriteOffBalance(e.target.checked)}
                      style={{ width: 14, height: 14, accentColor: "#fbbf24", cursor: "pointer", flexShrink: 0, marginTop: 1 }}
                    />
                    <span style={{ minWidth: 0 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif", display: "block" }}>
                        Write off Rs. {finalDue.toLocaleString()} as bad debt
                      </span>
                      <span style={{ fontSize: 11.5, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif", lineHeight: 1.5 }}>
                        Nothing goes on account and no credit record is opened. The job settles here.
                      </span>
                    </span>
                  </label>
                )}

                <div style={{ borderTop: "1px solid var(--border)", marginTop: 6, paddingTop: 8 }}>
                  {isCredit && writeOffBalance ? (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", borderRadius: 8, background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.35)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <Undo2 size={12} color="#fbbf24" />
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#fbbf24", letterSpacing: "0.04em" }}>WRITTEN OFF</span>
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 800, color: "#fbbf24" }}>Rs. {finalDue.toLocaleString()}</span>
                    </div>
                  ) : isCredit ? (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", borderRadius: 8, background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.3)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <CreditCard size={12} color="#fbbf24" />
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#fbbf24", letterSpacing: "0.04em" }}>CREDIT DUE</span>
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 800, color: "#fbbf24" }}>Rs. {finalDue.toLocaleString()}</span>
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 10px", borderRadius: 8, background: "rgba(74,222,128,0.07)", border: "1px solid rgba(74,222,128,0.25)" }}>
                      <CheckCircle size={12} color="#4ade80" />
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: "#4ade80" }}>FULLY SETTLED</span>
                    </div>
                  )}
                </div>

                {isCredit && !writeOffBalance && (
                  <p style={{ fontSize: 11.5, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif", marginTop: 8, lineHeight: 1.55 }}>
                    {isManoMobile
                      ? "Due amount will be credited to the selected customer's credit profile."
                      : "Due amount will be logged against the dealer's outstanding balance."}
                  </p>
                )}
            </div>

            {/* ── Dealer Info ── */}
            {!isManoMobile && (
            <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 10, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={cardHead}>Dealer Info</div>

              {/* Dealer identity */}
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10, paddingBottom: 12, borderBottom: "1px solid var(--border)" }}>
                <div style={{ width: 36, height: 36, borderRadius: 9, background: "var(--accent-dim)", border: "1px solid var(--accent-glow)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Building2 size={16} color="var(--accent)" />
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{selectedDealer}</p>
                  {dealerProfile && (
                    <>
                      {dealerProfile.address && (
                        <p style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif", marginTop: 2 }}>{dealerProfile.address}</p>
                      )}
                      <p style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif", marginTop: 2 }}>{dealerProfile.phone}</p>
                      <p style={{ fontSize: 10.5, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif", marginTop: 1 }}>Partner since {dealerProfile.since}</p>
                    </>
                  )}
                </div>
              </div>

              {dealerProfile && (
                <>
                  {/* Repair stats */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {[
                      { label: "Total Jobs",    value: dealerProfile.stats.total,      icon: Wrench,       color: "var(--accent)" },
                      { label: "Completed",     value: dealerProfile.stats.completed,  icon: CheckCircle,  color: "#4ade80" },
                      { label: "Pending",       value: dealerProfile.stats.pending,    icon: AlertCircle,  color: "#fbbf24" },
                      { label: "In Progress",   value: dealerProfile.stats.inProgress, icon: Clock,        color: "#60a5fa" },
                    ].map(({ label, value, icon: Icon, color }) => (
                      <div key={label} style={{ background: "var(--bg-primary)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", display: "flex", alignItems: "center", gap: 7 }}>
                        <Icon size={12} color={color} />
                        <div>
                          <p style={{ fontSize: 15, fontWeight: 700, color, fontFamily: "'Plus Jakarta Sans', sans-serif", lineHeight: 1 }}>{value}</p>
                          <p style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif", marginTop: 2 }}>{label}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Financial summary */}
                  <div style={{ paddingTop: 10, borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 7 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 5, color: "var(--text-muted)" }}>
                        <TrendingUp size={12} color="#4ade80" />Total Earned
                      </div>
                      <span style={{ fontWeight: 700, color: "#4ade80" }}>Rs. {dealerProfile.totalEarned.toLocaleString()}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 5, color: "var(--text-muted)" }}>
                        <AlertCircle size={12} color={dealerProfile.outstanding > 0 ? "#f87171" : "var(--text-muted)"} />Outstanding
                      </div>
                      <span style={{ fontWeight: 700, color: dealerProfile.outstanding > 0 ? "#f87171" : "var(--text-muted)" }}>
                        {dealerProfile.outstanding > 0 ? `Rs. ${dealerProfile.outstanding.toLocaleString()}` : "—"}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>
            )}

            {/* ── Customer Info ── */}
            <div style={{ background: "var(--bg-secondary)", border: `1px solid ${useCreditPicker ? "rgba(251,191,36,0.3)" : "var(--border)"}`, borderRadius: 10, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 11 }}>
              <div style={{ ...cardHead, color: useCreditPicker ? "#fbbf24" : "var(--text-muted)" }}>
                Customer Info
                {useCreditPicker && <span style={{ marginLeft: 6, fontSize: 9, color: "#fbbf24" }}>· CREDIT REQUIRED</span>}
              </div>

              {useCreditPicker ? (
                /* Mano Mobile + due → Credit Customer Picker */
                <CreditCustomerPicker
                  selected={selectedCreditCustomer}
                  onSelect={setSelectedCreditCustomer}
                />
              ) : (
                /* Simple customer entry */
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {canBillDealer && (
                    <label
                      style={{
                        display: "flex", alignItems: "flex-start", gap: 9, cursor: "pointer",
                        padding: "9px 11px", borderRadius: 9,
                        background: billToDealer ? "rgba(99,85,255,0.07)" : "var(--bg-primary)",
                        border: `1px solid ${billToDealer ? "var(--accent-glow)" : "var(--border)"}`,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={billToDealer}
                        onChange={e => toggleBillToDealer(e.target.checked)}
                        style={{ width: 15, height: 15, accentColor: "var(--accent)", cursor: "pointer", flexShrink: 0, marginTop: 1 }}
                      />
                      <span style={{ minWidth: 0 }}>
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif", display: "block" }}>
                          Set as {dealerRecord?.name ?? selectedDealer}
                        </span>
                        <span style={{ fontSize: 10.5, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif", lineHeight: 1.5 }}>
                          Bill the dealer rather than the phone&apos;s owner — fills these fields from the dealer registry.
                        </span>
                      </span>
                    </label>
                  )}

                  <div style={{ position: "relative" }}>
                    <label style={labelSt}>Full Name *</label>
                    <input
                      value={custName}
                      onChange={e => { setCustName(e.target.value); setCustMatchOpen(true); }}
                      onFocus={() => setCustMatchOpen(true)}
                      // A blur that fires before the click on a suggestion would
                      // close the list out from under the pointer.
                      onBlur={() => setTimeout(() => setCustMatchOpen(false), 150)}
                      readOnly={billToDealer}
                      placeholder="Customer full name"
                      autoComplete="off"
                      style={{ ...inputSt, ...(billToDealer ? lockedSt : null) }}
                    />

                    {!billToDealer && custMatchOpen && custMatches.length > 0 && (
                      <div style={{
                        position: "absolute", top: "100%", left: 0, right: 0, zIndex: 20, marginTop: 4,
                        background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 9,
                        boxShadow: "0 12px 32px rgba(0,0,0,0.35)", overflow: "hidden",
                      }}>
                        {custMatches.map(c => (
                          <button
                            key={c.phone}
                            type="button"
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => {
                              setCustName(c.name);
                              setCustPhone(c.phone);
                              setCustMatchOpen(false);
                            }}
                            style={{
                              display: "flex", alignItems: "center", gap: 10, width: "100%",
                              padding: "8px 11px", background: "transparent", border: "none",
                              borderBottom: "1px solid var(--border)", cursor: "pointer", textAlign: "left",
                              fontFamily: "'Plus Jakarta Sans', sans-serif",
                            }}
                            onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-card-hover)"}
                            onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = "transparent"}
                          >
                            <BookUser size={12} style={{ color: "var(--accent)", flexShrink: 0 }} />
                            <span style={{ flex: 1, minWidth: 0 }}>
                              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", display: "block" }}>{c.name}</span>
                              <span style={{ fontSize: 10.5, color: "var(--text-muted)" }}>
                                {c.phone} · {c.jobs} {c.jobs === 1 ? "repair" : "repairs"}
                              </span>
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <label style={labelSt}>Phone</label>
                    <input
                      value={custPhone}
                      onChange={e => { setCustPhone(e.target.value); setCustMatchOpen(true); }}
                      onFocus={() => setCustMatchOpen(true)}
                      onBlur={() => setTimeout(() => setCustMatchOpen(false), 150)}
                      readOnly={billToDealer}
                      placeholder={billToDealer ? "No contact number on the dealer record" : "07X XXX XXXX"}
                      style={{ ...inputSt, ...(billToDealer ? lockedSt : null) }}
                    />
                  </div>
                  {/* A dealer has no NIC, so the field goes away rather than
                      sitting there greyed out inviting a number that would be
                      wrong whatever was put in it. */}
                  {!billToDealer && (
                    <div>
                      <label style={labelSt}>NIC</label>
                      <input value={custNic} onChange={e => setCustNic(e.target.value)} placeholder="XXXXXXXXX V" style={inputSt} />
                    </div>
                  )}
                  {billToDealer && !custPhone.trim() && (
                    <p style={{ fontSize: 10.5, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif", lineHeight: 1.5 }}>
                      No contact number on this dealer&apos;s record. Add one under Admin Control → Repair Dealers.
                    </p>
                  )}
                  {!custName.trim() && (
                    <p style={{ fontSize: 10.5, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                      Name is required to generate the invoice.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Generate Invoice button row */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, paddingTop: 4 }}>
            <button
              onClick={handleReset}
              style={{ padding: "9px 20px", borderRadius: 9, fontSize: 12, fontWeight: 600, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif", transition: "all 0.15s" }}
            >
              <X size={12} style={{ display: "inline", marginRight: 5, verticalAlign: "middle" }} />Cancel
            </button>
            <button
              onClick={handleMarkIssued}
              disabled={!canGenerate || invoicing}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 20px", borderRadius: 9, fontSize: 12, fontWeight: 600, border: `1px solid ${canGenerate && !invoicing ? "var(--accent-glow)" : "var(--border)"}`, background: canGenerate && !invoicing ? "var(--accent-dim)" : "transparent", color: canGenerate && !invoicing ? "var(--accent)" : "var(--text-muted)", cursor: canGenerate && !invoicing ? "pointer" : "not-allowed", opacity: canGenerate && !invoicing ? 1 : 0.5, fontFamily: "'Plus Jakarta Sans', sans-serif", transition: "all 0.15s" }}
            >
              <CheckCircle size={13} />Mark As Issued
            </button>
            <button
              onClick={handleGenerateInvoice}
              disabled={!canGenerate || invoicing}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 24px", borderRadius: 9, fontSize: 12, fontWeight: 700, border: `1px solid ${canGenerate && !invoicing ? "var(--accent)" : "var(--border)"}`, background: canGenerate && !invoicing ? "var(--accent)" : "var(--border)", color: canGenerate && !invoicing ? "var(--accent-fg)" : "var(--text-muted)", cursor: canGenerate && !invoicing ? "pointer" : "not-allowed", opacity: canGenerate && !invoicing ? 1 : 0.5, fontFamily: "'Plus Jakarta Sans', sans-serif", transition: "all 0.15s" }}
            >
              <Printer size={13} />{invoicing ? "Generating invoice…" : "Issue & Generate Invoice"}
            </button>
          </div>
        </div>
      )}

      {/* Credit record confirmation modal */}
      {showCreditConfirm && (
        <CreditRecordConfirmModal
          dealer={selectedDealer}
          dueAmount={invoiceSnapshot?.finalDue ?? finalDue}
          onConfirm={() => { if (!invoiceNo || !invoiceSnapshot) return; setCreditRecordMade(true); setShowCreditConfirm(false); recordRepairSale(invoiceNo, invoiceSnapshot); setView("invoice"); }}
          onSkip={() => { if (!invoiceNo || !invoiceSnapshot) return; setCreditRecordMade(false); setShowCreditConfirm(false); recordRepairSale(invoiceNo, invoiceSnapshot); setView("invoice"); }}
          onCancel={() => setShowCreditConfirm(false)}
        />
      )}

      {/* "Marked as Issued" info message */}
      {showIssuedMsg && typeof document !== "undefined" && createPortal(
        <div
          onClick={() => { setShowIssuedMsg(false); handleReset(); }}
          style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
        >
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 420, background: "var(--bg-card)", borderRadius: 16, border: "1px solid var(--border)", boxShadow: "0 32px 80px rgba(0,0,0,0.5)", padding: "26px 24px", textAlign: "center", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            <div style={{ width: 52, height: 52, borderRadius: "50%", background: "rgba(74,222,128,0.12)", border: "2px solid #4ade80", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
              <CheckCircle size={26} color="#4ade80" />
            </div>
            <p style={{ fontSize: 17, fontWeight: 800, color: "var(--text-primary)" }}>Job Marked as Issued</p>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 8, lineHeight: 1.55 }}>
              This won&apos;t generate a print. If you need to print, you can find the job in <strong style={{ color: "var(--text-primary)" }}>Repair Management</strong>.
            </p>
            <button
              onClick={() => { setShowIssuedMsg(false); handleReset(); }}
              style={{ marginTop: 18, width: "100%", padding: "10px", borderRadius: 10, border: "none", background: "var(--accent)", color: "var(--accent-fg)", fontSize: 13.5, fontWeight: 700, cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              OK
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* Cancel button when step 3 not visible yet */}
      {!showStep3 && (selectedDealer || checkedIds.size > 0) && (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button onClick={handleReset} style={{ padding: "9px 20px", borderRadius: 9, fontSize: 12, fontWeight: 600, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
