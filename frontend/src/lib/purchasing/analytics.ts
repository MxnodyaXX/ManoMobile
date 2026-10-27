"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { POStatus, PurchaseOrder, Supplier as AdminSupplier } from "@/admin/contexts/AdminContext";

/**
 * Supplier invoices in the shape Admin Analytics already reads.
 *
 * The Suppliers analytics tab and Staff Insights were written against
 * AdminContext's purchase orders and suppliers — lists that only ever lived in
 * memory, so every purchase chart was empty. This maps the real records
 * (migration 20261021000085) onto those shapes, so the existing charts work
 * unchanged: a finalised invoice is a received/partially received order, a
 * draft a draft, a voided one cancelled; a supplier's balance is what is still
 * owed on its invoices.
 */
export async function fetchPurchaseAnalytics(): Promise<{ suppliers: AdminSupplier[]; purchaseOrders: PurchaseOrder[] }> {
  const sb = getSupabaseBrowserClient();
  const [sup, inv, items] = await Promise.all([
    sb.from("accessory_suppliers").select("*").order("name"),
    sb.from("purchase_invoice_summary").select("*"),
    sb.from("purchase_invoice_items").select("id, invoice_id, product_id, description, qty, received_qty, line_total, new_product, accessory_products(code, name)"),
  ]);
  for (const r of [sup, inv, items]) if (r.error) throw new Error(r.error.message);

  type Row = Record<string, unknown>;
  const invoices = (inv.data ?? []) as Row[];
  const lines = (items.data ?? []) as Row[];

  const purchaseOrders: PurchaseOrder[] = invoices.map(i => {
    const mine = lines.filter(l => Number(l.invoice_id) === Number(i.id));
    const ordered = Number(i.qty_ordered ?? 0), received = Number(i.qty_received ?? 0);
    const status: POStatus =
      i.status === "Draft" ? "Draft" : i.status === "Void" ? "Cancelled"
      : received >= ordered && ordered > 0 ? "Received" : received > 0 ? "Partially Received" : "Approved";
    return {
      id: String(i.ref),
      supplierId: String(i.supplier_id),
      supplierName: String(i.supplier_name ?? ""),
      status,
      items: mine.map(l => {
        const prod = l.accessory_products as Row | null;
        const np = l.new_product as Row | null;
        const qty = Number(l.qty ?? 0);
        return {
          id: String(l.id),
          description: String(prod?.name ?? np?.name ?? l.description ?? ""),
          sku: String(prod?.code ?? np?.code ?? "") || undefined,
          quantity: qty,
          unitPrice: qty ? Number(l.line_total ?? 0) / qty : 0,
          receivedQty: Number(l.received_qty ?? 0),
        };
      }),
      subtotal: Number(i.items_subtotal ?? 0),
      tax: 0,
      total: Number(i.total ?? 0),
      expectedDelivery: String(i.due_date ?? ""),
      createdAt: String(i.invoice_date),
      notes: String(i.notes ?? "") || undefined,
    };
  });

  const suppliers: AdminSupplier[] = ((sup.data ?? []) as Row[]).map(s => ({
    id: String(s.id),
    name: String(s.name ?? ""),
    contactPerson: String(s.contact_person ?? ""),
    phone: String(s.phone ?? ""),
    email: String(s.email ?? ""),
    address: String(s.address ?? ""),
    category: "Accessories",
    paymentTerms: "",
    balance: invoices.filter(i => Number(i.supplier_id) === Number(s.id) && i.status === "Open")
      .reduce((t, i) => t + Number(i.outstanding ?? 0), 0),
    status: s.active === false ? "Inactive" : "Active",
    createdAt: String(s.created_at ?? ""),
  }));

  return { suppliers, purchaseOrders };
}
