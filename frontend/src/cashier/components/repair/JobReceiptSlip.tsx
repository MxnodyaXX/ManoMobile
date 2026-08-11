"use client";

import { forwardRef } from "react";
import { type RepairJob, jobLabel, useRepair, findDealer, IN_HOUSE_DEALER } from "@/cashier/contexts/RepairContext";

/**
 * The Mano Mobile job-receipt slip (the Repair Management print template):
 * branded header, customer/device tables, dated job timeline, items-received
 * checklist, costs, status-specific notes, and a customer signature.
 *
 * Shared so Repair Management AND Repair Sales (for Mano Mobile dealers) print
 * the exact same template. forwardRef lets the caller grab it for printing.
 */
const JobReceiptSlip = forwardRef<HTMLDivElement, { job: RepairJob; signatureOverride?: string; title?: string; hideStatusNote?: boolean }>(function JobReceiptSlip({ job, signatureOverride, title, hideStatusNote }, ref) {
  const { dealers } = useRepair();
  const dealerRecord = findDealer(dealers, job);
  const d = new Date(job.createdAt);
  const dateValid = !isNaN(d.getTime());
  const receiptTitle = title ?? `${jobLabel(job)} Job Receipt`;
  const fmtSlipDate = (s?: string) => {
    if (!s) return "—";
    const dt = new Date(s);
    return isNaN(dt.getTime()) ? "—" : dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  };
  const timeline: [string, string][] = [
    ["Date Received",   fmtSlipDate(job.createdAt)],
    ["Est. Completion", fmtSlipDate(job.estimatedCompletion)],
    ["Date Started",    fmtSlipDate(job.startedAt)],
    ...(job.pausedAt ? ([["Date Paused", fmtSlipDate(job.pausedAt)]] as [string, string][]) : []),
    ["Date Finished",   fmtSlipDate(job.completedAt)],
    ["Date Issued",     fmtSlipDate(job.handover?.handedOverAt)],
    ...(job.cancelledAt ? ([["Date Cancelled", fmtSlipDate(job.cancelledAt)]] as [string, string][]) : []),
  ];

  return (
    <div ref={ref} style={{ background: "#ffffff", padding: "18px 26px", fontFamily: "Arial, Helvetica, sans-serif", color: "#000", fontSize: 10.5 }}>

      <div style={{ textAlign: "center", borderBottom: "2px solid #000", paddingBottom: 12, marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontWeight: 900, fontSize: 18, letterSpacing: "0.05em" }}>MANO MOBILE CENTRE</h2>
        <p style={{ margin: "4px 0 0", fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>{receiptTitle}</p>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14, gap: 20 }}>
        <div style={{ flex: 1 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10.5 }}>
            <tbody>
              {[
                ["Job ID", job.id],
                ["Date", dateValid ? d.toLocaleDateString("en-US", { weekday: "short", year: "numeric", month: "short", day: "numeric" }) : "—"],
                ["Dealer", dealerRecord?.name || job.dealer || IN_HOUSE_DEALER],
                ...(dealerRecord?.contact ? ([["Dealer Tel", dealerRecord.contact]] as [string, string][]) : []),
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
          <p style={{ fontSize: 12, fontWeight: 700 }}>{job.estimatedCompletion || "—"}</p>
          {job.completedAt && (
            <>
              <p style={{ fontSize: 8.5, fontWeight: 700, marginTop: 6, color: "#16a34a" }}>COMPLETED</p>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#16a34a" }}>{job.completedAt}</p>
            </>
          )}
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

      <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #999", marginBottom: 12, fontSize: 10.5 }}>
        <thead>
          <tr style={{ background: "#f0f0f0" }}>
            <th colSpan={2} style={{ padding: "5px 8px", borderBottom: "1px solid #999", textAlign: "left", fontWeight: 700 }}>JOB TIMELINE</th>
          </tr>
        </thead>
        <tbody>
          {timeline.map(([k, v], i) => (
            <tr key={k} style={{ background: i % 2 ? "#fafafa" : "#fff" }}>
              <td style={{ padding: "3px 8px", fontWeight: 700, width: 150, borderRight: "1px solid #eee" }}>{k}</td>
              <td style={{ padding: "3px 8px" }}>{v}</td>
            </tr>
          ))}
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

      {/* Pending (paused) — show the reason */}
      {!hideStatusNote && job.status === "Pending" && (
        <div style={{ border: "1px solid #d97706", background: "#fffbeb", borderRadius: 4, padding: "7px 10px", marginBottom: 12, fontSize: 10.5 }}>
          <strong>Status:</strong> On Hold (Pending){job.pauseReason ? <> — <em>{job.pauseReason}</em></> : null}
        </div>
      )}

      {/* Non-Issued (repaired, awaiting collection) — completion details */}
      {!hideStatusNote && job.status === "Completed" && (
        <div style={{ border: "1px solid #999", borderRadius: 4, padding: "8px 10px", marginBottom: 12, fontSize: 10.5 }}>
          <p style={{ fontWeight: 700, marginBottom: 4 }}>REPAIR COMPLETED — AWAITING COLLECTION</p>
          {job.partsUsed && job.partsUsed.length > 0 && (
            <p style={{ marginBottom: 3 }}><strong>Parts used:</strong> {job.partsUsed.join(", ")}</p>
          )}
          {job.techRemarks && <p style={{ marginBottom: 3 }}><strong>Technician remarks:</strong> {job.techRemarks}</p>}
          {job.futureFaults && (
            <p style={{ color: "#b45309" }}><strong>⚠ Future faults noted:</strong> {job.futureFaults}</p>
          )}
        </div>
      )}

      {/* Cancelled — reason, date, requested-by */}
      {!hideStatusNote && job.status === "Cancelled" && (
        <div style={{ border: "1px solid #dc2626", background: "#fef2f2", borderRadius: 4, padding: "8px 10px", marginBottom: 12, fontSize: 10.5 }}>
          <p style={{ fontWeight: 700, marginBottom: 3 }}>JOB CANCELLED</p>
          {job.cancelReason && <p style={{ marginBottom: 2 }}><strong>Reason:</strong> {job.cancelReason}</p>}
          {job.cancelledAt && <p style={{ marginBottom: 2 }}><strong>Cancelled on:</strong> {job.cancelledAt}</p>}
          {job.cancelledBy && <p><strong>Requested by:</strong> {job.cancelledBy}</p>}
        </div>
      )}

      <div style={{ borderTop: "1px dashed #999", paddingTop: 10, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <p style={{ fontSize: 9, color: "#666", maxWidth: 260, lineHeight: 1.4 }}>
            Please keep this slip safe. Present it when collecting your device. Mano Mobile is not responsible for pre-existing damage not noted at intake.
          </p>
          {job.status === "Delivered" && job.handover && (
            <p style={{ fontSize: 9.5, color: "#16a34a", fontWeight: 700, marginTop: 6 }}>
              ISSUED &amp; collected on {job.handover.handedOverAt.slice(0, 10)}
              {job.handover.collectedBy ? ` by ${job.handover.collectedBy}` : ""}
            </p>
          )}
        </div>
        <div style={{ textAlign: "center" }}>
          {(signatureOverride || (job.status === "Delivered" && job.handover?.handoverSignature)) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={signatureOverride || job.handover?.handoverSignature} alt="signature" style={{ width: 130, height: 44, objectFit: "contain", display: "block", marginBottom: 2 }} />
          ) : (
            <div style={{ borderTop: "1px solid #000", width: 120, marginBottom: 4 }} />
          )}
          <p style={{ fontSize: 9, fontWeight: 700 }}>Customer Signature</p>
        </div>
      </div>
    </div>
  );
});

export default JobReceiptSlip;
