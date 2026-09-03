"use client";

import { DEFAULT_FONT_FAMILY } from "@/lib/fonts";

/**
 * Canvas elements shared by the two printable documents built on this system
 * — the job-intake receipt and the job-issue sales invoice (see `kind` in
 * receiptTemplates.ts). Same idea as labelElements.ts (an ordered list of
 * boxes placed in millimetres, some containing {{tokens}}), scaled up to a
 * full page instead of a small label, plus kinds a label never needed: a QR
 * code and two different priced tables (one per document kind).
 */

export type TemplateKind = "receipt" | "issue";

export type ReceiptElementType = "text" | "image" | "line" | "shape" | "qr" | "table" | "invoiceTable";

interface BaseElement {
  id: string;
  type: ReceiptElementType;
  /** Millimetres from the page's content area top-left corner. */
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

/**
 * A drawn shape — the panels, boxes and badges a designed invoice is built out
 * of, as opposed to the rules a `line` already draws.
 *
 * Rectangle and ellipse only. Both are a single CSS box, so they survive the
 * print pipeline exactly as they appear on the canvas; anything needing
 * clip-path or SVG renders differently between the screen preview and the
 * printer, which on a customer-facing document is worse than not offering it.
 *
 * `fill` and `stroke` both accept "" for none, so one element covers an
 * outlined box, a solid block, and a tinted panel with a border.
 */
export interface ReceiptShapeElement extends BaseElement {
  type: "shape";
  shape: "rectangle" | "ellipse";
  /** "" for no fill. */
  fill: string;
  /** "" for no outline. */
  stroke: string;
  /** Millimetres. */
  strokeWidth: number;
  /** Corner radius in mm. Ignored on an ellipse. */
  radius: number;
}

export interface ReceiptQrElement extends BaseElement {
  type: "qr";
  /** May contain one {{token}} — normally {{trackUrl}}. */
  value: string;
}

/**
 * The job as a priced line on the intake receipt (`kind: "receipt"`), same
 * fields JobReceiptSlip has always printed (Device Model / IMEI / Fault Type
 * / Estimate / Advance / Remarks) — kept as one positionable block rather
 * than free-form cells, since its *content* is real per-job data, not
 * something to hand-design.
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

/**
 * The line-item table on the job-issue sales invoice (`kind: "issue"`) —
 * same fields RepairInvoicePreview has always printed (Item type / Item name
 * / IMEI / Warranty / Qty / Advance / Unit price / Discount / Line total).
 * A different, wider set of columns than the receipt's table, hence its own
 * element type rather than overloading "table" with two shapes.
 */
export interface ReceiptInvoiceTableElement extends BaseElement {
  type: "invoiceTable";
  headerBg: string;
  headerColor: string;
  borderColor: string;
  fontSize: number;
  /**
   * Which columns to print, in order, and how wide each one is.
   *
   * Optional, and absent on every design saved before columns were editable.
   * Those keep printing DEFAULT_INVOICE_COLUMNS — the exact ten they were
   * designed around — rather than silently changing shape underneath a shop
   * that had already approved its invoice.
   */
  columns?: InvoiceColumn[];
}

export interface InvoiceColumn {
  /** Which field this column prints. Unknown ids are skipped at render. */
  id: string;
  /** Header text. Seeded from the catalogue label, then editable — a shop
   *  that says "Description" should not be stuck with "Item Name". */
  label: string;
  /** Share of the table width, relative rather than a percentage: the
   *  renderer normalises against the total, so adding or removing a column
   *  never means retyping every other width. */
  width: number;
}

/**
 * Every field a column can print.
 *
 * `value` is the whole of the binding — a column is a name, a formatter and a
 * reader over the same ReceiptData the tokens resolve against, so nothing here
 * can print something a {{token}} could not. The four with no field behind them
 * (row number, item type, item name, quantity) are what the invoice has always
 * synthesised for its single repair line.
 */
export const INVOICE_COLUMNS: {
  id: string;
  label: string;
  align: "left" | "right";
  /** Formatted as currency, and shown as an amount in the editor's preview. */
  money?: boolean;
  value: (d: ReceiptData) => string | undefined;
}[] = [
  { id: "index",       label: "No.",           align: "left",  value: () => "1" },
  { id: "itemType",    label: "Item Type",     align: "left",  value: () => "Repair" },
  { id: "itemName",    label: "Item Name",     align: "left",  value: d => `${d.jobId} ${d.device}`.trim() },
  { id: "jobId",       label: "Job No.",       align: "left",  value: d => d.jobId },
  { id: "device",      label: "Device",        align: "left",  value: d => d.device },
  { id: "modelNumber", label: "Model No.",     align: "left",  value: d => d.modelNumber },
  { id: "imei",        label: "IMEI",          align: "left",  value: d => d.imei },
  { id: "fault",       label: "Fault",         align: "left",  value: d => d.fault },
  { id: "warranty",    label: "Warranty",      align: "left",  value: d => d.warranty },
  { id: "warrantyPeriod", label: "Warranty Period", align: "left", value: d => d.warrantyPeriod },
  { id: "technician",  label: "Technician",    align: "left",  value: d => d.technician },
  { id: "technicianRemarks", label: "Technician Remarks", align: "left", value: d => d.technicianRemarks },
  { id: "remarks",     label: "Remarks",       align: "left",  value: d => d.remarks },
  { id: "completionDate", label: "Completed",  align: "left",  value: d => d.completionDate },
  { id: "date",        label: "Date",          align: "left",  value: d => d.date },
  { id: "qty",         label: "Qty",           align: "right", value: () => "1" },
  { id: "advance",     label: "Advance",       align: "right", money: true, value: d => d.advance },
  { id: "estimate",    label: "Unit Price",    align: "right", money: true, value: d => d.estimate },
  { id: "finalAmount", label: "Final Amount",  align: "right", money: true, value: d => d.finalAmount },
  { id: "discount",    label: "Discount",      align: "right", money: true, value: d => d.discount },
  { id: "lineTotal",   label: "Line Total",    align: "right", money: true, value: d => d.lineTotal },
  { id: "balanceDue",  label: "Balance Due",   align: "right", money: true, value: d => d.balanceDue },
  { id: "amountToBePaid", label: "Amount To Pay", align: "right", money: true, value: d => d.amountToBePaid },
  { id: "paidAmount",  label: "Paid",          align: "right", money: true, value: d => d.paidAmount },
  { id: "dueAmount",   label: "Due",           align: "right", money: true, value: d => d.dueAmount },
  { id: "paymentType", label: "Payment Type",  align: "left",  value: d => d.paymentType },
];

/**
 * The ten columns the invoice printed before any of this was configurable.
 * Their widths reproduce the old layout: No. and Qty were pinned narrow and
 * everything else shared what was left evenly.
 */
export const DEFAULT_INVOICE_COLUMNS: InvoiceColumn[] = [
  { id: "index",     label: "No.",        width: 6 },
  { id: "itemType",  label: "Item Type",  width: 11 },
  { id: "itemName",  label: "Item Name",  width: 11 },
  { id: "imei",      label: "IMEI",       width: 11 },
  { id: "warranty",  label: "Warranty",   width: 11 },
  { id: "qty",       label: "Qty",        width: 8 },
  { id: "advance",   label: "Advance",    width: 11 },
  { id: "estimate",  label: "Unit Price", width: 11 },
  { id: "discount",  label: "Discount",   width: 11 },
  { id: "lineTotal", label: "Line Total", width: 11 },
];

/**
 * The columns to actually print — the element's own, or the original ten when
 * it has none. Emptying the list is treated as "not configured" rather than as
 * a table with no columns, which would print as an empty box nobody meant.
 */
export function invoiceColumns(el: ReceiptInvoiceTableElement): InvoiceColumn[] {
  const chosen = (el.columns ?? []).filter(c => INVOICE_COLUMNS.some(k => k.id === c.id));
  return chosen.length > 0 ? chosen : DEFAULT_INVOICE_COLUMNS;
}

export type ReceiptElement =
  | ReceiptTextElement | ReceiptImageElement | ReceiptLineElement | ReceiptShapeElement
  | ReceiptQrElement | ReceiptTableElement | ReceiptInvoiceTableElement;

/**
 * What {{tokens}} resolve to at print time. One design serves every job, so
 * anything job- or shop-specific has to be a token rather than typed in.
 * A single shared bag for both document kinds — a receipt design simply
 * never uses the issue-only tokens (and vice versa), same as a label design
 * doesn't have to use every LABEL_TOKENS entry either.
 */
export interface ReceiptData {
  jobId: string;
  customer: string;
  phone: string;
  address: string;
  device: string;
  modelNumber?: string;
  imei: string;
  estimate: string;
  advance: string;
  remarks: string;
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
  // ── Job-intake receipt only ──
  fault?: string;
  technician?: string;
  estCompletion?: string;
  priority?: string;
  itemsReceived?: string;
  // ── Job-issue invoice only ──
  invoiceNo?: string;
  nic?: string;
  email?: string;
  warranty?: string;
  /** When the repair itself was finished — set once the job leaves the
   *  technician's hands. */
  completionDate?: string;
  /** The price actually charged, i.e. the job's current cost — kept distinct
   *  from `estimate` (same underlying figure here, but "estimate" reads oddly
   *  on a document printed after the job is already done and being billed). */
  finalAmount?: string;
  technicianRemarks?: string;
  /** Duration + coverage together, e.g. "3 Months — Parts & Labour", from the
   *  canonical warranty record — richer than the plain `warranty` string. */
  warrantyPeriod?: string;
  /** finalAmount − advance, i.e. what's owed before the discount below. */
  balanceDue?: string;
  /** balanceDue − discount, i.e. what's owed before payment is taken. */
  amountToBePaid?: string;
  discount?: string;
  lineTotal?: string;
  paidAmount?: string;
  /** amountToBePaid − paidAmount, same figure `dueAmount` already carries —
   *  exposed under this name too since it's the label used on the printed
   *  page's own breakdown. */
  dueAfterPayment?: string;
  dueAmount?: string;
  paymentType?: string;
  adminApprover?: string;
}

export const RECEIPT_TOKENS: { token: string; label: string; kind?: TemplateKind }[] = [
  { token: "{{jobId}}",         label: "Job number" },
  { token: "{{customer}}",      label: "Customer name" },
  { token: "{{phone}}",         label: "Customer phone" },
  { token: "{{address}}",       label: "Customer address" },
  { token: "{{device}}",        label: "Device brand & model" },
  { token: "{{imei}}",          label: "IMEI" },
  { token: "{{fault}}",         label: "Fault type", kind: "receipt" },
  { token: "{{estimate}}",      label: "Estimate" },
  { token: "{{advance}}",       label: "Advance paid" },
  { token: "{{technician}}",    label: "Technician", kind: "receipt" },
  { token: "{{estCompletion}}", label: "Est. completion", kind: "receipt" },
  { token: "{{priority}}",      label: "Priority", kind: "receipt" },
  { token: "{{itemsReceived}}", label: "Items received", kind: "receipt" },
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
  { token: "{{invoiceNo}}",     label: "Invoice number", kind: "issue" },
  { token: "{{nic}}",           label: "Customer NIC", kind: "issue" },
  { token: "{{email}}",         label: "Customer email", kind: "issue" },
  { token: "{{warranty}}",      label: "Warranty terms", kind: "issue" },
  { token: "{{completionDate}}",    label: "Date of completion", kind: "issue" },
  { token: "{{finalAmount}}",       label: "Final amount", kind: "issue" },
  { token: "{{technicianRemarks}}", label: "Technician remarks", kind: "issue" },
  { token: "{{warrantyPeriod}}",    label: "Warranty period (parts/labour)", kind: "issue" },
  { token: "{{balanceDue}}",        label: "Due amount (before discount)", kind: "issue" },
  { token: "{{amountToBePaid}}",    label: "Amount to be paid (after discount)", kind: "issue" },
  { token: "{{discount}}",      label: "Discount", kind: "issue" },
  { token: "{{lineTotal}}",     label: "Line total (after discount)", kind: "issue" },
  { token: "{{paidAmount}}",    label: "Paid amount", kind: "issue" },
  { token: "{{dueAfterPayment}}",   label: "Due after payment", kind: "issue" },
  { token: "{{dueAmount}}",     label: "Balance due", kind: "issue" },
  { token: "{{paymentType}}",   label: "Payment type (CASH / CREDIT)", kind: "issue" },
  { token: "{{adminApprover}}", label: "Credit approved by", kind: "issue" },
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
    case "shape":
      // Outlined rather than filled by default: a new solid block dropped on a
      // design hides whatever it lands on, and the first thing anybody would do
      // is wonder where their text went.
      return { ...base, type, w: 40, h: 20, shape: "rectangle", fill: "", stroke: "#111111", strokeWidth: 0.3, radius: 0 };
    case "qr":
      return { ...base, type, w: 24, h: 24, value: "{{trackUrl}}" };
    case "table":
      return { ...base, type, w: Math.min(180, page.w - 8), h: 24, headerBg: "#dc2626", headerColor: "#ffffff", borderColor: "#999999", fontSize: 9, remarks: "" };
    case "invoiceTable":
      return { ...base, type, w: Math.min(180, page.w - 8), h: 24, headerBg: "#e0e0e0", headerColor: "#000000", borderColor: "#999999", fontSize: 9 };
  }
}

