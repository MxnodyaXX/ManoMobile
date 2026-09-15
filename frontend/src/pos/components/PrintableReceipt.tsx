"use client";

import { SHOP_DETAILS } from "@/lib/shop";
import { formatCurrency, formatDate, formatTime } from "../format";
import type { CartLine, Party } from "../types";

/**
 * What a printed bill needs — taken as a snapshot, because by the time the
 * receipt for a completed sale prints the working cart has been cleared.
 */
export interface ReceiptData {
  billNo: string;
  when: Date;
  lines: CartLine[];
  party: Party | null;
  subtotal: number;
  discountAmount: number;
  writeOffAmount: number;
  total: number;
  paid: number;
  /** Set when this is a copy of a bill still being rung up. */
  draft?: boolean;
}

/**
 * Renders only inside `@media print` (see .print-only in globals.css) — this
 * is the actual paper bill, laid out for an 80mm thermal roll. It never
 * appears on screen; the working panel is CartPanel.
 */
export function PrintableReceipt({ receipt }: { receipt: ReceiptData | null }) {
  if (!receipt) return null;
  const due = receipt.total - receipt.paid;
  const previous = receipt.party?.outstandingBalance ?? 0;
  const grandDue = due + previous;

  return (
    <div className="print-only receipt-paper px-4 pb-4 pt-5 font-mono">
      <div className="flex flex-col items-center gap-0.5 text-center">
        <p className="text-base font-extrabold tracking-tight">{SHOP_DETAILS.name}</p>
        <p className="receipt-ink-soft mt-1 text-[11px] leading-snug">{SHOP_DETAILS.address}</p>
        <p className="receipt-ink-soft text-[11px]">{SHOP_DETAILS.phone}</p>
      </div>

      <div className="receipt-dashed my-3" />

      <div className="flex items-center justify-between text-[11px]">
        <span className="text-sm font-extrabold">{receipt.draft ? "Draft" : "Bill No."} {receipt.billNo}</span>
        <span className="receipt-ink-soft">
          {formatDate(receipt.when)} &middot; {formatTime(receipt.when)}
        </span>
      </div>

      {receipt.party && (
        <>
          <div className="receipt-dashed my-3" />
          <p className="receipt-ink-soft text-[10px] font-semibold uppercase tracking-wider">
            {receipt.party.type === "dealer" ? "Dealer" : "Customer"}
          </p>
          <p className="text-sm font-bold">{receipt.party.name}</p>
          <p className="receipt-ink-soft text-[11px]">
            {receipt.party.phone}
            {receipt.party.address ? ` · ${receipt.party.address}` : ""}
          </p>
        </>
      )}

      <div className="receipt-dashed my-3" />

      <table className="w-full text-[11.5px]">
        <thead>
          <tr className="receipt-ink-soft text-left text-[10px] uppercase tracking-wider">
            <th className="pb-1.5 font-semibold">Item</th>
            <th className="w-8 pb-1.5 text-center font-semibold">Qty</th>
            <th className="w-16 pb-1.5 text-right font-semibold">Total</th>
          </tr>
        </thead>
        <tbody>
          {receipt.lines.map(line => (
            <tr key={line.id} className="align-top">
              <td className="receipt-line border-t border-dashed py-1.5 pr-2">
                <p className="font-sans font-semibold leading-snug">{line.product.name}</p>
                <p className="receipt-ink-soft text-[10px]">{formatCurrency(line.product.price)} each</p>
              </td>
              <td className="receipt-line border-t border-dashed py-1.5 text-center">{line.qty}</td>
              <td className="receipt-line whitespace-nowrap border-t border-dashed py-1.5 text-right font-bold">
                {formatCurrency(line.product.price * line.qty)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="receipt-dashed my-3" />

      <div className="flex flex-col gap-1 text-[11.5px]">
        <Row label="Subtotal" value={formatCurrency(receipt.subtotal)} />
        {receipt.discountAmount > 0 && <Row label="Discount" value={`- ${formatCurrency(receipt.discountAmount)}`} />}
        {receipt.writeOffAmount > 0 && <Row label="Write-off" value={`- ${formatCurrency(receipt.writeOffAmount)}`} />}
        <Row label="Total" value={formatCurrency(receipt.total)} strong />
        <Row label="Paid" value={formatCurrency(receipt.paid)} />
        {previous > 0 && <Row label="Previous balance" value={formatCurrency(previous)} />}
        <div className="receipt-dashed my-1" />
        <Row label={grandDue < 0 ? "Change" : "Due"} value={formatCurrency(Math.abs(grandDue))} strong />
      </div>

      <div className="receipt-dashed my-3" />

      <div className="pb-1 text-center">
        <p className="text-[12px] font-bold">Thank you for shopping with us!</p>
        <p className="receipt-ink-soft mt-0.5 text-[10px]">Please visit again</p>
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between ${strong ? "text-sm font-extrabold" : "receipt-ink-soft"}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
