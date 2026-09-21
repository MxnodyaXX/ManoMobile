"use client";

import type { Ref } from "react";
import JobIssuePrintable, { type IssueInvoiceData } from "@/cashier/components/repair/JobIssuePrintable";
import { useRepair, findDealer, isInHouseDealer } from "@/cashier/contexts/RepairContext";
import type { RepairJob } from "@/cashier/contexts/RepairContext";
import { extraLineTotal, type ExtraLine } from "@/cashier/components/sales/AddProductsModal";

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

/** One repair on the invoice. CompletedRepair in Repair Sales satisfies this. */
export interface InvoiceRepairLine {
  id: string;
  dealer: string;
  customerName: string;
  /** The originating dealer's own docket number, printed first where present. */
  dealerJobNo?: string;
  brand: string;
  model: string;
  imei: string;
  warranty: string;
  advance: number;
  unitPrice: number;
  discount: number;
  /** A Cash Return prints as a negative line for this amount. */
  cashReturnAmount?: number;
}

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

/** Paper size is part of the document: an in-house repair slip is A5, a dealer
 *  invoice A4. Stored alongside the markup so a reprint months later comes out
 *  the same shape rather than on whatever the reprinting screen defaults to. */
export const repairInvoicePageCss = (inHouse: boolean) =>
  `@page { size: ${inHouse ? "A5 landscape" : "A4 landscape"}; margin: ${inHouse ? "0" : "12mm"}; }`;

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
  const paymentType = isCredit ? "CREDIT" : "CASH / FULL";
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
    <div ref={ref} style={{ background: "#ffffff", padding: "36px 44px", fontFamily: "Arial, Helvetica, sans-serif", color: "#000000" }}>

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
            // A Cash Return prints as its own line at a negative total —
            // the dealer has to be able to see which job took the money off
            // their bill, not just that the bill came down.
            const back      = r.cashReturnAmount ?? 0;
            const lineTotal = back > 0 ? -back : r.unitPrice - r.discount;
            return (
              <tr key={r.id}>
                <td style={invTd}>{i + 1}.</td>
                <td style={invTd}>{back > 0 ? "Cash Return" : "Repair"}</td>
                {/* The dealer's own number first where there is one: the
                    person checking this invoice is checking it against
                    their book, and theirs is the number in it. */}
                <td style={invTd}>
                  {r.dealerJobNo ? `#${r.dealerJobNo} | ` : ""}{r.id} | {r.brand} | {r.model}
                </td>
                <td style={invTd}>{r.imei || "—"}</td>
                <td style={invTd}>{back > 0 ? "—" : r.warranty}</td>
                <td style={{ ...invTd, textAlign: "right" as const }}>1</td>
                <td style={{ ...invTd, textAlign: "right" as const }}>{r.advance.toLocaleString()}</td>
                <td style={{ ...invTd, textAlign: "right" as const }}>{back > 0 ? `(${back.toLocaleString()})` : r.unitPrice.toLocaleString()}</td>
                <td style={{ ...invTd, textAlign: "right" as const }}>{back === 0 && r.discount > 0 ? r.discount.toLocaleString() : "—"}</td>
                <td style={{ ...invTd, textAlign: "right" as const, fontWeight: 700, fontStyle: "normal" }}>
                  {lineTotal < 0 ? `(${Math.abs(lineTotal).toLocaleString()})` : lineTotal.toLocaleString()}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Repair lines above, products below, each summed to its own
          figure before the two meet in the total. The block carries its
          own side padding, so it is pulled back to the table edge here. */}
      {productsBlock && <div style={{ margin: "0 -44px" }}>{productsBlock}</div>}

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
        <div style={{ width: 280, display: "flex", flexDirection: "column", gap: 3 }}>
          {extras.length > 0 && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                <span style={{ color: "#555" }}>Repair charges</span>
                <span style={{ fontWeight: 600 }}>Rs. {repairTotals.toLocaleString()}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                <span style={{ color: "#555" }}>Additional products</span>
                <span style={{ fontWeight: 600 }}>Rs. {extrasTotal.toLocaleString()}</span>
              </div>
            </>
          )}
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
  );
}
