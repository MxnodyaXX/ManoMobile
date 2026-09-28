"use client";

import { useEffect, useState, type Ref } from "react";
import { QRCodeSVG } from "qrcode.react";
import { SHOP_DETAILS } from "@/lib/shop";
import ReceiptPagedRender from "@/cashier/components/shared/ReceiptPagedRender";
import { fetchDefaultReceiptTemplate, type ReceiptTemplate } from "@/lib/repair/receiptTemplates";
import type { ReceiptData } from "@/lib/repair/receiptElements";
import { useDealerPortalToken, dealerPortalUrl } from "@/lib/dealer/portal";

/**
 * The branded dealer sales invoice — A5 portrait, paginated.
 *
 * Replaces what used to be a plain "SALES INVOICE" heading over a bare table.
 * The design comes from six reference images the shop supplied
 * (src/InvopiceHeader.png, Customer_Dealer.png, JobNumberDateCreateBy.png,
 * ColumnHeaders.png, FinalAMountBottom.png, Footer.png) — recreated here as
 * real HTML rather than dropped in as raster images, because every one of
 * them except the footer carries a value that changes per invoice (dealer
 * name, invoice number, job rows, amounts) and a PNG can't hold a blank for
 * that. Only Footer.png is used as an actual image (public/DealerInvoiceFooter.png):
 * it never changes, and its diagonal shapes aren't worth re-deriving in CSS.
 *
 * Pagination is done here, not left to the browser's page-break engine,
 * because the rule is asymmetric: the header band repeats on every page, the
 * dealer/invoice-number block only belongs on the first, and the totals +
 * footer only belong on the last — plain CSS page-break properties can't
 * express "this repeats, that doesn't, this other thing only shows once at
 * the very end." So the row list is split into fixed-size chunks in
 * JavaScript and each chunk becomes its own fixed A5-sized page.
 *
 * The row counts below are computed from estimated band heights (this
 * shop's printer was not available to test against), not measured off a
 * real print. If a real invoice under- or over-fills a page, adjust
 * ROWS_PER_PAGE_* to match.
 */

/** One repair on the invoice. CompletedRepair in Repair Sales satisfies this
 *  (it carries more fields than this interface asks for, which is fine). */
export interface InvoiceRepairLine {
  id: string;
  /** Not shown on the dealer invoice itself — kept here because
   *  RepairInvoicePrintable's in-house (JobIssuePrintable) branch, which
   *  shares this same line type, still needs them. */
  dealer: string;
  customerName: string;
  advance: number;
  dealerJobNo?: string;
  brand: string;
  model: string;
  imei: string;
  issue: string;
  technician: string;
  techRemarks?: string;
  warranty: string;
  unitPrice: number;
  discount: number;
  /** A Cash Return prints as a negative line for this amount instead of the
   *  usual unit price / discount pair. */
  cashReturnAmount?: number;
}

/** A non-repair line (an accessory sold alongside the repairs) folded into
 *  the same table — the mockup's table has no second section for these, so
 *  they get a row of their own rather than going missing from the bill. */
export interface DealerInvoiceExtraLine {
  id: string;
  name: string;
  lineTotal: number;
}

export interface DealerInvoiceProps {
  invoiceNo: string;
  createdAt: string;
  dealerName: string;
  dealerAddress?: string;
  dealerContact?: string;
  repairs: InvoiceRepairLine[];
  extras?: DealerInvoiceExtraLine[];
  paidAmount: number;
  dueAmount: number;
  ref?: Ref<HTMLDivElement>;
  /** The dealer billed — used to put their portal link in the QR code. */
  dealerId?: number | null;
  /** Open this invoice on the portal. False for a single-job slip whose
   *  "invoice number" is really a job number. Default true. */
  linkInvoice?: boolean;
  /** Filled in by the wrapper below; what the QR encodes. */
  qrValue?: string;
}

export const DEALER_INVOICE_PAGE_CSS = "@page { size: A5 portrait; margin: 0; }";

