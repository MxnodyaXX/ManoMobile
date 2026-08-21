"use client";

import { forwardRef, useEffect, useState } from "react";
import JobReceiptSlip from "@/cashier/components/repair/JobReceiptSlip";
import ReceiptRender from "@/cashier/components/shared/ReceiptRender";
import { fetchDefaultReceiptTemplate, type ReceiptTemplate } from "@/lib/repair/receiptTemplates";
import { type ReceiptData } from "@/lib/repair/receiptElements";
import { type RepairJob, useRepair, findDealer, IN_HOUSE_DEALER } from "@/cashier/contexts/RepairContext";
import { SHOP_DETAILS } from "@/lib/shop";

/**
 * What actually prints for a job receipt. Picks up Admin -> Barcode -> Job
 * Receipt's default canvas design if one has been built (elements.length > 0);
 * otherwise renders the built-in JobReceiptSlip exactly as before. Same
 * fallback rule BarcodeLabelModal uses for label designs, so drawing nothing
 * in the designer changes nothing about what prints.
 */
const JobReceiptPrintable = forwardRef<HTMLDivElement, {
  job: RepairJob; signatureOverride?: string; title?: string; hideStatusNote?: boolean;
}>(function JobReceiptPrintable({ job, signatureOverride, title, hideStatusNote }, ref) {
  const { dealers } = useRepair();
  // undefined = still checking, null = no design to use (fall back), object = use it.
  const [template, setTemplate] = useState<ReceiptTemplate | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    fetchDefaultReceiptTemplate("receipt")
      .then(t => { if (active) setTemplate(t && t.elements.length > 0 ? t : null); })
      .catch(() => { if (active) setTemplate(null); });
    return () => { active = false; };
  }, []);

  // While the template check is in flight, render the built-in slip so
  // there's always something in the DOM for the caller's print button to
  // grab — it just gets replaced by the canvas design a moment later if
  // there is one, well before anyone has had time to click Print.
  if (!template) {
    return <JobReceiptSlip ref={ref} job={job} signatureOverride={signatureOverride} title={title} hideStatusNote={hideStatusNote} />;
  }

  const dealerRecord = findDealer(dealers, job);
  const fmtSlipDate = (s?: string) => {
    if (!s) return "—";
    const dt = new Date(s);
    return isNaN(dt.getTime()) ? "—" : dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  };
  const origin = typeof window === "undefined" ? "" : window.location.origin;

  const data: ReceiptData = {
    jobId: job.id,
    customer: job.customerName || "Walk-in",
    phone: job.phone || "",
    address: dealerRecord?.address ?? "",
    device: [job.brand, job.model].filter(Boolean).join(" "),
    modelNumber: job.modelNumber,
    imei: job.imei ?? "",
    fault: job.issue ?? "",
    estimate: job.estimatedCost.toLocaleString(),
    advance: job.advancePaid.toLocaleString(),
    remarks: "",
    technician: job.technician ?? "",
    estCompletion: fmtSlipDate(job.estimatedCompletion),
    priority: job.priority,
    itemsReceived: (job.receivedItems ?? []).join(", "),
    date: fmtSlipDate(job.createdAt),
    createdBy: "MANOMOBILE",
    trackUrl: `${origin}/track?job=${encodeURIComponent(job.id)}`,
    shopName: SHOP_DETAILS.name,
    shopTagline: SHOP_DETAILS.tagline,
    shopPhone: SHOP_DETAILS.phone,
    shopEmail: SHOP_DETAILS.email,
    shopWebsite: SHOP_DETAILS.website,
    shopAddress: SHOP_DETAILS.address,
    bankName: SHOP_DETAILS.bankName,
    bankAccountNumber: SHOP_DETAILS.bankAccountNumber,
    bankAccountHolder: SHOP_DETAILS.bankAccountHolder,
  };
  void title; void hideStatusNote; void signatureOverride; // carried by the built-in slip only — the canvas design has no equivalent slots yet

  return (
    <ReceiptRender
      ref={ref}
      elements={template.elements}
      data={data}
      widthMm={template.pageWidthMm}
      heightMm={template.pageHeightMm}
    />
  );
});

export default JobReceiptPrintable;
