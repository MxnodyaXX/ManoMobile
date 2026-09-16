"use client";

import { useEffect, useMemo, useState, type ReactNode, type Ref } from "react";
import type { SaleTx } from "@/cashier/contexts/SalesContext";
import { useRepair, findDealer, isInHouseDealer, IN_HOUSE_DEALER, type RepairJob } from "@/cashier/contexts/RepairContext";
import { fetchSaleByInvoiceNo, type SaleExtras } from "@/lib/sales/api";
import type { SaleItem } from "@/lib/sales/saleItems";
import { warrantyLine } from "@/lib/repair/warrantyLine";
import { SHOP_DETAILS } from "@/lib/shop";
import RepairInvoicePrintable, { repairInvoicePageCss, type InvoiceRepairLine } from "./RepairInvoicePrintable";
import type { ExtraLine } from "./AddProductsModal";

/**
 * An invoice for a sale whose printed document was never kept.
 *
 * Invoice history stores the page as it came off the printer, and reprints
 * that. Two kinds of sale never produced a page: one marked as issued without
 * a print, and anything sold before documents were stored at all. For those
 * the invoice is rebuilt from what the sale row and its jobs say now — the
 * same layout the checkout prints, fed the same figures from the other end.
 *
 * It is a reconstruction and the screen says so: a job repriced since, or a
 * dealer renamed, shows here as it is today, not as it was on the day.
 */

export interface RebuiltInvoice {
  /** True while the sale's extras (jobs, dealer, phone) are being read. */
  loading: boolean;
  pageCss: string;
  /** Draws the invoice. The ref lands on the element to copy for printing. */
  render: (ref: Ref<HTMLDivElement>) => ReactNode;
}

const fmtCreatedAt = (isoDate: string) => {
  const d = new Date(isoDate);
  return isNaN(d.getTime())
    ? isoDate
    : d.toLocaleDateString("en-US", { year: "numeric", month: "2-digit", day: "2-digit" });
};

export function useRebuiltInvoice(tx: SaleTx, lines: SaleItem[]): RebuiltInvoice {
  const { jobs, dealers } = useRepair();

  // What the sale row carries that the ledger's SaleTx does not: which jobs,
  // which dealer, and the customer's number.
  const [extras, setExtras] = useState<{ forNo: string; value: SaleExtras | null } | null>(null);
  useEffect(() => {
    let live = true;
    fetchSaleByInvoiceNo(tx.invoiceNo)
      .then(s => { if (live) setExtras({ forNo: tx.invoiceNo, value: s }); })
      .catch(() => { if (live) setExtras({ forNo: tx.invoiceNo, value: null }); });
    return () => { live = false; };
  }, [tx.invoiceNo]);
  const ready = extras?.forNo === tx.invoiceNo;
  const sale = ready ? extras.value : null;

  const saleJobs = useMemo(
    () => (sale?.jobIds ?? []).map(id => jobs.find(j => j.id === id)).filter((j): j is RepairJob => !!j),
    [sale, jobs],
  );

  // A repair invoice needs its jobs; a sale that names jobs the list no longer
  // has, or names none, prints as a plain sales invoice from its lines.
  const asRepair = tx.category === "Repair" && saleJobs.length > 0;

  if (asRepair) {
    const dealerName =
      findDealer(dealers, { dealerId: sale?.dealerId ?? undefined, dealer: saleJobs[0].dealer })?.name
      ?? saleJobs[0].dealer
      ?? IN_HOUSE_DEALER;
    const inHouse = isInHouseDealer(dealers, dealerName);

    const repairs: InvoiceRepairLine[] = saleJobs.map(j => {
      const svc = lines.find(l => l.kind === "repair_service" && l.referenceId === j.id);
      const back = j.completionType === "Cash Return" ? (j.cashReturnAmount ?? 0) : 0;
      // The intake advance is what the job had received before the handover
      // took the rest; advance_paid holds both, the handover says which part.
      const settled = j.handover?.balanceSettled ?? 0;
      return {
        id: j.id,
        dealer: dealerName,
        customerName: j.customerName,
        dealerJobNo: j.dealerJobNo,
        brand: j.brand,
        model: j.model,
        imei: j.imei ?? "",
        warranty: j.jobWarranty || warrantyLine("NO WARRANTY", j.completionType),
        advance: Math.max(0, (j.advancePaid ?? 0) - settled),
        unitPrice: svc && svc.unitPrice > 0 ? svc.unitPrice : j.estimatedCost,
        discount: svc?.discount ?? 0,
        cashReturnAmount: back,
      };
    });
    const products: ExtraLine[] = lines
      .filter(l => l.kind !== "repair_service" && l.kind !== "repair_part")
      .map(l => ({
        productId: Number(l.referenceId) || 0, code: "", name: l.description,
        qty: l.qty, unitPrice: l.unitPrice, discount: l.discount, stock: 0,
      }));

    const totalAdvance = repairs.reduce((s, r) => s + r.advance, 0);
    const lineDiscounts = repairs.reduce((s, r) => s + r.discount, 0) + products.reduce((s, l) => s + l.discount, 0);
    const invoiceDiscount = Math.max(0, (tx.discountAmount ?? 0) - lineDiscounts);
    // paid on the row is everything received against the bill, advance included.
    const paidTotal = tx.paid ?? (tx.paymentMethod === "Credit" ? totalAdvance : tx.total);
    const amountReceivedNow = Math.max(0, paidTotal - totalAdvance);
    const dueAmount = Math.max(0, tx.total - paidTotal);
    const customerIsDealer = tx.customer.trim().toLowerCase() === dealerName.trim().toLowerCase();

    return {
      loading: !ready,
      pageCss: repairInvoicePageCss(inHouse),
      render: ref => (
        <RepairInvoicePrintable
          ref={ref}
          invoiceNo={tx.invoiceNo}
          createdAt={fmtCreatedAt(tx.date)}
          dealer={dealerName}
          customer={{
            name: customerIsDealer ? "" : tx.customer,
            phone: sale?.customerPhone ?? saleJobs[0].phone ?? "",
            nic: "",
          }}
          isCredit={dueAmount > 0}
          amountReceivedNow={amountReceivedNow}
          dueAmount={dueAmount}
          totalAdvance={totalAdvance}
          invoiceDiscount={invoiceDiscount}
          repairs={repairs}
          extras={products}
        />
      ),
    };
  }

  return {
    loading: !ready,
    pageCss: "@page { size: A4 portrait; margin: 12mm; }",
    render: ref => <PlainSaleInvoice ref={ref} tx={tx} lines={lines} phone={sale?.customerPhone ?? null} />,
  };
}

