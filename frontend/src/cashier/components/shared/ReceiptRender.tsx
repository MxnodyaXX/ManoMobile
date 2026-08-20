"use client";

import { forwardRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  resolveReceiptTokens,
  type ReceiptElement,
  type ReceiptData,
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
}

const mm = (v: number) => `${v}mm`;
const money = (v: string) => (v.trim() ? `Rs. ${v}` : "—");

const ReceiptRender = forwardRef<HTMLDivElement, ReceiptRenderProps>(function ReceiptRender(
  { elements, data, widthMm, heightMm, scale = 1 }, ref,
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
          <ElementBody el={el} data={data} />
        </div>
      ))}
    </div>
  );
});

export default ReceiptRender;

function ElementBody({ el, data }: { el: ReceiptElement; data: ReceiptData }) {
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

    case "qr": {
      const value = resolveReceiptTokens(el.value, data) || data.trackUrl;
      // A square QR centred in whatever box it was given — a QR stretched to
      // a non-square box just stops scanning.
      const sizePx = Math.max(16, Math.min(el.w, el.h) * (96 / 25.4));
      return (
        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <QRCodeSVG value={value || " "} size={sizePx} level="M" />
        </div>
      );
    }

    case "table": {
      const th: React.CSSProperties = {
        padding: "1.2mm 1.6mm", border: `0.2mm solid ${el.borderColor}`, fontWeight: 700,
        textAlign: "left", whiteSpace: "nowrap", fontSize: `${el.fontSize}pt`,
        background: el.headerBg, color: el.headerColor,
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
  }
}
