"use client";

import { forwardRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  resolveReceiptTokens,
  type ReceiptElement,
  type ReceiptData,
  type ReceiptInvoiceTableElement,
  INVOICE_COLUMNS, invoiceColumns,
} from "@/lib/repair/receiptElements";
import { DEFAULT_FONT_FAMILY } from "@/lib/fonts";

/**
 * Draws a canvas-designed job receipt. Mirrors LabelRender.tsx: the same
 * component renders the editor preview and the actual print output, so what
 * the designer sees is what comes off the printer.
 */

interface ReceiptRenderProps {
  elements: ReceiptElement[];
  data: ReceiptData;
  widthMm: number;
  heightMm: number;
  /** Editor zoom. 1 = physical size, which is what printing uses. */
  scale?: number;
  /**
   * Multiple rows for the invoiceTable element, e.g. one dealer invoice's
   * worth of jobs on this physical page — see ReceiptPagedRender.tsx, which
   * is what actually splits a job list across pages and calls this once per
   * page with just that page's slice. Absent (the receipt/issue case) means
   * the invoiceTable element prints its usual single row from `data` itself.
   */
  tableRows?: ReceiptData[];
  /** How many rows came before this page's slice — so the "No." column keeps
   *  counting up across pages instead of starting over at 1 on each one. */
  tableRowStart?: number;
}

const mm = (v: number) => `${v}mm`;
const money = (v: string | undefined) => (v && v.trim() ? `Rs. ${v}` : "—");

const ReceiptRender = forwardRef<HTMLDivElement, ReceiptRenderProps>(function ReceiptRender(
  { elements, data, widthMm, heightMm, scale = 1, tableRows, tableRowStart = 0 }, ref,
) {
  return (
    <div
      ref={ref}
      style={{
        position: "relative",
        width: mm(widthMm),
        height: mm(heightMm),
        background: "#fff",
        overflow: "hidden",
        boxSizing: "border-box",
        transform: scale === 1 ? undefined : `scale(${scale})`,
        transformOrigin: "top left",
      }}
    >
      {elements.map(el => (
        <div
          key={el.id}
          style={{
            position: "absolute",
            left: mm(el.x), top: mm(el.y),
            width: mm(el.w), height: mm(el.h),
            overflow: "hidden",
            boxSizing: "border-box",
          }}
        >
          <ElementBody el={el} data={data} tableRows={tableRows} tableRowStart={tableRowStart} />
        </div>
      ))}
    </div>
  );
});

export default ReceiptRender;

