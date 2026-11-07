"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import Barcode from "react-barcode";
import { barcodeClearArea } from "@/lib/inventory/barcodeArea";
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
      {elements.map(drawn => {
        const el = drawn.type === "barcode" ? { ...drawn, ...barcodeClearArea(drawn, elements) } : drawn;
        return (
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
        );
      })}
    </div>
  );
}

/**
 * Holds a barcode at the height its box was drawn. A code too long for the box
 * gets squeezed to fit, and an SVG keeps its proportions by default, so a long
 * SKU came out a fraction of the height of the short sample in the editor. Only
 * the width has to give: a barcode's bars carry nothing in their height, and tall
 * bars are what make it easy to scan.
 *
 * Set on the element rather than passed in because react-barcode offers no prop
 * for it. The attribute is part of the markup, so it reaches the printed copy.
 */
function BarcodeBox({ children }: { children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    box.current?.querySelector("svg")?.setAttribute("preserveAspectRatio", "none");
  });
  return (
    <div ref={box} style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
      {children}
    </div>
  );
}

const PT_TO_MM = 25.4 / 72;
const LINE_HEIGHT = 1.15;
// Below this a label's text can't be read, so it clips rather than shrinks further.
const MIN_TEXT_SCALE = 0.55;

/**
 * Text that stays whole inside its box. A real value can be far longer than the
 * sample it was designed with: a long SKU wrapped onto a second line its box had
 * no room for, and the first line was lost behind whatever sat above it. A box
 * only tall enough for one line now stays on one line, and anything too big
 * shrinks to fit. The size is set on the element, so the printed copy has it too.
 */
function FittedText({ el, text }: { el: Extract<LabelElement, { type: "text" }>; text: string }) {
  const box = useRef<HTMLDivElement>(null);
  const oneLine = el.h < el.fontSize * PT_TO_MM * LINE_HEIGHT * 2;
  useLayoutEffect(() => {
    const node = box.current;
    if (!node) return;
    let scale = 1;
    node.style.fontSize = `${el.fontSize}pt`;
    const tooBig = () => node.scrollWidth > node.clientWidth + 0.5 || node.scrollHeight > node.clientHeight + 0.5;
    while (tooBig() && scale > MIN_TEXT_SCALE) {
      scale -= 0.05;
      node.style.fontSize = `${el.fontSize * scale}pt`;
    }
  });
  return (
    <div ref={box} style={{
      width: "100%", height: "100%",
      display: "flex", alignItems: "center",
      justifyContent: el.align === "center" ? "center" : el.align === "right" ? "flex-end" : "flex-start",
      fontSize: `${el.fontSize}pt`,
      fontWeight: el.bold ? 800 : 500,
      color: el.color,
      fontFamily: el.fontFamily ?? DEFAULT_FONT_FAMILY,
      lineHeight: LINE_HEIGHT,
      textAlign: el.align,
      overflow: "hidden",
      // Long customer names must not push the box wider and shove the
      // barcode off the label; they fit or clip at the box edge instead.
      whiteSpace: oneLine ? "pre" : "pre-wrap",
      wordBreak: oneLine ? "normal" : "break-word",
    }}>
      {text}
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
      return <FittedText el={el} text={resolveTokens(el.text, data)} />;
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
      const value = data.barcodeValue || resolveTokens("{{code}}", data) || data.code;
      // EAN-13 only encodes 12-13 digits; anything else falls back so the
      // element renders instead of react-barcode throwing mid-print.
      const usable = format === "EAN13" && !/^\d{12,13}$/.test(value) ? "CODE128" : format;
      const code = usable === "CODE39" ? value.toUpperCase() : value;
      return (
        <BarcodeBox>
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
        </BarcodeBox>
      );
    }

    case "line":
      return <div style={{ width: "100%", height: "100%", background: el.color }} />;
  }
}
