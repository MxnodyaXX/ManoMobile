"use client";

import { DEFAULT_FONT_FAMILY } from "@/lib/fonts";

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
  /** A FONT_OPTIONS value (lib/fonts.ts). Absent on elements saved before this
   *  existed — render with DEFAULT_FONT_FAMILY when so. */
  fontFamily?: string;
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
  /** The job number on the originating dealer's own docket, when the device
   *  came from another shop. Blank for Mano Mobile's own jobs — same rule
   *  RepairJob.dealerJobNo already follows, so this token is naturally empty
   *  on our own jobs without any extra logic. */
  dealerJobNo?: string;
  customer?: string;
  device?: string;
  imei?: string;
  /** Last 6 digits of the IMEI — the full 15 digits rarely fit legibly on a
   *  small stock label, but the tail is usually enough to match a phone in
   *  hand against the row on screen. Derived from `imei`, not a separate
   *  input anywhere the data comes from. */
  imeiShort?: string;
  /** Selling price, formatted (e.g. "Rs. 45,000") — not a bare number, so a
   *  design can drop {{price}} straight into text without its own currency
   *  formatting. */
  price?: string;
  /** Just the device's own name/model (e.g. "Galaxy S21"), as opposed to
   *  {{device}} which already carries brand + name together. */
  deviceName?: string;
  modelNumber?: string;
  /** What the device came in for — RepairJob.issue. On a tag sitting on the
   *  bench this is the one thing a technician cannot work out by looking at
   *  the phone, so it earns its place beside the job number. */
  fault?: string;
  /** The unlock code left with the device, when one was. Blank otherwise —
   *  so a design that prints it prints nothing for a device without one. */
  passcode?: string;
  title?: string;
  subtitle?: string;
  date?: string;
  shopName: string;
  shopPhone: string;
  shopAddress: string;
}

/**
 * `layouts` names which label kinds a token means something on — e.g.
 * {{fault}} and {{passcode}} exist for a repair job tag sitting on a bench,
 * not a phone sitting in stock. Omitted entirely (undefined) means every
 * layout: {{code}}/{{date}}/the shop fields resolve the same way regardless
 * of what's being labelled, so there's nothing layout-specific to restrict.
 *
 * Plain strings rather than importing BarcodeLayout from barcodeTemplates.ts:
 * that file already imports LabelElement from here, and importing back would
 * make the two files depend on each other.
 */
export const LABEL_TOKENS: { token: string; label: string; layouts?: string[] }[] = [
  { token: "{{jobId}}",       label: "Job number", layouts: ["repair"] },
  { token: "{{dealerJobNo}}", label: "Dealer's job number", layouts: ["repair"] },
  { token: "{{code}}",        label: "Barcode value" },
  { token: "{{customer}}",    label: "Customer name", layouts: ["repair"] },
  { token: "{{device}}",      label: "Device brand & model", layouts: ["repair", "device"] },
  { token: "{{imei}}",        label: "IMEI", layouts: ["repair", "device"] },
  { token: "{{imeiShort}}",   label: "IMEI (last 6 digits)", layouts: ["device"] },
  { token: "{{price}}",       label: "Selling price", layouts: ["device"] },
  { token: "{{deviceName}}",  label: "Device name", layouts: ["device"] },
  { token: "{{modelNumber}}", label: "Model number", layouts: ["device"] },
  { token: "{{fault}}",       label: "Reported fault", layouts: ["repair"] },
  { token: "{{passcode}}",    label: "Device passcode", layouts: ["repair"] },
  { token: "{{title}}",       label: "Item title", layouts: ["device", "accessory", "part", "simple"] },
  { token: "{{subtitle}}",    label: "Item subtitle", layouts: ["device", "accessory", "part", "simple"] },
  { token: "{{date}}",        label: "Today's date" },
  { token: "{{shopName}}",    label: "Shop name" },
  { token: "{{shopPhone}}",   label: "Shop phone" },
  { token: "{{shopAddress}}", label: "Shop address" },
];

/** The tokens that actually mean something for one layout — every layout-less
 *  (universal) token, plus whichever tagged ones name this layout. */
export function tokensForLayout(layout: string): { token: string; label: string }[] {
  return LABEL_TOKENS.filter(t => !t.layouts || t.layouts.includes(layout));
}

/**
 * Substitute tokens. Unknown tokens are left as written rather than blanked:
 * a typo showing as {{cusomter}} on the preview is a bug you can see, whereas
 * an empty gap looks like a label that simply has no customer.
 */
export function resolveTokens(text: string, data: LabelData): string {
  const map: Record<string, string | undefined> = {
    jobId: data.jobId,
    dealerJobNo: data.dealerJobNo,
    code: data.code,
    customer: data.customer,
    device: data.device,
    imei: data.imei,
    imeiShort: data.imeiShort,
    price: data.price,
    deviceName: data.deviceName,
    modelNumber: data.modelNumber,
    fault: data.fault,
    passcode: data.passcode,
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
      return { ...base, type, w: Math.min(24, label.w - 4), h: 4, text: "New text", fontSize: 8, bold: false, align: "left", color: "#000000", fontFamily: DEFAULT_FONT_FAMILY };
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
