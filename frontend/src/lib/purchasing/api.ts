"use client";

import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { fetchAllRows } from "@/lib/supabase/fetchAll";

/**
 * Supplier invoices, purchase batches and supplier payments — the data side of
 * migration 20261021000085. Every write is one RPC (one transaction): a draft
 * is saved, finalised, received and paid through the database functions, never
 * by writing rows from here, so stock, batches and balances can't drift apart.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type InvoiceStatus = "Draft" | "Open" | "Void";
export type PaymentStatus = "Draft" | "Void" | "Paid" | "Partially Paid" | "Unpaid" | "Overdue";
export type ReceivingStatus = "Not received" | "Partially received" | "Received";
export type PayMethod = "Cash" | "Card" | "Bank Transfer" | "Cheque" | "Other";
export type WarrantyStart = "invoice_date" | "received_date" | "sale_date";

export const PAY_METHODS: PayMethod[] = ["Cash", "Bank Transfer", "Cheque", "Card", "Other"];
export const WARRANTY_START_LABEL: Record<WarrantyStart, string> = {
  invoice_date: "From the invoice date",
  received_date: "From the day it's received",
  sale_date: "From the day we sell it",
};

export interface InitialPayment {
  amount: number;
  method: PayMethod;
  paidOn: string;
  reference: string;
  notes: string;
}

export interface PurchaseTrip {
  id: number;
  name: string;
  tripDate: string;
  cost: number;
  notes: string;
}

export interface PurchaseInvoice {
  id: number;
  tripId: number | null;
  tripName: string | null;
  ref: string;
  supplierId: number;
  supplierName: string;
  invoiceNo: string;
  invoiceDate: string;
  dueDate: string | null;
  status: InvoiceStatus;
  itemsSubtotal: number;
  expenses: number;
  discount: number;
  total: number;
  paid: number;
  outstanding: number;
  qtyOrdered: number;
  qtyReceived: number;
  lineCount: number;
  notes: string;
  attachmentPath: string | null;
  attachmentName: string | null;
  initialPayment: InitialPayment | null;
  createdAt: string;
  finalisedAt: string | null;
  voidedAt: string | null;
  voidReason: string | null;
}

/** A product not in the catalogue yet, created when the invoice is finalised. */
export interface NewProductDraft {
  name: string;
  code: string;
  category: string;
  subcategory: string;
  brand: string;
  model: string;
  description: string;
  barcodes: string[];
  minStock: number;
}

/** A repair part not in the catalogue yet, created when the invoice is finalised. */
export interface NewPartDraft {
  name: string;
  sku: string;
  category: string;
  brand: string;
  compatibleWith: string[];
  /** What was typed for the part, e.g. Display. The name is built from it. */
  partWord: string;
  reorderLevel: number;
}

export interface PurchaseItem {
  id: number;
  invoiceId: number;
  productId: number | null;
  newProduct: NewProductDraft | null;
  partId: number | null;
  newPart: NewPartDraft | null;
  description: string;
  qty: number;
  receivedQty: number;
  unitCost: number;
  expectedSellPrice: number;
  discount: number;
  taxPct: number;
  lineTotal: number;
  updateSellingPrice: boolean;
  supplierWarrantyDays: number | null;
  supplierWarrantyStart: WarrantyStart;
  supplierWarrantyNotes: string;
  supplierWarrantyTerms: string;
  customerWarrantyDays: number | null;
  sortOrder: number;
}

export interface Batch {
  id: number;
  batchNo: string;
  productId: number;
  source: "purchase" | "opening" | "adjustment" | "return";
  invoiceId: number | null;
  invoiceItemId: number | null;
  receiptId: number | null;
  supplierId: number | null;
  supplierName: string;
  receivedOn: string;
  qtyReceived: number;
  qtyAvailable: number;
  unitCost: number;
  expectedSellPrice: number | null;
  supplierWarrantyDays: number | null;
  supplierWarrantyStart: string | null;
  supplierWarrantyNotes: string;
  supplierWarrantyTerms: string;
  customerWarrantyDays: number | null;
  status: "Active" | "Depleted" | "Reversed";
  /** Filled where the query joins the invoice. */
  invoiceNo?: string;
}

