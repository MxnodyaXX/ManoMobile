"use client";

import { forwardRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { type RepairJob, useRepair, findDealer, IN_HOUSE_DEALER } from "@/cashier/contexts/RepairContext";

/**
 * The Mano Mobile job-receipt slip — an A5 **landscape** template: branded
 * header with a status-tracking QR, dealer/customer blocks, the job as a single
 * priced line item, the customer's agreement signature, and the running balance.
 *
 * Shared so Repair Management, the new-repair confirmation, AND Repair Sales all
 * print the exact same thing. forwardRef lets the caller grab it for printing.
 *
 * Print CSS lives with each caller; all of them must use `@page { size: A5 landscape }`
 * to match the CONTENT_W below.
 */

/** A5 landscape at 10mm margins ≈ 190mm × 128mm of usable space (96dpi). */
const CONTENT_W = 718;

const money = (n: number) => `Rs. ${n.toLocaleString()}`;

const th: React.CSSProperties = {
  padding: "5px 7px", border: "1px solid #999", fontWeight: 700, fontStyle: "italic",
  textAlign: "left", whiteSpace: "nowrap", fontSize: 9.5, background: "#f0f0f0",
};
const td: React.CSSProperties = {
  padding: "6px 7px", border: "1px solid #ccc", fontSize: 9.5, fontStyle: "italic", verticalAlign: "top",
};

const JobReceiptSlip = forwardRef<HTMLDivElement, { job: RepairJob; signatureOverride?: string; title?: string; hideStatusNote?: boolean }>(
  function JobReceiptSlip({ job, signatureOverride, title, hideStatusNote }, ref) {
    const { dealers } = useRepair();
    const dealerRecord = findDealer(dealers, job);

    const fmtSlipDate = (s?: string) => {
      if (!s) return "—";
      const dt = new Date(s);
      return isNaN(dt.getTime()) ? "—" : dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    };

    const balance = job.estimatedCost - job.advancePaid;
    // A collected job carries the handover signature; otherwise fall back to the
    // consent signed at intake, and to a blank rule when neither exists.
    const signature = signatureOverride || job.handover?.handoverSignature || job.customerConsentSignature;
    const origin = typeof window === "undefined" ? "" : window.location.origin;
    const trackUrl = `${origin}/track?job=${encodeURIComponent(job.id)}`;

    return (
      <div ref={ref} style={{ background: "#fff", color: "#000", fontFamily: "Arial, Helvetica, sans-serif", fontSize: 10, width: CONTENT_W, padding: "16px 20px" }}>

        {/* ── Header: brand · title · tracking QR ── */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, flex: "0 0 auto", width: 190 }}>
            <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true">
              <path d="M4 6 L16 2 L16 14 Z" fill="#111" />
              <path d="M4 6 L16 14 L16 26 Z" fill="#555" />
              <path d="M28 12 L16 14 L16 26 Z" fill="#999" />
            </svg>
            <div style={{ lineHeight: 1.15 }}>
              <div style={{ fontSize: 13, fontWeight: 900, letterSpacing: "0.04em" }}>MANO MOBILE</div>
              <div style={{ fontSize: 7.5, letterSpacing: "0.22em", color: "#666" }}>REPAIR CENTRE</div>
            </div>
          </div>

          <div style={{ flex: 1, textAlign: "center", paddingTop: 6 }}>
            <h1 style={{ margin: 0, fontSize: 17, fontWeight: 900, letterSpacing: "0.06em" }}>
              {title ?? "Repair Job Receipt"}
            </h1>
          </div>

          <div style={{ flex: "0 0 auto", width: 118, textAlign: "center" }}>
            <QRCodeSVG value={trackUrl} size={74} level="M" />
            <p style={{ fontSize: 6.8, color: "#444", marginTop: 3, lineHeight: 1.35 }}>
              Scan The QR Code To<br />Track the Job Status
            </p>
          </div>
        </div>

        {/* ── Dealer · customer · invoice meta ── */}
        <div style={{ display: "flex", justifyContent: "space-between", gap: 18, marginTop: 14, marginBottom: 12 }}>
          <div style={{ display: "flex", gap: 26 }}>
            <div>
              <p style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.1em", color: "#555", marginBottom: 3 }}>DEALER</p>
              <p style={{ fontSize: 11, fontWeight: 700 }}>{dealerRecord?.name || job.dealer || IN_HOUSE_DEALER}</p>
              {dealerRecord?.address && <p style={{ fontSize: 8.5, color: "#333", marginTop: 2 }}>{dealerRecord.address}</p>}
              {dealerRecord?.contact && <p style={{ fontSize: 8.5, color: "#333" }}>Tel: {dealerRecord.contact}</p>}
            </div>
            <div>
              <p style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.1em", color: "#555", marginBottom: 3 }}>CUSTOMER</p>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>{job.customerName}</p>
              {job.phone && <p style={{ fontSize: 8.5, color: "#333", marginTop: 2 }}>Tel: {job.phone}</p>}
            </div>
          </div>

          <table style={{ borderCollapse: "collapse", alignSelf: "flex-start" }}>
            <tbody>
              <tr>
                <td style={{ fontSize: 8.5, fontWeight: 700, textAlign: "right", padding: "2px 8px", whiteSpace: "nowrap" }}>INVOICE NUMBER:</td>
                <td style={{ border: "1px solid #999", background: "#f0f0f0", padding: "3px 12px", fontSize: 10.5, fontWeight: 700, whiteSpace: "nowrap" }}>{job.id}</td>
              </tr>
              <tr>
                <td style={{ fontSize: 8.5, fontWeight: 700, textAlign: "right", padding: "2px 8px", whiteSpace: "nowrap" }}>DATE and CREATED BY:</td>
                <td style={{ border: "1px solid #999", background: "#f0f0f0", padding: "3px 12px", fontSize: 9.5, whiteSpace: "nowrap" }}>
                  {fmtSlipDate(job.createdAt)} | MANOMOBILE
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ── The job as a priced line ── */}
        <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #999" }}>
          <thead>
            <tr>
              <th style={{ ...th, width: 30 }}>No</th>
              <th style={th}>Device Model</th>
              <th style={{ ...th, width: 116 }}>IMEI</th>
              <th style={th}>Fault Type</th>
              <th style={{ ...th, width: 84 }}>Estimate</th>
              <th style={{ ...th, width: 84 }}>Advance</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={td}>1.</td>
              <td style={td}>
                {job.brand} {job.model}
                {job.modelNumber && <div style={{ fontSize: 8, fontStyle: "normal", color: "#555", marginTop: 2 }}>{job.modelNumber}</div>}
              </td>
              <td style={{ ...td, fontFamily: "monospace", fontStyle: "normal" }}>{job.imei || "—"}</td>
              <td style={td}>
                {job.issue || "—"}
                {job.completionType === "Return" && (
                  <div style={{ fontSize: 8, fontStyle: "normal", fontWeight: 700, color: "#b91c1c", marginTop: 2 }}>
                    NOT REPAIRED - RETURNED TO CUSTOMER
                  </div>
                )}
                {job.completionType === "FOC" && (
                  <div style={{ fontSize: 8, fontStyle: "normal", fontWeight: 700, color: "#1d4ed8", marginTop: 2 }}>
                    FREE OF CHARGE
                  </div>
                )}
              </td>
              <td style={td}>{money(job.estimatedCost)}</td>
              <td style={td}>{money(job.advancePaid)}</td>
            </tr>
          </tbody>
        </table>

        {/* ── Job facts the customer needs, kept off the priced table ── */}
        <div style={{ display: "flex", gap: 22, marginTop: 8, fontSize: 8.5, color: "#333" }}>
          <span><strong>Technician:</strong> {job.technician}</span>
          <span><strong>Est. completion:</strong> {fmtSlipDate(job.estimatedCompletion)}</span>
          <span><strong>Priority:</strong> {job.priority}</span>
          {job.receivedItems && job.receivedItems.length > 0 && (
            <span><strong>Items received:</strong> {job.receivedItems.join(", ")}</span>
          )}
        </div>

        {!hideStatusNote && job.status === "Pending" && (
          <p style={{ marginTop: 6, border: "1px solid #d97706", background: "#fffbeb", padding: "4px 8px", fontSize: 8.5 }}>
            <strong>On Hold (Pending)</strong>{job.pauseReason ? ` — ${job.pauseReason}` : ""}
          </p>
        )}
        {!hideStatusNote && job.status === "Cancelled" && (
          <p style={{ marginTop: 6, border: "1px solid #dc2626", background: "#fef2f2", padding: "4px 8px", fontSize: 8.5 }}>
            <strong>JOB CANCELLED</strong>{job.cancelReason ? ` — ${job.cancelReason}` : ""}
            {job.cancelledAt ? ` (${fmtSlipDate(job.cancelledAt)})` : ""}
          </p>
        )}

        {/* ── Agreement · totals ── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 30, marginTop: 26 }}>
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, marginBottom: 20 }}>I Hereby Accept the Agreement</p>
            {signature ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={signature} alt="customer signature" style={{ width: 150, height: 40, objectFit: "contain", display: "block" }} />
            ) : null}
            <div style={{ borderTop: "1px solid #000", width: 190 }} />
          </div>

          <table style={{ borderCollapse: "collapse", width: 250 }}>
            <tbody>
              <tr>
                <td style={{ padding: "3px 8px", fontSize: 12, fontWeight: 700, borderTop: "1.5px solid #000" }}>TOTAL</td>
                <td style={{ padding: "3px 8px", fontSize: 12, fontWeight: 700, textAlign: "right", borderTop: "1.5px solid #000" }}>{money(job.estimatedCost)}</td>
              </tr>
              <tr>
                <td style={{ padding: "3px 8px", fontSize: 9 }}>Total Paid</td>
                <td style={{ padding: "3px 8px", fontSize: 9, textAlign: "right" }}>{money(job.advancePaid)}</td>
              </tr>
              <tr>
                <td style={{ padding: "4px 8px", fontSize: 9.5, fontWeight: 700, color: "#b45309", border: "1px solid #d97706", background: "#fffbeb" }}>BALANCE DUE</td>
                <td style={{ padding: "4px 8px", fontSize: 9.5, fontWeight: 700, color: "#b45309", textAlign: "right", border: "1px solid #d97706", background: "#fffbeb" }}>{money(balance)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p style={{ fontSize: 7.5, color: "#666", marginTop: 10, textAlign: "center" }}>
          Please keep this receipt and present it when collecting your device. Mano Mobile is not responsible for
          pre-existing damage not noted at intake. Warranty applies only to the work performed.
        </p>
      </div>
    );
  },
);

export default JobReceiptSlip;
