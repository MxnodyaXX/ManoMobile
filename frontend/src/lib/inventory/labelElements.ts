"use client";

/**
 * Label canvas elements.
 *
 * A label design is an ordered list of boxes positioned in millimetres from
 * the top-left of the label. Millimetres, not pixels, because the thing being
 * designed is physical: 50 x 25mm stock has to render identically in the
 * editor at 8px/mm and on a 203dpi thermal printer, and only a physical unit
 * survives that trip.
 */

export type LabelElementType = "text" | "image" | "barcode" | "line";

interface BaseElement {
  id: string;
  type: LabelElementType;
  /** Millimetres from the label's top-left corner. */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface TextElement extends BaseElement {
  type: "text";
  /** May contain {{tokens}} — see LABEL_TOKENS. */
  text: string;
  fontSize: number;   // pt
  bold: boolean;
  align: "left" | "center" | "right";
  color: string;
}

export interface ImageElement extends BaseElement {
  type: "image";
  /** A path under /public, or a data: URI for an uploaded image. */
  src: string;
}

export interface BarcodeElement extends BaseElement {
  type: "barcode";
  showText: boolean;
  fontSize: number;
}

export interface LineElement extends BaseElement {
  type: "line";
  color: string;
}

export type LabelElement = TextElement | ImageElement | BarcodeElement | LineElement;

/**
 * What {{tokens}} resolve to at print time. The label is designed once and
 * printed for every job, so anything job-specific has to be a token rather
 * than typed in.
 */
export interface LabelData {
  code: string;
  jobId?: string;
  customer?: string;
  device?: string;
  imei?: string;
  title?: string;
  subtitle?: string;
  date?: string;
  shopName: string;
  shopPhone: string;
  shopAddress: string;
}

export const LABEL_TOKENS: { token: string; label: string }[] = [
  { token: "{{jobId}}",       label: "Job number" },
  { token: "{{code}}",        label: "Barcode value" },
  { token: "{{customer}}",    label: "Customer name" },
  { token: "{{device}}",      label: "Device brand & model" },
  { token: "{{imei}}",        label: "IMEI" },
  { token: "{{date}}",        label: "Today's date" },
  { token: "{{shopName}}",    label: "Shop name" },
  { token: "{{shopPhone}}",   label: "Shop phone" },
  { token: "{{shopAddress}}", label: "Shop address" },
];

/**
 * Substitute tokens. Unknown tokens are left as written rather than blanked:
 * a typo showing as {{cusomter}} on the preview is a bug you can see, whereas
 * an empty gap looks like a label that simply has no customer.
 */
export function resolveTokens(text: string, data: LabelData): string {
  const map: Record<string, string | undefined> = {
    jobId: data.jobId,
    code: data.code,
    customer: data.customer,
    device: data.device,
    imei: data.imei,
    title: data.title,
    subtitle: data.subtitle,
    date: data.date,
    shopName: data.shopName,
    shopPhone: data.shopPhone,
    shopAddress: data.shopAddress,
  };
  return text.replace(/\{\{(\w+)\}\}/g, (whole, key: string) =>
    key in map ? (map[key] ?? "") : whole,
  );
}

let seq = 0;
const newId = () => `el-${Date.now().toString(36)}-${(seq++).toString(36)}`;

/** A sensible starting box for each type, placed at the top-left. */
export function blankElement(type: LabelElementType, label: { w: number; h: number }): LabelElement {
  const base = { id: newId(), x: 2, y: 2 };
  switch (type) {
    case "text":
      return { ...base, type, w: Math.min(24, label.w - 4), h: 4, text: "New text", fontSize: 8, bold: false, align: "left", color: "#000000" };
    case "image":
      return { ...base, type, w: 10, h: 10, src: "/ManoMobileBlack.png" };
    case "barcode":
      return { ...base, type, w: Math.min(34, label.w - 4), h: 10, showText: true, fontSize: 8 };
    case "line":
      return { ...base, type, w: Math.min(34, label.w - 4), h: 0.3, color: "#000000" };
  }
}

/** Keep a box inside the label. Dragging something off the edge silently
 *  loses it at print time, since the label clips. */
export function clampElement<T extends LabelElement>(el: T, label: { w: number; h: number }): T {
  const w = Math.max(1, Math.min(el.w, label.w));
  const h = Math.max(el.type === "line" ? 0.1 : 1, Math.min(el.h, label.h));
  return {
    ...el,
    w,
    h,
    x: Math.max(0, Math.min(el.x, label.w - w)),
    y: Math.max(0, Math.min(el.y, label.h - h)),
  };
}

/**
 * Copy a design onto another label.
 *
 * Ids are regenerated so the two designs stay independent — without that,
 * editing the copy and the original in the same session can end up keyed
 * against the same element.
 *
 * `scaleToFit` matters whenever the two labels are different stock. A design
 * laid out for 50x25 dropped onto 38x25 unscaled loses everything past 38mm,
 * silently, because the label clips. Scaling stretches each axis by its own
 * ratio; font sizes take the smaller of the two so text never outgrows its box.
 * Unscaled, boxes are clamped inside the label instead, which keeps sizes
 * exact at the cost of moving anything that overhung the edge.
 */
export function copyDesign(
  elements: LabelElement[],
  from: { w: number; h: number },
  to: { w: number; h: number },
  scaleToFit: boolean,
): LabelElement[] {
  const sx = from.w > 0 ? to.w / from.w : 1;
  const sy = from.h > 0 ? to.h / from.h : 1;
  const sFont = Math.min(sx, sy);
  const round = (v: number) => Math.round(v * 2) / 2;

  return elements.map(el => {
    const copy = { ...el, id: newId() } as LabelElement;

    if (scaleToFit) {
      copy.x = round(el.x * sx);
      copy.y = round(el.y * sy);
      copy.w = round(el.w * sx);
      copy.h = round(el.h * sy);
      if (copy.type === "text" || copy.type === "barcode") {
        copy.fontSize = Math.max(4, Math.round(copy.fontSize * sFont * 10) / 10);
      }
    }
    return clampElement(copy, to);
  });
}

export function isLabelElement(v: unknown): v is LabelElement {
  if (typeof v !== "object" || v === null) return false;
  const e = v as Partial<LabelElement>;
  return typeof e.id === "string"
    && (e.type === "text" || e.type === "image" || e.type === "barcode" || e.type === "line")
    && typeof e.x === "number" && typeof e.y === "number"
    && typeof e.w === "number" && typeof e.h === "number";
}

/** Rows come back as untyped jsonb; drop anything malformed rather than
 *  letting it reach a renderer that assumes the shape. */
export function parseElements(v: unknown): LabelElement[] {
  return Array.isArray(v) ? v.filter(isLabelElement) : [];
}