export interface PartBatch {
  id: number;
  batchNo: string;
  partId: number;
  source: "purchase" | "opening" | "adjustment";
  invoiceId: number | null;
  supplierName: string;
  receivedOn: string;
  qtyReceived: number;
  qtyAvailable: number;
  unitCost: number;
  status: "Active" | "Depleted" | "Reversed";
  invoiceNo?: string;
}

export interface PartMovement {
  id: number;
  partId: number;
  batchId: number | null;
  kind: "purchase" | "opening" | "job" | "adjustment_in" | "adjustment_out" | "reversal";
  qty: number;
  unitCost: number | null;
  note: string;
  createdAt: string;
}

export interface StockMovement {
  id: number;
  productId: number;
  batchId: number | null;
  kind: "purchase" | "opening" | "sale" | "void_return" | "adjustment_in" | "adjustment_out" | "reversal";
  qty: number;
  unitCost: number | null;
  invoiceNo: string | null;
  purchaseInvoiceId: number | null;
  note: string;
  createdAt: string;
}

export interface SupplierPayment {
  id: number;
  ref: string;
  supplierId: number;
  paidOn: string;
  amount: number;
  method: PayMethod;
  reference: string;
  notes: string;
  status: "Valid" | "Voided";
  voidReason: string | null;
  createdAt: string;
  allocations: { invoiceId: number; amount: number }[];
}

export interface Receipt {
  id: number;
  invoiceId: number;
  receivedOn: string;
  note: string;
  createdAt: string;
}

export interface InvoiceEvent {
  id: number;
  action: string;
  detail: string;
  createdAt: string;
}

export interface InvoiceDetail {
  invoice: PurchaseInvoice;
  items: PurchaseItem[];
  batches: Batch[];
  partBatches: PartBatch[];
  receipts: Receipt[];
  payments: SupplierPayment[];
  events: InvoiceEvent[];
}

/** One supplied line with the invoice it came on — "Products supplied". */
export interface SuppliedLine extends PurchaseItem {
  invoiceNo: string;
  invoiceDate: string;
  invoiceStatus: InvoiceStatus;
}

// ── Derived status ────────────────────────────────────────────────────────────

export const today = () => new Date().toISOString().slice(0, 10);

export function paymentStatus(i: Pick<PurchaseInvoice, "status" | "total" | "paid" | "outstanding" | "dueDate">): PaymentStatus {
  if (i.status === "Draft") return "Draft";
  if (i.status === "Void") return "Void";
  if (i.outstanding <= 0.005) return "Paid";
  if (i.dueDate && i.dueDate < today()) return "Overdue";
  return i.paid > 0 ? "Partially Paid" : "Unpaid";
}

export function receivingStatus(i: Pick<PurchaseInvoice, "qtyOrdered" | "qtyReceived">): ReceivingStatus {
  if (i.qtyReceived <= 0) return "Not received";
  return i.qtyReceived >= i.qtyOrdered ? "Received" : "Partially received";
}

export const supplierCode = (id: number) => `SUP-${String(id).padStart(4, "0")}`;

/** Same formula as the database (_purchase_invoice_recalc). */
export function lineTotalOf(l: { qty: number; unitCost: number; discount: number; taxPct: number }): number {
  const base = l.qty * l.unitCost - l.discount;
  return Math.round(base * (1 + l.taxPct / 100) * 100) / 100;
}

export function warrantyText(days: number | null | undefined): string {
  if (days == null) return "—";
  if (days <= 0) return "No warranty";
  if (days % 365 === 0) return `${days / 365} year${days === 365 ? "" : "s"}`;
  if (days % 30 === 0) return `${days / 30} month${days === 30 ? "" : "s"}`;
  return `${days} days`;
}

// ── Row mapping ───────────────────────────────────────────────────────────────

type Row = Record<string, unknown>;
const n = (v: unknown) => Number(v ?? 0);
const nn = (v: unknown) => (v == null ? null : Number(v));
const s = (v: unknown) => (v == null ? "" : String(v));

