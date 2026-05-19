"use client";

import { useState, useRef, useMemo } from "react";
import { useCashRegister } from "@/cashier/contexts/CashRegisterContext";
import { useSales } from "@/cashier/contexts/SalesContext";
import {
  Search, ArrowLeft, Printer, ChevronDown,
  Building2, CheckCircle, Clock, Wrench, TrendingUp, AlertCircle,
  CreditCard, X, BookUser,
} from "lucide-react";
import { createPortal } from "react-dom";
import CreditCustomerPicker, { INITIAL_POS_CREDIT_CUSTOMERS, POSCreditCustomer } from "./CreditCustomerPicker";

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
}

interface DealerProfile {
  phone: string;
  since: string;
  stats: { total: number; completed: number; pending: number; inProgress: number };
  totalEarned: number;
  outstanding: number;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const COMPLETED_REPAIRS: CompletedRepair[] = [
  { id: "RM-004", dealer: "MANO MOBILE CENTRE",  customerName: "Dilini Rajapaksa",  brand: "Apple",   model: "iPhone 13",    imei: "356822002345678", warranty: "3 MONTHS WARRANTY [NORMAL]", advance: 15000, unitPrice: 15000, discount: 0 },
  { id: "RM-008", dealer: "MANO MOBILE CENTRE",  customerName: "Isuru Madushanka",  brand: "OnePlus", model: "Nord 3",        imei: "860123456789012", warranty: "1 MONTH WARRANTY [NORMAL]",  advance: 6000,  unitPrice: 6000,  discount: 0 },
  { id: "RM-009", dealer: "MANO MOBILE CENTRE",  customerName: "Dilini Rajapaksa",  brand: "Samsung", model: "Galaxy A52",    imei: "354668771114184", warranty: "3 MONTHS WARRANTY [NORMAL]", advance: 3500,  unitPrice: 7000,  discount: 500 },
  { id: "RM-010", dealer: "CITY PHONE REPAIRS",  customerName: "Kasun Perera",      brand: "Xiaomi",  model: "Redmi Note 11", imei: "351988100241349", warranty: "NO WARRANTY [NORMAL]",       advance: 0,     unitPrice: 2500,  discount: 0 },
  { id: "RM-011", dealer: "CITY PHONE REPAIRS",  customerName: "Nimali Silva",      brand: "Vivo",    model: "Y21",           imei: "864562049583598", warranty: "6 MONTHS WARRANTY [NORMAL]", advance: 1000,  unitPrice: 4000,  discount: 200 },
  { id: "RM-012", dealer: "MANO MOBILE CENTRE",  customerName: "Nimali Silva",      brand: "Samsung", model: "Galaxy A14",    imei: "352667108901234", warranty: "NO WARRANTY [FOC]",          advance: 0,     unitPrice: 3200,  discount: 0 },
  { id: "RM-013", dealer: "SMART FIX SOLUTIONS", customerName: "Kasun Perera",      brand: "Apple",   model: "iPhone SE",     imei: "350023456789012", warranty: "3 MONTHS WARRANTY [NORMAL]", advance: 5000,  unitPrice: 12000, discount: 0 },
  { id: "RM-014", dealer: "SMART FIX SOLUTIONS", customerName: "Samantha Bandara",  brand: "Oppo",    model: "A78",           imei: "867543210987654", warranty: "1 MONTH WARRANTY [NORMAL]",  advance: 0,     unitPrice: 1800,  discount: 100 },
];

const DEALERS = Array.from(new Set(COMPLETED_REPAIRS.map(r => r.dealer))).sort();

const DEALER_PROFILES: Record<string, DealerProfile> = {
  "MANO MOBILE CENTRE":  { phone: "0112 345 678", since: "2022", stats: { total: 47, completed: 38, pending: 5, inProgress: 4 }, totalEarned: 285000, outstanding: 12500 },
  "CITY PHONE REPAIRS":  { phone: "0114 567 890", since: "2023", stats: { total: 22, completed: 17, pending: 3, inProgress: 2 }, totalEarned: 112000, outstanding: 8000 },
  "SMART FIX SOLUTIONS": { phone: "0117 890 123", since: "2024", stats: { total: 14, completed: 10, pending: 2, inProgress: 2 }, totalEarned: 76000,  outstanding: 0 },
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
  fontSize: 10, fontWeight: 700, color: "var(--text-muted)",
  letterSpacing: "0.1em", textTransform: "uppercase",
  fontFamily: "'Plus Jakarta Sans', sans-serif", marginBottom: 12,
};

const inputSt: React.CSSProperties = {
  width: "100%", padding: "8px 10px", borderRadius: 8,
  border: "1px solid var(--border)", background: "var(--bg-primary)",
  color: "var(--text-primary)", fontSize: 12.5, outline: "none",
  fontFamily: "'Plus Jakarta Sans', sans-serif", boxSizing: "border-box",
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

function InvoiceView({ invoiceNo, createdAt, dealer, customer, isCredit, amountReceivedNow, dueAmount, totalAdvance, creditRecordMade, repairs, onBack }: {
  invoiceNo: string;
  createdAt: string;
  dealer: string;
  customer: { name: string; phone: string; nic: string };
  isCredit: boolean;
  amountReceivedNow: number;
  dueAmount: number;
  totalAdvance: number;
  creditRecordMade: boolean;
  repairs: CompletedRepair[];
  onBack: () => void;
}) {
  const invoiceRef = useRef<HTMLDivElement>(null);
  const grandTotal  = repairs.reduce((s, r) => s + r.unitPrice - r.discount, 0);
  const paidAmount  = totalAdvance + amountReceivedNow;
  const paymentType = isCredit ? "CREDIT" : "CASH / FULL";

  const handlePrint = () => {
    if (!invoiceRef.current) return;
    const printDiv = document.createElement("div");
    printDiv.id = "__rp_inv__";
    printDiv.innerHTML = invoiceRef.current.outerHTML;
    document.body.appendChild(printDiv);
    const styleEl = document.createElement("style");
    styleEl.id = "__rp_inv_style__";
    styleEl.textContent = `
      @page { size: A4 landscape; margin: 12mm; }
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
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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
              <p style={{ fontSize: 13, fontWeight: 700 }}>{dealer}</p>
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
      </div>
    </div>
  );
}

// ─── Repair Sales Main ────────────────────────────────────────────────────────

export default function RepairSales() {
  const { addEntry } = useCashRegister();
  const { addSale } = useSales();
  const [view,           setView]           = useState<"search" | "invoice">("search");
  const [selectedDealer, setSelectedDealer] = useState("");
  const [checkedIds,     setCheckedIds]     = useState<Set<string>>(new Set());
  const [search,         setSearch]         = useState("");

  // Step 3 — Customer Info
  const [custName,  setCustName]  = useState("");
  const [custPhone, setCustPhone] = useState("");
  const [custNic,   setCustNic]   = useState("");

  // Step 3 — Amount received now
  const [amountReceived, setAmountReceived] = useState("");

  // Step 3 — Credit customer (Mano Mobile + due)
  const [creditCustomers,        setCreditCustomers]        = useState<POSCreditCustomer[]>(INITIAL_POS_CREDIT_CUSTOMERS);
  const [selectedCreditCustomer, setSelectedCreditCustomer] = useState<POSCreditCustomer | null>(null);

  // Credit record confirmation (non-Mano Mobile + due)
  const [showCreditConfirm,  setShowCreditConfirm]  = useState(false);
  const [creditRecordMade,   setCreditRecordMade]   = useState(false);

  const invoiceNo = useMemo(() => Date.now().toString().slice(-10).padStart(10, "0"), []);
  const createdAt = useMemo(() => new Date().toLocaleString("en-US", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: true }), []);

  const dealerRepairs = COMPLETED_REPAIRS.filter(r =>
    r.dealer === selectedDealer &&
    (!search || r.id.toLowerCase().includes(search.toLowerCase()) ||
      r.brand.toLowerCase().includes(search.toLowerCase()) ||
      r.model.toLowerCase().includes(search.toLowerCase()) ||
      r.imei.includes(search) ||
      r.customerName.toLowerCase().includes(search.toLowerCase()))
  );

  const selectedRepairs = COMPLETED_REPAIRS.filter(r => checkedIds.has(r.id));

  // Billing calculations
  const grandTotal    = selectedRepairs.reduce((s, r) => s + r.unitPrice - r.discount, 0);
  const totalAdvance  = selectedRepairs.reduce((s, r) => s + r.advance, 0);
  const totalDiscount = selectedRepairs.reduce((s, r) => s + r.discount, 0);
  const netDue        = Math.max(0, grandTotal - totalAdvance);

  // Amount received now — empty defaults to full net due (no credit)
  const receivedDisplay   = amountReceived === "" ? netDue.toString() : amountReceived;
  const effectiveReceived = parseFloat(receivedDisplay) || 0;
  const finalDue          = Math.max(0, netDue - effectiveReceived);
  const isCredit          = finalDue > 0;
  const isManoMobile      = selectedDealer === "MANO MOBILE CENTRE";
  const useCreditPicker   = isManoMobile && isCredit;

  const dealerProfile = DEALER_PROFILES[selectedDealer];

  const showStep3 = !!selectedDealer && checkedIds.size > 0;

  const canGenerate = showStep3 &&
    (useCreditPicker ? !!selectedCreditCustomer : !!custName.trim());

  // Effective customer for invoice
  const invoiceCustomer = useCreditPicker && selectedCreditCustomer
    ? { name: selectedCreditCustomer.name, phone: selectedCreditCustomer.phone, nic: selectedCreditCustomer.nic }
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

  const handleReset = () => {
    setSelectedDealer(""); setCheckedIds(new Set()); setSearch("");
    setCustName(""); setCustPhone(""); setCustNic(""); setAmountReceived("");
    setSelectedCreditCustomer(null); setShowCreditConfirm(false); setCreditRecordMade(false);
  };

  const handleDealerChange = (val: string) => {
    setSelectedDealer(val); setCheckedIds(new Set()); setSearch("");
    setCustName(""); setCustPhone(""); setCustNic(""); setAmountReceived("");
    setSelectedCreditCustomer(null); setShowCreditConfirm(false); setCreditRecordMade(false);
  };

  const recordRepairSale = () => {
    addSale({
      invoiceNo,
      date: new Date().toISOString().slice(0, 10),
      customer: custName || selectedRepairs[0]?.customerName || "Walk-in",
      category: "Repair",
      items: selectedRepairs.map(r => `${r.brand} ${r.model}`).join(", ") || "Repair Invoice",
      total: grandTotal,
      status: "Paid",
    });
  };

  const handleGenerateInvoice = () => {
    if (!isManoMobile && isCredit) {
      setShowCreditConfirm(true);
    } else {
      if (effectiveReceived > 0) {
        addEntry("in", `Cash — Repair Invoice ${invoiceNo} (${selectedDealer})`, effectiveReceived);
      }
      recordRepairSale();
      setView("invoice");
    }
  };

  if (view === "invoice") {
    return (
      <InvoiceView
        invoiceNo={invoiceNo}
        createdAt={createdAt}
        dealer={selectedDealer}
        customer={invoiceCustomer}
        isCredit={isCredit}
        amountReceivedNow={effectiveReceived}
        dueAmount={finalDue}
        totalAdvance={totalAdvance}
        creditRecordMade={creditRecordMade}
        repairs={selectedRepairs}
        onBack={() => setView("search")}
      />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

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
            {DEALERS.map(d => <option key={d} value={d}>{d}</option>)}
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

        <div className="table-scroll" style={{ border: "1px solid var(--border)", borderRadius: 10, minHeight: 200, overflow: "hidden", background: "var(--bg-primary)" }}>
          {!selectedDealer ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, color: "var(--text-muted)", fontSize: 13, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              Select a dealer to see their completed repairs
            </div>
          ) : dealerRepairs.length === 0 ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, color: "var(--text-muted)", fontSize: 13, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              No completed repairs found
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
                  {["", "Job ID", "Customer", "Brand / Model", "IMEI No.", "Warranty", "Unit Price", "Discount", "Line Total"].map(h => (
                    <th key={h} style={{ padding: "9px 14px", textAlign: h === "" ? "center" : "left", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.06em", textTransform: "uppercase" as const, fontFamily: "'Plus Jakarta Sans', sans-serif", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dealerRepairs.map((r, i) => {
                  const checked   = checkedIds.has(r.id);
                  const lineTotal = r.unitPrice - r.discount;
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
                      <td style={{ padding: "11px 14px" }}><p style={{ fontSize: 12.5, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{r.customerName}</p></td>
                      <td style={{ padding: "11px 14px" }}><p style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{r.brand} {r.model}</p></td>
                      <td style={{ padding: "11px 14px" }}><span style={{ fontSize: 11.5, color: "var(--text-muted)", fontFamily: "monospace" }}>{r.imei}</span></td>
                      <td style={{ padding: "11px 14px" }}><span style={{ fontSize: 11.5, color: "var(--text-secondary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{r.warranty}</span></td>
                      <td style={{ padding: "11px 14px" }}><span style={{ fontSize: 12, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Rs. {r.unitPrice.toLocaleString()}</span></td>
                      <td style={{ padding: "11px 14px" }}><span style={{ fontSize: 12, color: r.discount > 0 ? "#f87171" : "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{r.discount > 0 ? `− Rs. ${r.discount.toLocaleString()}` : "—"}</span></td>
                      <td style={{ padding: "11px 14px" }}><span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Rs. {lineTotal.toLocaleString()}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Step 3: Billing — only when dealer selected + repairs checked */}
      {showStep3 && (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
          <p style={stepLabel}>Step 3 — Billing</p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>

            {/* ── Bill Info ── */}
            <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 0 }}>
              <div style={cardHead}>Bill Info</div>

              {/* Selected items */}
              <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 12 }}>
                {selectedRepairs.map(r => (
                  <div key={r.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                    <span style={{ color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "60%" }}>{r.id} · {r.brand} {r.model}</span>
                    <span style={{ fontWeight: 600, color: "var(--text-primary)", flexShrink: 0 }}>Rs. {(r.unitPrice - r.discount).toLocaleString()}</span>
                  </div>
                ))}
              </div>

              <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                {[
                  { label: "Subtotal",       value: fmtRs(selectedRepairs.reduce((s, r) => s + r.unitPrice, 0)), color: "var(--text-primary)" },
                  { label: "Total Discount", value: totalDiscount > 0 ? `− Rs. ${totalDiscount.toLocaleString()}` : "—", color: totalDiscount > 0 ? "#f87171" : "var(--text-muted)" },
                  { label: "Net Total",      value: fmtRs(grandTotal), color: "var(--text-primary)" },
                  { label: "Advance Paid",   value: totalAdvance > 0 ? `− Rs. ${totalAdvance.toLocaleString()}` : "—", color: totalAdvance > 0 ? "#4ade80" : "var(--text-muted)" },
                ].map(row => (
                  <div key={row.label} style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                    <span style={{ color: "var(--text-muted)" }}>{row.label}</span>
                    <span style={{ fontWeight: 600, color: row.color }}>{row.value}</span>
                  </div>
                ))}

                {/* Balance after advance */}
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700, fontFamily: "'Plus Jakarta Sans', sans-serif", paddingTop: 6, borderTop: "1px solid var(--border)", marginTop: 2 }}>
                  <span style={{ color: "var(--text-secondary)" }}>Balance Due</span>
                  <span style={{ color: "var(--text-primary)" }}>Rs. {netDue.toLocaleString()}</span>
                </div>

                {/* Amount received now — editable */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, fontFamily: "'Plus Jakarta Sans', sans-serif", marginTop: 4 }}>
                  <span style={{ color: "var(--text-muted)" }}>Amount Received Now</span>
                  <input
                    type="number" min={0} max={netDue}
                    value={receivedDisplay}
                    onChange={e => setAmountReceived(e.target.value)}
                    style={{ width: 110, padding: "4px 8px", borderRadius: 6, border: `1px solid ${isCredit ? "rgba(251,191,36,0.5)" : "rgba(74,222,128,0.4)"}`, background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 12, outline: "none", textAlign: "right", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                  />
                </div>

                <div style={{ borderTop: "1px solid var(--border)", marginTop: 6, paddingTop: 8 }}>
                  {isCredit ? (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", borderRadius: 8, background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.3)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <CreditCard size={12} color="#fbbf24" />
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#fbbf24", letterSpacing: "0.04em" }}>CREDIT DUE</span>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#fbbf24" }}>Rs. {finalDue.toLocaleString()}</span>
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 10px", borderRadius: 8, background: "rgba(74,222,128,0.07)", border: "1px solid rgba(74,222,128,0.25)" }}>
                      <CheckCircle size={12} color="#4ade80" />
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#4ade80" }}>FULLY SETTLED</span>
                    </div>
                  )}
                </div>

                {isCredit && (
                  <p style={{ fontSize: 10.5, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif", marginTop: 6, lineHeight: 1.5 }}>
                    {isManoMobile
                      ? "Due amount will be credited to the selected customer's credit profile."
                      : "Due amount will be logged against the dealer's outstanding balance."}
                  </p>
                )}
              </div>
            </div>

            {/* ── Dealer Info ── */}
            <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
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

            {/* ── Customer Info ── */}
            <div style={{ background: "var(--bg-secondary)", border: `1px solid ${useCreditPicker ? "rgba(251,191,36,0.3)" : "var(--border)"}`, borderRadius: 10, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ ...cardHead, color: useCreditPicker ? "#fbbf24" : "var(--text-muted)" }}>
                Customer Info
                {useCreditPicker && <span style={{ marginLeft: 6, fontSize: 9, color: "#fbbf24" }}>· CREDIT REQUIRED</span>}
              </div>

              {useCreditPicker ? (
                /* Mano Mobile + due → Credit Customer Picker */
                <CreditCustomerPicker
                  customers={creditCustomers}
                  selected={selectedCreditCustomer}
                  onSelect={setSelectedCreditCustomer}
                  onNewCustomer={(c) => { setCreditCustomers(prev => [...prev, c]); setSelectedCreditCustomer(c); }}
                />
              ) : (
                /* Simple customer entry */
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div>
                    <label style={labelSt}>Full Name *</label>
                    <input value={custName} onChange={e => setCustName(e.target.value)} placeholder="Customer full name" style={inputSt} />
                  </div>
                  <div>
                    <label style={labelSt}>Phone</label>
                    <input value={custPhone} onChange={e => setCustPhone(e.target.value)} placeholder="07X XXX XXXX" style={inputSt} />
                  </div>
                  <div>
                    <label style={labelSt}>NIC</label>
                    <input value={custNic} onChange={e => setCustNic(e.target.value)} placeholder="XXXXXXXXX V" style={inputSt} />
                  </div>
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
              onClick={handleGenerateInvoice}
              disabled={!canGenerate}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 24px", borderRadius: 9, fontSize: 12, fontWeight: 700, border: `1px solid ${canGenerate ? "var(--accent)" : "var(--border)"}`, background: canGenerate ? "var(--accent)" : "var(--border)", color: canGenerate ? "var(--accent-fg)" : "var(--text-muted)", cursor: canGenerate ? "pointer" : "not-allowed", opacity: canGenerate ? 1 : 0.5, fontFamily: "'Plus Jakarta Sans', sans-serif", transition: "all 0.15s" }}
            >
              <Printer size={13} />Generate Invoice
            </button>
          </div>
        </div>
      )}

      {/* Credit record confirmation modal */}
      {showCreditConfirm && (
        <CreditRecordConfirmModal
          dealer={selectedDealer}
          dueAmount={finalDue}
          onConfirm={() => { setCreditRecordMade(true); setShowCreditConfirm(false); recordRepairSale(); setView("invoice"); }}
          onSkip={() => { setCreditRecordMade(false); setShowCreditConfirm(false); recordRepairSale(); setView("invoice"); }}
          onCancel={() => setShowCreditConfirm(false)}
        />
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
