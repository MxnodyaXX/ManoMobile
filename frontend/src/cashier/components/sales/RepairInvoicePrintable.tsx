"use client";

import type { Ref } from "react";
import JobIssuePrintable, { type IssueInvoiceData } from "@/cashier/components/repair/JobIssuePrintable";
import DealerInvoicePrintable, { DEALER_INVOICE_PAGE_CSS, type DealerInvoiceExtraLine } from "@/cashier/components/sales/DealerInvoicePrintable";
import { useRepair, findDealer, isInHouseDealer } from "@/cashier/contexts/RepairContext";
import type { RepairJob } from "@/cashier/contexts/RepairContext";
import { extraLineTotal, type ExtraLine } from "@/cashier/components/sales/AddProductsModal";

export type { InvoiceRepairLine } from "@/cashier/components/sales/DealerInvoicePrintable";
import type { InvoiceRepairLine } from "@/cashier/components/sales/DealerInvoicePrintable";

/**
 * The repair invoice, as paper.
 *
 * Two layouts under one component: Mano Mobile's own customers get the Job
 * Issue Invoice template, one page per device; an outside dealer gets a
 * sales invoice with every device as a line. Which one is decided by the
 * dealer, the same way everywhere else in the app.
 *
 * Lifted out of Repair Sales so it can be drawn from two places: the checkout
 * at the moment of sale, and Sales History for a past sale whose printed
 * document was never stored — an invoice marked as issued without a print,
 * or one from before documents were kept. Both feed it the same figures; the
 * second reconstructs them from the sale row and its jobs.
 */

export interface RepairInvoiceProps {
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
  creditRecordMade?: boolean;
  repairs: InvoiceRepairLine[];
  /** Products sold on the same invoice, printed in their own section. */
  extras?: ExtraLine[];
  /** The element every print and store handler copies the outerHTML of. */
  ref?: Ref<HTMLDivElement>;
}

/** Paper size is part of the document: an in-house repair slip is A5
 *  landscape, a dealer invoice A5 portrait (see DealerInvoicePrintable).
 *  Stored alongside the markup so a reprint months later comes out the same
 *  shape rather than on whatever the reprinting screen defaults to. */
export const repairInvoicePageCss = (inHouse: boolean) =>
  inHouse ? "@page { size: A5 landscape; margin: 0; }" : DEALER_INVOICE_PAGE_CSS;

const invTh: React.CSSProperties = {
  padding: "5px 7px", border: "1px solid #999",
  fontWeight: 700, fontStyle: "italic", textAlign: "left",
  whiteSpace: "nowrap", fontSize: 10.5, background: "#f0f0f0",
};
const invTd: React.CSSProperties = {
  padding: "4px 7px", border: "1px solid #ccc", fontSize: 10.5, fontStyle: "italic",
};

