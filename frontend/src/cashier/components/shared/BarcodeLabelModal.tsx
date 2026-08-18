"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Barcode from "react-barcode";
import { Printer, X, Tag, AlertTriangle } from "lucide-react";
import { useInventory } from "@/cashier/contexts/InventoryContext";
import { printLabelNode } from "@/cashier/utils/printLabel";
import { SHOP_DETAILS } from "@/lib/shop";

const ff = "'Plus Jakarta Sans', sans-serif";
const PX_PER_MM = 96 / 25.4;
const VERTICAL_PAD_MM = 1;
// GS1's practical floor for a still-scannable module width (~0.2mm) and a
// bar height low enough it stops being a usable barcode. Below these we
// stop shrinking even if content still overflows, rather than print
// something no scanner can read.
const MIN_BAR_WIDTH = 0.75;
const MIN_BAR_HEIGHT = 14;

interface BarcodeLabelModalProps {
  /** Value to encode as-is (IMEI, product code, job id...) — no prefix is added here. */
  code: string;
  /** Short line printed above the barcode, e.g. item name or device model. */
  title: string;
  /** Optional short line printed below the barcode, e.g. price or customer name. */
  subtitle?: string;
  /**
   * "repair" prints the job tag that goes on the device: job number and device
   * across the top, barcode in the middle, shop details along the bottom.
   * "simple" (default) is the stock inventory label.
   */
  variant?: "simple" | "repair";
  /** Job number for the repair tag — printed large, top-left. */
  jobId?: string;
  onClose: () => void;
}

/**
 * Print-one-label flow shared by Inventory (devices/accessories) and Repair
 * (job tags). Reads size/format from the admin Barcode settings (Admin →
 * Barcode) so every label in the app comes off the same physical size —
 * the one thing that has to match the label stock loaded in the printer.
 *
 * A barcode must print at true 100% scale — shrinking it in the print
 * dialog compresses the bar widths and can make it unscannable. So rather
 * than hand-calculating how much space title/barcode-text/subtitle take up
 * (react-barcode's own margins don't map cleanly to a formula), this
 * measures what actually rendered and shrinks the bars — never the text —
 * until it fits. Runs for both axes since a narrower label (38mm) can
 * overflow sideways even when a wider one (50mm) had enough slack.
 */
