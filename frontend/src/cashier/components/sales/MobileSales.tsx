"use client";

import { useState, useRef, useMemo } from "react";
import { useIsMobile } from "@/cashier/hooks/useIsMobile";
import { useCashRegister } from "@/cashier/contexts/CashRegisterContext";
import { useSales } from "@/cashier/contexts/SalesContext";
import { useDevices, type DeviceRecord } from "@/cashier/contexts/DevicesContext";
import { useAccessories } from "@/cashier/contexts/AccessoriesContext";
import { useAuth } from "@/lib/auth/AuthContext";
import { createPortal } from "react-dom";
import { Search, Trash2, Plus, Minus, X, Printer } from "lucide-react";
import CreditCustomerPicker, { type POSCreditCustomer } from "./CreditCustomerPicker";
import { usePersistInvoiceDocument } from "@/lib/sales/invoiceDoc";
import { posPostCredit } from "@/lib/pos/api";
import type { NewSaleItem } from "@/lib/sales/saleItems";
import { SHOP_DETAILS } from "@/lib/shop";
import InvoiceNoBadge from "@/cashier/components/sales/InvoiceNoBadge";
import { QRCodeSVG } from "qrcode.react";
import Barcode from "react-barcode";

// ─── Types ────────────────────────────────────────────────────────────────────

/** A phone from mobile_devices — one unit, one IMEI. */
type Phone = DeviceRecord;

interface PhoneCartItem {
  phone: Phone;
  sellingPrice: string;
  discount: string;
}

/** An accessory as the counter sees it, from accessory_products. */
interface AccessoryBase {
  id: number;
  code: string;
  name: string;
  model: string;
  brand: string;
  price: number;
  /** Real stock left, less whatever this cart already holds. */
  stock: number;
}

interface AccessoryCartItem extends Omit<AccessoryBase, "stock"> {
  discount: string;
  qty: number;
}

/** A phone line's net: selling price less its own discount, never negative. */
const phoneNet = (pc: PhoneCartItem) =>
  Math.max(0, (parseFloat(pc.sellingPrice) || 0) - (parseFloat(pc.discount) || 0));

/** An accessory line's net, clamped the same way. */
const accNet = (i: AccessoryCartItem) =>
  Math.max(0, i.price * i.qty - (parseFloat(i.discount) || 0));

/** Every identifier a phone can be scanned by. */
const phoneIds = (p: Phone) => [p.imei, p.imei2, p.serialNumber].filter(Boolean).map(s => s.toLowerCase());


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

const fmt = (n: number) => `Rs. ${n.toLocaleString("en-LK")}`;

const searchBtn: React.CSSProperties = {
  width: 40, height: 40, borderRadius: 8, border: "none", flexShrink: 0,
  background: "var(--accent)", color: "var(--accent-fg)",
  display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
};

// ─── Card Payment Modal ───────────────────────────────────────────────────────