const toInvoice = (r: Row): PurchaseInvoice => {
  const ip = r.initial_payment as Row | null;
  return {
    id: n(r.id), tripId: nn(r.trip_id), tripName: (r.trip_name as string | null) ?? null,
    ref: s(r.ref), supplierId: n(r.supplier_id), supplierName: s(r.supplier_name),
    invoiceNo: s(r.invoice_no), invoiceDate: s(r.invoice_date), dueDate: (r.due_date as string | null) ?? null,
    status: r.status as InvoiceStatus, itemsSubtotal: n(r.items_subtotal), expenses: n(r.expenses),
    discount: n(r.discount), total: n(r.total), paid: n(r.paid), outstanding: n(r.outstanding),
    qtyOrdered: n(r.qty_ordered), qtyReceived: n(r.qty_received), lineCount: n(r.line_count),
    notes: s(r.notes), attachmentPath: (r.attachment_path as string | null) ?? null,
    attachmentName: (r.attachment_name as string | null) ?? null,
    initialPayment: ip ? {
      amount: n(ip.amount), method: (s(ip.method) || "Cash") as PayMethod, paidOn: s(ip.paid_on) || today(),
      reference: s(ip.reference), notes: s(ip.notes),
    } : null,
    createdAt: s(r.created_at), finalisedAt: (r.finalised_at as string | null) ?? null,
    voidedAt: (r.voided_at as string | null) ?? null, voidReason: (r.void_reason as string | null) ?? null,
  };
};

const toNewProduct = (v: unknown): NewProductDraft | null => {
  if (!v || typeof v !== "object") return null;
  const r = v as Row;
  return {
    name: s(r.name), code: s(r.code), category: s(r.category), subcategory: s(r.subcategory),
    brand: s(r.brand), model: s(r.model), description: s(r.description),
    barcodes: Array.isArray(r.barcodes) ? (r.barcodes as unknown[]).map(String) : [],
    minStock: r.min_stock == null ? 5 : n(r.min_stock),
  };
};

const toNewPart = (v: unknown): NewPartDraft | null => {
  if (!v || typeof v !== "object") return null;
  const r = v as Row;
  return {
    name: s(r.name), sku: s(r.sku), category: s(r.category) || "Other", brand: s(r.brand),
    compatibleWith: Array.isArray(r.compatible_with) ? (r.compatible_with as unknown[]).map(String) : [],
    partWord: s(r.part_word), reorderLevel: r.reorder_level == null ? 5 : n(r.reorder_level),
  };
};

const toPartBatch = (r: Row): PartBatch => ({
  id: n(r.id), batchNo: s(r.batch_no), partId: n(r.part_id), source: r.source as PartBatch["source"],
  invoiceId: nn(r.invoice_id), supplierName: s(r.supplier_name), receivedOn: s(r.received_on),
  qtyReceived: n(r.qty_received), qtyAvailable: n(r.qty_available), unitCost: n(r.unit_cost),
  status: r.status as PartBatch["status"],
  invoiceNo: r.purchase_invoices ? s((r.purchase_invoices as Row).invoice_no) : undefined,
});

const toItem = (r: Row): PurchaseItem => ({
  id: n(r.id), invoiceId: n(r.invoice_id), productId: nn(r.product_id), newProduct: toNewProduct(r.new_product),
  partId: nn(r.part_id), newPart: toNewPart(r.new_part),
  description: s(r.description), qty: n(r.qty), receivedQty: n(r.received_qty), unitCost: n(r.unit_cost),
  expectedSellPrice: n(r.expected_sell_price), discount: n(r.discount), taxPct: n(r.tax_pct),
  lineTotal: n(r.line_total), updateSellingPrice: !!r.update_selling_price,
  supplierWarrantyDays: nn(r.supplier_warranty_days),
  supplierWarrantyStart: (s(r.supplier_warranty_start) || "invoice_date") as WarrantyStart,
  supplierWarrantyNotes: s(r.supplier_warranty_notes), supplierWarrantyTerms: s(r.supplier_warranty_terms),
  customerWarrantyDays: nn(r.customer_warranty_days), sortOrder: n(r.sort_order),
});

const toBatch = (r: Row): Batch => ({
  id: n(r.id), batchNo: s(r.batch_no), productId: n(r.product_id), source: r.source as Batch["source"],
  invoiceId: nn(r.invoice_id), invoiceItemId: nn(r.invoice_item_id), receiptId: nn(r.receipt_id),
  supplierId: nn(r.supplier_id), supplierName: s(r.supplier_name), receivedOn: s(r.received_on),
  qtyReceived: n(r.qty_received), qtyAvailable: n(r.qty_available), unitCost: n(r.unit_cost),
  expectedSellPrice: nn(r.expected_sell_price), supplierWarrantyDays: nn(r.supplier_warranty_days),
  supplierWarrantyStart: (r.supplier_warranty_start as string | null) ?? null,
  supplierWarrantyNotes: s(r.supplier_warranty_notes), supplierWarrantyTerms: s(r.supplier_warranty_terms),
  customerWarrantyDays: nn(r.customer_warranty_days), status: r.status as Batch["status"],
  invoiceNo: r.purchase_invoices ? s((r.purchase_invoices as Row).invoice_no) : undefined,
});