// ── Page geometry (mm) — see the file comment above ─────────────────────────
const PAGE_W = 148;
const PAGE_H = 210;
const PAD_X = 9;
const PAD_TOP = 7;
const PAD_BOTTOM = 7;

// Estimated row capacity per page kind — tune against a real print. Two fewer
// than before since the header QR grew to 18mm so phones can scan it.
const ROWS_PAGE1_FULL = 14; // first page, more pages follow
const ROWS_PAGE1_LAST = 10; // first page, and also the last (short invoice)
const ROWS_OTHER_FULL = 17; // a continuation page, more pages follow
const ROWS_OTHER_LAST = 13; // a continuation page that is also the last

type Row = { kind: "repair"; r: InvoiceRepairLine } | { kind: "extra"; e: DealerInvoiceExtraLine };

function paginate(rows: Row[]): Row[][] {
  const pages: Row[][] = [];
  let i = 0;
  let pageIndex = 0;
  while (i < rows.length) {
    const isFirst = pageIndex === 0;
    const full = isFirst ? ROWS_PAGE1_FULL : ROWS_OTHER_FULL;
    const take = Math.min(full, rows.length - i);
    pages.push(rows.slice(i, i + take));
    i += take;
    pageIndex++;
  }
  // The page that ended up last needs room for the totals + footer band,
  // which is smaller than a plain content page — if what landed there
  // doesn't fit the reduced capacity, spill the excess onto one more page.
  const lastCap = pages.length === 1 ? ROWS_PAGE1_LAST : ROWS_OTHER_LAST;
  const last = pages[pages.length - 1];
  if (last.length > lastCap) {
    const overflow = last.splice(lastCap);
    pages.push(overflow);
  }
  return pages;
}

const Rs = (n: number) => `Rs. ${Math.abs(n).toLocaleString("en-LK", { minimumFractionDigits: 2 })}`;

/** The logo + "INVOICE / ISSUED JOB RECEIPT" banner — every page. */
function HeaderBand({ qrValue }: { qrValue: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={SHOP_DETAILS.logo} alt="" style={{ height: 26, width: "auto" }} />
        <div>
          <div style={{ fontSize: 15, fontWeight: 900, letterSpacing: "-0.01em", lineHeight: 1 }}>
            {SHOP_DETAILS.name.toUpperCase()}
          </div>
          <div style={{ fontSize: 7, fontWeight: 700, color: "#555", letterSpacing: "0.04em", marginTop: 2 }}>
            {SHOP_DETAILS.tagline.toUpperCase()}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 17, fontWeight: 900, letterSpacing: "0.02em", lineHeight: 1 }}>INVOICE</div>
          <div style={{ fontSize: 8, fontWeight: 800, color: "#c0392b", letterSpacing: "0.03em", marginTop: 2 }}>ISSUED JOB RECEIPT</div>
        </div>
        <div style={{ width: 1, height: 44, background: "#ccc" }} />
        <div style={{ textAlign: "center" }}>
          {/* 16mm and error level L: the portal link is ~90 characters, and in
              the old 8mm box its modules were too fine for a phone camera. */}
          <div style={{ border: "1px solid #000", borderRadius: 3, padding: "1mm", width: "18mm", height: "18mm", boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center", background: "#fff" }}>
            <QRCodeSVG value={qrValue} size={96} level="L" style={{ width: "16mm", height: "16mm" }} />
          </div>
          <div style={{ fontSize: 5.5, fontWeight: 700, marginTop: 1, lineHeight: 1.15, maxWidth: "18mm" }}>Scan for job details</div>
        </div>
      </div>
    </div>
  );
}