function CardPaymentModal({
  phoneCart, accessoryCart, customer,
  subtotal, overallDiscount, total,
  onConfirm, onCancel,
}: {
  phoneCart: PhoneCartItem[];
  accessoryCart: AccessoryCartItem[];
  customer: { name: string; phone: string; whatsapp: string; email: string; nic: string };
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
    <div
      onClick={onCancel}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 520,
          background: "var(--bg-card)", borderRadius: 16,
          border: "1px solid var(--border)",
          boxShadow: "0 32px 80px rgba(0,0,0,0.5)",
          display: "flex", flexDirection: "column", overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{ padding: "18px 22px 14px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif", marginBottom: 6 }}>
              Card Payment
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: "0.02em" }}>
              {fmt(total)}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif", marginTop: 2 }}>
              The invoice number is assigned when the payment is confirmed.
            </div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: "'Plus Jakarta Sans', sans-serif", marginTop: 3 }}>
              {today}
            </div>
          </div>
          <button onClick={onCancel} style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid var(--border)", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", flexShrink: 0 }}>
            <X size={14} />
          </button>
        </div>

        {/* Items */}
        <div style={{ padding: "14px 22px", borderBottom: "1px solid var(--border)", maxHeight: 220, overflowY: "auto" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif", marginBottom: 10 }}>
            Purchased Items
          </div>
          {phoneCart.map(pc => (
            <div key={pc.phone.imei} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8, gap: 12 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{pc.phone.name}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "monospace" }}>{pc.phone.imei}</div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif", flexShrink: 0 }}>
                {fmt(phoneNet(pc))}
              </div>
            </div>
          ))}
          {accessoryCart.map(item => (
            <div key={item.id} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, gap: 12 }}>
              <div style={{ fontSize: 13, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                {item.name} <span style={{ color: "var(--text-muted)" }}>×{item.qty}</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif", flexShrink: 0 }}>
                {fmt(accNet(item))}
              </div>
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
              <span style={{ color: "var(--text-primary)" }}>Total</span>
              <span style={{ color: "var(--accent)" }}>{fmt(total)}</span>
            </div>
          </div>
        </div>

        {/* Customer */}
        {(customer.name || customer.phone) && (
          <div style={{ padding: "12px 22px", borderBottom: "1px solid var(--border)" }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif", marginBottom: 8 }}>
              Customer
            </div>
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
              {customer.name  && <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{customer.name}</span>}
              {customer.phone && <span style={{ fontSize: 13, color: "var(--text-secondary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{customer.phone}</span>}
              {customer.nic   && <span style={{ fontSize: 13, color: "var(--text-secondary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>NIC: {customer.nic}</span>}
            </div>
          </div>
        )}

        {/* Reference input */}
        <div style={{ padding: "16px 22px" }}>
          <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif", display: "block", marginBottom: 8 }}>
            Card Transaction Reference No. *
          </label>
          <input
            autoFocus
            value={ref}
            onChange={e => setRef(e.target.value)}
            onKeyDown={e => e.key === "Enter" && ref.trim() && onConfirm(ref.trim())}
            placeholder="Enter reference number from terminal..."
            style={{
              width: "100%", padding: "10px 13px", borderRadius: 9,
              border: `1px solid ${ref.trim() ? "var(--border-active)" : "var(--border)"}`,
              background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14,
              fontFamily: "monospace", outline: "none", boxSizing: "border-box",
              transition: "border-color 0.15s",
            }}
          />
          <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif", marginTop: 6 }}>
            Transaction will not be marked complete until a reference number is entered.
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "0 22px 18px", display: "flex", gap: 10 }}>
          <button
            onClick={onCancel}
            style={{ flex: 1, padding: "10px", borderRadius: 9, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            Cancel
          </button>
          <button
            onClick={() => ref.trim() && onConfirm(ref.trim())}
            disabled={!ref.trim()}
            style={{
              flex: 2, padding: "10px", borderRadius: 9, border: "none", fontSize: 13, fontWeight: 700,
              cursor: ref.trim() ? "pointer" : "not-allowed",
              background: ref.trim() ? "var(--accent)" : "var(--border)",
              color: ref.trim() ? "var(--accent-fg)" : "var(--text-muted)",
              fontFamily: "'Plus Jakarta Sans', sans-serif", transition: "all 0.15s",
            }}
          >
            {ref.trim() ? `Confirm Payment · ${fmt(total)}` : "Enter reference to confirm"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}


// ─── Mobile Print Preview Modal ──────────────────────────────────────────────

function MobilePrintPreviewModal({
  invoiceNo, phoneCart, accessoryCart, customer,
  paymentMethod, cardRef, creditCustomer,
  subtotal, overallDiscount, total, issuedBy,
  cashReceived, change, cardPaid, creditDue,
  onDone,
}: {
  invoiceNo: string;
  phoneCart: PhoneCartItem[];
  accessoryCart: AccessoryCartItem[];
  customer: { name: string; phone: string; whatsapp: string; email: string; nic: string };
  paymentMethod: string;
  cardRef?: string;
  creditCustomer?: POSCreditCustomer | null;
  subtotal: number;
  overallDiscount: number;
  total: number;
  issuedBy: string;
  /** Set only for a cash sale — what was handed over, before change. */
  cashReceived?: number;
  change: number;
  cardPaid: number;
  creditDue: number;
  onDone: () => void;
}) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const today = new Date().toLocaleDateString("en-LK", { year: "numeric", month: "long", day: "numeric" });

  usePersistInvoiceDocument(invoiceNo, receiptRef, "@page { size: A4 portrait; margin: 12mm; }");

  const handlePrint = () => {
    if (!receiptRef.current) return;
    const printDiv = document.createElement("div");
    printDiv.id = "__mp__";
    printDiv.innerHTML = receiptRef.current.outerHTML;
    document.body.appendChild(printDiv);

    const styleEl = document.createElement("style");
    styleEl.id = "__mp_style__";
    styleEl.textContent = `
      @page { size: A5 landscape; margin: 10mm; }
      #__mp__ { display: none; }
      @media print {
        body { visibility: hidden; }
        #__mp__ {
          display: block !important;
          visibility: visible;
          position: fixed;
          left: 0; top: 0;
          width: 100%;
        }
        #__mp__ * { visibility: visible; }
      }
    `;
    document.head.appendChild(styleEl);
    window.print();
    setTimeout(() => {
      document.getElementById("__mp__")?.remove();
      document.getElementById("__mp_style__")?.remove();
    }, 1000);
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.72)",
        backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, gap: 16,
      }}
    >
      {/* Toolbar */}
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.7)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          Print Invoice — A5 Landscape
        </div>
        <div style={{ flex: 1 }} />
        <button
          onClick={handlePrint}
          style={{
            display: "flex", alignItems: "center", gap: 7,
            padding: "9px 22px", borderRadius: 9, border: "none",
            background: "#ffffff", color: "#111827",
            fontWeight: 700, fontSize: 13, cursor: "pointer",
            fontFamily: "'Plus Jakarta Sans', sans-serif",
          }}
        >
          <Printer size={15} /> Print
        </button>
        <button
          onClick={onDone}
          style={{
            padding: "9px 22px", borderRadius: 9,
            border: "1px solid rgba(255,255,255,0.2)", background: "transparent",
            color: "rgba(255,255,255,0.7)", fontWeight: 600, fontSize: 13,
            cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif",
          }}
        >
          Skip &amp; Done
        </button>
      </div>

      {/* A5 Preview */}
      <div style={{ overflowY: "auto", maxHeight: "calc(100vh - 130px)", borderRadius: 8 }}>
        <div
          ref={receiptRef}
          style={{
            background: "#ffffff", borderRadius: 6, border: "1px solid #d1d5db",
            overflow: "hidden", boxShadow: "0 4px 32px rgba(0,0,0,0.4)",
            fontFamily: "Arial, Helvetica, sans-serif", color: "#111827",
            width: 740,
          }}
        >
          {/* Top accent bar */}
          <div style={{ height: 4, background: "#111827" }} />

          {/* Row 1: Branding + Invoice ref  |  Customer Info */}
          <div style={{ display: "flex", borderBottom: "1.5px solid #111827" }}>

            {/* Left — Branding */}
            <div style={{ flex: "0 0 52%", padding: "14px 18px 12px", borderRight: "1px solid #d1d5db" }}>
              <div style={{ fontSize: 17, fontWeight: 900, letterSpacing: "0.12em", color: "#111827", lineHeight: 1 }}>{SHOP_DETAILS.name.toUpperCase()}</div>
              <div style={{ fontSize: 8, letterSpacing: "0.22em", color: "#6b7280", marginTop: 3, marginBottom: 10 }}>{SHOP_DETAILS.tagline.toUpperCase()}</div>
              <div style={{ fontSize: 9.5, color: "#374151", lineHeight: 1.65 }}>
                <div>{SHOP_DETAILS.address}</div>
                <div>Tel: {SHOP_DETAILS.phone}</div>
                <div>{SHOP_DETAILS.email}</div>
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

            {/* Right — Customer + Payment */}
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
                <div style={{ fontSize: 10, fontWeight: 700, color: creditDue > 0 ? "#dc2626" : "#111827" }}>{paymentMethod}</div>
                {cardRef && (
                  <div style={{ fontSize: 9, color: "#6b7280", marginTop: 2 }}>Ref: <span style={{ fontWeight: 700, color: "#374151" }}>{cardRef}</span></div>
                )}
                {creditCustomer && (
                  <div style={{ fontSize: 9, color: "#dc2626", marginTop: 2 }}>Credit A/C: {creditCustomer.name}</div>
                )}
              </div>
            </div>
          </div>

          {/* Row 2: Items */}
          <div style={{ padding: "12px 18px", borderBottom: "1.5px solid #111827" }}>
            <div style={{ fontSize: 8, fontWeight: 700, color: "#6b7280", letterSpacing: "0.14em", textTransform: "uppercase" as const, marginBottom: 8 }}>Purchased Items</div>
            <table style={{ width: "100%", borderCollapse: "collapse" as const, fontSize: 9.5 }}>
              <colgroup>
                <col style={{ width: "26%" }} />
                <col style={{ width: "24%" }} />
                <col style={{ width: "8%" }} />
                <col style={{ width: "14%" }} />
                <col style={{ width: "14%" }} />
                <col style={{ width: "14%" }} />
              </colgroup>
              <thead>
                <tr style={{ borderBottom: "1.5px solid #111827" }}>
                  <th style={{ textAlign: "left" as const, padding: "4px 6px 5px 0", fontWeight: 700, color: "#111827" }}>Item</th>
                  <th style={{ textAlign: "left" as const, padding: "4px 6px 5px", fontWeight: 700, color: "#111827" }}>IMEI / Code</th>
                  <th style={{ textAlign: "center" as const, padding: "4px 6px 5px", fontWeight: 700, color: "#111827" }}>Qty</th>
                  <th style={{ textAlign: "right" as const, padding: "4px 6px 5px", fontWeight: 700, color: "#111827" }}>Unit Price</th>
                  <th style={{ textAlign: "right" as const, padding: "4px 6px 5px", fontWeight: 700, color: "#111827" }}>Discount</th>
                  <th style={{ textAlign: "right" as const, padding: "4px 0 5px 6px", fontWeight: 700, color: "#111827" }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {phoneCart.map(pc => {
                  const disc = parseFloat(pc.discount) || 0;
                  const net  = phoneNet(pc);
                  return (
                    <tr key={pc.phone.imei} style={{ borderBottom: "1px solid #e5e7eb" }}>
                      <td style={{ padding: "5px 6px 5px 0", fontWeight: 600, color: "#111827" }}>
                        {pc.phone.name}
                        <div style={{ fontSize: 8, color: "#6b7280", fontWeight: 400, marginTop: 1 }}>{pc.phone.color} · {pc.phone.storage}</div>
                      </td>
                      <td style={{ padding: "5px 6px", fontFamily: "monospace", fontSize: 8.5, color: "#6b7280" }}>{pc.phone.imei}</td>
                      <td style={{ padding: "5px 6px", textAlign: "center" as const, color: "#374151" }}>1</td>
                      <td style={{ padding: "5px 6px", textAlign: "right" as const, color: "#374151" }}>Rs.{(parseFloat(pc.sellingPrice) || 0).toLocaleString()}</td>
                      <td style={{ padding: "5px 6px", textAlign: "right" as const, color: disc > 0 ? "#dc2626" : "#9ca3af" }}>{disc > 0 ? `(Rs.${disc.toLocaleString()})` : "—"}</td>
                      <td style={{ padding: "5px 0 5px 6px", textAlign: "right" as const, fontWeight: 700, color: "#111827" }}>Rs.{net.toLocaleString()}</td>
                    </tr>
                  );
                })}
                {accessoryCart.map(item => {
                  const disc = parseFloat(item.discount) || 0;
                  const net  = accNet(item);
                  return (
                    <tr key={item.id} style={{ borderBottom: "1px solid #e5e7eb" }}>
                      <td style={{ padding: "5px 6px 5px 0", fontWeight: 600, color: "#111827" }}>{item.name}</td>
                      <td style={{ padding: "5px 6px", fontFamily: "monospace", fontSize: 8.5, color: "#6b7280" }}>{item.code}</td>
                      <td style={{ padding: "5px 6px", textAlign: "center" as const, color: "#374151" }}>{item.qty}</td>
                      <td style={{ padding: "5px 6px", textAlign: "right" as const, color: "#374151" }}>Rs.{item.price.toLocaleString()}</td>
                      <td style={{ padding: "5px 6px", textAlign: "right" as const, color: disc > 0 ? "#dc2626" : "#9ca3af" }}>{disc > 0 ? `(Rs.${disc.toLocaleString()})` : "—"}</td>
                      <td style={{ padding: "5px 0 5px 6px", textAlign: "right" as const, fontWeight: 700, color: "#111827" }}>Rs.{net.toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Totals */}
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
                  <span>TOTAL</span>
                  <span>Rs.{total.toLocaleString()}</span>
                </div>
                {[
                  { label: "Cash Received", value: cashReceived ?? 0,  show: cashReceived !== undefined && cashReceived > 0 },
                  { label: "Change",        value: change,             show: change > 0 },
                  { label: "Paid by Card",  value: cardPaid,           show: cardPaid > 0 },
                ].filter(r => r.show).map(r => (
                  <div key={r.label} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", fontSize: 9.5, borderBottom: "1px solid #f3f4f6" }}>
                    <span style={{ color: "#6b7280" }}>{r.label}</span>
                    <span style={{ color: "#374151" }}>Rs.{r.value.toLocaleString()}</span>
                  </div>
                ))}
                {creditDue > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", fontSize: 9.5, fontWeight: 700, color: "#dc2626" }}>
                    <span>Balance Due (Credit)</span>
                    <span>Rs.{creditDue.toLocaleString()}</span>
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
                <div>• Warranty valid only with this receipt.</div>
                <div>• Physical damage not covered under warranty.</div>
                <div>• Device IMEI is verified at point of sale.</div>
                <div>• Queries: {SHOP_DETAILS.phone}</div>
              </div>
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #e5e7eb", fontSize: 8.5, color: "#6b7280" }}>
                Issued by: <span style={{ fontWeight: 700, color: "#111827" }}>{issuedBy}</span>
              </div>
            </div>
            <div style={{ flex: 1, padding: "10px 18px 12px", display: "flex", alignItems: "center", justifyContent: "space-evenly", gap: 6 }}>
              <QRCodeSVG value={invoiceNo} size={72} level="M" />
              <Barcode value={invoiceNo} width={1.2} height={58} fontSize={8} margin={0} background="#ffffff" lineColor="#111111" displayValue />
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Phone Search Popup ───────────────────────────────────────────────────────

function PhoneSearchPopup({
  phones, phoneCart, initialName = "", initialImei = "", onAddMultiple, onClose,
}: {
  phones: Phone[];
  phoneCart: PhoneCartItem[];
  initialName?: string;
  initialImei?: string;
  onAddMultiple: (selected: Phone[]) => void;
  onClose: () => void;
}) {
  const [filterBrand,   setFilterBrand]   = useState("");
  const [filterStorage, setFilterStorage] = useState("");
  const [filterColor,   setFilterColor]   = useState("");
  const [filterName,    setFilterName]    = useState(initialName);
  const [filterImei,    setFilterImei]    = useState(initialImei);
  const [selectedImeis, setSelectedImeis] = useState<Set<string>>(new Set());

  const brands    = [...new Set(phones.map(p => p.brand).filter(Boolean))].sort();
  const storages  = [...new Set(phones.map(p => p.storage).filter(Boolean))].sort();
  const colors    = [...new Set(phones.map(p => p.color).filter(Boolean))].sort();

  const filtered = phones.filter(p => {
    if (filterBrand   && p.brand   !== filterBrand)   return false;
    if (filterStorage && p.storage !== filterStorage) return false;
    if (filterColor   && p.color   !== filterColor)   return false;
    if (filterName) {
      const q = filterName.trim().toLowerCase();
      if (![p.name, p.brand, p.modelNumber].some(v => v.toLowerCase().includes(q))) return false;
    }
    if (filterImei) {
      const q = filterImei.trim().toLowerCase();
      if (!phoneIds(p).some(id => id.includes(q))) return false;
    }
    return true;
  });

  const inCart = (imei: string) => phoneCart.some(pc => pc.phone.imei === imei);
  const selectable = filtered.filter(p => !inCart(p.imei));

  const toggleSelect = (imei: string) =>
    setSelectedImeis(prev => { const n = new Set(prev); n.has(imei) ? n.delete(imei) : n.add(imei); return n; });

  const toggleAll = () =>
    setSelectedImeis(selectedImeis.size === selectable.length ? new Set() : new Set(selectable.map(p => p.imei)));

  const addSelected = () => {
    onAddMultiple(phones.filter(p => selectedImeis.has(p.imei)));
    onClose();
  };

  const selStyle: React.CSSProperties = {
    padding: "7px 10px", borderRadius: 8, border: "1px solid var(--border)",
    background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 12,
    fontFamily: "'Plus Jakarta Sans', sans-serif", outline: "none", cursor: "pointer",
  };
  const thStyle: React.CSSProperties = {
    padding: "10px 12px", fontSize: 11, fontWeight: 700, textAlign: "left",
    color: "var(--text-secondary)", fontFamily: "'Plus Jakarta Sans', sans-serif",
    letterSpacing: "0.05em", textTransform: "uppercase" as const, whiteSpace: "nowrap" as const,
    borderBottom: "1px solid var(--border)", background: "var(--bg-card)",
    position: "sticky" as const, top: 0,
  };
  const tdStyle: React.CSSProperties = {
    padding: "10px 12px", fontSize: 12, color: "var(--text-primary)",
    fontFamily: "'Plus Jakarta Sans', sans-serif", borderBottom: "1px solid var(--border)",
    verticalAlign: "middle",
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 1100,
          height: "100%", maxHeight: "calc(100vh - 80px)",
          background: "var(--bg-card)", borderRadius: 16,
          border: "1px solid var(--border)",
          boxShadow: "0 32px 80px rgba(0,0,0,0.5)",
          display: "flex", flexDirection: "column", overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{ padding: "16px 22px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              Search Device
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif", marginTop: 2 }}>
              Filter inventory and select devices to add to this sale
            </div>
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid var(--border)", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
            <X size={14} />
          </button>
        </div>

        {/* Filters */}
        <div style={{ padding: "14px 22px", borderBottom: "1px solid var(--border)", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", flexShrink: 0 }}>
          <input
            value={filterImei}
            onChange={e => setFilterImei(e.target.value)}
            placeholder="IMEI or last 6 digits..."
            style={{ ...selStyle, width: 190, fontFamily: "monospace" }}
          />
          <input
            value={filterName}
            onChange={e => setFilterName(e.target.value)}
            placeholder="Phone name..."
            style={{ ...selStyle, width: 160 }}
          />
          <select value={filterBrand} onChange={e => setFilterBrand(e.target.value)} style={selStyle}>
            <option value="">All Brands</option>
            {brands.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          <select value={filterStorage} onChange={e => setFilterStorage(e.target.value)} style={selStyle}>
            <option value="">All Storage</option>
            {storages.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={filterColor} onChange={e => setFilterColor(e.target.value)} style={selStyle}>
            <option value="">All Colors</option>
            {colors.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          {(filterImei || filterName || filterBrand || filterStorage || filterColor) && (
            <button
              onClick={() => { setFilterImei(""); setFilterName(""); setFilterBrand(""); setFilterStorage(""); setFilterColor(""); }}
              style={{ ...selStyle, color: "#ef4444", border: "1px solid #ef444440" }}
            >
              Clear
            </button>
          )}
        </div>

        {/* Table */}
        <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, width: 40 }}>
                  <input
                    type="checkbox"
                    checked={selectable.length > 0 && selectedImeis.size === selectable.length}
                    onChange={toggleAll}
                    style={{ cursor: "pointer", accentColor: "var(--accent)" }}
                  />
                </th>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>IMEI</th>
                <th style={thStyle}>Brand</th>
                <th style={thStyle}>Storage</th>
                <th style={thStyle}>Color</th>
                <th style={thStyle}>Supplier</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Min Price</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Suggested</th>
                <th style={{ ...thStyle, textAlign: "center", width: 80 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ ...tdStyle, textAlign: "center", padding: "32px 0", color: "var(--text-muted)" }}>
                    No devices match the filters
                  </td>
                </tr>
              ) : (
                filtered.map(p => {
                  const selected = selectedImeis.has(p.imei);
                  const already  = inCart(p.imei);
                  return (
                    <tr
                      key={p.imei}
                      onClick={() => !already && toggleSelect(p.imei)}
                      style={{
                        cursor: already ? "not-allowed" : "pointer",
                        opacity: already ? 0.45 : 1,
                        background: selected ? `rgba(var(--accent-rgb),0.06)` : "transparent",
                        transition: "background 0.1s",
                      }}
                    >
                      <td style={tdStyle}>
                        <input
                          type="checkbox"
                          checked={selected}
                          disabled={already}
                          onChange={() => toggleSelect(p.imei)}
                          onClick={e => e.stopPropagation()}
                          style={{ cursor: already ? "not-allowed" : "pointer", accentColor: "var(--accent)" }}
                        />
                      </td>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>{p.name}</td>
                      <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 11, color: "var(--text-secondary)" }}>
                        {filterImei.trim() && p.imei.includes(filterImei.trim()) ? (() => {
                          const idx = p.imei.lastIndexOf(filterImei.trim());
                          return (<>
                            {p.imei.slice(0, idx)}
                            <span style={{ color: "var(--accent)", fontWeight: 700 }}>{p.imei.slice(idx, idx + filterImei.trim().length)}</span>
                            {p.imei.slice(idx + filterImei.trim().length)}
                          </>);
                        })() : p.imei}
                      </td>
                      <td style={{ ...tdStyle, color: "var(--text-secondary)" }}>{p.brand}</td>
                      <td style={{ ...tdStyle, color: "var(--text-secondary)" }}>{p.storage}</td>
                      <td style={{ ...tdStyle, color: "var(--text-secondary)" }}>{p.color}</td>
                      <td style={{ ...tdStyle, color: "var(--text-secondary)" }}>{p.supplier}</td>
                      <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600, color: "#f59e0b" }}>
                        Rs. {p.minSellingPrice.toLocaleString()}
                      </td>
                      <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600 }}>
                        Rs. {p.suggestedPrice.toLocaleString()}
                      </td>
                      <td style={{ ...tdStyle, textAlign: "center" }}>
                        {already ? (
                          <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 5, background: "var(--accent-dim)", color: "var(--accent)", fontWeight: 600, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                            In cart
                          </span>
                        ) : p.status === "reserved" ? (
                          <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 5, background: "rgba(251,191,36,0.12)", color: "#f59e0b", fontWeight: 600, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                            Reserved
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div style={{ padding: "14px 22px", borderTop: "1px solid var(--border)", flexShrink: 0, display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg-card)" }}>
          <span style={{ fontSize: 13, color: "var(--text-secondary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            {filtered.length} device{filtered.length !== 1 ? "s" : ""} shown
            {selectedImeis.size > 0 && <span style={{ color: "var(--accent)", fontWeight: 700 }}> · {selectedImeis.size} selected</span>}
          </span>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={onClose}
              style={{ padding: "9px 20px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", fontSize: 13, fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, cursor: "pointer" }}
            >
              Cancel
            </button>
            <button
              onClick={addSelected}
              disabled={selectedImeis.size === 0}
              style={{
                padding: "9px 22px", borderRadius: 8, border: "none", fontSize: 13,
                fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700,
                cursor: selectedImeis.size === 0 ? "not-allowed" : "pointer",
                background: selectedImeis.size === 0 ? "var(--border)" : "var(--accent)",
                color: selectedImeis.size === 0 ? "var(--text-muted)" : "var(--accent-fg)",
              }}
            >
              {selectedImeis.size === 0 ? "Select devices to add" : `Add ${selectedImeis.size} device${selectedImeis.size > 1 ? "s" : ""}`}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Accessory Search Popup ───────────────────────────────────────────────────

function AccessorySearchPopup({
  accessories, accessoryCart, onAddMultiple, onClose,
}: {
  accessories: AccessoryBase[];
  accessoryCart: AccessoryCartItem[];
  onAddMultiple: (selected: AccessoryBase[]) => void;
  onClose: () => void;
}) {
  const [filterBrand, setFilterBrand] = useState("");
  const [filterName,  setFilterName]  = useState("");
  const [filterCode,  setFilterCode]  = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const brands = [...new Set(accessories.map(a => a.brand).filter(Boolean))].sort();

  const filtered = accessories.filter(a => {
    if (filterBrand && a.brand !== filterBrand) return false;
    if (filterName  && !a.name.toLowerCase().includes(filterName.toLowerCase())) return false;
    if (filterCode  && !a.code.toLowerCase().includes(filterCode.trim().toLowerCase())) return false;
    return true;
  });
  const selectable = filtered.filter(a => a.stock > 0);

  const toggleSelect = (id: number) =>
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const toggleAll = () =>
    setSelectedIds(selectedIds.size === selectable.length ? new Set() : new Set(selectable.map(a => a.id)));

  const addSelected = () => {
    onAddMultiple(accessories.filter(a => selectedIds.has(a.id)));
    onClose();
  };

  const inCart = (id: number) => accessoryCart.some(i => i.id === id);

  const selStyle: React.CSSProperties = {
    padding: "7px 10px", borderRadius: 8, border: "1px solid var(--border)",
    background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 12,
    fontFamily: "'Plus Jakarta Sans', sans-serif", outline: "none", cursor: "pointer",
  };
  const thStyle: React.CSSProperties = {
    padding: "10px 12px", fontSize: 11, fontWeight: 700, textAlign: "left",
    color: "var(--text-secondary)", fontFamily: "'Plus Jakarta Sans', sans-serif",
    letterSpacing: "0.05em", textTransform: "uppercase" as const, whiteSpace: "nowrap" as const,
    borderBottom: "1px solid var(--border)", background: "var(--bg-card)",
    position: "sticky" as const, top: 0,
  };
  const tdStyle: React.CSSProperties = {
    padding: "10px 12px", fontSize: 12, color: "var(--text-primary)",
    fontFamily: "'Plus Jakarta Sans', sans-serif", borderBottom: "1px solid var(--border)",
    verticalAlign: "middle",
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 900,
          height: "100%", maxHeight: "calc(100vh - 80px)",
          background: "var(--bg-card)", borderRadius: 16,
          border: "1px solid var(--border)",
          boxShadow: "0 32px 80px rgba(0,0,0,0.5)",
          display: "flex", flexDirection: "column", overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{ padding: "16px 22px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              Search Item
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif", marginTop: 2 }}>
              Select accessories to add to this sale
            </div>
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid var(--border)", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
            <X size={14} />
          </button>
        </div>

        {/* Filters */}
        <div style={{ padding: "14px 22px", borderBottom: "1px solid var(--border)", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", flexShrink: 0 }}>
          <input
            value={filterCode}
            onChange={e => setFilterCode(e.target.value)}
            placeholder="Product code..."
            style={{ ...selStyle, width: 160, fontFamily: "monospace" }}
          />
          <input
            value={filterName}
            onChange={e => setFilterName(e.target.value)}
            placeholder="Item name..."
            style={{ ...selStyle, width: 180 }}
          />
          <select value={filterBrand} onChange={e => setFilterBrand(e.target.value)} style={selStyle}>
            <option value="">All Brands</option>
            {brands.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          {(filterCode || filterName || filterBrand) && (
            <button
              onClick={() => { setFilterCode(""); setFilterName(""); setFilterBrand(""); }}
              style={{ ...selStyle, color: "#ef4444", border: "1px solid #ef444440" }}
            >
              Clear
            </button>
          )}
        </div>

        {/* Table */}
        <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, width: 40 }}>
                  <input
                    type="checkbox"
                    checked={selectable.length > 0 && selectedIds.size === selectable.length}
                    onChange={toggleAll}
                    style={{ cursor: "pointer", accentColor: "var(--accent)" }}
                  />
                </th>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Model</th>
                <th style={thStyle}>Brand</th>
                <th style={thStyle}>Code</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Price</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Stock</th>
                <th style={{ ...thStyle, textAlign: "center", width: 80 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ ...tdStyle, textAlign: "center", padding: "32px 0", color: "var(--text-muted)" }}>
                    No items match the filters
                  </td>
                </tr>
              ) : (
                filtered.map(a => {
                  const selected = selectedIds.has(a.id);
                  const already  = inCart(a.id);
                  const out      = a.stock <= 0;
                  return (
                    <tr
                      key={a.id}
                      onClick={() => !out && toggleSelect(a.id)}
                      style={{
                        cursor: out ? "not-allowed" : "pointer",
                        opacity: out ? 0.45 : 1,
                        background: selected ? `rgba(var(--accent-rgb),0.06)` : "transparent",
                        transition: "background 0.1s",
                      }}
                    >
                      <td style={tdStyle}>
                        <input
                          type="checkbox"
                          checked={selected}
                          disabled={out}
                          onChange={() => toggleSelect(a.id)}
                          onClick={e => e.stopPropagation()}
                          style={{ cursor: out ? "not-allowed" : "pointer", accentColor: "var(--accent)" }}
                        />
                      </td>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>{a.name}</td>
                      <td style={{ ...tdStyle, color: "var(--text-secondary)" }}>{a.model}</td>
                      <td style={{ ...tdStyle, color: "var(--text-secondary)" }}>{a.brand}</td>
                      <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 11, color: "var(--text-secondary)" }}>
                        {filterCode && a.code.toLowerCase().includes(filterCode.trim().toLowerCase()) ? (() => {
                          const q = filterCode.trim().toLowerCase();
                          const idx = a.code.toLowerCase().indexOf(q);
                          return (<>
                            {a.code.slice(0, idx)}
                            <span style={{ color: "var(--accent)", fontWeight: 700 }}>{a.code.slice(idx, idx + q.length)}</span>
                            {a.code.slice(idx + q.length)}
                          </>);
                        })() : a.code}
                      </td>
                      <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600 }}>
                        Rs. {a.price.toLocaleString()}
                      </td>
                      <td style={{ ...tdStyle, textAlign: "right", color: out ? "#ef4444" : "var(--text-secondary)" }}>
                        {out ? "Out" : a.stock}
                      </td>
                      <td style={{ ...tdStyle, textAlign: "center" }}>
                        {already && (
                          <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 5, background: "var(--accent-dim)", color: "var(--accent)", fontWeight: 600, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                            In cart
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div style={{ padding: "14px 22px", borderTop: "1px solid var(--border)", flexShrink: 0, display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg-card)" }}>
          <span style={{ fontSize: 13, color: "var(--text-secondary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            {filtered.length} item{filtered.length !== 1 ? "s" : ""} shown
            {selectedIds.size > 0 && <span style={{ color: "var(--accent)", fontWeight: 700 }}> · {selectedIds.size} selected</span>}
          </span>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={onClose}
              style={{ padding: "9px 20px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", fontSize: 13, fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, cursor: "pointer" }}
            >
              Cancel
            </button>
            <button
              onClick={addSelected}
              disabled={selectedIds.size === 0}
              style={{
                padding: "9px 22px", borderRadius: 8, border: "none", fontSize: 13,
                fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700,
                cursor: selectedIds.size === 0 ? "not-allowed" : "pointer",
                background: selectedIds.size === 0 ? "var(--border)" : "var(--accent)",
                color: selectedIds.size === 0 ? "var(--text-muted)" : "var(--accent-fg)",
              }}
            >
              {selectedIds.size === 0 ? "Select items to add" : `Add ${selectedIds.size} item${selectedIds.size > 1 ? "s" : ""}`}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MobileSales() {
  const isMobile = useIsMobile();
  const { addEntry } = useCashRegister();
  const { addSale } = useSales();
  const { profile } = useAuth();
  const { devices, sellSale, loading: devicesLoading, error: devicesError, configured } = useDevices();
  const { products, reload: reloadAccessories } = useAccessories();

  const [imeiQuery,       setImeiQuery]       = useState("");
  const [imeiError,       setImeiError]       = useState<string | null>(null);
  const [phoneCart,       setPhoneCart]       = useState<PhoneCartItem[]>([]);
  const [phoneSearch,     setPhoneSearch]     = useState<{ name: string; imei: string } | null>(null);

  const [barcodeQuery,      setBarcodeQuery]      = useState("");
  const [barcodeError,      setBarcodeError]      = useState<string | null>(null);
  const [accessoryCart,     setAccessoryCart]     = useState<AccessoryCartItem[]>([]);
  const [showAccessorySearch, setShowAccessorySearch] = useState(false);

  const [overallDiscount, setOverallDiscount] = useState("");
  const [paymentMethod,   setPaymentMethod]   = useState<"" | "Cash" | "Card" | "Credit">("");
  const [customer,        setCustomer]        = useState({ name: "", phone: "", whatsapp: "", email: "", nic: "" });
  const [completed,              setCompleted]              = useState(false);
  const [showCardModal,          setShowCardModal]          = useState(false);
  const [selectedCreditCustomer, setSelectedCreditCustomer] = useState<POSCreditCustomer | null>(null);
  // Cash: what the customer handed over, and — when it falls short of the
  // total — how the rest is being settled.
  const [cashReceived,           setCashReceived]           = useState("");
  const [balanceMethod,          setBalanceMethod]          = useState<"" | "Card" | "Credit">("");
  const [balanceCardRef,         setBalanceCardRef]         = useState("");
  const [showPrintPreview,      setShowPrintPreview]       = useState(false);
  const [confirmedCardRef,       setConfirmedCardRef]       = useState("");
  const [checkoutError,          setCheckoutError]          = useState<string | null>(null);
  // Set when the stock moved and the invoice number was taken, but the ledger
  // row or its credit charge did not land — the sale happened, the books need
  // somebody to look at them.
  const [saveWarning,            setSaveWarning]            = useState<string | null>(null);

  // Assigned by sell_mobile_sale() in the same transaction that marks the
  // devices sold, so a refused sale never burns a number.
  const [invoiceNo, setInvoiceNo] = useState<string | null>(null);
  const [invoicing, setInvoicing] = useState(false);
  const busyRef = useRef(false);

  const cashierName = profile?.fullName?.trim() || "Cashier";

  // ── What can be sold ───────────────────────────────────────────────────────
  // Sold phones are history, not stock. Reserved ones are still on the shelf —
  // usually for the very customer now at the counter — and are flagged.
  const sellablePhones = useMemo(
    () => devices.filter(d => d.status !== "sold"),
    [devices],
  );

  // Real stock less what this cart already holds, so the pickers can't offer
  // more than is on the shelf. The actual deduction happens at checkout.
  const accessories = useMemo<AccessoryBase[]>(() => {
    const held = new Map(accessoryCart.map(i => [i.id, i.qty]));
    return products.map(p => ({
      id: p.id, code: p.code, name: p.name, model: p.model, brand: p.brand,
      price: p.sellingPrice,
      stock: Math.max(0, p.stock - (held.get(p.id) ?? 0)),
    }));
  }, [products, accessoryCart]);
  const stockOf = (id: number) => products.find(p => p.id === id)?.stock ?? 0;

  // ── Phone cart handlers ────────────────────────────────────────────────────
  const addPhones = (selected: Phone[]) => {
    setPhoneCart(prev => {
      const existing = new Set(prev.map(pc => pc.phone.id));
      const toAdd = selected
        .filter(p => !existing.has(p.id))
        .map(p => ({ phone: p, sellingPrice: p.suggestedPrice ? p.suggestedPrice.toString() : "", discount: "" }));
      return [...prev, ...toAdd];
    });
  };

  const handleImeiSearch = () => {
    const q = imeiQuery.trim().toLowerCase();
    if (!q) return;

    // A scanned IMEI / serial is exact; a typed one is often just the last few
    // digits; anything else is a name.
    const exact = sellablePhones.filter(p => phoneIds(p).includes(q));
    const partial = exact.length ? exact : sellablePhones.filter(p =>
      phoneIds(p).some(id => id.endsWith(q)) ||
      [p.name, p.brand, p.modelNumber].some(v => v.toLowerCase().includes(q)),
    );

    if (partial.length === 0) {
      const sold = devices.find(p => p.status === "sold" && phoneIds(p).includes(q));
      setImeiError(sold ? `${sold.name} (${sold.imei}) has already been sold` : "No device found — check IMEI or name");
      return;
    }
    if (partial.length === 1) {
      if (phoneCart.some(pc => pc.phone.id === partial[0].id)) {
        setImeiError("That device is already in this sale");
        return;
      }
      addPhones(partial);
      setImeiError(null);
      setImeiQuery("");
      return;
    }
    // Several match — let the cashier pick.
    const numeric = /^[0-9]+$/.test(q);
    setPhoneSearch({ name: numeric ? "" : imeiQuery.trim(), imei: numeric ? imeiQuery.trim() : "" });
    setImeiError(null);
    setImeiQuery("");
  };

  const updatePhonePrice    = (id: number, val: string) =>
    setPhoneCart(prev => prev.map(pc => pc.phone.id === id ? { ...pc, sellingPrice: val } : pc));
  const updatePhoneDiscount = (id: number, val: string) =>
    setPhoneCart(prev => prev.map(pc => pc.phone.id === id ? { ...pc, discount: val } : pc));
  const removePhone         = (id: number) =>
    setPhoneCart(prev => prev.filter(pc => pc.phone.id !== id));

  // ── Accessory cart handlers ────────────────────────────────────────────────
  const addAccessories = (selected: AccessoryBase[]) => {
    setAccessoryCart(prev => {
      let next = [...prev];
      for (const a of selected) {
        const existing = next.find(i => i.id === a.id);
        if (existing) {
          if (existing.qty < stockOf(a.id)) next = next.map(i => i.id === a.id ? { ...i, qty: i.qty + 1 } : i);
        } else if (stockOf(a.id) > 0) {
          next = [...next, { id: a.id, code: a.code, name: a.name, model: a.model, brand: a.brand, price: a.price, discount: "", qty: 1 }];
        }
      }
      return next;
    });
  };

  const handleBarcodeAdd = () => {
    const q = barcodeQuery.trim().toLowerCase();
    if (!q) return;
    const byCode = accessories.find(a => a.code.toLowerCase() === q);
    const byName = byCode ? [] : accessories.filter(a => a.name.toLowerCase().includes(q));
    const acc = byCode ?? (byName.length === 1 ? byName[0] : undefined);

    if (!acc) {
      if (byName.length > 1) { setShowAccessorySearch(true); setBarcodeError(null); return; }
      setBarcodeError("No item found — check the code");
      return;
    }
    if (acc.stock <= 0) {
      setBarcodeError(`${acc.name} is out of stock`);
      return;
    }
    addAccessories([acc]);
    setBarcodeError(null);
    setBarcodeQuery("");
  };

  const updateAccQty      = (id: number, delta: number) =>
    setAccessoryCart(prev => prev.map(i => i.id === id
      ? { ...i, qty: Math.min(stockOf(id), Math.max(1, i.qty + delta)) }
      : i));
  const updateAccDiscount = (id: number, val: string) =>
    setAccessoryCart(prev => prev.map(i => i.id === id ? { ...i, discount: val } : i));
  const removeAcc         = (id: number) =>
    setAccessoryCart(prev => prev.filter(i => i.id !== id));

  // ── Bill ───────────────────────────────────────────────────────────────────
  const phonesNet   = phoneCart.reduce((s, pc) => s + phoneNet(pc), 0);
  const accsNet     = accessoryCart.reduce((s, i) => s + accNet(i), 0);
  const subtotal    = phonesNet + accsNet;
  const overallAmt  = Math.min(subtotal, Math.max(0, parseFloat(overallDiscount) || 0));
  const total       = subtotal - overallAmt;
  // Before any discount at all — what sales.subtotal means.
  const grossTotal  = phoneCart.reduce((s, pc) => s + (parseFloat(pc.sellingPrice) || 0), 0)
                    + accessoryCart.reduce((s, i) => s + i.price * i.qty, 0);

  // What each phone is really sold for: its own net, less its share of the
  // overall discount. That is what the minimum is checked against — here and
  // again in sell_mobile_sale() — and what the device records as sold_price.
  const effectivePrice = (pc: PhoneCartItem) => {
    const net = phoneNet(pc);
    return subtotal > 0 ? Math.round((net - overallAmt * (net / subtotal)) * 100) / 100 : net;
  };
  const isPhoneBelowMin = (pc: PhoneCartItem) =>
    pc.phone.minSellingPrice > 0 && effectivePrice(pc) < pc.phone.minSellingPrice;

  const belowMin      = phoneCart.some(isPhoneBelowMin);
  const missingPrice  = phoneCart.some(pc => !(parseFloat(pc.sellingPrice) > 0));
  const customerReady = customer.name.trim() !== "" && customer.phone.trim() !== "";

  // ── Payment split ──────────────────────────────────────────────────────────
  const isCash       = paymentMethod === "Cash";
  const cashEntered  = cashReceived.trim() !== "";
  const received     = Math.max(0, parseFloat(cashReceived) || 0);
  const cashPaid     = isCash ? Math.min(received, total) : 0;
  const change       = isCash ? Math.max(0, Math.round((received - total) * 100) / 100) : 0;
  const cashBalance  = isCash && cashEntered ? Math.max(0, Math.round((total - received) * 100) / 100) : 0;
  const cardPaid     = paymentMethod === "Card" ? total : cashBalance > 0 && balanceMethod === "Card" ? cashBalance : 0;
  const creditDue    = paymentMethod === "Credit" ? total : cashBalance > 0 && balanceMethod === "Credit" ? cashBalance : 0;
  const usesCredit   = creditDue > 0;
  /** What the ledger and the invoice call it. Credit wins whenever a balance
   *  is going on account, the same rule the repair checkout uses. */
  const recordedMethod: "Cash" | "Card" | "Credit" | "Split" | "" =
    usesCredit ? "Credit" : isCash && cardPaid > 0 ? "Split" : paymentMethod;

  const cashReady = isCash && cashEntered && (
    cashBalance === 0 ||
    (balanceMethod === "Card" && balanceCardRef.trim() !== "") ||
    (balanceMethod === "Credit" && selectedCreditCustomer !== null)
  );

  const canComplete = configured && phoneCart.length > 0 && !belowMin && !missingPrice && customerReady &&
    (cashReady ||
     paymentMethod === "Card" ||
     (paymentMethod === "Credit" && selectedCreditCustomer !== null));

  const choosePayment = (m: "Cash" | "Card" | "Credit") => {
    setPaymentMethod(paymentMethod === m ? "" : m);
    setCashReceived(""); setBalanceMethod(""); setBalanceCardRef("");
    setSelectedCreditCustomer(null);
  };

  /**
   * The sale itself. Stock first — every device marked sold and every
   * accessory deducted in one transaction that also hands back the invoice
   * number — then the ledger row, the till and, for credit, the charge.
   * Nothing is recorded for a sale the database refused.
   */
  const finalize = async (cardRef?: string) => {
    // A ref, not the state: a double click lands twice before any re-render.
    if (busyRef.current) return;
    busyRef.current = true;
    setInvoicing(true);
    setCheckoutError(null);
    setSaveWarning(null);
    try {
      const no = await sellSale(
        phoneCart.map(pc => ({ id: pc.phone.id, price: effectivePrice(pc) })),
        accessoryCart.map(i => ({ id: i.id, qty: i.qty })),
      );
      setInvoiceNo(no);
      if (accessoryCart.length) void reloadAccessories();

      // Only the cash actually kept goes in the drawer — change handed back
      // never belonged to the till.
      if (cashPaid > 0) addEntry("in", `Cash Sale — ${no}`, cashPaid);

      const stored = await addSale(
        {
          invoiceNo: no,
          date: new Date().toISOString().slice(0, 10),
          customer: customer.name.trim() || "Walk-in",
          category: "Mobile",
          items: [
            ...phoneCart.map(pc => pc.phone.name),
            ...accessoryCart.map(ac => `${ac.name} ×${ac.qty}`),
          ].join(", ") || "Mobile Sale",
          total,
          subtotal: grossTotal,
          discountAmount: Math.max(0, grossTotal - total),
          // Everything settled now; the rest is what the credit charge covers.
          paid: Math.round((total - creditDue) * 100) / 100,
          status: "Paid",
          paymentMethod: recordedMethod || undefined,
          cashAmount: isCash ? cashPaid : undefined,
          cardAmount: cardPaid > 0 ? cardPaid : undefined,
          cardRef: cardRef || (cardPaid > 0 && isCash ? balanceCardRef.trim() : "") || undefined,
          cashier: profile?.fullName?.trim() || undefined,
        },
        {
          customerPhone: customer.phone.trim() || null,
          creditAccountId: usesCredit ? selectedCreditCustomer?.id ?? null : null,
          lineItems: [
            ...phoneCart.map(pc => ({ type: "device" as const, id: pc.phone.id, qty: 1 })),
            ...accessoryCart.map(i => ({ type: "accessory" as const, id: i.id, qty: i.qty })),
          ],
          saleItems: [
            ...phoneCart.map<NewSaleItem>(pc => ({
              kind: "device",
              referenceId: pc.phone.imei,
              description: [pc.phone.name, pc.phone.storage, pc.phone.color].filter(Boolean).join(" · "),
              qty: 1,
              unitPrice: parseFloat(pc.sellingPrice) || 0,
              discount: Math.min(parseFloat(pc.discount) || 0, parseFloat(pc.sellingPrice) || 0),
              lineTotal: phoneNet(pc),
            })),
            ...accessoryCart.map<NewSaleItem>(i => ({
              kind: "accessory",
              referenceId: i.id,
              description: i.name,
              qty: i.qty,
              unitPrice: i.price,
              discount: Math.min(parseFloat(i.discount) || 0, i.price * i.qty),
              lineTotal: accNet(i),
            })),
          ],
        },
      );

      if (configured && !stored) {
        setSaveWarning(`${no} was sold but could not be written to the sales ledger — check Sales History and tell an Admin.`);
      } else if (usesCredit && stored && selectedCreditCustomer) {
        // Charges total − paid, read from the stored row — i.e. just the balance.
        try {
          await posPostCredit(no, selectedCreditCustomer.id);
        } catch (e) {
          setSaveWarning(`${no} was saved, but the charge to ${selectedCreditCustomer.name}'s credit account failed: ${e instanceof Error ? e.message : String(e)}`);
        }
      }

      setShowCardModal(false);
      setShowPrintPreview(true);
    } catch (e) {
      setShowCardModal(false);
      setCheckoutError(e instanceof Error ? e.message : String(e));
    } finally {
      busyRef.current = false;
      setInvoicing(false);
    }
  };

  const resetAll = () => {
    setPhoneCart([]); setAccessoryCart([]); setImeiQuery(""); setBarcodeQuery("");
    setImeiError(null); setBarcodeError(null);
    setOverallDiscount(""); setPaymentMethod("");
    setCustomer({ name: "", phone: "", whatsapp: "", email: "", nic: "" });
    setSelectedCreditCustomer(null);
    setCashReceived(""); setBalanceMethod(""); setBalanceCardRef("");
    setShowCardModal(false);
    setShowPrintPreview(false); setConfirmedCardRef("");
    setCheckoutError(null); setSaveWarning(null);
    setCompleted(false); setInvoiceNo(null);
  };

  if (completed) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, gap: 16, textAlign: "center" }}>
        <div style={{ fontSize: 52, color: "var(--accent)" }}>✓</div>
        <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "'Plus Jakarta Sans', sans-serif", color: "var(--text-primary)" }}>Invoice Complete</div>
        <div style={{ fontSize: 13, color: "var(--text-secondary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          {invoiceNo} · {phoneCart.length} device{phoneCart.length !== 1 ? "s" : ""} · {fmt(total)} · {recordedMethod}
          {change > 0 && ` · Change ${fmt(change)}`}
          {creditDue > 0 && ` · ${fmt(creditDue)} on credit`}
        </div>
        {saveWarning && (
          <div style={{ maxWidth: 460, padding: "10px 14px", borderRadius: 9, background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.35)", fontSize: 12.5, color: "#dc2626", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            {saveWarning}
          </div>
        )}
        <button onClick={resetAll} style={{ marginTop: 8, padding: "10px 28px", borderRadius: 8, border: "none", background: "var(--accent)", color: "var(--accent-fg)", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          New Sale
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>

      {!configured && (
        <div style={{ marginBottom: 12, padding: "10px 14px", borderRadius: 9, background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.35)", fontSize: 12.5, color: "var(--text-secondary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          Connect Supabase to sell devices — the inventory is empty and nothing here will be saved.
        </div>
      )}
      {configured && devicesLoading && devices.length === 0 && (
        <div style={{ marginBottom: 12, fontSize: 12.5, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Loading device inventory…</div>
      )}
      {devicesError && (
        <div style={{ marginBottom: 12, padding: "10px 14px", borderRadius: 9, background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.35)", fontSize: 12.5, color: "#dc2626", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          Could not load the device inventory: {devicesError}
        </div>
      )}
      {checkoutError && (
        <div style={{ marginBottom: 12, padding: "10px 14px", borderRadius: 9, background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.35)", fontSize: 12.5, color: "#dc2626", fontFamily: "'Plus Jakarta Sans', sans-serif", display: "flex", justifyContent: "space-between", gap: 12 }}>
          <span>Sale not completed — {checkoutError}</span>
          <button onClick={() => setCheckoutError(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", display: "flex", padding: 0 }}><X size={14} /></button>
        </div>
      )}

    <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", flex: 1, minHeight: 0, overflowY: isMobile ? "auto" : undefined }}>

      {phoneSearch && (
        <PhoneSearchPopup
          phones={sellablePhones}
          phoneCart={phoneCart}
          initialName={phoneSearch.name}
          initialImei={phoneSearch.imei}
          onAddMultiple={addPhones}
          onClose={() => setPhoneSearch(null)}
        />
      )}

      {showAccessorySearch && (
        <AccessorySearchPopup
          accessories={accessories}
          accessoryCart={accessoryCart}
          onAddMultiple={addAccessories}
          onClose={() => setShowAccessorySearch(false)}
        />
      )}

      {showCardModal && (
        <CardPaymentModal
          phoneCart={phoneCart}
          accessoryCart={accessoryCart}
          customer={customer}
          subtotal={subtotal}
          overallDiscount={overallAmt}
          total={total}
          onConfirm={(ref) => { setConfirmedCardRef(ref); void finalize(ref); }}
          onCancel={() => { if (!invoicing) setShowCardModal(false); }}
        />
      )}

      {showPrintPreview && invoiceNo && (
        <MobilePrintPreviewModal
          invoiceNo={invoiceNo}
          phoneCart={phoneCart}
          accessoryCart={accessoryCart}
          customer={customer}
          paymentMethod={recordedMethod === "Split" ? "Cash + Card" : isCash && usesCredit ? "Cash + Credit" : recordedMethod}
          cardRef={confirmedCardRef || (isCash && cardPaid > 0 ? balanceCardRef.trim() : "") || undefined}
          creditCustomer={usesCredit ? selectedCreditCustomer : null}
          cashReceived={isCash ? received : undefined}
          change={change}
          cardPaid={cardPaid}
          creditDue={creditDue}
          subtotal={subtotal}
          overallDiscount={overallAmt}
          total={total}
          issuedBy={cashierName}
          onDone={() => {
            setShowPrintPreview(false);
            setCompleted(true);
          }}
        />
      )}

      {/* ── Col 1: Devices ───────────────────────────────────────────────────── */}
      <div style={{ flex: isMobile ? "none" : 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 14, paddingRight: isMobile ? 0 : 20, paddingBottom: isMobile ? 16 : 0, borderRight: isMobile ? "none" : "1px solid var(--border)", borderBottom: isMobile ? "1px solid var(--border)" : "none", minHeight: 0 }}>

        {/* IMEI search */}
        <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={imeiQuery}
              onChange={e => { setImeiQuery(e.target.value); setImeiError(null); }}
              onKeyDown={e => e.key === "Enter" && handleImeiSearch()}
              placeholder="Scan IMEI or enter phone name..."
              style={{ ...inputStyle, flex: 1, borderColor: imeiError ? "#ef4444" : undefined }}
            />
            <button onClick={() => setPhoneSearch({ name: "", imei: "" })} style={searchBtn}><Search size={15} /></button>
          </div>
          {imeiError && (
            <div style={{ fontSize: 11, color: "#ef4444", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              {imeiError}
            </div>
          )}
        </div>

        {/* Device tiles list */}
        <div style={{ flex: 1, overflowY: "auto", minHeight: 0, display: "flex", flexDirection: "column", gap: 10 }}>
          {phoneCart.length === 0 ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <div style={{ fontSize: 32, opacity: 0.25 }}>📱</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif", textAlign: "center" }}>
                Scan or enter IMEI to add a device
              </div>
            </div>
          ) : (
            phoneCart.map(pc => {
              const isBelowMin = (parseFloat(pc.sellingPrice) || 0) > 0 && isPhoneBelowMin(pc);
              const effective  = effectivePrice(pc);
              return (
                <div key={pc.phone.id} style={{
                  padding: "12px 14px", borderRadius: 10,
                  border: `1px solid ${isBelowMin ? "rgba(239,68,68,0.4)" : "var(--border)"}`,
                  background: "var(--bg-card)", display: "flex", flexDirection: "column", gap: 10,
                }}>
                  {/* Row 1: name + remove */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                        {pc.phone.name}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif", marginTop: 2 }}>
                        {[pc.phone.color, pc.phone.storage, pc.phone.ram && `${pc.phone.ram} RAM`].filter(Boolean).join(" · ")} · <span style={{ fontFamily: "monospace" }}>{pc.phone.imei}</span>
                        {pc.phone.status === "reserved" && <span style={{ color: "#f59e0b", fontWeight: 600 }}> · Reserved</span>}
                      </div>
                    </div>
                    <button
                      onClick={() => removePhone(pc.phone.id)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", display: "flex", padding: 2, flexShrink: 0 }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>

                  {/* Row 2: min price info row */}
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {[
                      ["Brand",    pc.phone.brand],
                      ["Supplier", pc.phone.supplier],
                      ["Bought",   pc.phone.addedDate],
                    ].filter(([, v]) => v).map(([k, v]) => (
                      <span key={k} style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                        <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>{k}:</span> {v}
                      </span>
                    ))}
                  </div>

                  {/* Min price badge */}
                  <div style={{ padding: "5px 8px", borderRadius: 6, background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.18)", display: "inline-flex", alignSelf: "flex-start" }}>
                    <span style={{ fontSize: 11, color: "#f59e0b", fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600 }}>
                      Min. price: {fmt(pc.phone.minSellingPrice)}
                    </span>
                  </div>

                  {/* Row 3: selling price + discount */}
                  <div style={{ display: "flex", gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ ...labelStyle, marginBottom: 3 }}>Selling Price (Rs.)</label>
                      <input
                        type="number" value={pc.sellingPrice}
                        min={0}
                        onChange={e => updatePhonePrice(pc.phone.id, e.target.value)}
                        style={{ ...inputStyle, fontWeight: 700, borderColor: isBelowMin ? "#ef4444" : undefined }}
                      />
                      {isBelowMin && (
                        <div style={{ fontSize: 10, color: "#ef4444", fontFamily: "'Plus Jakarta Sans', sans-serif", marginTop: 3 }}>
                          Sells for {fmt(effective)} after discounts — below minimum
                        </div>
                      )}
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ ...labelStyle, marginBottom: 3 }}>Discount (Rs.)</label>
                      <input
                        type="number" value={pc.discount}
                        min={0}
                        onChange={e => updatePhoneDiscount(pc.phone.id, e.target.value)}
                        placeholder="0"
                        style={inputStyle}
                      />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Col 2: Accessories ───────────────────────────────────────────────── */}
      <div style={{ flex: isMobile ? "none" : 0.8, minWidth: 0, display: "flex", flexDirection: "column", gap: 14, padding: isMobile ? "16px 0" : "0 20px", borderRight: isMobile ? "none" : "1px solid var(--border)", borderBottom: isMobile ? "1px solid var(--border)" : "none", minHeight: 0 }}>

        <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={barcodeQuery}
              onChange={e => { setBarcodeQuery(e.target.value); setBarcodeError(null); }}
              onKeyDown={e => e.key === "Enter" && handleBarcodeAdd()}
              placeholder="Scan barcode or enter item code..."
              style={{ ...inputStyle, flex: 1, borderColor: barcodeError ? "#ef4444" : undefined }}
            />
            <button onClick={() => setShowAccessorySearch(true)} style={searchBtn}><Search size={15} /></button>
          </div>
          {barcodeError && (
            <div style={{ fontSize: 11, color: "#ef4444", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              {barcodeError}
            </div>
          )}
        </div>

        <div style={{ flex: 1, overflowY: "auto", minHeight: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          {accessoryCart.length === 0 ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <div style={{ fontSize: 28, opacity: 0.25 }}>📦</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif", textAlign: "center" }}>
                Scan accessories or extras<br />to add to this sale
              </div>
            </div>
          ) : (
            accessoryCart.map(item => (
              <div key={item.id} style={{ padding: "12px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-card)", display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{item.name}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif", marginTop: 2 }}>
                      {[item.model, item.brand].filter(Boolean).join(" · ")} · {stockOf(item.id)} in stock
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif", whiteSpace: "nowrap" }}>Rs. {item.price.toLocaleString()}</span>
                    <button onClick={() => removeAcc(item.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", display: "flex", padding: 2 }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ ...labelStyle, marginBottom: 3 }}>Discount (Rs.)</label>
                    <input type="number" min={0} value={item.discount} onChange={e => updateAccDiscount(item.id, e.target.value)} placeholder="0" style={{ ...inputStyle, fontSize: 12 }} />
                  </div>
                  <div>
                    <label style={{ ...labelStyle, marginBottom: 3 }}>Qty</label>
                    <div style={{ display: "flex", alignItems: "center", border: "1px solid var(--border)", borderRadius: 7, overflow: "hidden" }}>
                      <button onClick={() => updateAccQty(item.id, -1)} style={{ width: 28, height: 32, border: "none", background: "transparent", cursor: "pointer", color: "var(--text-secondary)", display: "flex", alignItems: "center", justifyContent: "center" }}><Minus size={11} /></button>
                      <span style={{ width: 28, textAlign: "center", fontSize: 13, fontWeight: 700, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{item.qty}</span>
                      <button onClick={() => updateAccQty(item.id, 1)} disabled={item.qty >= stockOf(item.id)} style={{ width: 28, height: 32, border: "none", background: "transparent", cursor: item.qty >= stockOf(item.id) ? "not-allowed" : "pointer", opacity: item.qty >= stockOf(item.id) ? 0.35 : 1, color: "var(--text-secondary)", display: "flex", alignItems: "center", justifyContent: "center" }}><Plus size={11} /></button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Col 3: Customer + Bill ────────────────────────────────────────────── */}
      <div style={{ width: isMobile ? "100%" : undefined, flex: isMobile ? "none" : 1.35, minWidth: isMobile ? 0 : 420, display: "flex", flexDirection: "column", paddingLeft: isMobile ? 0 : 20, paddingTop: isMobile ? 16 : 0, minHeight: 0, overflowY: "auto" }}>

        <div style={{ ...sectionHead, marginBottom: 12 }}>Customer Info</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
          {([
            { key: "name",     label: "Name *",              placeholder: "Customer name"      },
            { key: "phone",    label: "Phone Number *",      placeholder: "07X XXX XXXX"       },
            { key: "whatsapp", label: "WhatsApp (Optional)", placeholder: "07X XXX XXXX"       },
            { key: "email",    label: "Email (Optional)",    placeholder: "customer@email.com" },
            { key: "nic",      label: "NIC (Optional)",      placeholder: "199912345678"       },
          ] as { key: keyof typeof customer; label: string; placeholder: string }[]).map(({ key, label, placeholder }) => (
            <div key={key} style={{ gridColumn: key === "nic" ? "1 / -1" : undefined, minWidth: 0 }}>
              <label style={labelStyle}>{label}</label>
              <input value={customer[key]} onChange={e => setCustomer(c => ({ ...c, [key]: e.target.value }))} placeholder={placeholder} style={inputStyle} />
            </div>
          ))}
        </div>

        <div style={{ borderTop: "1px solid var(--border)", marginBottom: 16 }} />

        <div style={{ ...sectionHead, marginBottom: 10 }}>Bill Summary</div>

        {/* Per-phone breakdown */}
        {phoneCart.map(pc => (
          <div key={pc.phone.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12, fontFamily: "'Plus Jakarta Sans', sans-serif", marginBottom: 8 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ color: "var(--text-primary)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pc.phone.name}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>
                <span style={{ fontFamily: "monospace" }}>{pc.phone.imei}</span>
                {[pc.phone.storage, pc.phone.color].filter(Boolean).map(v => ` · ${v}`).join("")}
              </div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ color: "var(--text-primary)", fontWeight: 600 }}>{fmt(phoneNet(pc))}</div>
              {(parseFloat(pc.discount) || 0) > 0 && (
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>
                  {fmt(parseFloat(pc.sellingPrice) || 0)} − {fmt(parseFloat(pc.discount) || 0)}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Per-accessory breakdown */}
        {accessoryCart.map(item => (
          <div key={item.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12, fontFamily: "'Plus Jakarta Sans', sans-serif", marginBottom: 8 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ color: "var(--text-primary)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>
                <span style={{ fontFamily: "monospace" }}>{item.code}</span> · {item.qty} × {fmt(item.price)}
              </div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ color: "var(--text-primary)", fontWeight: 600 }}>{fmt(accNet(item))}</div>
              {(parseFloat(item.discount) || 0) > 0 && (
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>− {fmt(parseFloat(item.discount) || 0)}</div>
              )}
            </div>
          </div>
        ))}

        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10, marginBottom: 10, display: "flex", flexDirection: "column", gap: 9 }}>
          <InvoiceNoBadge />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
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

        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
          {(["Cash", "Card", "Credit"] as const).map(m => (
            <button
              key={m}
              onClick={() => choosePayment(m)}
              style={{
                flex: 1, padding: "8px 0", borderRadius: 7, fontSize: 12, fontWeight: 600,
                border: `1px solid ${paymentMethod === m ? "var(--border-active)" : "var(--border)"}`,
                background: paymentMethod === m ? "var(--accent-dim)" : "transparent",
                color: paymentMethod === m ? "var(--accent)" : "var(--text-secondary)",
                cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif", transition: "all 0.15s",
              }}
            >{m}</button>
          ))}
        </div>

        {paymentMethod === "Credit" && (
          <div style={{ marginBottom: 8 }}>
            <CreditCustomerPicker
              selected={selectedCreditCustomer}
              onSelect={setSelectedCreditCustomer}
            />
          </div>
        )}

        {/* ── Cash: what was handed over, and how any shortfall is settled ── */}
        {isCash && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 10, padding: 12, borderRadius: 9, border: "1px solid var(--border)", background: "var(--bg-card)" }}>
            <div>
              <label style={labelStyle}>Cash Received (Rs.) *</label>
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  type="number" min={0} autoFocus
                  value={cashReceived}
                  onChange={e => { setCashReceived(e.target.value); setBalanceMethod(""); setBalanceCardRef(""); setSelectedCreditCustomer(null); }}
                  placeholder={total.toString()}
                  style={{ ...inputStyle, flex: 1, fontWeight: 700 }}
                />
                <button
                  onClick={() => { setCashReceived(total.toString()); setBalanceMethod(""); setBalanceCardRef(""); setSelectedCreditCustomer(null); }}
                  style={{ padding: "0 12px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif", whiteSpace: "nowrap" }}
                >
                  Exact
                </button>
              </div>
            </div>

            {cashEntered && change > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700, fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#16a34a" }}>
                <span>Change to give</span><span>{fmt(change)}</span>
              </div>
            )}

            {cashBalance > 0 && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700, fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#dc2626" }}>
                  <span>Balance remaining</span><span>{fmt(cashBalance)}</span>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: "'Plus Jakarta Sans', sans-serif", marginBottom: 6 }}>
                    How is the balance being settled?
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {([["Card", "Paid by Card"], ["Credit", "Put on Credit"]] as const).map(([m, label]) => (
                      <button
                        key={m}
                        onClick={() => { setBalanceMethod(balanceMethod === m ? "" : m); setBalanceCardRef(""); setSelectedCreditCustomer(null); }}
                        style={{
                          flex: 1, padding: "7px 0", borderRadius: 7, fontSize: 12, fontWeight: 600,
                          border: `1px solid ${balanceMethod === m ? "var(--border-active)" : "var(--border)"}`,
                          background: balanceMethod === m ? "var(--accent-dim)" : "transparent",
                          color: balanceMethod === m ? "var(--accent)" : "var(--text-secondary)",
                          cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif",
                        }}
                      >{label}</button>
                    ))}
                  </div>
                </div>

                {balanceMethod === "Card" && (
                  <div>
                    <label style={labelStyle}>Card Reference No. for {fmt(cashBalance)} *</label>
                    <input
                      value={balanceCardRef}
                      onChange={e => setBalanceCardRef(e.target.value)}
                      placeholder="Reference number from terminal..."
                      style={{ ...inputStyle, fontFamily: "monospace" }}
                    />
                  </div>
                )}

                {balanceMethod === "Credit" && (
                  <div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif", marginBottom: 6 }}>
                      Select the customer&apos;s credit account, or open a new one — {fmt(cashBalance)} will be charged to it.
                    </div>
                    <CreditCustomerPicker
                      selected={selectedCreditCustomer}
                      onSelect={setSelectedCreditCustomer}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <button
          onClick={() => {
            if (!canComplete || invoicing) return;
            // Card waits for the terminal's reference before anything is sold.
            if (paymentMethod === "Card") { setShowCardModal(true); return; }
            void finalize();
          }}
          disabled={!canComplete || invoicing}
          style={{
            width: "100%", padding: "11px", borderRadius: 9, border: "none",
            background: canComplete && !invoicing ? "var(--accent)" : "var(--border)",
            color: canComplete && !invoicing ? "var(--accent-fg)" : "var(--text-muted)",
            fontWeight: 700, fontSize: 13, cursor: canComplete && !invoicing ? "pointer" : "not-allowed",
            fontFamily: "'Plus Jakarta Sans', sans-serif", transition: "all 0.15s",
          }}
        >
          {invoicing
            ? "Completing sale…"
            : !configured
            ? "Database not connected"
            : phoneCart.length === 0
            ? "Scan a device first"
            : missingPrice
            ? "Enter a selling price"
            : belowMin
            ? "Price below minimum"
            : !customerReady
            ? "Enter customer name & phone"
            : !paymentMethod
            ? "Select payment method"
            : paymentMethod === "Credit" && !selectedCreditCustomer
            ? "Select credit customer"
            : isCash && !cashEntered
            ? "Enter cash received"
            : isCash && cashBalance > 0 && !balanceMethod
            ? "Choose how the balance is paid"
            : isCash && balanceMethod === "Card" && !balanceCardRef.trim()
            ? "Enter card reference"
            : isCash && balanceMethod === "Credit" && !selectedCreditCustomer
            ? "Select credit account"
            : `Complete Invoice · ${fmt(total)}`}
        </button>
      </div>
    </div>
    </div>
  );
}