function ElementBody({ el, data, tableRows, tableRowStart = 0 }: { el: ReceiptElement; data: ReceiptData; tableRows?: ReceiptData[]; tableRowStart?: number }) {
  switch (el.type) {
    case "text": {
      const text = resolveReceiptTokens(el.text, data);
      return (
        <div style={{
          width: "100%", height: "100%",
          display: "flex", alignItems: "center",
          justifyContent: el.align === "center" ? "center" : el.align === "right" ? "flex-end" : "flex-start",
          fontSize: `${el.fontSize}pt`,
          fontWeight: el.bold ? 800 : 500,
          color: el.color,
          fontFamily: el.fontFamily ?? DEFAULT_FONT_FAMILY,
          lineHeight: 1.2,
          textAlign: el.align,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}>
          {text}
        </div>
      );
    }

    case "image":
      return (
        // eslint-disable-next-line @next/next/no-img-element -- data: URIs and
        // print sizing in mm; next/image adds nothing here and breaks both.
        <img
          src={el.src}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
        />
      );

    case "line":
      return <div style={{ width: "100%", height: "100%", background: el.color }} />;

    case "shape":
      return (
        <div
          style={{
            width: "100%", height: "100%", boxSizing: "border-box",
            background: el.fill || "transparent",
            border: el.stroke && el.strokeWidth > 0 ? `${el.strokeWidth}mm solid ${el.stroke}` : "none",
            borderRadius: el.shape === "ellipse" ? "50%" : `${Math.max(0, el.radius)}mm`,
            // Backgrounds are dropped by default when printing; the design is
            // the point here, so they are forced on the same way the rest of
            // this template's colour is.
            printColorAdjust: "exact",
            WebkitPrintColorAdjust: "exact",
          }}
        />
      );

    case "qr": {
      const value = (resolveReceiptTokens(el.value, data) || data.trackUrl || "").trim();
      // Nothing to encode: print nothing. A QR of a blank space looks exactly
      // like a working code on paper and scans as nothing, which is worse than
      // an empty corner.
      if (!value) return null;
      // A square QR centred in whatever box it was given — a QR stretched to
      // a non-square box just stops scanning.
      const sizePx = Math.max(16, Math.min(el.w, el.h) * (96 / 25.4));
      return (
        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {/* A link (portal / tracking URL) is long; level L keeps its modules
              large enough for a phone camera in a small printed box. The white
              margin is the "quiet zone" a scanner needs to find the code at
              all — without it, a QR drawn edge-to-edge in its box next to a
              border or text often will not scan. */}
          <QRCodeSVG value={value} size={sizePx} level={value.length > 40 ? "L" : "M"} marginSize={2} bgColor="#ffffff" />
        </div>
      );
    }

    case "table": {
      const th: React.CSSProperties = {
        padding: "1.2mm 1.6mm", border: `0.2mm solid ${el.borderColor}`, fontWeight: 700,
        textAlign: "left", whiteSpace: "nowrap", fontSize: `${el.fontSize}pt`,
        background: el.headerBg, color: el.headerColor,
        // Browsers drop backgrounds when printing unless told not to — the
        // header band printed white while the shapes (which already set this)
        // kept their colour.
        printColorAdjust: "exact", WebkitPrintColorAdjust: "exact",
      };
      const td: React.CSSProperties = {
        padding: "1.4mm 1.6mm", border: `0.2mm solid ${el.borderColor}`, fontSize: `${el.fontSize}pt`,
        color: "#000", verticalAlign: "top",
      };
      return (
        <table style={{ width: "100%", height: "100%", borderCollapse: "collapse", tableLayout: "fixed", fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }}>
          <thead>
            <tr>
              <th style={th}>Device Model</th>
              <th style={th}>IMEI</th>
              <th style={th}>Fault Type</th>
              <th style={th}>Estimate</th>
              <th style={th}>Advance Paid</th>
              <th style={th}>Remarks</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={td}>{data.device}{data.modelNumber ? ` (${data.modelNumber})` : ""}</td>
              <td style={{ ...td, fontFamily: "monospace" }}>{data.imei || "—"}</td>
              <td style={td}>{data.fault || "—"}</td>
              <td style={td}>{money(data.estimate)}</td>
              <td style={td}>{money(data.advance)}</td>
              <td style={td}>{resolveReceiptTokens(el.remarks, data) || "—"}</td>
            </tr>
          </tbody>
        </table>
      );
    }

    case "invoiceTable":
      // The issue invoice has always printed its own one row from `data`, and
      // that one row is meant to stretch and fill the box it was given. A
      // dealer invoice hands in the whole page's slice of jobs instead — those
      // rows must stay their natural height regardless of how many happen to
      // land on a page, or a short last page stretches every row on it to
      // fill the space the fuller pages needed, ballooning them for no reason.
      return <InvoiceTableBody el={el} rows={tableRows ?? [data]} fill={!tableRows} startIndex={tableRowStart} />;
  }
}

/**
 * The invoiceTable's header + body rows, on their own — split out so
 * ReceiptPagedRender can render this exact markup a second time, off-screen,
 * to measure how tall a header and a row of real content actually come out.
 * Nothing else in this file knows that measurement happens; the table is
 * simply reused byte-for-byte, so what gets measured is what prints.
 */
export function InvoiceTableBody({ el, rows, fill, startIndex = 0, headerRef, rowRef }: {
  el: ReceiptInvoiceTableElement;
  rows: ReceiptData[];
  /** true inside the normal absolutely-positioned box (fills it); false in
   *  the measuring pass, which needs the table to size to its own content. */
  fill?: boolean;
  /** How many rows came before this slice, so "No." keeps counting across
   *  pages instead of restarting at 1 on every page. */
  startIndex?: number;
  headerRef?: (node: HTMLTableRowElement | null) => void;
  rowRef?: (index: number) => (node: HTMLTableRowElement | null) => void;
}) {
  const th: React.CSSProperties = {
    padding: "1.2mm 1.6mm", border: `0.2mm solid ${el.borderColor}`, fontWeight: 700,
    whiteSpace: "nowrap", fontSize: `${el.fontSize}pt`,
    background: el.headerBg, color: el.headerColor,
    // Keep the header colour on paper — see the receipt table above.
    printColorAdjust: "exact", WebkitPrintColorAdjust: "exact",
  };
  const td: React.CSSProperties = {
    padding: "1.4mm 1.6mm", border: `0.2mm solid ${el.borderColor}`, fontSize: `${el.fontSize}pt`,
    color: "#000", verticalAlign: "top",
  };

  const cols = invoiceColumns(el);
  // Widths are relative weights, so they are normalised here rather than
  // being required to add up to 100 in the editor — a column can be
  // dropped without every remaining width needing to be retyped.
  const total = cols.reduce((n, c) => n + Math.max(1, c.width), 0);

  return (
    <table style={{ width: "100%", height: fill ? "100%" : undefined, borderCollapse: "collapse", tableLayout: "fixed", fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }}>
      <thead>
        <tr ref={headerRef}>
          {cols.map((c, n) => {
            const spec = INVOICE_COLUMNS.find(k => k.id === c.id)!;
            return (
              <th key={`${c.id}-${n}`} style={{ ...th, textAlign: spec.align, width: `${(Math.max(1, c.width) / total) * 100}%` }}>
                {c.label || spec.label}
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {rows.map((rowData, rowIndex) => (
          <tr key={rowIndex} ref={rowRef?.(rowIndex)}>
            {cols.map((c, n) => {
              const spec = INVOICE_COLUMNS.find(k => k.id === c.id)!;
              // "No." is synthesised per catalogue entry as a literal "1" —
              // right for a single-row issue invoice, wrong once there's a
              // real list of rows, where it has to count from the top.
              const raw = c.id === "index" ? String(startIndex + rowIndex + 1) : spec.value(rowData);
              return (
                <td
                  key={`${c.id}-${n}`}
                  style={{
                    ...td,
                    textAlign: spec.align,
                    // The IMEI is read digit by digit off a printed page, so
                    // it keeps the fixed pitch it has always had.
                    fontFamily: c.id === "imei" ? "monospace" : undefined,
                    fontWeight: c.id === "lineTotal" ? 700 : undefined,
                  }}
                >
                  {c.id === "jobId" && rowData.dealerJobNo?.trim() ? (
                    // A dealer's job: their own number is the only one they
                    // look for, so it replaces ours, in bold.
                    <span style={{ fontWeight: 700 }}>{(rowData.dealerJobNo ?? "").trim()}</span>
                  ) : spec.money ? money(raw) : (raw && raw.trim() ? raw : "—")}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