export default function RepairInvoicePrintable({
  invoiceNo, createdAt, dealer, customer, isCredit, amountReceivedNow, dueAmount, totalAdvance,
  invoiceDiscount = 0, creditRecordMade = false, repairs, extras = [], ref,
}: RepairInvoiceProps) {
  const { dealers } = useRepair();
  // Cash Returns subtract, so the printed TOTAL is what the dealer actually
  // owes rather than the gross of repairs done in both directions.
  const repairTotals = repairs.reduce(
    (s, r) => s + ((r.cashReturnAmount ?? 0) > 0 ? -(r.cashReturnAmount ?? 0) : r.unitPrice - r.discount),
    0,
  );
  const extrasTotal = extras.reduce((s, l) => s + extraLineTotal(l), 0);
  const lineTotals  = repairTotals + extrasTotal;
  const grandTotal  = Math.max(0, lineTotals - invoiceDiscount);
  const paidAmount  = totalAdvance + amountReceivedNow;
  // Mano Mobile's own customers get the job-receipt template; external dealers get a sales invoice.
  const isManoMobile = isInHouseDealer(dealers, dealer);
  const dealerRecord = findDealer(dealers, dealer);
  const today = new Date().toISOString().slice(0, 10);
  /**
   * The products, as a printed section.
   *
   * Shared by both layouts. Rendered after the repair lines with its own
   * heading, so the two kinds of charge are read apart: the customer can see
   * what the repair cost and what the glass cost without doing arithmetic on
   * a total.
   */
  const productsBlock = extras.length === 0 ? null : (
    <div style={{ padding: "0 44px 20px", fontFamily: "Arial, Helvetica, sans-serif", color: "#000" }}>
      <p style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.06em", margin: "14px 0 6px", borderBottom: "2px solid #000", paddingBottom: 4 }}>
        ADDITIONAL PRODUCTS
      </p>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
        <thead>
          <tr>
            {["Item", "Qty", "Unit Price", "Discount", "Line Total"].map((h, i) => (
              <th key={h} style={{ textAlign: i === 0 ? "left" : "right", padding: "5px 6px", borderBottom: "1px solid #999", fontSize: 10.5, fontWeight: 700 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {extras.map(l => (
            <tr key={l.productId}>
              <td style={{ padding: "5px 6px", borderBottom: "1px solid #e0e0e0" }}>{l.name}{l.code && <span style={{ color: "#777" }}> · {l.code}</span>}</td>
              <td style={{ padding: "5px 6px", borderBottom: "1px solid #e0e0e0", textAlign: "right" }}>{l.qty}</td>
              <td style={{ padding: "5px 6px", borderBottom: "1px solid #e0e0e0", textAlign: "right" }}>{l.unitPrice.toLocaleString()}</td>
              <td style={{ padding: "5px 6px", borderBottom: "1px solid #e0e0e0", textAlign: "right" }}>{l.discount > 0 ? l.discount.toLocaleString() : "—"}</td>
              <td style={{ padding: "5px 6px", borderBottom: "1px solid #e0e0e0", textAlign: "right", fontWeight: 700 }}>{extraLineTotal(l).toLocaleString()}</td>
            </tr>
          ))}
          <tr>
            <td colSpan={4} style={{ padding: "6px 6px 0", textAlign: "right", fontWeight: 700 }}>Products</td>
            <td style={{ padding: "6px 6px 0", textAlign: "right", fontWeight: 700 }}>Rs. {extrasTotal.toLocaleString()}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );

  const mapToJob = (r: InvoiceRepairLine): RepairJob => ({
    id: r.id,
    customerName: customer.name || r.customerName,
    phone: customer.phone || "—",
    brand: r.brand,
    model: r.model,
    issue: "Repair",
    technician: "—",
    status: "Completed",
    priority: "Normal",
    // The gross price, not the net of discount — JobIssuePrintable computes
    // its own "Line total" as estimatedCost − discount, so a net figure here
    // made the discount come off twice (once here, once there).
    estimatedCost: r.unitPrice,
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
  const mapToIssueData = (r: InvoiceRepairLine): IssueInvoiceData => {
    // amountReceivedNow is what the whole invoice took in today, on top of
    // any advance — a single figure with no clean per-device split once
    // there's more than one thing on the bill (see the comment above). When
    // this job is the only thing on the invoice, though, there is nothing
    // else it could belong to, so crediting it here is exact, not a guess —
    // and without it, a job paid in full at pickup with no advance printed
    // as "Paid Rs. 0 / CREDIT DUE" for the whole price.
    const receivedHere = repairs.length === 1 && extras.length === 0 ? amountReceivedNow : 0;
    const paidAmount = r.advance + receivedHere;
    const due = Math.max(0, r.unitPrice - r.discount - paidAmount);
    return {
      job: mapToJob(r),
      name: customer.name || r.customerName,
      phone: customer.phone,
      nic: customer.nic,
      email: "",
      imei: r.imei,
      discount: r.discount,
      paidAmount,
      dueAmount: due,
      isCredit: due > 0,
      adminApprover: "",
      warranty: r.warranty,
      invoiceNo,
      createdAt,
    };
  };

  return isManoMobile ? (
      /* Mano Mobile → the Job Issue Invoice template, one page per device */
      <div ref={ref} style={{ background: "#ffffff" }}>
        {repairs.map((r, i) => (
          <div key={r.id} style={{ pageBreakAfter: i < repairs.length - 1 ? "always" : "auto", borderBottom: i < repairs.length - 1 ? "2px dashed #bbb" : "none" }}>
            <JobIssuePrintable data={mapToIssueData(r)} />
          </div>
        ))}
        {/* The job receipt template is one device per page and knows
            nothing about a cover. So the products and the combined total
            follow it, on the same sheet, under the same number — one
            invoice, two sections, the way the customer paid. */}
        {productsBlock && (
          <div style={{ borderTop: "2px dashed #bbb" }}>
            {productsBlock}
            <div style={{ padding: "0 44px 24px", fontFamily: "Arial, Helvetica, sans-serif", color: "#000", display: "flex", justifyContent: "flex-end" }}>
              <div style={{ width: 300, display: "flex", flexDirection: "column", gap: 3, fontSize: 11 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "#555" }}>Repair charges</span><span style={{ fontWeight: 600 }}>Rs. {repairTotals.toLocaleString()}</span></div>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "#555" }}>Additional products</span><span style={{ fontWeight: 600 }}>Rs. {extrasTotal.toLocaleString()}</span></div>
                {invoiceDiscount > 0 && <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "#555" }}>Invoice discount</span><span style={{ fontWeight: 600 }}>− Rs. {invoiceDiscount.toLocaleString()}</span></div>}
                <div style={{ borderTop: "2px solid #000", paddingTop: 5, display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700 }}><span>INVOICE TOTAL</span><span>Rs. {grandTotal.toLocaleString()}</span></div>
                {totalAdvance > 0 && <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "#555" }}>Advance (previously paid)</span><span style={{ fontWeight: 600 }}>Rs. {totalAdvance.toLocaleString()}</span></div>}
                {amountReceivedNow > 0 && <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "#555" }}>Received now</span><span style={{ fontWeight: 600 }}>Rs. {amountReceivedNow.toLocaleString()}</span></div>}
                <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #e0e0e0", paddingTop: 3, fontWeight: 700 }}><span>{dueAmount > 0 ? "Balance due" : "Balance"}</span><span>Rs. {dueAmount.toLocaleString()}</span></div>
              </div>
            </div>
          </div>
        )}
      </div>
    ) : (
      <DealerInvoicePrintable
        ref={ref}
        invoiceNo={invoiceNo}
        createdAt={createdAt}
        dealerName={dealerRecord?.name ?? dealer}
        dealerAddress={dealerRecord?.address}
        dealerContact={dealerRecord?.contact}
        dealerId={dealerRecord?.id ?? null}
        repairs={repairs}
        extras={extras.map((l): DealerInvoiceExtraLine => ({ id: String(l.productId), name: l.name, lineTotal: extraLineTotal(l) }))}
        paidAmount={paidAmount}
        dueAmount={dueAmount}
      />
    );
}
