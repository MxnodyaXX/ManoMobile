"use client";

import Barcode from "react-barcode";
import {
  resolveTokens,
  type LabelElement,
  type LabelData,
} from "@/lib/inventory/labelElements";
import { DEFAULT_FONT_FAMILY } from "@/lib/fonts";

/**
 * Draws a canvas-designed label.
 *
 * The same component renders the editor preview and the actual print output,
 * so what the designer sees is what comes off the printer — the usual failure
 * of label designers is having two code paths that drift apart.
 *
 * Everything is positioned in mm via CSS, letting the browser do the physical
 * unit conversion for print. `scale` only affects the on-screen editor, where
 * a 50mm label rendered at true size would be too small to drag things around
 * in; at scale 1 the output is exactly life-size.
 */

interface LabelRenderProps {
  elements: LabelElement[];
  data: LabelData;
  widthMm: number;
  heightMm: number;
  format: "CODE128" | "CODE39" | "EAN13";
  barWidth: number;
  /** Editor zoom. 1 = physical size, which is what printing uses. */
  scale?: number;
}

const mm = (v: number) => `${v}mm`;

export default function LabelRender({
  elements, data, widthMm, heightMm, format, barWidth, scale = 1,
}: LabelRenderProps) {
  return (
    <div
      style={{
        position: "relative",
        width: mm(widthMm),
        height: mm(heightMm),
        background: "#fff",
        overflow: "hidden",
        boxSizing: "border-box",
        // Scaling the whole label keeps every child in physical units, so one
        // set of coordinates serves both the editor and the printer.
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
          <ElementBody el={el} data={data} format={format} barWidth={barWidth} />
        </div>
      ))}
    </div>
  );
}

function ElementBody({ el, data, format, barWidth }: {
  el: LabelElement;
  data: LabelData;
  format: LabelRenderProps["format"];
  barWidth: number;
}) {
  switch (el.type) {
    case "text": {
      const text = resolveTokens(el.text, data);
      return (
        <div style={{
          width: "100%", height: "100%",
          display: "flex", alignItems: "center",
          justifyContent: el.align === "center" ? "center" : el.align === "right" ? "flex-end" : "flex-start",
          fontSize: `${el.fontSize}pt`,
          fontWeight: el.bold ? 800 : 500,
          color: el.color,
          fontFamily: el.fontFamily ?? DEFAULT_FONT_FAMILY,
          lineHeight: 1.15,
          textAlign: el.align,
          // Long customer names must not push the box wider and shove the
          // barcode off the label; they clip at the box edge instead.
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

    case "barcode": {
      const value = resolveTokens("{{code}}", data) || data.code;
      // EAN-13 only encodes 12-13 digits; anything else falls back so the
      // element renders instead of react-barcode throwing mid-print.
      const usable = format === "EAN13" && !/^\d{12,13}$/.test(value) ? "CODE128" : format;
      const code = usable === "CODE39" ? value.toUpperCase() : value;
      return (
        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Barcode
            value={code || " "}
            format={usable}
            width={barWidth}
            // react-barcode wants px; the box is in mm, and 1mm = 96/25.4 px
            // at CSS's fixed reference. Text, when shown, takes its own space
            // below the bars, so it comes out of the height rather than
            // overflowing the box.
            height={Math.max(8, (el.h * 96) / 25.4 - (el.showText ? el.fontSize * 1.6 : 0))}
            fontSize={el.fontSize}
            displayValue={el.showText}
            margin={0}
          />
        </div>
      );
    }

    case "line":
      return <div style={{ width: "100%", height: "100%", background: el.color }} />;
  }
}