const toPayment = (r: Row): SupplierPayment => ({
  id: n(r.id), ref: s(r.ref), supplierId: n(r.supplier_id), paidOn: s(r.paid_on), amount: n(r.amount),
  method: r.method as PayMethod, reference: s(r.reference), notes: s(r.notes),
  status: r.status as SupplierPayment["status"], voidReason: (r.void_reason as string | null) ?? null,
  createdAt: s(r.created_at),
  allocations: ((r.supplier_payment_allocations as Row[] | null) ?? []).map(a => ({ invoiceId: n(a.invoice_id), amount: n(a.amount) })),
});

const toMovement = (r: Row): StockMovement => ({
  id: n(r.id), productId: n(r.product_id), batchId: nn(r.batch_id), kind: r.kind as StockMovement["kind"],
  qty: n(r.qty), unitCost: nn(r.unit_cost), invoiceNo: (r.invoice_no as string | null) ?? null,
  purchaseInvoiceId: nn(r.purchase_invoice_id), note: s(r.note), createdAt: s(r.created_at),
});

/** Turns "relation does not exist" into what to actually do about it. */
function explain(message: string, code?: string): string {
  if (/purchase_trips|repair_part_batches|repair_part_stock_movements|trip_id|part_id/i.test(message)) {
    return "Repair parts on invoices and trips aren't set up in the database yet — run migration 20261107000095_purchasing_repair_parts_and_trips.sql.";
  }
  if (code === "PGRST205" || code === "42P01" || code === "PGRST202" || /Could not find the (table|function)|does not exist/i.test(message)) {
    return "Supplier purchasing isn't set up in the database yet — run migration 20261021000085_supplier_purchasing.sql.";
  }
  if (code === "42501") return "You don't have permission to record supplier purchases.";
  return message;
}

function check<T>({ data, error }: { data: T | null; error: { message: string; code?: string } | null }): T {
  if (error) throw new Error(explain(error.message, error.code));
  return data as T;
}

const sb = () => getSupabaseBrowserClient();

// ── Reads ─────────────────────────────────────────────────────────────────────

export async function fetchInvoices(supplierId?: number): Promise<PurchaseInvoice[]> {
  if (!isSupabaseConfigured()) return [];
  // Paged: a single read stops at 1,000 invoices (see fetchAllRows).
  try {
    const rows = await fetchAllRows<Row>((from, to) => {
      let q = sb().from("purchase_invoice_summary").select("*");
      if (supplierId) q = q.eq("supplier_id", supplierId);
      return q.order("invoice_date", { ascending: false }).order("id", { ascending: false }).range(from, to);
    });
    return rows.map(toInvoice);
  } catch (e) {
    const err = e as Error & { code?: string };
    throw new Error(explain(err.message, err.code));
  }
}

export async function fetchInvoiceDetail(id: number): Promise<InvoiceDetail> {
  const [inv, items, batches, partBatches, receipts, allocs, events] = await Promise.all([
    sb().from("purchase_invoice_summary").select("*").eq("id", id).single(),
    sb().from("purchase_invoice_items").select("*").eq("invoice_id", id).order("sort_order"),
    sb().from("accessory_batches").select("*").eq("invoice_id", id).order("id"),
    sb().from("repair_part_batches").select("*").eq("invoice_id", id).order("id"),
    sb().from("purchase_receipts").select("*").eq("invoice_id", id).order("id"),
    sb().from("supplier_payment_allocations").select("payment_id").eq("invoice_id", id),
    sb().from("purchase_invoice_events").select("*").eq("invoice_id", id).order("id"),
  ]);
  const paymentIds = check<Row[]>(allocs).map(a => n(a.payment_id));
  const payments = paymentIds.length
    ? check<Row[]>(await sb().from("supplier_payments").select("*, supplier_payment_allocations(invoice_id, amount)").in("id", paymentIds).order("paid_on")).map(toPayment)
    : [];
  return {
    invoice: toInvoice(check<Row>(inv)),
    items: check<Row[]>(items).map(toItem),
    batches: check<Row[]>(batches).map(toBatch),
    // Absent until migration 20261107000095: older invoices still open.
    partBatches: partBatches.error ? [] : ((partBatches.data ?? []) as Row[]).map(toPartBatch),
    receipts: check<Row[]>(receipts).map(r => ({ id: n(r.id), invoiceId: n(r.invoice_id), receivedOn: s(r.received_on), note: s(r.note), createdAt: s(r.created_at) })),
    payments,
    events: check<Row[]>(events).map(e => ({ id: n(e.id), action: s(e.action), detail: s(e.detail), createdAt: s(e.created_at) })),
  };
}

