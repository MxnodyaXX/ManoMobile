"use client";

import { useEffect, useState, type Ref } from "react";
import { QRCodeSVG } from "qrcode.react";
import { verifyUrl } from "@/lib/sales/verify";
import { SHOP_DETAILS } from "@/lib/shop";
import ReceiptPagedRender from "@/cashier/components/shared/ReceiptPagedRender";
import { fetchDefaultReceiptTemplate, type ReceiptTemplate } from "@/lib/repair/receiptTemplates";
import type { ReceiptData } from "@/lib/repair/receiptElements";

/**
 * The accessory sales invoice — A5 landscape, paginated.
 *
 * Prints Admin -> Barcode -> Accessories -> Receipts' default design when one
 * has been built (kind "accessoryInvoice"), one invoice-table row per product
 * sold, spread over as many sheets as the bill needs (ReceiptPagedRender). With
 * no design yet it prints BuiltInAccessoryInvoice below — the same fallback
 * rule as DealerInvoicePrintable, so an empty designer changes nothing.
 */

export const ACCESSORY_INVOICE_PAGE_CSS = "@page { size: A5 landscape; margin: 0; }";

export interface AccessoryInvoiceLine {
  productId: number;
  name: string;
  code: string;
  brand: string;
  category: string;
  qty: number;
  unitPrice: number;
  /** As chosen at the counter, e.g. "6 Months". "None" or "" for none. */
  warranty: string;
}

export interface AccessoryInvoiceProps {
  invoiceNo: string;
  /** Already formatted for print. */
  createdAt: string;
  customer: { name: string; phone: string; nic?: string; email?: string };
  lines: AccessoryInvoiceLine[];
  discount: number;
  payMethod: string;
  /** Cash handed over; 0 or absent when not counted. */
  received?: number;
  cashier?: string;
  ref?: Ref<HTMLDivElement>;
}

const fmt = (n: number) => n.toLocaleString("en-LK");
const Rs = (n: number) => `Rs. ${n.toLocaleString("en-LK", { minimumFractionDigits: 2 })}`;
const hasWarranty = (w: string) => !!w && w !== "None";

function totalsOf({ lines, discount, received = 0 }: Pick<AccessoryInvoiceProps, "lines" | "discount" | "received">) {
  const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
  const total = Math.max(0, subtotal - discount);
  const change = received > 0 ? Math.max(0, received - total) : 0;
  const itemCount = lines.reduce((s, l) => s + l.qty, 0);
  return { subtotal, total, change, itemCount };
}

export default function AccessoryInvoicePrintable(props: AccessoryInvoiceProps) {
  const { invoiceNo, createdAt, customer, lines, discount, payMethod, received = 0, cashier, ref } = props;

  // undefined = still checking, null = no design to use (fall back), object = use it.
  const [template, setTemplate] = useState<ReceiptTemplate | null | undefined>(undefined);
  useEffect(() => {
    let active = true;
    fetchDefaultReceiptTemplate("accessoryInvoice")
      .then(t => { if (active) setTemplate(t && t.elements.length > 0 ? t : null); })
      .catch(() => { if (active) setTemplate(null); });
    return () => { active = false; };
  }, []);

  if (template) {
    const { subtotal, total, change, itemCount } = totalsOf(props);
    const headerData: ReceiptData = {
      jobId: "", customer: customer.name || "Walk-in", phone: customer.phone, address: "",
      device: "", imei: "", estimate: "", advance: "", remarks: "",
      // A designed QR is bound to {{trackUrl}} — for a product sale that's
      // the customer's product & warranty check, as /track is for a repair.
      date: createdAt, createdBy: cashier || "MANOMOBILE", trackUrl: verifyUrl(invoiceNo),
      shopName: SHOP_DETAILS.name, shopTagline: SHOP_DETAILS.tagline, shopPhone: SHOP_DETAILS.phone,
      shopEmail: SHOP_DETAILS.email, shopWebsite: SHOP_DETAILS.website, shopAddress: SHOP_DETAILS.address,
      bankName: SHOP_DETAILS.bankName, bankAccountNumber: SHOP_DETAILS.bankAccountNumber,
      bankAccountHolder: SHOP_DETAILS.bankAccountHolder,
      invoiceNo, nic: customer.nic ?? "", email: customer.email ?? "",
      paymentType: payMethod.toUpperCase(),
      itemCount: String(itemCount),
      subtotal: fmt(subtotal), discount: fmt(discount), total: fmt(total),
      received: received > 0 ? fmt(received) : "", change: received > 0 ? fmt(change) : "",
    };
    const rows: ReceiptData[] = lines.map((l): ReceiptData => ({
      ...headerData,
      itemName: l.name, itemCode: l.code, itemType: "Accessory", category: l.category,
      warranty: hasWarranty(l.warranty) ? l.warranty : "",
      qty: String(l.qty), estimate: fmt(l.unitPrice), discount: "0",
      lineTotal: fmt(l.unitPrice * l.qty),
    }));

    return (
      <ReceiptPagedRender
        ref={ref}
        elements={template.elements}
        headerData={headerData}
        rows={rows}
        widthMm={template.pageWidthMm}
        heightMm={template.pageHeightMm}
      />
    );
  }

  return <BuiltInAccessoryInvoice {...props} pending={template === undefined} />;
}

