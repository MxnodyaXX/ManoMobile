"use client";

import { useState, useMemo, useRef } from "react";
import { useIsMobile } from "@/cashier/hooks/useIsMobile";
import { useCashRegister } from "@/cashier/contexts/CashRegisterContext";
import { useSales } from "@/cashier/contexts/SalesContext";
import { createPortal } from "react-dom";
import { Plus, Trash2, X, Printer } from "lucide-react";
import CreditCustomerPicker, { INITIAL_POS_CREDIT_CUSTOMERS, POSCreditCustomer } from "./CreditCustomerPicker";
import { QRCodeSVG } from "qrcode.react";
import Barcode from "react-barcode";

// ─── Types ────────────────────────────────────────────────────────────────────

interface OtherSaleItem {
  id: number;
  name: string;
  unitPrice: number;
  qty: number;
  discount: number;
}

// ─── Shared Styles ────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "9px 12px", borderRadius: 8,
  border: "1px solid var(--border)", background: "var(--bg-card)",
  color: "var(--text-primary)", fontSize: 13,
  fontFamily: "'Plus Jakarta Sans', sans-serif", outline: "none",
  transition: "border-color 0.15s", boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, letterSpacing: "0.06em",
  textTransform: "uppercase" as const, color: "var(--text-muted)",
  display: "block", marginBottom: 4,
  fontFamily: "'Plus Jakarta Sans', sans-serif",
};

const sectionHead: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, letterSpacing: "0.07em",
  textTransform: "uppercase" as const, color: "var(--text-secondary)",
  fontFamily: "'Plus Jakarta Sans', sans-serif",
};

const fmt = (n: number) => `Rs. ${Math.max(0, n).toLocaleString("en-LK")}`;

// ─── Card Payment Modal ───────────────────────────────────────────────────────