export async function fetchSupplierPayments(supplierId: number): Promise<SupplierPayment[]> {
  return check<Row[]>(await sb().from("supplier_payments")
    .select("*, supplier_payment_allocations(invoice_id, amount)")
    .eq("supplier_id", supplierId).order("paid_on", { ascending: false }).order("id", { ascending: false })).map(toPayment);
}

/** Every line ever bought from this supplier, with its invoice. */
export async function fetchSuppliedLines(supplierId: number): Promise<SuppliedLine[]> {
  const rows = check<Row[]>(await sb().from("purchase_invoice_items")
    .select("*, purchase_invoices!inner(supplier_id, invoice_no, invoice_date, status)")
    .eq("purchase_invoices.supplier_id", supplierId));
  return rows.map(r => {
    const inv = r.purchase_invoices as Row;
    return { ...toItem(r), invoiceNo: s(inv.invoice_no), invoiceDate: s(inv.invoice_date), invoiceStatus: inv.status as InvoiceStatus };
  });
}

export async function fetchBatchesForSupplier(supplierId: number): Promise<Batch[]> {
  return check<Row[]>(await sb().from("accessory_batches").select("*, purchase_invoices(invoice_no)")
    .eq("supplier_id", supplierId).order("received_on", { ascending: false })).map(toBatch);
}

export async function fetchProductBatches(productId: number): Promise<Batch[]> {
  return check<Row[]>(await sb().from("accessory_batches").select("*, purchase_invoices(invoice_no)")
    .eq("product_id", productId).order("received_on", { ascending: false }).order("id", { ascending: false })).map(toBatch);
}

export async function fetchProductMovements(productId: number, limit = 100): Promise<StockMovement[]> {
  return check<Row[]>(await sb().from("accessory_stock_movements").select("*")
    .eq("product_id", productId).order("created_at", { ascending: false }).limit(limit)).map(toMovement);
}

export async function fetchPartBatches(partId: string): Promise<PartBatch[]> {
  return check<Row[]>(await sb().from("repair_part_batches").select("*, purchase_invoices(invoice_no)")
    .eq("part_id", Number(partId)).order("received_on", { ascending: false }).order("id", { ascending: false })).map(toPartBatch);
}

export async function fetchPartMovements(partId: string, limit = 100): Promise<PartMovement[]> {
  return check<Row[]>(await sb().from("repair_part_stock_movements").select("*")
    .eq("part_id", Number(partId)).order("created_at", { ascending: false }).limit(limit)).map(r => ({
      id: n(r.id), partId: n(r.part_id), batchId: nn(r.batch_id), kind: r.kind as PartMovement["kind"],
      qty: n(r.qty), unitCost: nn(r.unit_cost), note: s(r.note), createdAt: s(r.created_at),
    }));
}

export async function fetchTrips(): Promise<PurchaseTrip[]> {
  if (!isSupabaseConfigured()) return [];
  return check<Row[]>(await sb().from("purchase_trips").select("*")
    .order("trip_date", { ascending: false }).order("id", { ascending: false })).map(r => ({
      id: n(r.id), name: s(r.name), tripDate: s(r.trip_date), cost: n(r.cost), notes: s(r.notes),
    }));
}

export async function savePurchaseTrip(t: { id: number | null; name: string; tripDate: string; cost: number; notes: string }): Promise<number> {
  return Number(check(await sb().rpc("save_purchase_trip", {
    p: { id: t.id, name: t.name.trim(), trip_date: t.tripDate, cost: t.cost, notes: t.notes.trim() },
  })));
}