// ── Built-in layout ─────────────────────────────────────────────────────────

const PAGE_W = 210;
const PAGE_H = 148;
const PAD = 8;

// Rows per sheet. Every row is one line (names truncate), so these hold; the
// first sheet carries the bill-to block, the last the totals and terms.
const ROWS_ONLY = 8;        // first page, and also the last
const ROWS_FIRST = 13;      // first page, more follow
const ROWS_MIDDLE = 18;     // a continuation page, more follow
const ROWS_LAST = 11;       // a continuation page that is also the last

function paginate<T>(rows: T[]): T[][] {
  if (rows.length <= ROWS_ONLY) return [rows];
  const pages: T[][] = [rows.slice(0, ROWS_FIRST)];
  let i = ROWS_FIRST;
  while (rows.length - i > ROWS_LAST) {
    pages.push(rows.slice(i, i + ROWS_MIDDLE));
    i += ROWS_MIDDLE;
  }
  // What's left fits a closing page; if the first page took everything, the
  // totals still need a sheet of their own.
  pages.push(rows.slice(i));
  return pages;
}

const label: React.CSSProperties = { fontSize: 7, fontWeight: 700, color: "#6b7280", letterSpacing: "0.14em", textTransform: "uppercase" };

function BuiltInAccessoryInvoice({
  invoiceNo, createdAt, customer, lines, discount, payMethod, received = 0, cashier, ref, pending,
}: AccessoryInvoiceProps & { pending: boolean }) {
  const { subtotal, total, change, itemCount } = totalsOf({ lines, discount, received });
  const pages = paginate(lines);
  const startOf = pages.map((_, i) => pages.slice(0, i).reduce((n, p) => n + p.length, 0));

  const th: React.CSSProperties = { padding: "1.6mm 1.8mm", fontSize: 8, fontWeight: 700, color: "#fff", textAlign: "left", whiteSpace: "nowrap" };
  const td: React.CSSProperties = { padding: "1.4mm 1.8mm", fontSize: 8.5, borderBottom: "0.2mm solid #e5e7eb", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
  const right: React.CSSProperties = { textAlign: "right" };

  return (
    <div ref={ref} data-template-pending={pending ? "1" : undefined} style={{ background: "#fff" }}>
      {pages.map((chunk, pageIdx) => {
        const isFirst = pageIdx === 0;
        const isLast = pageIdx === pages.length - 1;
        return (
          <div
            key={pageIdx}
            style={{
              width: `${PAGE_W}mm`, height: `${PAGE_H}mm`, padding: `${PAD}mm`, boxSizing: "border-box",
              background: "#fff", color: "#111827", fontFamily: "Arial, Helvetica, sans-serif",
              display: "flex", flexDirection: "column", overflow: "hidden",
              pageBreakAfter: isLast ? "auto" : "always",
            }}
          >
            {/* Header — every page */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={SHOP_DETAILS.logo} alt="" style={{ height: "11mm", width: "auto" }} />
                <div>
                  <div style={{ fontSize: 15, fontWeight: 900, letterSpacing: "-0.01em", lineHeight: 1 }}>{SHOP_DETAILS.name.toUpperCase()}</div>
                  <div style={{ fontSize: 7, fontWeight: 700, color: "#6b7280", letterSpacing: "0.04em", marginTop: 2 }}>{SHOP_DETAILS.tagline.toUpperCase()}</div>
                  <div style={{ fontSize: 7.5, color: "#374151", marginTop: 3 }}>
                    {SHOP_DETAILS.address} · {SHOP_DETAILS.phone}
                  </div>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 17, fontWeight: 900, letterSpacing: "0.04em", lineHeight: 1 }}>INVOICE</div>
                <div style={{ fontSize: 7.5, fontWeight: 700, color: "#6b7280", letterSpacing: "0.1em", marginTop: 2 }}>ACCESSORIES SALE</div>
                <div style={{ fontSize: 10, fontWeight: 800, marginTop: 4 }}>{invoiceNo}</div>
                <div style={{ fontSize: 7.5, color: "#374151", marginTop: 1 }}>{createdAt}</div>
                {pages.length > 1 && (
                  <div style={{ fontSize: 7, color: "#6b7280", marginTop: 1 }}>Page {pageIdx + 1} of {pages.length}</div>
                )}
              </div>
            </div>
            <div style={{ height: "0.6mm", background: "#111827", marginTop: "3mm" }} />

            {/* Bill to — first page */}
            {isFirst && (
              <div style={{ display: "flex", gap: 16, marginTop: "3mm" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={label}>Bill To</div>
                  <div style={{ fontSize: 10.5, fontWeight: 700, marginTop: 2 }}>{customer.name || "Walk-in customer"}</div>
                  <div style={{ fontSize: 8, color: "#374151", marginTop: 1 }}>
                    {[customer.phone && `Tel: ${customer.phone}`, customer.nic && `NIC: ${customer.nic}`, customer.email].filter(Boolean).join(" · ")}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={label}>Payment</div>
                  <div style={{ fontSize: 10, fontWeight: 700, marginTop: 2, color: payMethod === "Credit" ? "#dc2626" : "#111827" }}>{payMethod}</div>
                  <div style={{ fontSize: 8, color: "#374151", marginTop: 1 }}>{itemCount} item{itemCount === 1 ? "" : "s"}</div>
                </div>
              </div>
            )}

            {/* no-resp: a fixed A5 sheet, not a screen table — keep it out of
                globals.css's narrow-screen scrolling rule. */}
            <table className="no-resp" style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed", marginTop: "3mm" }}>
              <colgroup>
                <col style={{ width: "6%" }} />
                <col style={{ width: "36%" }} />
                <col style={{ width: "12%" }} />
                <col style={{ width: "13%" }} />
                <col style={{ width: "7%" }} />
                <col style={{ width: "12%" }} />
                <col style={{ width: "14%" }} />
              </colgroup>
              <thead>
                <tr style={{ background: "#111827", printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}>
                  <th style={th}>No.</th>
                  <th style={th}>Item</th>
                  <th style={th}>Code</th>
                  <th style={th}>Warranty</th>
                  <th style={{ ...th, ...right }}>Qty</th>
                  <th style={{ ...th, ...right }}>Unit Price</th>
                  <th style={{ ...th, ...right }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {chunk.map((l, i) => (
                  <tr key={`${l.productId}-${i}`}>
                    <td style={td}>{startOf[pageIdx] + i + 1}.</td>
                    <td style={{ ...td, fontWeight: 700 }} title={l.name}>
                      {l.name}{l.brand ? <span style={{ fontWeight: 400, color: "#6b7280" }}> · {l.brand}</span> : null}
                    </td>
                    <td style={{ ...td, color: "#374151" }}>{l.code || "—"}</td>
                    <td style={{ ...td, fontWeight: hasWarranty(l.warranty) ? 700 : 400, color: hasWarranty(l.warranty) ? "#111827" : "#9ca3af" }}>
                      {hasWarranty(l.warranty) ? l.warranty : "—"}
                    </td>
                    <td style={{ ...td, ...right }}>{l.qty}</td>
                    <td style={{ ...td, ...right }}>{fmt(l.unitPrice)}</td>
                    <td style={{ ...td, ...right, fontWeight: 700 }}>{fmt(l.unitPrice * l.qty)}</td>
                  </tr>
                ))}
                {chunk.length === 0 && isFirst && (
                  <tr><td colSpan={7} style={{ ...td, textAlign: "center", color: "#9ca3af" }}>No items</td></tr>
                )}
              </tbody>
            </table>

            <div style={{ flex: 1 }} />

            {/* Terms + totals — last page */}
            {isLast && (
              <div style={{ display: "flex", gap: 14, alignItems: "flex-end", borderTop: "0.3mm solid #d1d5db", paddingTop: "3mm" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={label}>Terms &amp; Conditions</div>
                  <div style={{ fontSize: 7.5, color: "#374151", lineHeight: 1.6, marginTop: 2 }}>
                    <div>• Warranty is valid only with this invoice.</div>
                    <div>• Physical, liquid and burn damage are not covered.</div>
                    <div>• Goods once sold are not refundable after 7 days.</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 12, marginTop: "2mm" }}>
                    <div style={{ textAlign: "center", flexShrink: 0 }}>
                      <QRCodeSVG value={verifyUrl(invoiceNo)} size={128} level="M" marginSize={0} style={{ width: "19mm", height: "19mm", display: "block" }} />
                      <div style={{ fontSize: 6, fontWeight: 700, marginTop: "0.8mm" }}>Scan to check warranty</div>
                    </div>
                    <div style={{ fontSize: 7.5, color: "#6b7280" }}>
                      Issued by <span style={{ fontWeight: 700, color: "#111827" }}>{cashier || "MANOMOBILE"}</span>
                      <div style={{ marginTop: 1 }}>Thank you for shopping with us!</div>
                    </div>
                  </div>
                </div>
                <div style={{ width: "62mm", flexShrink: 0 }}>
                  {[
                    { k: "Subtotal", v: Rs(subtotal), show: true },
                    { k: "Discount", v: `(${Rs(discount)})`, show: discount > 0 },
                    { k: "Received", v: Rs(received), show: received > 0 },
                    { k: "Change", v: Rs(change), show: received > 0 },
                  ].filter(r => r.show).map(r => (
                    <div key={r.k} style={{ display: "flex", justifyContent: "space-between", fontSize: 8.5, padding: "0.8mm 0", borderBottom: "0.2mm solid #f3f4f6" }}>
                      <span style={{ color: "#6b7280" }}>{r.k}</span>
                      <span>{r.v}</span>
                    </div>
                  ))}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: "1.5mm", padding: "1.8mm 2.5mm", background: "#111827", color: "#fff", printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}>
                    <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.06em" }}>TOTAL</span>
                    <span style={{ fontSize: 12, fontWeight: 900 }}>{Rs(total)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
