import type { CreditEntry } from "@/lib/credit/api";

/**
 * Which invoices on a credit account are still open, and how a payment
 * settles them.
 *
 * A dealer owing Rs. 100,000 across 50 invoices who pays Rs. 50,000 wants to
 * know which of those invoices that clears. The ledger alone can't say: until
 * now a payment was recorded against the account, not against invoices. So
 * the open amount per invoice is worked out here, the way a statement would:
 *
 *   1. each invoice's charges, less anything already booked against that same
 *      invoice (a write-off or refund naming it, or a payment that was split);
 *   2. then every unnamed payment, refund or write-off, applied oldest invoice
 *      first — the order a dealer settles in, and what "paid on account" means.
 *
 * A new payment is then allocated the same way, oldest first.
 */

export interface OpenInvoice {
  /** Stable key — the invoice number, or the charge id for an un-invoiced charge. */
  key: string;
  invoiceNo: string | null;
  /** What to show: the invoice number, or what the loose charge was for. */
  label: string;
  /** Earliest charge date on it — the settling order. */
  date: string;
  charged: number;
  /** Still owed on it before the new payment. */
  open: number;
}

export interface Allocation {
  invoice: OpenInvoice;
  /** Taken off this invoice by the new payment. */
  applied: number;
  /** Owed on it once the new payment is applied. */
  left: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * The same rule as the database (migration 20261011000079): what an invoice
 * still owes is its charges less whatever names it. Money on the account that
 * names no invoice is NOT spread across invoices — spreading it again on every
 * change is what made correcting one invoice turn the next one "Part paid".
 * It still lowers the account balance; it just belongs to no invoice.
 */
export function openInvoices(entries: CreditEntry[]): OpenInvoice[] {
  const groups = new Map<string, OpenInvoice>();
  for (const e of entries) {
    if (e.kind !== "Charge") continue;
    const key = e.invoiceNo ?? `charge-${e.id}`;
    const g = groups.get(key) ?? {
      key, invoiceNo: e.invoiceNo,
      label: e.invoiceNo ?? (e.jobId ? `Job ${e.jobId}` : e.note || "Account charge"),
      date: e.occurredOn, charged: 0, open: 0,
    };
    g.charged = r2(g.charged + e.amount);
    g.open = g.charged;
    if (e.occurredOn < g.date) g.date = e.occurredOn;
    groups.set(key, g);
  }

  // Reductions that name an invoice come off that invoice.
  for (const e of entries) {
    if (e.kind === "Charge") continue;
    const g = e.invoiceNo ? groups.get(e.invoiceNo) : undefined;
    if (!g) continue;
    g.open = r2(Math.max(0, g.open - e.amount));
  }

  const list = [...groups.values()].sort((a, b) => a.date.localeCompare(b.date) || a.label.localeCompare(b.label));

  return list.filter(g => g.open > 0.005);
}

/** Apply `amount` to the open invoices, oldest first. */
export function allocatePayment(open: OpenInvoice[], amount: number): Allocation[] {
  let left = r2(amount);
  return open.map(invoice => {
    const applied = Math.min(invoice.open, Math.max(0, left));
    left = r2(left - applied);
    return { invoice, applied: r2(applied), left: r2(invoice.open - applied) };
  });
}

/** Money paid onto the account without naming an invoice — still "on account". */
export const moneyOnAccount = (entries: CreditEntry[]) =>
  r2(entries.filter(e => e.kind === "Payment" && !e.invoiceNo).reduce((t, e) => t + e.amount, 0));
