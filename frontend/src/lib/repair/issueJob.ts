"use client";

import { useCallback } from "react";
import { useRepair, type RepairJob } from "@/cashier/contexts/RepairContext";
import { useSales } from "@/cashier/contexts/SalesContext";
import { useAuth } from "@/lib/auth/AuthContext";
import { useParts } from "@/cashier/contexts/PartsContext";
import { notifyJobEvent } from "@/lib/sms/notify";
import { postJobToCredit } from "@/lib/credit/api";
import { fetchNextInvoiceNo } from "@/lib/sales/invoiceNo";
import type { IssueInvoiceData } from "@/cashier/components/repair/JobIssuePrintable";

/**
 * Handing a finished repair over and billing it.
 *
 * Five things happen together and none of them is optional: an invoice number
 * is drawn, the job goes Delivered with its handover recorded, any unpaid
 * balance lands on the holder's credit account, the sale is written to the
 * ledger, and the printable invoice is produced.
 *
 * Pulled out of JobsTable when Instant Jobs needed the same billing. A second
 * copy would have been the expensive kind of duplication — one of the two
 * would eventually stop stamping the invoice number onto the credit charge, or
 * record the cash taken instead of the amount billed, and the books would
 * disagree with the paperwork with nothing on screen to say which was right.
 */

/** Everything the issue form collects, before the number and timestamp. */
export type IssueFormData = Omit<IssueInvoiceData, "job" | "invoiceNo" | "createdAt">;

export function useIssueJob() {
  const { updateJob } = useRepair();
  const { addSale } = useSales();
  const { profile } = useAuth();
  const { partRequests } = useParts();

  return useCallback(async (job: RepairJob, data: IssueFormData): Promise<IssueInvoiceData> => {
    const invoiceNo = await fetchNextInvoiceNo();
    const createdAt = new Date().toLocaleString("en-US", {
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: true,
    });
    const issuedISO = new Date().toISOString();

    // "Delivered", not "Issued": the internal enum uses Issued for work in
    // progress, so the old value pushed a collected job back onto the bench.
    //
    // Awaited, because Delivered is what makes the database raise the credit
    // charge, and the sale recorded below is what stamps this invoice number
    // onto it. Fire-and-forget leaves a charge with no invoice on it.
    await updateJob(job.id, {
      status: "Delivered",
      imei: data.imei,
      jobWarranty: data.warranty,
      advancePaid: data.paidAmount,
      handover: job.handover ?? {
        collectedBy: job.customerName || "Customer",
        relationship: "Owner",
        idVerified: false,
        balanceSettled: data.paidAmount,
        paymentMethod: "Cash",
        handoverSignature: "",
        warrantyCardIssued: false,
        handedOverBy: profile?.fullName?.trim() || "Cashier",
        handedOverAt: issuedISO,
      },
    });

    // Belt and braces: the Delivered trigger is the backstop, so a failure
    // here is not worth stopping a handover for.
    try {
      await postJobToCredit(job.id);
    } catch {
      /* the trigger will have done it */
    }

    addSale(
      {
        invoiceNo,
        date: issuedISO.slice(0, 10),
        customer: data.name || job.customerName || "Walk-in",
        category: "Repair",
        items: `${job.brand} ${job.model}`.trim() || job.id,
        // What the invoice was for, after any discount — not what was handed
        // over at the counter. The two differ whenever a balance is left
        // owing, and the ledger records the sale, not the cash.
        total: Math.max(0, (job.estimatedCost ?? 0) - (data.discount ?? 0)),
        subtotal: job.estimatedCost ?? 0,
        discountAmount: data.discount ?? 0,
        paid: data.paidAmount ?? 0,
        status: "Paid",
        paymentMethod: data.isCredit ? "Credit" : "Cash",
        cashier: profile?.fullName?.trim() || undefined,
      },
      {
        customerPhone: data.phone || job.phone || null,
        jobIds: [job.id],
        // Filed against the account the cashier chose, rather than left for
        // the ledger to infer from a phone number typed at the counter.
        creditAccountId: data.creditAccount?.id ?? null,
      },
    );

    /**
     * An instant job's "handed back to you today" message goes from here, not
     * from the form that created it, because the settling is what triggers it
     * and settling can happen twice over: at the counter while the customer
     * waits, or days later from Non-Issued when they come back with the cash.
     * Both are the same event to the customer, so both send the same message.
     *
     * Normal jobs are untouched — they were already told "ready for
     * collection" when the technician finished, and a second text on handover
     * would say nothing new.
     */
    if (job.creationType === "Instant") {
      const fitted = partRequests
        .filter(r => r.jobId === job.id && r.status !== "Rejected")
        .map(r => `${r.partName} x${r.quantity}`);
      notifyJobEvent("instant_settled", { ...job, advancePaid: data.paidAmount }, {
        parts_used: fitted.length > 0 ? fitted.join(", ") : "None",
      });
    }

    return { job, ...data, invoiceNo, createdAt };
  }, [updateJob, addSale, profile, partRequests]);
}