export default function BarcodeLabelModal({ code, title, subtitle, variant = "simple", jobId, onClose }: BarcodeLabelModalProps) {
  const { barcodeSettings: s } = useInventory();
  const labelRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const barcodeWrapRef = useRef<HTMLDivElement>(null);

  /**
   * The repair tag is designed for 50 x 25 mm stock and pins itself to it.
   * Inventory labels still follow Admin -> Barcode, but a job tag that changed
   * shape because someone adjusted a product-label setting would stop fitting
   * the tags on the roll — and that setting currently resets on reload.
   */
  const REPAIR_LABEL = { w: 50, h: 25, margin: 2 };
  const labelW = variant === "repair" ? REPAIR_LABEL.w : s.labelWidthMm;
  const labelH = variant === "repair" ? REPAIR_LABEL.h : s.labelHeightMm;
  const labelMargin = variant === "repair" ? REPAIR_LABEL.margin : s.labelMarginMm;

  const handlePrint = () => {
    if (!labelRef.current) return;
    printLabelNode(labelRef.current, labelW, labelH);
  };

  // EAN-13 only encodes a 12-13 digit numeric value; anything else (an IMEI is
  // 15 digits, most job/product codes have letters) falls back to CODE128 so
  // the barcode still renders instead of react-barcode throwing on a bad value.
  const isNumeric1213 = /^\d{12,13}$/.test(code);
  const format = s.format === "EAN13" && !isNumeric1213 ? "CODE128" : s.format;
  // CODE39 only supports uppercase letters, digits and a few symbols.
  const value = format === "CODE39" ? code.toUpperCase() : code;

  // Roughly a quarter of the label height — big enough to read as a mark
  // rather than a smudge, small enough to leave the barcode its room.
  const logoMm = Math.max(4.5, Math.round(labelH * 0.26 * 10) / 10);

  const availableWidthPx = Math.max(10, (labelW - 2 * labelMargin) * PX_PER_MM);
  const availableHeightPx = Math.max(10, labelH * PX_PER_MM - VERTICAL_PAD_MM * PX_PER_MM * 2);

  // 50x25 leaves roughly 11mm for bars once the header and footer band have
  // taken theirs, so the repair tag opens near that instead of at the 60px
  // inventory default — the loop below still trims from here if it must.
  const startBarHeight = variant === "repair" ? Math.min(s.height, 42) : s.height;

  const [barWidth, setBarWidth] = useState(s.width);
  const [barHeight, setBarHeight] = useState(startBarHeight);
  const [tooTight, setTooTight] = useState(false);
  // How far to pull the subtitle up to sit right under the barcode's own
  // text ("RM-012"), closing the blank line-height/descender space
  // react-barcode reserves below it — measured, not guessed, since it
  // scales with font size and would drift out of sync with a fixed value.
  const [subtitleMarginTop, setSubtitleMarginTop] = useState(0);

  // Inputs changed (new code, different label, different admin defaults) —
  // start over from the configured size and let the measure effect below
  // shrink it again if it doesn't fit.
  useLayoutEffect(() => {
    setBarWidth(s.width);
    setBarHeight(startBarHeight);
    setTooTight(false);
    setSubtitleMarginTop(0);
  }, [s.width, startBarHeight, labelW, labelH, labelMargin, s.showText, s.fontSize, value, format, title, subtitle]);

  // Runs after every render (including ones triggered by its own state
  // updates below), measuring the real DOM and nudging bar width/height down
  // a step at a time until both fit — converges in a couple of renders.
  useLayoutEffect(() => {
    const svg = barcodeWrapRef.current?.querySelector("svg");
    const content = contentRef.current;
    if (!svg || !content) return;

    const actualWidthPx = svg.getBoundingClientRect().width;
    const actualHeightPx = content.getBoundingClientRect().height;
    const widthOverflow = actualWidthPx - availableWidthPx;
    const heightOverflow = actualHeightPx - availableHeightPx;

    let nextWidth = barWidth;
    let nextHeight = barHeight;
    let stuck = false;

    if (widthOverflow > 0.5) {
      if (barWidth <= MIN_BAR_WIDTH) stuck = true;
      else nextWidth = Math.max(MIN_BAR_WIDTH, Math.round(barWidth * (availableWidthPx / actualWidthPx) * 100) / 100);
    }
    if (heightOverflow > 0.5) {
      if (barHeight <= MIN_BAR_HEIGHT) stuck = true;
      // Bar height maps ~1:1 to the SVG's total height, so subtract the
      // overflow directly rather than scaling proportionally.
      else nextHeight = Math.max(MIN_BAR_HEIGHT, Math.floor(barHeight - heightOverflow - 1));
    }

    if (nextWidth !== barWidth) setBarWidth(nextWidth);
    if (nextHeight !== barHeight) setBarHeight(nextHeight);
    setTooTight(stuck && (widthOverflow > 0.5 || heightOverflow > 0.5));

    // Measure the barcode SVG's own drawn content (bars + "RM-012" text)
    // against its full box, so the subtitle can sit exactly 1px under the
    // visible ink instead of guessing how much reserved whitespace to skip.
    if (subtitle) {
      try {
        const svgEl = svg as unknown as SVGSVGElement;
        const bbox = svgEl.getBBox();
        const vb = svgEl.viewBox.baseVal;
        const rectHeight = svgEl.getBoundingClientRect().height;
        if (vb && vb.height > 0 && rectHeight > 0) {
          const scale = rectHeight / vb.height;
          const belowContentPx = (vb.height - (bbox.y + bbox.height)) * scale;
          const nextMargin = Math.round((1 - belowContentPx) * 10) / 10;
          if (Math.abs(nextMargin - subtitleMarginTop) > 0.3) setSubtitleMarginTop(nextMargin);
        }
      } catch {
        // getBBox can throw before the SVG is laid out — next render retries.
      }
    }
  });

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      style={{ position: "fixed", inset: 0, zIndex: 1010, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, width: "min(380px, calc(100vw - 24px))", overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,0.55)" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 18px", borderBottom: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Tag size={15} color="var(--accent)" />
            <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>{variant === "repair" ? "Print Repair Tag" : "Print Barcode Label"}</p>
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={14} />
          </button>
        </div>

        <div style={{ padding: 20, display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: ff, textAlign: "center" }}>
            {variant === "repair"
              ? <>Repair tag: fixed <strong>50 × 25 mm</strong>, 2mm side margin — the size of the job-tag roll.</>
              : <>Label size {labelW} × {labelH} mm, {labelMargin}mm side margin — adjust in Admin → Barcode if it doesn&apos;t match your label stock.</>}
            <br />In the print dialog, keep <strong>Scale: Actual size</strong> — never a custom % (it distorts the bar widths).
          </div>

          {tooTight && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "9px 12px", borderRadius: 8, background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.35)", width: "100%", boxSizing: "border-box" }}>
              <AlertTriangle size={13} color="#fbbf24" style={{ flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontSize: 11, color: "var(--text-secondary)", fontFamily: ff, lineHeight: 1.5 }}>
                This doesn&apos;t reliably fit on a {labelW}×{labelH}mm label — content will still overflow slightly. Try a larger label, a shorter code, or turn off &quot;Show Text Below&quot; in Admin → Barcode.
              </span>
            </div>
          )}

          {/* Rendered at its true physical size, so what's previewed here is what prints. */}
          <div
            ref={labelRef}
            style={{
              width: `${labelW}mm`, height: `${labelH}mm`,
              background: "#fff", border: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: `${VERTICAL_PAD_MM}mm ${labelMargin}mm`, boxSizing: "border-box", overflow: "hidden",
            }}
          >
            {variant === "repair" ? (
              /* Job tag: what a technician needs to identify the device on the
                 bench without opening the system — job number, device, owner —
                 plus the shop details for a customer holding the receipt. */
              <div ref={contentRef} style={{ display: "flex", flexDirection: "column", width: "100%", gap: "0.7mm" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: "#000", fontFamily: ff, letterSpacing: "-0.02em", whiteSpace: "nowrap" }}>
                    {jobId ?? code}
                  </span>
                  <div style={{ textAlign: "right", minWidth: 0 }}>
                    <div style={{ fontSize: 9, fontWeight: 800, color: "#000", fontFamily: ff, lineHeight: 1.15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {title}
                    </div>
                    {subtitle && (
                      <div style={{ fontSize: 6.5, color: "#444", fontFamily: ff, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {subtitle}
                      </div>
                    )}
                  </div>
                </div>

                <div ref={barcodeWrapRef} style={{ display: "flex", justifyContent: "center", width: "100%" }}>
                  <Barcode
                    value={value}
                    format={format}
                    width={barWidth}
                    height={barHeight}
                    fontSize={s.fontSize}
                    displayValue={false}
                    marginTop={0}
                    marginBottom={0}
                    marginLeft={0}
                    marginRight={0}
                  />
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "1.4mm" }}>
                  {/* Sized in mm against the label height, not in pixels: the
                      same tag prints on 25mm and 40mm stock, and a fixed pixel
                      logo looks like a speck on the larger one. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={SHOP_DETAILS.logo}
                    alt=""
                    style={{
                      width: `${logoMm}mm`, height: `${logoMm}mm`,
                      objectFit: "contain", flexShrink: 0,
                    }}
                  />
                  <div style={{ minWidth: 0, lineHeight: 1.3 }}>
                    <div style={{ fontSize: 8, fontWeight: 800, color: "#000", fontFamily: ff }}>{SHOP_DETAILS.name}</div>
                    <div style={{ fontSize: 6.6, color: "#333", fontFamily: ff, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {SHOP_DETAILS.phone}&nbsp;&nbsp;&nbsp;{SHOP_DETAILS.address}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div ref={contentRef} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: "#000", fontFamily: ff, textAlign: "center", lineHeight: 1.2, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {title}
                </div>
                <div ref={barcodeWrapRef}>
                  <Barcode
                    value={value}
                    format={format}
                    width={barWidth}
                    height={barHeight}
                    fontSize={s.fontSize}
                    displayValue={s.showText}
                    marginTop={3}
                    marginBottom={0}
                    marginLeft={2}
                    marginRight={2}
                  />
                </div>
                {subtitle && (
                  <div style={{ fontSize: 8, color: "#333", fontFamily: ff, textAlign: "center", lineHeight: 1.2, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: subtitleMarginTop }}>
                    {subtitle}
                  </div>
                )}
              </div>
            )}
          </div>

          <button
            onClick={handlePrint}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 20px", borderRadius: 8, fontSize: 13, fontWeight: 600, border: "1px solid var(--accent)", background: "var(--accent)", color: "var(--accent-fg)", cursor: "pointer", fontFamily: ff }}
          >
            <Printer size={14} /> {variant === "repair" ? "Print Repair Tag" : "Print Label"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