function CardPaymentModal({
  invoiceNo, items, customer, subtotal, overallDiscount, total, onConfirm, onCancel,
}: {
  invoiceNo: string;
  items: OtherSaleItem[];
  customer: { name: string; phone: string; nic: string };
  subtotal: number;
  overallDiscount: number;
  total: number;
  onConfirm: (ref: string) => void;
  onCancel: () => void;
}) {
  const [ref, setRef] = useState("");
  const today = new Date().toLocaleDateString("en-LK", { year: "numeric", month: "long", day: "numeric" });

  if (typeof document === "undefined") return null;
  return createPortal(
    <div onClick={onCancel} style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 520, background: "var(--bg-card)", borderRadius: 16, border: "1px solid var(--border)", boxShadow: "0 32px 80px rgba(0,0,0,0.5)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "18px 22px 14px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif", marginBottom: 6 }}>Card Payment</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: "0.02em" }}>{invoiceNo}</div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: "'Plus Jakarta Sans', sans-serif", marginTop: 3 }}>{today}</div>
          </div>
          <button onClick={onCancel} style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid var(--border)", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", flexShrink: 0 }}><X size={14} /></button>
        </div>
        <div style={{ padding: "14px 22px", borderBottom: "1px solid var(--border)", maxHeight: 200, overflowY: "auto" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif", marginBottom: 10 }}>Items</div>
          {items.map(i => (
            <div key={i.id} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, gap: 12 }}>
              <div style={{ fontSize: 13, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{i.name} <span style={{ color: "var(--text-muted)" }}>×{i.qty}</span></div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif", flexShrink: 0 }}>{fmt(i.unitPrice * i.qty - i.discount)}</div>
            </div>
          ))}
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10, marginTop: 4 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-secondary)", fontFamily: "'Plus Jakarta Sans', sans-serif", marginBottom: 4 }}>
              <span>Subtotal</span><span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{fmt(subtotal)}</span>
            </div>
            {overallDiscount > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-secondary)", fontFamily: "'Plus Jakarta Sans', sans-serif", marginBottom: 4 }}>
                <span>Discount</span><span style={{ color: "#ef4444", fontWeight: 600 }}>({fmt(overallDiscount)})</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 800, fontFamily: "'Plus Jakarta Sans', sans-serif", marginTop: 6 }}>
              <span style={{ color: "var(--text-primary)" }}>Total</span><span style={{ color: "var(--accent)" }}>{fmt(total)}</span>
            </div>
          </div>
        </div>
        {(customer.name || customer.phone) && (
          <div style={{ padding: "12px 22px", borderBottom: "1px solid var(--border)" }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif", marginBottom: 8 }}>Customer</div>
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
              {customer.name  && <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{customer.name}</span>}
              {customer.phone && <span style={{ fontSize: 13, color: "var(--text-secondary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{customer.phone}</span>}
              {customer.nic   && <span style={{ fontSize: 13, color: "var(--text-secondary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>NIC: {customer.nic}</span>}
            </div>
          </div>
        )}
        <div style={{ padding: "16px 22px" }}>
          <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif", display: "block", marginBottom: 8 }}>Card Transaction Reference No. *</label>
          <input autoFocus value={ref} onChange={e => setRef(e.target.value)} onKeyDown={e => e.key === "Enter" && ref.trim() && onConfirm(ref.trim())} placeholder="Enter reference number from terminal..." style={{ width: "100%", padding: "10px 13px", borderRadius: 9, border: `1px solid ${ref.trim() ? "var(--border-active)" : "var(--border)"}`, background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14, fontFamily: "monospace", outline: "none", boxSizing: "border-box", transition: "border-color 0.15s" }} />
          <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif", marginTop: 6 }}>Transaction will not be marked complete until a reference number is entered.</div>
        </div>
        <div style={{ padding: "0 22px 18px", display: "flex", gap: 10 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: "10px", borderRadius: 9, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Cancel</button>
          <button onClick={() => ref.trim() && onConfirm(ref.trim())} disabled={!ref.trim()} style={{ flex: 2, padding: "10px", borderRadius: 9, border: "none", fontSize: 13, fontWeight: 700, cursor: ref.trim() ? "pointer" : "not-allowed", background: ref.trim() ? "var(--accent)" : "var(--border)", color: ref.trim() ? "var(--accent-fg)" : "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif", transition: "all 0.15s" }}>
            {ref.trim() ? `Confirm Payment · ${fmt(total)}` : "Enter reference to confirm"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Print Preview Modal ──────────────────────────────────────────────────────

function OthersPrintPreviewModal({
  invoiceNo, items, customer, paymentMethod, cardRef, creditCustomer,
  subtotal, overallDiscount, total, onDone,
}: {
  invoiceNo: string;
  items: OtherSaleItem[];
  customer: { name: string; phone: string; whatsapp: string; email: string; nic: string };
  paymentMethod: string;
  cardRef?: string;
  creditCustomer?: POSCreditCustomer | null;
  subtotal: number;
  overallDiscount: number;
  total: number;
  onDone: () => void;
}) {
  const [printFormat, setPrintFormat] = useState<"A5" | "POS">("A5");
  const receiptRef = useRef<HTMLDivElement>(null);
  const today     = new Date().toLocaleDateString("en-LK", { year: "numeric", month: "long", day: "numeric" });
  const todayFull = new Date().toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

  const handlePrint = () => {
    if (!receiptRef.current) return;
    const printDiv = document.createElement("div");
    printDiv.id = "__op__";
    printDiv.innerHTML = receiptRef.current.outerHTML;
    document.body.appendChild(printDiv);

    const styleEl = document.createElement("style");
    styleEl.id = "__op_style__";
    if (printFormat === "A5") {
      styleEl.textContent = `
        @page { size: A5 landscape; margin: 10mm; }
        #__op__ { display: none; }
        @media print {
          body { visibility: hidden; }
          #__op__ { display: block !important; visibility: visible; position: fixed; left: 0; top: 0; width: 100%; }
          #__op__ * { visibility: visible; }
        }
      `;
    } else {
      styleEl.textContent = `
        @page { size: 80mm auto; margin: 0; }
        #__op__ { display: none; }
        @media print {
          body { visibility: hidden; }
          #__op__ { display: block !important; visibility: visible; position: fixed; left: 0; top: 0; width: 80mm; }
          #__op__ * { visibility: visible; }
        }
      `;
    }
    document.head.appendChild(styleEl);
    window.print();
    setTimeout(() => {
      document.getElementById("__op__")?.remove();
      document.getElementById("__op_style__")?.remove();
    }, 1000);
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.72)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, gap: 16 }}>

      {/* Toolbar */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", width: printFormat === "A5" ? 740 : 320 }}>
        {/* Format toggle */}
        <div style={{ display: "flex", borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)", overflow: "hidden" }}>
          {(["A5", "POS"] as const).map(f => (
            <button key={f} onClick={() => setPrintFormat(f)} style={{ padding: "7px 18px", fontSize: 12, fontWeight: 700, letterSpacing: "0.05em", fontFamily: "'Plus Jakarta Sans', sans-serif", border: "none", cursor: "pointer", background: printFormat === f ? "#ffffff" : "transparent", color: printFormat === f ? "#111827" : "rgba(255,255,255,0.55)", transition: "background 0.15s, color 0.15s" }}>{f}</button>
          ))}
        </div>
        <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.6)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          {printFormat === "A5" ? "A5 Landscape Invoice" : "POS Thermal Receipt"}
        </div>
        <button onClick={handlePrint} style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 22px", borderRadius: 9, border: "none", background: "#ffffff", color: "#111827", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          <Printer size={15} /> Print
        </button>
        <button onClick={onDone} style={{ padding: "9px 22px", borderRadius: 9, border: "1px solid rgba(255,255,255,0.2)", background: "transparent", color: "rgba(255,255,255,0.7)", fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          Skip &amp; Done
        </button>
      </div>

      {/* Preview */}
      <div style={{ overflowY: "auto", maxHeight: "calc(100vh - 130px)", borderRadius: 8 }}>

        {printFormat === "A5" ? (
          /* ── A5 Invoice ── */
          <div ref={receiptRef} style={{ background: "#ffffff", borderRadius: 6, border: "1px solid #d1d5db", overflow: "hidden", boxShadow: "0 4px 32px rgba(0,0,0,0.4)", fontFamily: "Arial, Helvetica, sans-serif", color: "#111827", width: 740 }}>

            <div style={{ height: 4, background: "#111827" }} />

            {/* Row 1: Branding | Customer + Payment */}
            <div style={{ display: "flex", borderBottom: "1.5px solid #111827" }}>
              <div style={{ flex: "0 0 52%", padding: "14px 18px 12px", borderRight: "1px solid #d1d5db" }}>
                <div style={{ fontSize: 17, fontWeight: 900, letterSpacing: "0.12em", color: "#111827", lineHeight: 1 }}>MANO MOBILE</div>
                <div style={{ fontSize: 8, letterSpacing: "0.22em", color: "#6b7280", marginTop: 3, marginBottom: 10 }}>MANAGEMENT SUITE</div>
                <div style={{ fontSize: 9.5, color: "#374151", lineHeight: 1.65 }}>
                  <div>123 Main Street, Colombo 03</div>
                  <div>Tel: 0112 345 678</div>
                  <div>mano@manomobile.lk</div>
                </div>
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                  <div>
                    <div style={{ fontSize: 8, fontWeight: 700, color: "#6b7280", letterSpacing: "0.14em", textTransform: "uppercase" as const }}>Invoice No.</div>
                    <div style={{ fontSize: 12, fontWeight: 900, color: "#111827", letterSpacing: "0.06em", marginTop: 1 }}>{invoiceNo}</div>
                  </div>
                  <div style={{ textAlign: "right" as const }}>
                    <div style={{ fontSize: 8, fontWeight: 700, color: "#6b7280", letterSpacing: "0.14em", textTransform: "uppercase" as const }}>Date</div>
                    <div style={{ fontSize: 9, color: "#374151", marginTop: 1 }}>{today}</div>
                  </div>
                </div>
              </div>
              <div style={{ flex: 1, padding: "14px 18px 12px" }}>
                <div style={{ fontSize: 8, fontWeight: 700, color: "#6b7280", letterSpacing: "0.14em", textTransform: "uppercase" as const, marginBottom: 8 }}>Bill To</div>
                {customer.name ? (
                  <div style={{ fontSize: 10, lineHeight: 1.7 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#111827" }}>{customer.name}</div>
                    {customer.phone && <div style={{ color: "#374151" }}>Tel: {customer.phone}</div>}
                    {customer.whatsapp && customer.whatsapp !== customer.phone && <div style={{ color: "#374151" }}>WhatsApp: {customer.whatsapp}</div>}
                    {customer.nic   && <div style={{ color: "#374151" }}>NIC: {customer.nic}</div>}
                    {customer.email && <div style={{ color: "#374151" }}>{customer.email}</div>}
                  </div>
                ) : (
                  <div style={{ fontSize: 10, color: "#9ca3af", fontStyle: "italic" as const }}>Walk-in customer</div>
                )}
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #e5e7eb" }}>
                  <div style={{ fontSize: 8, fontWeight: 700, color: "#6b7280", letterSpacing: "0.14em", textTransform: "uppercase" as const, marginBottom: 3 }}>Payment Method</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: paymentMethod === "Credit" ? "#dc2626" : "#111827" }}>{paymentMethod}</div>
                  {cardRef && <div style={{ fontSize: 9, color: "#6b7280", marginTop: 2 }}>Ref: <span style={{ fontWeight: 700, color: "#374151" }}>{cardRef}</span></div>}
                  {creditCustomer && <div style={{ fontSize: 9, color: "#dc2626", marginTop: 2 }}>Credit A/C: {creditCustomer.name}</div>}
                </div>
              </div>
            </div>

            {/* Row 2: Items */}
            <div style={{ padding: "12px 18px", borderBottom: "1.5px solid #111827" }}>
              <div style={{ fontSize: 8, fontWeight: 700, color: "#6b7280", letterSpacing: "0.14em", textTransform: "uppercase" as const, marginBottom: 8 }}>Items</div>
              <table style={{ width: "100%", borderCollapse: "collapse" as const, fontSize: 9.5 }}>
                <colgroup>
                  <col style={{ width: "34%" }} />
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "18%" }} />
                  <col style={{ width: "18%" }} />
                  <col style={{ width: "20%" }} />
                </colgroup>
                <thead>
                  <tr style={{ borderBottom: "1.5px solid #111827" }}>
                    <th style={{ textAlign: "left" as const, padding: "4px 6px 5px 0", fontWeight: 700, color: "#111827" }}>Item</th>
                    <th style={{ textAlign: "center" as const, padding: "4px 6px 5px", fontWeight: 700, color: "#111827" }}>Qty</th>
                    <th style={{ textAlign: "right" as const, padding: "4px 6px 5px", fontWeight: 700, color: "#111827" }}>Unit Price</th>
                    <th style={{ textAlign: "right" as const, padding: "4px 6px 5px", fontWeight: 700, color: "#111827" }}>Discount</th>
                    <th style={{ textAlign: "right" as const, padding: "4px 0 5px 6px", fontWeight: 700, color: "#111827" }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(i => (
                    <tr key={i.id} style={{ borderBottom: "1px solid #e5e7eb" }}>
                      <td style={{ padding: "5px 6px 5px 0", fontWeight: 600, color: "#111827" }}>{i.name}</td>
                      <td style={{ padding: "5px 6px", textAlign: "center" as const, color: "#374151" }}>{i.qty}</td>
                      <td style={{ padding: "5px 6px", textAlign: "right" as const, color: "#374151" }}>Rs.{i.unitPrice.toLocaleString()}</td>
                      <td style={{ padding: "5px 6px", textAlign: "right" as const, color: i.discount > 0 ? "#dc2626" : "#9ca3af" }}>{i.discount > 0 ? `(Rs.${i.discount.toLocaleString()})` : "—"}</td>
                      <td style={{ padding: "5px 0 5px 6px", textAlign: "right" as const, fontWeight: 700, color: "#111827" }}>Rs.{Math.max(0, i.unitPrice * i.qty - i.discount).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                <div style={{ width: 220 }}>
                  {[
                    { label: "Subtotal", value: `Rs.${subtotal.toLocaleString()}`, show: true },
                    { label: "Discount", value: `(Rs.${overallDiscount.toLocaleString()})`, show: overallDiscount > 0 },
                  ].filter(r => r.show).map(r => (
                    <div key={r.label} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", fontSize: 9.5, borderBottom: "1px solid #f3f4f6" }}>
                      <span style={{ color: "#6b7280" }}>{r.label}</span>
                      <span style={{ color: "#374151" }}>{r.value}</span>
                    </div>
                  ))}
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", marginTop: 2, borderTop: "1.5px solid #111827", fontSize: 11, fontWeight: 700, color: "#111827" }}>
                    <span>TOTAL</span><span>Rs.{total.toLocaleString()}</span>
                  </div>
                  {paymentMethod === "Credit" && (
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", fontSize: 9.5, fontWeight: 700, color: "#dc2626" }}>
                      <span>Balance Due</span><span>Rs.{total.toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Row 3: Terms | QR + Barcode */}
            <div style={{ display: "flex" }}>
              <div style={{ flex: "0 0 52%", padding: "10px 18px 12px", borderRight: "1px solid #d1d5db" }}>
                <div style={{ fontSize: 8, fontWeight: 700, color: "#6b7280", letterSpacing: "0.14em", textTransform: "uppercase" as const, marginBottom: 6 }}>Terms &amp; Conditions</div>
                <div style={{ fontSize: 8.5, color: "#374151", lineHeight: 1.75 }}>
                  <div>• All sales are final. No refunds after 7 days.</div>
                  <div>• This receipt is valid only with the invoice number.</div>
                  <div>• Keep this receipt for future reference.</div>
                  <div>• Queries: 0112 345 678</div>
                </div>
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #e5e7eb", fontSize: 8.5, color: "#6b7280" }}>
                  Issued by: <span style={{ fontWeight: 700, color: "#111827" }}>Admin</span>
                </div>
              </div>
              <div style={{ flex: 1, padding: "10px 18px 12px", display: "flex", alignItems: "center", justifyContent: "space-evenly", gap: 6 }}>
                <QRCodeSVG value={invoiceNo} size={72} level="M" />
                <Barcode value={invoiceNo} width={1.2} height={58} fontSize={8} margin={0} background="#ffffff" lineColor="#111111" displayValue />
              </div>
            </div>
          </div>

        ) : (
          /* ── POS Thermal Receipt ── */
          <div ref={receiptRef} style={{ background: "#ffffff", borderRadius: "6px 6px 0 0", overflow: "hidden", boxShadow: "0 4px 24px rgba(0,0,0,0.25)", width: 300 }}>
            <div style={{ padding: "18px 16px 14px", fontFamily: "'Courier New', monospace", color: "#1a1a1a", fontSize: 11 }}>

              <div style={{ textAlign: "center", marginBottom: 12 }}>
                <div style={{ fontSize: 7, letterSpacing: "0.3em", color: "#bbb", fontFamily: "sans-serif", marginBottom: 4 }}>✦ ✦ ✦</div>
                <div style={{ fontSize: 16, fontWeight: 900, letterSpacing: "0.1em", fontFamily: "'Arial Black', Arial, sans-serif", color: "#111" }}>MANO MOBILE</div>
                <div style={{ fontSize: 8, letterSpacing: "0.25em", color: "#999", marginTop: 2, fontFamily: "sans-serif" }}>MANAGEMENT SUITE</div>
                <div style={{ fontSize: 10, color: "#666", marginTop: 6 }}>{todayFull}</div>
              </div>

              <div style={{ margin: "10px 0" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  <div style={{ flex: 1, borderTop: "1px dashed #bbb" }} />
                  <span style={{ fontSize: 9, color: "#999", letterSpacing: "0.1em" }}>RECEIPT</span>
                  <div style={{ flex: 1, borderTop: "1px dashed #bbb" }} />
                </div>
                <div style={{ border: "1px dashed #444", borderRadius: 3, padding: "6px 10px", textAlign: "center" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.1em" }}>{invoiceNo}</div>
                  <div style={{ borderTop: "1px dashed #ccc", marginTop: 5, paddingTop: 4, fontSize: 8, color: "#aaa", letterSpacing: "0.15em" }}>— — — — — — — — — —</div>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                <span style={{ color: "#777" }}>Payment Type</span>
                <span style={{ fontWeight: 700 }}>{paymentMethod}</span>
              </div>
              {cardRef && (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: 10 }}>
                  <span style={{ color: "#777" }}>Card Ref</span>
                  <span style={{ fontFamily: "monospace" }}>{cardRef}</span>
                </div>
              )}

              <div style={{ borderTop: "1px dashed #ccc", margin: "7px 0" }} />

              {customer.name && (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
                    <span style={{ color: "#777" }}>Customer</span>
                    <span style={{ fontWeight: 700, maxWidth: "55%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{customer.name}</span>
                  </div>
                  {customer.phone && (
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
                      <span style={{ color: "#777" }}>Phone</span><span>{customer.phone}</span>
                    </div>
                  )}
                  <div style={{ borderTop: "1px dashed #ccc", margin: "7px 0" }} />
                </>
              )}

              {items.map(i => (
                <div key={i.id} style={{ marginBottom: 4 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", gap: 6 }}>
                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{i.name} ×{i.qty}</span>
                    <span style={{ flexShrink: 0 }}>Rs.{(i.unitPrice * i.qty).toLocaleString()}</span>
                  </div>
                  {i.discount > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#888", paddingLeft: 2 }}>
                      <span>Discount</span><span>(Rs.{i.discount.toLocaleString()})</span>
                    </div>
                  )}
                </div>
              ))}

              <div style={{ borderTop: "1px dashed #ccc", margin: "7px 0" }} />

              <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
                <span style={{ color: "#777" }}>Amount</span><span>Rs.{subtotal.toLocaleString()}</span>
              </div>
              {overallDiscount > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
                  <span style={{ color: "#777" }}>Discount</span><span>(Rs.{overallDiscount.toLocaleString()})</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px dashed #555", marginTop: 4, paddingTop: 5, fontWeight: 700, fontSize: 12 }}>
                <span>TOTAL</span><span>Rs.{total.toLocaleString()}</span>
              </div>

              <div style={{ textAlign: "center", marginTop: 14, paddingTop: 10, borderTop: "1px dashed #ccc", fontSize: 9, color: "#999" }}>
                Thank you for your purchase!<br />
                Mano Mobile · 0112 345 678
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

// ─── OtherSales Component ─────────────────────────────────────────────────────

export default function OtherSales() {
  const isMobile = useIsMobile();
  const { addEntry } = useCashRegister();
  const { addSale } = useSales();
  // Item form
  const [itemName,     setItemName]     = useState("");
  const [unitPrice,    setUnitPrice]    = useState("");
  const [qty,          setQty]          = useState("1");
  const [itemDiscount, setItemDiscount] = useState("");
  const [formError,    setFormError]    = useState("");
  const [nextId,       setNextId]       = useState(1);

  // Cart
  const [items, setItems] = useState<OtherSaleItem[]>([]);

  // Customer
  const [customer, setCustomer] = useState({ name: "", phone: "", whatsapp: "", email: "", nic: "" });

  // Bill
  const [overallDiscount, setOverallDiscount] = useState("");

  // Payment
  const [paymentMethod,          setPaymentMethod]          = useState<"" | "Cash" | "Card" | "Credit">("");
  const [creditCustomers,        setCreditCustomers]        = useState<POSCreditCustomer[]>(INITIAL_POS_CREDIT_CUSTOMERS);
  const [selectedCreditCustomer, setSelectedCreditCustomer] = useState<POSCreditCustomer | null>(null);

  // Modals
  const [showCardModal,    setShowCardModal]    = useState(false);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [confirmedCardRef, setConfirmedCardRef] = useState("");
  const [completed,        setCompleted]        = useState(false);

  const invoiceNo = useMemo(() => {
    const now = new Date();
    const yy  = String(now.getFullYear()).slice(2);
    const mm  = String(now.getMonth() + 1).padStart(2, "0");
    const dd  = String(now.getDate()).padStart(2, "0");
    return `OTH-${yy}${mm}${dd}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
  }, []);

  // ── Item handlers ──────────────────────────────────────────────────────────
  const addItem = () => {
    const name  = itemName.trim();
    const price = parseFloat(unitPrice);
    const q     = Math.max(1, parseInt(qty) || 1);
    const disc  = Math.max(0, parseFloat(itemDiscount) || 0);

    if (!name)            { setFormError("Item name is required"); return; }
    if (!price || price <= 0) { setFormError("Enter a valid unit price"); return; }

    setItems(prev => [...prev, { id: nextId, name, unitPrice: price, qty: q, discount: disc }]);
    setNextId(n => n + 1);
    setItemName(""); setUnitPrice(""); setQty("1"); setItemDiscount(""); setFormError("");
  };

  const removeItem = (id: number) => setItems(prev => prev.filter(i => i.id !== id));

  // ── Bill ───────────────────────────────────────────────────────────────────
  const subtotal    = items.reduce((s, i) => s + Math.max(0, i.unitPrice * i.qty - i.discount), 0);
  const overallAmt  = Math.min(subtotal, parseFloat(overallDiscount) || 0);
  const total       = Math.max(0, subtotal - overallAmt);

  const canComplete = items.length > 0 &&
    (paymentMethod === "Cash" ||
     paymentMethod === "Card" ||
     (paymentMethod === "Credit" && selectedCreditCustomer !== null));

  const resetAll = () => {
    setItems([]); setItemName(""); setUnitPrice(""); setQty("1"); setItemDiscount(""); setFormError("");
    setCustomer({ name: "", phone: "", whatsapp: "", email: "", nic: "" });
    setOverallDiscount(""); setPaymentMethod(""); setSelectedCreditCustomer(null);
    setShowCardModal(false);
    setShowPrintPreview(false); setConfirmedCardRef(""); setCompleted(false);
  };

  if (completed) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, gap: 16, textAlign: "center" }}>
        <div style={{ fontSize: 52, color: "var(--accent)" }}>✓</div>
        <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "'Plus Jakarta Sans', sans-serif", color: "var(--text-primary)" }}>Sale Complete</div>
        <div style={{ fontSize: 13, color: "var(--text-secondary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          {items.length} item{items.length !== 1 ? "s" : ""} · {fmt(total)} · {paymentMethod}
        </div>
        <button onClick={resetAll} style={{ marginTop: 8, padding: "10px 28px", borderRadius: 8, border: "none", background: "var(--accent)", color: "var(--accent-fg)", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          New Sale
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", flex: 1, minHeight: 0, overflowY: isMobile ? "auto" : undefined }}>

      {/* Modals */}
      {showCardModal && (
        <CardPaymentModal
          invoiceNo={invoiceNo} items={items} customer={customer}
          subtotal={subtotal} overallDiscount={overallAmt} total={total}
          onConfirm={ref => { setConfirmedCardRef(ref); setShowCardModal(false); setShowPrintPreview(true); }}
          onCancel={() => setShowCardModal(false)}
        />
      )}
      {showPrintPreview && (
        <OthersPrintPreviewModal
          invoiceNo={invoiceNo} items={items} customer={customer}
          paymentMethod={paymentMethod} cardRef={confirmedCardRef || undefined}
          creditCustomer={selectedCreditCustomer}
          subtotal={subtotal} overallDiscount={overallAmt} total={total}
          onDone={() => {
            if (paymentMethod === "Cash") {
              addEntry("in", `Cash Sale — ${invoiceNo}`, total);
            }
            addSale({
              invoiceNo,
              date: new Date().toISOString().slice(0, 10),
              customer: customer.name || "Walk-in",
              category: "Others",
              items: items.map(i => `${i.name} ×${i.qty}`).join(", ") || "Other Sale",
              total,
              status: "Paid",
            });
            setShowPrintPreview(false);
            setCompleted(true);
          }}
        />
      )}

      {/* ── Left: Sale Info ──────────────────────────────────────────────────── */}
      <div style={{ flex: isMobile ? "none" : 1.4, display: "flex", flexDirection: "column", gap: 16, paddingRight: isMobile ? 0 : 20, paddingBottom: isMobile ? 16 : 0, borderRight: isMobile ? "none" : "1px solid var(--border)", borderBottom: isMobile ? "1px solid var(--border)" : "none", minHeight: 0 }}>

        <div style={{ ...sectionHead }}>Sale Info</div>

        {/* Item entry form */}
        <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", gap: 10, padding: "16px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-card)" }}>
          <div>
            <label style={labelStyle}>Item / Service Name</label>
            <input
              value={itemName}
              onChange={e => { setItemName(e.target.value); setFormError(""); }}
              onKeyDown={e => e.key === "Enter" && addItem()}
              placeholder="e.g. Photo Copy A4, Lamination, Printing..."
              style={inputStyle}
            />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 2 }}>
              <label style={labelStyle}>Unit Price (Rs.)</label>
              <input
                type="number" min={0} value={unitPrice}
                onChange={e => { setUnitPrice(e.target.value); setFormError(""); }}
                onKeyDown={e => e.key === "Enter" && addItem()}
                placeholder="0"
                style={inputStyle}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Qty</label>
              <input
                type="number" min={1} value={qty}
                onChange={e => setQty(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addItem()}
                style={inputStyle}
              />
            </div>
            <div style={{ flex: 2 }}>
              <label style={labelStyle}>Item Discount (Rs.)</label>
              <input
                type="number" min={0} value={itemDiscount}
                onChange={e => setItemDiscount(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addItem()}
                placeholder="0"
                style={inputStyle}
              />
            </div>
            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <button
                onClick={addItem}
                style={{ height: 40, width: 40, borderRadius: 8, border: "none", background: "var(--accent)", color: "var(--accent-fg)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}
              >
                <Plus size={16} />
              </button>
            </div>
          </div>
          {formError && (
            <div style={{ fontSize: 11, color: "#ef4444", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{formError}</div>
          )}
        </div>

        {/* Items list */}
        <div style={{ flex: 1, overflowY: "auto", minHeight: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          {items.length === 0 ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <div style={{ fontSize: 32, opacity: 0.2 }}>🗂️</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif", textAlign: "center" }}>
                Add items above to start a sale
              </div>
            </div>
          ) : (
            items.map(i => {
              const net = Math.max(0, i.unitPrice * i.qty - i.discount);
              return (
                <div key={i.id} style={{ padding: "12px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-card)", display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{i.name}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif", marginTop: 2 }}>
                      Rs.{i.unitPrice.toLocaleString()} × {i.qty}
                      {i.discount > 0 && <span style={{ color: "#f59e0b", marginLeft: 6 }}>disc. (Rs.{i.discount.toLocaleString()})</span>}
                    </div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif", flexShrink: 0 }}>{fmt(net)}</div>
                  <button onClick={() => removeItem(i.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", display: "flex", padding: 2, flexShrink: 0 }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Right: Customer Info + Bill ──────────────────────────────────────── */}
      <div style={{ width: isMobile ? "100%" : 300, flexShrink: 0, display: "flex", flexDirection: "column", paddingLeft: isMobile ? 0 : 20, paddingTop: isMobile ? 16 : 0, minHeight: 0, overflowY: "auto" }}>

        <div style={{ ...sectionHead, marginBottom: 12 }}>Customer Info</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
          {([
            { key: "name",     label: "Name",                placeholder: "Customer name"      },
            { key: "phone",    label: "Phone Number",        placeholder: "07X XXX XXXX"       },
            { key: "whatsapp", label: "WhatsApp (Optional)", placeholder: "07X XXX XXXX"       },
            { key: "email",    label: "Email (Optional)",    placeholder: "customer@email.com" },
            { key: "nic",      label: "NIC (Optional)",      placeholder: "199912345678"       },
          ] as { key: keyof typeof customer; label: string; placeholder: string }[]).map(({ key, label, placeholder }) => (
            <div key={key}>
              <label style={labelStyle}>{label}</label>
              <input value={customer[key]} onChange={e => setCustomer(c => ({ ...c, [key]: e.target.value }))} placeholder={placeholder} style={inputStyle} />
            </div>
          ))}
        </div>

        <div style={{ borderTop: "1px solid var(--border)", marginBottom: 16 }} />

        {/* Invoice number */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif", marginBottom: 4 }}>Invoice No.</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: "0.03em" }}>{invoiceNo}</div>
        </div>

        <div style={{ ...sectionHead, marginBottom: 10 }}>Bill Summary</div>

        {items.map(i => (
          <div key={i.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontFamily: "'Plus Jakarta Sans', sans-serif", marginBottom: 6 }}>
            <span style={{ color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 170 }}>{i.name} ×{i.qty}</span>
            <span style={{ color: "var(--text-primary)", fontWeight: 600, flexShrink: 0 }}>{fmt(Math.max(0, i.unitPrice * i.qty - i.discount))}</span>
          </div>
        ))}

        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10, marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontFamily: "'Plus Jakarta Sans', sans-serif", marginBottom: 8 }}>
            <span style={{ color: "var(--text-secondary)" }}>Subtotal</span>
            <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{fmt(subtotal)}</span>
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Overall Discount (Rs.)</label>
          <input type="number" min={0} value={overallDiscount} onChange={e => setOverallDiscount(e.target.value)} placeholder="0" style={inputStyle} />
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderTop: "1px solid var(--border)", marginBottom: 12 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Total</span>
          <span style={{ fontSize: 16, fontWeight: 800, color: "var(--accent)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{fmt(total)}</span>
        </div>

        {/* Payment method */}
        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
          {(["Cash", "Card", "Credit"] as const).map(m => (
            <button
              key={m}
              onClick={() => {
                setPaymentMethod(paymentMethod === m ? "" : m);
                if (paymentMethod !== m && m !== "Credit") setSelectedCreditCustomer(null);
              }}
              style={{ flex: 1, padding: "8px 0", borderRadius: 7, fontSize: 12, fontWeight: 600, border: `1px solid ${paymentMethod === m ? "var(--border-active)" : "var(--border)"}`, background: paymentMethod === m ? "var(--accent-dim)" : "transparent", color: paymentMethod === m ? "var(--accent)" : "var(--text-secondary)", cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif", transition: "all 0.15s" }}
            >{m}</button>
          ))}
        </div>

        {paymentMethod === "Credit" && (
          <CreditCustomerPicker
            customers={creditCustomers}
            selected={selectedCreditCustomer}
            onSelect={(c) => { setSelectedCreditCustomer(c); if (c) setPaymentMethod("Credit"); }}
            onNewCustomer={(c) => { setCreditCustomers(prev => [...prev, c]); setSelectedCreditCustomer(c); }}
          />
        )}

        <button
          onClick={() => {
            if (!canComplete) return;
            if (paymentMethod === "Card") { setShowCardModal(true); return; }
            setShowPrintPreview(true);
          }}
          disabled={!canComplete}
          style={{ width: "100%", padding: "11px", borderRadius: 9, border: "none", background: canComplete ? "var(--accent)" : "var(--border)", color: canComplete ? "var(--accent-fg)" : "var(--text-muted)", fontWeight: 700, fontSize: 13, cursor: canComplete ? "pointer" : "not-allowed", fontFamily: "'Plus Jakarta Sans', sans-serif", transition: "all 0.15s" }}
        >
          {items.length === 0
            ? "Add items first"
            : !paymentMethod
            ? "Select payment method"
            : paymentMethod === "Credit" && !selectedCreditCustomer
            ? "Select credit customer"
            : `Complete Sale · ${fmt(total)}`}
        </button>
      </div>
    </div>
  );
}
