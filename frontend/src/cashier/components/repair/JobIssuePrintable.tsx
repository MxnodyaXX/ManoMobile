"use client";

import { forwardRef, useEffect, useState } from "react";
import ReceiptRender from "@/cashier/components/shared/ReceiptRender";
import { fetchDefaultReceiptTemplate, type ReceiptTemplate } from "@/lib/repair/receiptTemplates";
import { type ReceiptData } from "@/lib/repair/receiptElements";
import { type RepairJob } from "@/cashier/contexts/RepairContext";
import { useWarranty } from "@/cashier/contexts/WarrantyContext";
import { SHOP_DETAILS } from "@/lib/shop";

/** What the job-issue sales invoice needs to print — the pricing and
 *  customer details collected at the moment a job is handed back to the
 *  customer. Every place that hands a device back builds one of these. */
export interface IssueInvoiceData {
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

/** "3 Months", "1 Year" — matches the granularities Warranty.durationDays is
 *  actually issued in; anything odd just falls back to a day count. */
export function formatWarrantyDuration(days: number): string {
  if (days > 0 && days % 365 === 0) { const y = days / 365; return `${y} Year${y === 1 ? "" : "s"}`; }
  if (days > 0 && days % 30 === 0) { const m = days / 30; return `${m} Month${m === 1 ? "" : "s"}`; }
  return `${days} Days`;
}

const invTd: React.CSSProperties = { padding: "5px 7px", border: "1px solid #ccc", fontSize: 10.5, fontStyle: "italic" };

/**
 * What actually prints for a job-issue sales invoice. Picks up Admin ->
 * Barcode -> Job Issue Invoice's default canvas design if one has been built
 * (elements.length > 0); otherwise renders the built-in SALES INVOICE layout.
 * Same fallback rule JobReceiptPrintable uses for the intake receipt, so
 * drawing nothing in the designer changes nothing about what prints.
 *
 * Shared by everywhere a completed repair sale needs to hand the customer
 * this document: Repair Management's Issue Job flow and Sales Management's
 * Repair Sales completion — one canvas design serves both instead of each
 * inventing its own copy of this fallback layout.
 */
const JobIssuePrintable = forwardRef<HTMLDivElement, { data: IssueInvoiceData }>(
  function JobIssuePrintable({ data }, ref) {
    const { warranties } = useWarranty();
    const lineTotal = data.job.estimatedCost - data.discount;
    const paymentType = data.isCredit ? "CREDIT" : "CASH / FULL";

    const fmtDate = (s?: string) => {
      if (!s) return "—";
      const dt = new Date(s);
      return isNaN(dt.getTime()) ? "—" : dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    };

    // The canonical warranty record (WarrantyContext) carries the parts/labour
    // scope the free-text warranty string never did; fall back to that string
    // for jobs issued before the canonical model existed.
    const warrantyRecord = warranties.find(w => w.jobId === data.job.id);
    const warrantyPeriod = warrantyRecord
      ? `${formatWarrantyDuration(warrantyRecord.durationDays)} — ${warrantyRecord.scope}`
      : (data.warranty || "No Warranty");

    // Due amount before the discount is applied — a distinct figure from
    // `dueAmount` below, which is what's left after discount *and* payment.
    const balanceDue = Math.max(0, data.job.estimatedCost - data.job.advancePaid);
    const amountToBePaid = Math.max(0, balanceDue - data.discount);

    // undefined = still checking, null = no design to use (fall back), object = use it.
    const [template, setTemplate] = useState<ReceiptTemplate | null | undefined>(undefined);
    useEffect(() => {
      let active = true;
      fetchDefaultReceiptTemplate("issue")
        .then(t => { if (active) setTemplate(t && t.elements.length > 0 ? t : null); })
        .catch(() => { if (active) setTemplate(null); });
      return () => { active = false; };
    }, []);

    const origin = typeof window === "undefined" ? "" : window.location.origin;
    const canvasData: ReceiptData = {
      jobId: data.job.id,
      customer: data.name || "Walk-in",
      phone: data.phone,
      address: "",
      device: [data.job.brand, data.job.model].filter(Boolean).join(" "),
      modelNumber: data.job.modelNumber,
      imei: data.imei,
      estimate: data.job.estimatedCost.toLocaleString(),
      advance: data.job.advancePaid.toLocaleString(),
      remarks: "",
      // These are documented as "receipt only", but the underlying job data
      // is available here just the same — and a design started by copying
      // the Job Receipt (via Copy Design From) carries these tokens over
      // verbatim. Filling them in means that still prints correctly instead
      // of leaving the raw {{token}} text on the page.
      fault: data.job.issue ?? "",
      technician: data.job.technician ?? "",
      estCompletion: fmtDate(data.job.estimatedCompletion),
      priority: data.job.priority ?? "",
      itemsReceived: (data.job.receivedItems ?? []).join(", "),
      date: data.createdAt,
      createdBy: "MANOMOBILE",
      trackUrl: `${origin}/track?job=${encodeURIComponent(data.job.id)}`,
      shopName: SHOP_DETAILS.name,
      shopTagline: SHOP_DETAILS.tagline,
      shopPhone: SHOP_DETAILS.phone,
      shopEmail: SHOP_DETAILS.email,
      shopWebsite: SHOP_DETAILS.website,
      shopAddress: SHOP_DETAILS.address,
      bankName: SHOP_DETAILS.bankName,
      bankAccountNumber: SHOP_DETAILS.bankAccountNumber,
      bankAccountHolder: SHOP_DETAILS.bankAccountHolder,
      invoiceNo: data.invoiceNo,
      nic: data.nic,
      email: data.email,
      warranty: data.warranty,
      completionDate: fmtDate(data.job.completedAt),
      finalAmount: data.job.estimatedCost.toLocaleString(),
      technicianRemarks: data.job.techRemarks ?? "",
      warrantyPeriod,
      balanceDue: balanceDue.toLocaleString(),
      amountToBePaid: amountToBePaid.toLocaleString(),
      discount: data.discount.toLocaleString(),
      lineTotal: lineTotal.toLocaleString(),
      paidAmount: data.paidAmount.toLocaleString(),
      // Same figure as dueAmount below — exposed under this name too since
      // it's the label used on the printed page's own totals breakdown.
      dueAfterPayment: data.dueAmount.toLocaleString(),
      dueAmount: data.dueAmount.toLocaleString(),
      paymentType,
      adminApprover: data.adminApprover,
    };

    if (template && template.elements.length > 0) {
      return (
        <ReceiptRender
          ref={ref}
          elements={template.elements}
          data={canvasData}
          widthMm={template.pageWidthMm}
          heightMm={template.pageHeightMm}
        />
      );
    }

    return (
      <div ref={ref} style={{ background: "#ffffff", padding: "36px 44px", fontFamily: "Arial, Helvetica, sans-serif", color: "#000000" }}>
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
        <p style={{ marginTop: 18, fontSize: 13, fontWeight: 700 }}>CUSTOMER NAME: {(data.name || "Walk-in").toUpperCase()}</p>
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
    );
  },
);

export default JobIssuePrintable;