export async function deletePurchaseTrip(id: number): Promise<void> {
  check(await sb().rpc("delete_purchase_trip", { p_id: id }));
}

/**
 * The customer warranty set on the batch each product will sell from next
 * (FIFO: the oldest batch with stock). Products whose next batch sets none are
 * left out — the shop's policy applies to them. Never throws: a till must
 * still sell if this can't be read.
 */
export async function fetchNextBatchCustomerWarranty(productIds: number[]): Promise<Map<number, number>> {
  const out = new Map<number, number>();
  if (!isSupabaseConfigured() || productIds.length === 0) return out;
  try {
    const { data, error } = await sb().from("accessory_batches")
      .select("product_id, customer_warranty_days, received_on, id")
      .in("product_id", productIds).gt("qty_available", 0).neq("status", "Reversed")
      .order("received_on").order("id");
    if (error) return out;
    const seen = new Set<number>();
    for (const r of (data ?? []) as Row[]) {
      const pid = n(r.product_id);
      if (seen.has(pid)) continue;
      seen.add(pid);
      if (r.customer_warranty_days != null) out.set(pid, n(r.customer_warranty_days));
    }
  } catch { /* fall back to policy */ }
  return out;
}

// ── Writes ────────────────────────────────────────────────────────────────────

export interface ItemDraft {
  productId: number | null;
  newProduct: NewProductDraft | null;
  partId: number | null;
  newPart: NewPartDraft | null;
  description: string;
  qty: number;
  unitCost: number;
  expectedSellPrice: number;
  discount: number;
  taxPct: number;
  updateSellingPrice: boolean;
  supplierWarrantyDays: number | null;
  supplierWarrantyStart: WarrantyStart;
  supplierWarrantyNotes: string;
  supplierWarrantyTerms: string;
  customerWarrantyDays: number | null;
}

export interface InvoiceDraft {
  id: number | null;
  tripId: number | null;
  supplierId: number | null;
  invoiceNo: string;
  invoiceDate: string;
  dueDate: string;
  expenses: number;
  discount: number;
  notes: string;
  attachmentPath: string | null;
  attachmentName: string | null;
  initialPayment: InitialPayment | null;
  items: ItemDraft[];
}

export async function savePurchaseInvoice(d: InvoiceDraft): Promise<number> {
  const payload = {
    id: d.id,
    trip_id: d.tripId,
    supplier_id: d.supplierId,
    invoice_no: d.invoiceNo.trim(),
    invoice_date: d.invoiceDate,
    due_date: d.dueDate || null,
    expenses: d.expenses,
    discount: d.discount,
    notes: d.notes,
    attachment_path: d.attachmentPath,
    attachment_name: d.attachmentName,
    initial_payment: d.initialPayment && d.initialPayment.amount > 0 ? {
      amount: d.initialPayment.amount, method: d.initialPayment.method, paid_on: d.initialPayment.paidOn,
      reference: d.initialPayment.reference, notes: d.initialPayment.notes,
    } : null,
    items: d.items.map(i => ({
      product_id: i.productId,
      part_id: i.partId,
      new_part: i.partId || !i.newPart ? null : {
        name: i.newPart.name.trim(), sku: i.newPart.sku.trim(), category: i.newPart.category, brand: i.newPart.brand.trim(),
        compatible_with: i.newPart.compatibleWith, part_word: i.newPart.partWord, reorder_level: i.newPart.reorderLevel,
      },
      new_product: i.productId ? null : i.newProduct && {
        name: i.newProduct.name.trim(), code: i.newProduct.code.trim(), category: i.newProduct.category,
        subcategory: i.newProduct.subcategory, brand: i.newProduct.brand, model: i.newProduct.model,
        description: i.newProduct.description, barcodes: i.newProduct.barcodes.map(b => b.trim()).filter(Boolean),
        min_stock: i.newProduct.minStock,
      },
      description: i.description,
      qty: i.qty, unit_cost: i.unitCost, expected_sell_price: i.expectedSellPrice,
      discount: i.discount, tax_pct: i.taxPct, update_selling_price: i.updateSellingPrice,
      supplier_warranty_days: i.supplierWarrantyDays, supplier_warranty_start: i.supplierWarrantyStart,
      supplier_warranty_notes: i.supplierWarrantyNotes, supplier_warranty_terms: i.supplierWarrantyTerms,
      customer_warranty_days: i.customerWarrantyDays,
    })),
  };
  return Number(check(await sb().rpc("save_purchase_invoice", { p: payload })));
}