/* ── A sales invoice with no repair on it ─────────────────────────────────── */

const th: React.CSSProperties = {
  padding: "5px 7px", border: "1px solid #999",
  fontWeight: 700, fontStyle: "italic", textAlign: "left",
  whiteSpace: "nowrap", fontSize: 10.5, background: "#f0f0f0",
};
const td: React.CSSProperties = {
  padding: "4px 7px", border: "1px solid #ccc", fontSize: 10.5, fontStyle: "italic",
};
const right: React.CSSProperties = { textAlign: "right" };

/**
 * Accessories, handsets and everything else: the same sales-invoice frame
 * the dealer layout uses, with the lines the sale recorded. A sale from
 * before lines were stored has only its `items` summary, which prints as the
 * one line it is.
 */
function PlainSaleInvoice({ tx, lines, phone, ref }: {
  tx: SaleTx;
  lines: SaleItem[];
  phone: string | null;
  ref?: Ref<HTMLDivElement>;
}) {
  const rows = lines.length > 0
    ? lines.map(l => ({ key: String(l.id), name: l.description, qty: l.qty, unit: l.unitPrice, discount: l.discount, total: l.lineTotal }))
    : [{ key: "summary", name: tx.items || tx.category, qty: 1, unit: tx.total + (tx.discountAmount ?? 0), discount: tx.discountAmount ?? 0, total: tx.total }];
  const subtotal = tx.subtotal ?? rows.reduce((s, r) => s + r.unit * r.qty, 0);
  const discount = tx.discountAmount ?? 0;
  const paid = tx.paid ?? (tx.paymentMethod === "Credit" ? 0 : tx.total);
  const due = Math.max(0, tx.total - paid);
  const credit = due > 0;

  return (
    <div ref={ref} style={{ background: "#ffffff", padding: "36px 44px", fontFamily: "Arial, Helvetica, sans-serif", color: "#000000" }}>
      <h1 style={{ textAlign: "center", fontWeight: 900, textDecoration: "underline", fontSize: 24, margin: 0, letterSpacing: "0.06em" }}>
        SALES INVOICE
      </h1>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginTop: 22, gap: 24 }}>
        <div>
          <p style={{ fontSize: 14, fontWeight: 800 }}>{SHOP_DETAILS.name}</p>
          <p style={{ fontSize: 11, color: "#555", marginTop: 1 }}>{SHOP_DETAILS.address}</p>
          <p style={{ fontSize: 11, color: "#555", marginTop: 1 }}>Tel: {SHOP_DETAILS.phone}</p>
        </div>
        <table style={{ borderCollapse: "collapse" }}>
          <tbody>
            <tr>
              <td style={{ padding: "3px 10px", fontWeight: 700, fontSize: 11, textAlign: "right", whiteSpace: "nowrap" }}>INVOICE NUMBER:</td>
              <td style={{ padding: "4px 14px", background: "#e0e0e0", border: "1px solid #aaa", minWidth: 180, fontWeight: 700, fontSize: 14 }}>{tx.invoiceNo}</td>
            </tr>
            <tr>
              <td style={{ padding: "3px 10px", fontWeight: 700, fontSize: 11, textAlign: "right", whiteSpace: "nowrap" }}>DATE and CREATED BY:</td>
              <td style={{ padding: "4px 14px", background: "#e0e0e0", border: "1px solid #aaa", fontWeight: 700, fontSize: 11 }}>{fmtCreatedAt(tx.date)} | {(tx.cashier || "MANOMOBILE").toUpperCase()}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 18 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: "#555" }}>CUSTOMER</p>
        <p style={{ fontSize: 13, fontWeight: 700 }}>{(tx.customer || "Walk-in").toUpperCase()}</p>
        {phone && <p style={{ fontSize: 11, color: "#555", marginTop: 1 }}>Tel: {phone}</p>}
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 16, border: "1px solid #999" }}>
        <thead>
          <tr>
            <th style={th}>No.</th>
            <th style={th}>Item</th>
            <th style={{ ...th, ...right }}>Qty</th>
            <th style={{ ...th, ...right }}>Unit price</th>
            <th style={{ ...th, ...right }}>Discount</th>
            <th style={{ ...th, ...right }}>Line total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.key}>
              <td style={td}>{i + 1}.</td>
              <td style={td}>{r.name}</td>
              <td style={{ ...td, ...right }}>{r.qty}</td>
              <td style={{ ...td, ...right }}>{r.unit.toLocaleString()}</td>
              <td style={{ ...td, ...right }}>{r.discount > 0 ? r.discount.toLocaleString() : "—"}</td>
              <td style={{ ...td, ...right, fontWeight: 700, fontStyle: "normal" }}>{r.total.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
        <div style={{ width: 280, display: "flex", flexDirection: "column", gap: 3 }}>
          {discount > 0 && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                <span style={{ color: "#555" }}>Sub Total</span>
                <span style={{ fontWeight: 600 }}>Rs. {subtotal.toLocaleString()}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                <span style={{ color: "#555" }}>Discount</span>
                <span style={{ fontWeight: 600 }}>− Rs. {discount.toLocaleString()}</span>
              </div>
            </>
          )}
          <div style={{ borderTop: "2px solid #000", paddingTop: 5, display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700 }}>
            <span>TOTAL</span><span>Rs. {tx.total.toLocaleString()}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, borderTop: "1px solid #e0e0e0", paddingTop: 3, marginTop: 1 }}>
            <span style={{ color: "#555" }}>Total Paid</span>
            <span style={{ fontWeight: 700 }}>Rs. {paid.toLocaleString()}</span>
          </div>
          {credit ? (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, background: "#fff8e1", border: "1px solid #f59e0b", borderRadius: 4, padding: "3px 6px", marginTop: 2 }}>
              <span style={{ fontWeight: 700, color: "#b45309" }}>CREDIT DUE</span>
              <span style={{ fontWeight: 700, color: "#b45309" }}>Rs. {due.toLocaleString()}</span>
            </div>
          ) : (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, background: "#f0fdf4", border: "1px solid #4ade80", borderRadius: 4, padding: "3px 6px", marginTop: 2 }}>
              <span style={{ fontWeight: 700, color: "#166534" }}>SETTLED</span>
              <span style={{ fontWeight: 700, color: "#166534" }}>✓</span>
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 14, fontSize: 11 }}>
        <span style={{ fontWeight: 700 }}>Payment Type: </span>
        <span style={{ fontWeight: 700, color: credit ? "#b45309" : "#166534", background: credit ? "#fff8e1" : "#f0fdf4", border: `1px solid ${credit ? "#f59e0b" : "#4ade80"}`, borderRadius: 4, padding: "2px 8px" }}>
          {credit ? "CREDIT" : (tx.paymentMethod ?? "CASH").toUpperCase()}
        </span>
      </div>

      <p style={{ marginTop: 28, fontSize: 9.5, color: "#888", textAlign: "center" }}>
        This is a computer-generated invoice. No signature required.
      </p>
    </div>
  );
}