/** Dealer name/contact + invoice number/date boxes — first page only. */
function DealerAndMetaBlock({ dealerName, dealerAddress, dealerContact, invoiceNo, createdAt }: {
  dealerName: string; dealerAddress?: string; dealerContact?: string; invoiceNo: string; createdAt: string;
}) {
  const boxTd: React.CSSProperties = { border: "1px solid #000", padding: "3px 8px", fontSize: 8.5, fontWeight: 700 };
  const labelTd: React.CSSProperties = { padding: "3px 6px 3px 0", fontSize: 8, fontWeight: 700, textAlign: "right", whiteSpace: "nowrap" };
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginTop: 8 }}>
      <div>
        <div style={{ fontSize: 9, fontWeight: 900, color: "#c0392b", letterSpacing: "0.04em" }}>DEALER</div>
        <div style={{ fontSize: 10, fontWeight: 900, marginTop: 2 }}>Name : {dealerName}</div>
        <div style={{ fontSize: 10, fontWeight: 900, marginTop: 1 }}>Contact : {dealerContact || "—"}</div>
        {dealerAddress && <div style={{ fontSize: 7.5, color: "#555", marginTop: 1 }}>{dealerAddress}</div>}
      </div>
      <table style={{ borderCollapse: "collapse" }}>
        <tbody>
          <tr>
            <td style={labelTd}>INVOICE NUMBER :</td>
            <td style={boxTd}>{invoiceNo}</td>
          </tr>
          <tr>
            <td style={labelTd}>DATE &amp; CREATED BY :</td>
            <td style={boxTd}>{createdAt} | MANOMOBILE</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

const COLS = ["No.", "Device Model / IMEI", "Fault Type", "Technician", "Warranty", "Final Amount", "Technician Remarks"];
const COL_WIDTHS = ["6%", "24%", "16%", "13%", "12%", "13%", "16%"];

function TableHead() {
  const th: React.CSSProperties = { color: "#fff", fontWeight: 800, fontSize: 7.5, padding: "4px 5px", textAlign: "left", whiteSpace: "nowrap" };
  return (
    <thead>
      <tr style={{ background: "#c0392b" }}>
        {COLS.map((c, i) => (
          <th key={c} style={{ ...th, width: COL_WIDTHS[i], textAlign: c === "Final Amount" ? "right" : "left" }}>{c}</th>
        ))}
      </tr>
    </thead>
  );
}

function RepairRow({ no, r }: { no: number; r: InvoiceRepairLine }) {
  const back = r.cashReturnAmount ?? 0;
  const lineTotal = back > 0 ? -back : r.unitPrice - r.discount;
  const td: React.CSSProperties = { padding: "3px 5px", fontSize: 7.5, borderBottom: "1px solid #eee", verticalAlign: "top" };
  return (
    <tr>
      <td style={td}>{no}.</td>
      <td style={td}>
        <div style={{ fontWeight: 700 }}>{[r.brand, r.model].filter(Boolean).join(" ") || "—"}</div>
        <div style={{ fontSize: 6.3, color: "#777", marginTop: 1 }}>
          {r.dealerJobNo ? `#${r.dealerJobNo} · ` : ""}{r.id}{r.imei ? ` · IMEI ${r.imei}` : ""}
        </div>
      </td>
      <td style={td}>{back > 0 ? "Cash Return" : (r.issue || "—")}</td>
      <td style={td}>{r.technician || "—"}</td>
      <td style={td}>{back > 0 ? "—" : (r.warranty || "—")}</td>
      <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>{lineTotal < 0 ? `(${Rs(lineTotal)})` : Rs(lineTotal)}</td>
      <td style={{ ...td, maxWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.techRemarks || ""}>
        {r.techRemarks || "—"}
      </td>
    </tr>
  );
}

function ExtraRow({ no, e }: { no: number; e: DealerInvoiceExtraLine }) {
  const td: React.CSSProperties = { padding: "3px 5px", fontSize: 7.5, borderBottom: "1px solid #eee", verticalAlign: "top" };
  return (
    <tr>
      <td style={td}>{no}.</td>
      <td style={td}><div style={{ fontWeight: 700 }}>{e.name}</div></td>
      <td style={td}>Product</td>
      <td style={td}>—</td>
      <td style={td}>—</td>
      <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>{Rs(e.lineTotal)}</td>
      <td style={td}>—</td>
    </tr>
  );
}

/** Paid / Due — the last page only. */
function TotalsBand({ paidAmount, dueAmount }: { paidAmount: number; dueAmount: number }) {
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "2px 0" }}>
        <span style={{ fontSize: 11, fontWeight: 900 }}>PAID AMOUNT</span>
        <span style={{ fontSize: 11, fontWeight: 900 }}>{Rs(paidAmount)}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "4px 8px", marginTop: 4, border: "1.5px solid #c0392b" }}>
        <span style={{ fontSize: 11, fontWeight: 900, color: "#c0392b" }}>DUE AFTER PAYMENT</span>
        <span style={{ fontSize: 11, fontWeight: 900, color: "#c0392b" }}>{Rs(dueAmount)}</span>
      </div>
    </div>
  );
}