export async function finalisePurchaseInvoice(id: number, receiveAll: boolean): Promise<void> {
  check(await sb().rpc("finalise_purchase_invoice", { p_id: id, p_receive_all: receiveAll }));
}

export async function receivePurchaseInvoice(id: number, lines: { itemId: number; qty: number }[] | null, receivedOn: string, note: string): Promise<void> {
  check(await sb().rpc("receive_purchase_invoice", {
    p_id: id,
    p_lines: lines ? lines.filter(l => l.qty > 0).map(l => ({ item_id: l.itemId, qty: l.qty })) : null,
    p_received_on: receivedOn,
    p_note: note,
  }));
}

export async function voidPurchaseInvoice(id: number, reason: string): Promise<void> {
  check(await sb().rpc("void_purchase_invoice", { p_id: id, p_reason: reason }));
}

export async function recordSupplierPayment(p: {
  supplierId: number; paidOn: string; method: PayMethod; reference: string; notes: string;
  allocations: { invoiceId: number; amount: number }[];
}): Promise<number> {
  return Number(check(await sb().rpc("record_supplier_payment", {
    p_supplier_id: p.supplierId, p_paid_on: p.paidOn, p_method: p.method, p_reference: p.reference, p_notes: p.notes,
    p_allocations: p.allocations.filter(a => a.amount > 0).map(a => ({ invoice_id: a.invoiceId, amount: a.amount })),
  })));
}

export async function voidSupplierPayment(id: number, reason: string): Promise<void> {
  check(await sb().rpc("void_supplier_payment", { p_id: id, p_reason: reason }));
}

// ── Supplier profile fields ──────────────────────────────────────────────────

export interface SupplierDetails {
  contactPerson: string;
  address: string;
  notes: string;
}

export async function fetchSupplierDetails(id: number): Promise<SupplierDetails> {
  const r = check<Row>(await sb().from("accessory_suppliers").select("contact_person, address, notes").eq("id", id).single());
  return { contactPerson: s(r.contact_person), address: s(r.address), notes: s(r.notes) };
}

export async function saveSupplierDetails(id: number, d: SupplierDetails): Promise<void> {
  check(await sb().from("accessory_suppliers")
    .update({ contact_person: d.contactPerson.trim(), address: d.address.trim(), notes: d.notes.trim() })
    .eq("id", id).select("id").single());
}

// ── Attachments ───────────────────────────────────────────────────────────────

const BUCKET = "supplier-invoices";

export async function uploadInvoiceAttachment(file: File): Promise<{ path: string; name: string }> {
  if (file.size > 10 * 1024 * 1024) throw new Error("The file is over 10 MB.");
  const safe = file.name.replace(/[^\w.\-]+/g, "_").slice(-80);
  const path = `${crypto.randomUUID()}/${safe}`;
  const { error } = await sb().storage.from(BUCKET).upload(path, file, { contentType: file.type || undefined });
  if (error) throw new Error(`Could not upload the attachment: ${error.message}`);
  return { path, name: file.name };
}

export async function attachmentUrl(path: string): Promise<string | null> {
  const { data, error } = await sb().storage.from(BUCKET).createSignedUrl(path, 600);
  return error ? null : data.signedUrl;
}

// ── Item codes for new products ───────────────────────────────────────────────

/** "Data Cable" -> "DC". Same rule as the Add Product form. */
export function categoryAbbr(cat: string): string {
  return cat.split(/[\s/\-–]+/).filter(w => w.length > 0).map(w => w[0].toUpperCase()).join("");
}

/** Next free ABBR-NNN code, counting both the catalogue and codes already
 *  taken by other new lines on the same invoice. */
export function nextItemCode(cat: string, takenCodes: string[]): string {
  const abbr = categoryAbbr(cat);
  if (!abbr) return "";
  const re = new RegExp(`^${abbr}-(\d+)$`, "i");
  let max = 0;
  for (const c of takenCodes) {
    const m = c.match(re);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${abbr}-${String(max + 1).padStart(3, "0")}`;
}