/** Keep a box inside the page's content area. Dragging something off the
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
    if (copy.type === "text" || copy.type === "table" || copy.type === "invoiceTable") {
      copy.fontSize = Math.max(4, Math.round(copy.fontSize * sFont * 10) / 10);
    }
    return clampReceiptElement(copy, to);
  });
}

/**
 * Copy another template's design onto this one — same idea as copyDesign in
 * labelElements.ts, and usable across kinds (a receipt's logo/header
 * arrangement is exactly the sort of thing worth reusing on the invoice, or
 * back). Fresh ids throughout: editing the copy and the original in the same
 * session must not end up keyed against the same element.
 *
 * `scaleToFit` matters whenever the source and target pages differ — the
 * receipt's 210x148mm A5 sheet and the invoice's ~180x267mm A4 content area
 * are nothing alike. Scaling stretches each axis by its own ratio, with font
 * sizes taking the smaller of the two so text never outgrows its box.
 * Unscaled, boxes are clamped inside the page instead, which keeps sizes
 * exact at the cost of moving anything that overhung the edge.
 */
export function copyReceiptElements(
  elements: ReceiptElement[],
  from: { w: number; h: number },
  to: { w: number; h: number },
  scaleToFit: boolean,
): ReceiptElement[] {
  const sx = from.w > 0 ? to.w / from.w : 1;
  const sy = from.h > 0 ? to.h / from.h : 1;
  const sFont = Math.min(sx, sy);
  const round = (v: number) => Math.round(v * 2) / 2;

  return elements.map(el => {
    const copy = { ...el, id: newId() } as ReceiptElement;
    if (scaleToFit) {
      copy.x = round(el.x * sx);
      copy.y = round(el.y * sy);
      copy.w = round(el.w * sx);
      copy.h = round(el.h * sy);
      if (copy.type === "text" || copy.type === "table" || copy.type === "invoiceTable") {
        copy.fontSize = Math.max(4, Math.round(copy.fontSize * sFont * 10) / 10);
      }
    }
    return clampReceiptElement(copy, to);
  });
}

export function isReceiptElement(v: unknown): v is ReceiptElement {
  if (typeof v !== "object" || v === null) return false;
  const e = v as Partial<ReceiptElement>;
  return typeof e.id === "string"
    && (e.type === "text" || e.type === "image" || e.type === "line" || e.type === "shape" || e.type === "qr" || e.type === "table" || e.type === "invoiceTable")
    && typeof e.x === "number" && typeof e.y === "number"
    && typeof e.w === "number" && typeof e.h === "number";
}

/** Rows come back as untyped jsonb; drop anything malformed rather than
 *  letting it reach a renderer that assumes the shape. */
export function parseReceiptElements(v: unknown): ReceiptElement[] {
  return Array.isArray(v) ? v.filter(isReceiptElement) : [];
}