/** One physical A5 sheet. */
function Page({ children, isLast }: { children: React.ReactNode; isLast: boolean }) {
  return (
    <div
      style={{
        width: `${PAGE_W}mm`, height: `${PAGE_H}mm`,
        padding: `${PAD_TOP}mm ${PAD_X}mm ${PAD_BOTTOM}mm`,
        boxSizing: "border-box", background: "#fff", color: "#000",
        fontFamily: "Arial, Helvetica, sans-serif",
        display: "flex", flexDirection: "column",
        pageBreakAfter: isLast ? "auto" : "always",
        overflow: "hidden",
      }}
    >
      {children}
    </div>
  );
}

/**
 * What actually prints. Picks up Admin -> Barcode -> Dealer Invoice's default
 * canvas design if one has been built (elements.length > 0); otherwise this
 * falls back to BuiltInDealerInvoice below — the same fallback rule
 * JobIssuePrintable/JobReceiptPrintable use, so drawing nothing in the
 * designer changes nothing about what prints.
 */
export default function DealerInvoicePrintable(props: DealerInvoiceProps) {
  const { invoiceNo, createdAt, dealerName, dealerAddress, dealerContact, repairs, extras = [], paidAmount, dueAmount, ref, dealerId, linkInvoice = true } = props;

  // The dealer's portal — their jobs, this invoice, what they owe. Until the
  // token is known (or with no dealer) the QR is the bare invoice number, as
  // it always was.
  const portalToken = useDealerPortalToken(dealerId);
  const qrValue = portalToken ? dealerPortalUrl(portalToken, linkInvoice ? invoiceNo : undefined) : invoiceNo;

  // undefined = still checking, null = no design to use (fall back), object = use it.
  const [template, setTemplate] = useState<ReceiptTemplate | null | undefined>(undefined);
  useEffect(() => {
    let active = true;
    fetchDefaultReceiptTemplate("dealerInvoice")
      .then(t => { if (active) setTemplate(t && t.elements.length > 0 ? t : null); })
      .catch(() => { if (active) setTemplate(null); });
    return () => { active = false; };
  }, []);

  // A designed template shows once the portal link is known too, so its QR
  // (bound to trackUrl) never prints without it.
  if (template && template.elements.length > 0 && portalToken !== undefined) {
    const headerData: ReceiptData = {
      jobId: "", customer: dealerName, phone: "", address: "", device: "", imei: "",
      estimate: "", advance: "", remarks: "", date: createdAt, createdBy: "MANOMOBILE",
      trackUrl: qrValue, shopName: SHOP_DETAILS.name, shopTagline: SHOP_DETAILS.tagline,
      shopPhone: SHOP_DETAILS.phone, shopEmail: SHOP_DETAILS.email, shopWebsite: SHOP_DETAILS.website,
      shopAddress: SHOP_DETAILS.address, bankName: SHOP_DETAILS.bankName,
      bankAccountNumber: SHOP_DETAILS.bankAccountNumber, bankAccountHolder: SHOP_DETAILS.bankAccountHolder,
      invoiceNo, paidAmount: paidAmount.toLocaleString(), dueAmount: dueAmount.toLocaleString(),
      dueAfterPayment: dueAmount.toLocaleString(),
      dealerName, dealerAddress: dealerAddress ?? "", dealerContact: dealerContact ?? "",
    };

    const rows: ReceiptData[] = [
      ...repairs.map((r): ReceiptData => {
        const back = r.cashReturnAmount ?? 0;
        const net = back > 0 ? -back : r.unitPrice - r.discount;
        return {
          ...headerData,
          jobId: r.id,
          device: [r.brand, r.model].filter(Boolean).join(" "),
          imei: r.imei,
          fault: back > 0 ? "Cash Return" : r.issue,
          technician: r.technician,
          technicianRemarks: r.techRemarks ?? "",
          warranty: back > 0 ? "" : r.warranty,
          estimate: r.unitPrice.toLocaleString(),
          advance: r.advance.toLocaleString(),
          discount: r.discount.toLocaleString(),
          finalAmount: net.toLocaleString(),
          lineTotal: net.toLocaleString(),
        };
      }),
      ...extras.map((e): ReceiptData => ({
        ...headerData,
        jobId: e.id,
        device: e.name,
        fault: "Product",
        finalAmount: e.lineTotal.toLocaleString(),
        lineTotal: e.lineTotal.toLocaleString(),
      })),
    ];

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

  return <BuiltInDealerInvoice {...props} qrValue={qrValue} pending={template === undefined || portalToken === undefined} />;
}

/** The plain built-in layout — what printed before any dealer invoice design
 *  existed, and what still prints for a shop that hasn't opened the designer. */
function BuiltInDealerInvoice({
  invoiceNo, createdAt, dealerName, dealerAddress, dealerContact, repairs, extras = [], paidAmount, dueAmount, ref, pending, qrValue,
}: DealerInvoiceProps & { pending: boolean }) {
  const rows: Row[] = [
    ...repairs.map((r): Row => ({ kind: "repair", r })),
    ...extras.map((e): Row => ({ kind: "extra", e })),
  ];
  const pages = rows.length > 0 ? paginate(rows) : [[]];
  // Where each page's row numbering starts, worked out before rendering.
  const startOf = pages.map((_, i) => pages.slice(0, i).reduce((n, p) => n + p.length, 0) + 1);

  return (
    <div ref={ref} data-template-pending={pending ? "1" : undefined} style={{ background: "#fff" }}>
      {pages.map((chunk, pageIdx) => {
        const isFirst = pageIdx === 0;
        const isLast = pageIdx === pages.length - 1;
        const startNo = startOf[pageIdx];
        return (
          <Page key={pageIdx} isLast={isLast}>
            <HeaderBand qrValue={qrValue ?? invoiceNo} />
            <div style={{ height: 2, background: "linear-gradient(90deg, #c0392b 12%, #000 12%)", marginTop: 6 }} />

            {isFirst && (
              <DealerAndMetaBlock
                dealerName={dealerName} dealerAddress={dealerAddress} dealerContact={dealerContact}
                invoiceNo={invoiceNo} createdAt={createdAt}
              />
            )}

            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: isFirst ? 8 : 10, tableLayout: "fixed" }}>
              <TableHead />
              <tbody>
                {chunk.map((row, i) =>
                  row.kind === "repair"
                    ? <RepairRow key={`r-${row.r.id}`} no={startNo + i} r={row.r} />
                    : <ExtraRow key={`e-${row.e.id}`} no={startNo + i} e={row.e} />,
                )}
                {chunk.length === 0 && (
                  <tr><td colSpan={COLS.length} style={{ padding: "10px 5px", fontSize: 8, color: "#999", textAlign: "center" }}>No items</td></tr>
                )}
              </tbody>
            </table>

            {/* Pushes the closing bands to the bottom of the sheet regardless
                of how few rows this particular page holds. */}
            <div style={{ flex: 1 }} />

            {isLast && <TotalsBand paidAmount={paidAmount} dueAmount={dueAmount} />}
            {isLast && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src="/DealerInvoiceFooter.png" alt=""
                style={{ width: `${PAGE_W}mm`, marginLeft: `-${PAD_X}mm`, marginRight: `-${PAD_X}mm`, marginBottom: `-${PAD_BOTTOM}mm`, marginTop: 8, display: "block" }}
              />
            )}
          </Page>
        );
      })}
    </div>
  );
}
