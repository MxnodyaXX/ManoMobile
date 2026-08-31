"use client";

import { Hash } from "lucide-react";
import { useNextInvoiceNo } from "@/lib/sales/invoiceNo";
import { useSales } from "@/cashier/contexts/SalesContext";

/**
 * The invoice number this sale is about to get.
 *
 * Every sale screen — Accessories, Mobile, Other, Repair — draws its number
 * from the same shop-wide sequence, and none of them showed it until the
 * invoice had already been printed. A cashier writing the number into a book,
 * or telling a customer what to quote when they come back, had nothing to read.
 *
 * It says "next" rather than showing a bare number on purpose. The number is
 * not reserved until Complete Sale is pressed: two people billing at the same
 * moment both see INV-000124, and whoever finishes first gets it. Reserving one
 * per opened cart would leave gaps in the invoice book instead, which is the
 * worse trade — a preview that is occasionally superseded beats a permanent
 * hole somebody has to explain.
 *
 * Renders nothing when the number cannot be read, so a billing panel is never
 * blocked by it.
 */
export default function InvoiceNoBadge({
  refreshKey,
  align = "left",
}: {
  /** Change this when a sale completes so the panel stops showing a number
   *  that has just been handed out. */
  refreshKey?: unknown;
  align?: "left" | "right";
}) {
  // Re-read whenever a sale is recorded anywhere in this session, so the panel
  // stops offering a number that has just been handed out — including one taken
  // by a different sale screen in the same tab.
  const { sales } = useSales();
  const next = useNextInvoiceNo(`${sales.length}:${String(refreshKey ?? "")}`);
  if (!next) return null;

  return (
    <div
      title="Assigned when the sale is completed. Another till may take this number first."
      style={{
        display: "inline-flex", alignItems: "center", gap: 7,
        alignSelf: align === "right" ? "flex-end" : "flex-start",
        padding: "5px 10px", borderRadius: 8,
        background: "var(--bg-primary)", border: "1px dashed var(--border-active)",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}
    >
      <Hash size={11} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
      <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.07em", textTransform: "uppercase" }}>
        Next invoice
      </span>
      <span style={{ fontSize: 12.5, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>
        {next}
      </span>
    </div>
  );
}
