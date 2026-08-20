"use client";

import { DEFAULT_FONT_FAMILY } from "@/lib/fonts";

/**
 * Job-receipt canvas elements — the same idea as labelElements.ts (an ordered
 * list of boxes placed in millimetres, some containing {{tokens}}), scaled up
 * to a full A5 receipt instead of a small label, plus two kinds a label never
 * needed: a QR code and the priced job-details table.
 */

export type ReceiptElementType = "text" | "image" | "line" | "qr" | "table";

interface BaseElement {
  id: string;
  type: ReceiptElementType;
  /** Millimetres from the receipt content area's top-left corner. */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ReceiptTextElement extends BaseElement {
  type: "text";
  /** May contain {{tokens}} — see RECEIPT_TOKENS. */
  text: string;
  fontSize: number; // pt
  bold: boolean;
  align: "left" | "center" | "right";
  color: string;
  /** A FONT_OPTIONS value (lib/fonts.ts). Absent on elements saved before
   *  this existed — render with DEFAULT_FONT_FAMILY when so. */
  fontFamily?: string;
}

export interface ReceiptImageElement extends BaseElement {
  type: "image";
  /** A path under /public, or a data: URI for an uploaded image. */
  src: string;
}

/**
 * Also doubles as a filled rectangle: a big `h` with a fill `color` is how
 * the brand's coloured header rule / footer band / bank-box background get
 * drawn, the same trick a "line" element already does on the barcode labels.
 */
export interface ReceiptLineElement extends BaseElement {
  type: "line";
  color: string;
}

export interface ReceiptQrElement extends BaseElement {
  type: "qr";
  /** May contain one {{token}} — normally {{trackUrl}}. */
  value: string;
}

/**
 * The job as a priced line, same fields JobReceiptSlip has always printed
 * (Device Model / IMEI / Fault Type / Estimate / Advance / Remarks) — kept as
 * one positionable block rather than free-form cells, since its *content* is
 * real per-job data, not something to hand-design.
 */
export interface ReceiptTableElement extends BaseElement {
  type: "table";
  headerBg: string;
  headerColor: string;
  borderColor: string;
  fontSize: number;
  /** Free-text note shown in the Remarks column — the one cell that isn't a job field. */
  remarks: string;
}

export type ReceiptElement =
  | ReceiptTextElement | ReceiptImageElement | ReceiptLineElement
  | ReceiptQrElement | ReceiptTableElement;

/**
 * What {{tokens}} resolve to at print time. One design serves every job, so
 * anything job- or shop-specific has to be a token rather than typed in.
 */
export interface ReceiptData {
  jobId: string;
  customer: string;
  phone: string;
  address: string;
  device: string;
  modelNumber?: string;
  imei: string;
  fault: string;
  estimate: string;
  advance: string;
  remarks: string;
  technician: string;
  estCompletion: string;
  priority: string;
  itemsReceived: string;
  date: string;
  createdBy: string;
  trackUrl: string;
  shopName: string;
  shopTagline: string;
  shopPhone: string;
  shopEmail: string;
  shopWebsite: string;
  shopAddress: string;
  bankName: string;
  bankAccountNumber: string;
  bankAccountHolder: string;
}

export const RECEIPT_TOKENS: { token: string; label: string }[] = [
  { token: "{{jobId}}",         label: "Job number" },
  { token: "{{customer}}",      label: "Customer name" },
  { token: "{{phone}}",         label: "Customer phone" },
  { token: "{{address}}",       label: "Customer address" },
  { token: "{{device}}",        label: "Device brand & model" },
  { token: "{{imei}}",          label: "IMEI" },
  { token: "{{fault}}",         label: "Fault type" },
  { token: "{{estimate}}",      label: "Estimate" },
  { token: "{{advance}}",       label: "Advance paid" },
  { token: "{{technician}}",    label: "Technician" },
  { token: "{{estCompletion}}", label: "Est. completion" },
  { token: "{{priority}}",      label: "Priority" },
  { token: "{{itemsReceived}}", label: "Items received" },
  { token: "{{date}}",          label: "Date created" },
  { token: "{{createdBy}}",     label: "Created by" },
  { token: "{{shopName}}",      label: "Shop name" },
  { token: "{{shopTagline}}",   label: "Shop tagline" },
  { token: "{{shopPhone}}",     label: "Shop phone" },
  { token: "{{shopEmail}}",     label: "Shop email" },
  { token: "{{shopWebsite}}",   label: "Shop website" },
  { token: "{{shopAddress}}",   label: "Shop address" },
  { token: "{{bankName}}",           label: "Bank name" },
  { token: "{{bankAccountNumber}}",  label: "Bank account number" },
  { token: "{{bankAccountHolder}}",  label: "Bank account holder" },
];

export function resolveReceiptTokens(text: string, data: ReceiptData): string {
  const map = data as unknown as Record<string, string | undefined>;
  return text.replace(/\{\{(\w+)\}\}/g, (whole, key: string) =>
    key in map ? (map[key] ?? "") : whole,
  );
}

let seq = 0;
const newId = () => `re-${Date.now().toString(36)}-${(seq++).toString(36)}`;

/** A sensible starting box for each type, placed at the top-left. */
export function blankReceiptElement(type: ReceiptElementType, page: { w: number; h: number }): ReceiptElement {
  const base = { id: newId(), x: 4, y: 4 };
  switch (type) {
    case "text":
      return { ...base, type, w: Math.min(60, page.w - 8), h: 8, text: "New text", fontSize: 11, bold: false, align: "left", color: "#000000", fontFamily: DEFAULT_FONT_FAMILY };
    case "image":
      return { ...base, type, w: 24, h: 24, src: "/ManoMobileBlack.png" };
    case "line":
      return { ...base, type, w: Math.min(60, page.w - 8), h: 1, color: "#dc2626" };
    case "qr":
      return { ...base, type, w: 24, h: 24, value: "{{trackUrl}}" };
    case "table":
      return { ...base, type, w: Math.min(180, page.w - 8), h: 24, headerBg: "#dc2626", headerColor: "#ffffff", borderColor: "#999999", fontSize: 9, remarks: "" };
  }
}

/** Keep a box inside the receipt's content area. Dragging something off the
 *  edge silently loses it at print time, since the page clips. */
export function clampReceiptElement<T extends ReceiptElement>(el: T, page: { w: number; h: number }): T {
  const w = Math.max(1, Math.min(el.w, page.w));
  const h = Math.max(el.type === "line" ? 0.2 : 1, Math.min(el.h, page.h));
  return {
    ...el,
    w,
    h,
    x: Math.max(0, Math.min(el.x, page.w - w)),
    y: Math.max(0, Math.min(el.y, page.h - h)),
  };
}

/**
 * Rescale every element when the page itself is resized (e.g. switching an
 * existing design from the 190x128mm content area to a full 210x148mm A5
 * sheet after the print margin was removed). Each axis scales by its own
 * ratio; font sizes take the smaller of the two so text never outgrows its
 * box — same approach as copyDesign in labelElements.ts.
 */
export function scaleReceiptElements(
  elements: ReceiptElement[],
  from: { w: number; h: number },
  to: { w: number; h: number },
): ReceiptElement[] {
  const sx = from.w > 0 ? to.w / from.w : 1;
  const sy = from.h > 0 ? to.h / from.h : 1;
  const sFont = Math.min(sx, sy);
  const round = (v: number) => Math.round(v * 2) / 2;

  return elements.map(el => {
    const copy = { ...el } as ReceiptElement;
    copy.x = round(el.x * sx);
    copy.y = round(el.y * sy);
    copy.w = round(el.w * sx);
    copy.h = round(el.h * sy);
    if (copy.type === "text" || copy.type === "table") {
      copy.fontSize = Math.max(4, Math.round(copy.fontSize * sFont * 10) / 10);
    }
    return clampReceiptElement(copy, to);
  });
}

export function isReceiptElement(v: unknown): v is ReceiptElement {
  if (typeof v !== "object" || v === null) return false;
  const e = v as Partial<ReceiptElement>;
  return typeof e.id === "string"
    && (e.type === "text" || e.type === "image" || e.type === "line" || e.type === "qr" || e.type === "table")
    && typeof e.x === "number" && typeof e.y === "number"
    && typeof e.w === "number" && typeof e.h === "number";
}

/** Rows come back as untyped jsonb; drop anything malformed rather than
 *  letting it reach a renderer that assumes the shape. */
export function parseReceiptElements(v: unknown): ReceiptElement[] {
  return Array.isArray(v) ? v.filter(isReceiptElement) : [];
}
