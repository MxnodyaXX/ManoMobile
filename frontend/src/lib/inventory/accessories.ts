"use client";

import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { fetchAllRows } from "@/lib/supabase/fetchAll";
import type { AccessoryProduct } from "@/cashier/contexts/AccessoriesContext";

/**
 * Data access for the retail accessory catalogue. See
 * supabase/migrations/20260903000001_accessory_inventory.sql — stock only
 * ever changes through a direct edit here or sellAccessoryStock() at
 * checkout, never a client-side read-modify-write.
 */

interface ProductRow {
  id: number;
  code: string;
  name: string;
  brand: string;
  category: string;
  subcategory: string | null;
  model: string;
  buying_price: number | string;
  selling_price: number | string;
  stock: number;
  min_stock: number;
  supplier: string;
  added_date: string;
  insight: string | null;
  label_barcode: string;
  accessory_barcodes: { barcode: string }[] | null;
}

const num = (v: number | string) => Number(v);

const PRODUCT_COLUMNS =
  "id, code, name, brand, category, subcategory, model, buying_price, selling_price, stock, min_stock, supplier, added_date, insight, label_barcode, accessory_barcodes(barcode)";

function toProduct(row: ProductRow): AccessoryProduct {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    brand: row.brand,
    category: row.category,
    subcategory: row.subcategory ?? "",
    model: row.model,
    buyingPrice: num(row.buying_price),
    sellingPrice: num(row.selling_price),
    stock: row.stock,
    minStock: row.min_stock,
    supplier: row.supplier,
    addedDate: row.added_date,
    insight: row.insight ?? "",
    labelBarcode: row.label_barcode,
    barcodes: (row.accessory_barcodes ?? []).map(b => b.barcode).sort(),
  };
}

export async function fetchAccessoryProducts(): Promise<AccessoryProduct[]> {
  if (!isSupabaseConfigured()) return [];
  // Paged: a single read stops at 1,000 products (see fetchAllRows).
  const sb = getSupabaseBrowserClient();
  const data = await fetchAllRows<ProductRow>((from, to) => sb
    .from("accessory_products")
    .select(PRODUCT_COLUMNS)
    .order("name", { ascending: true })
    .order("id", { ascending: true })
    .range(from, to) as unknown as PromiseLike<{ data: ProductRow[] | null; error: { message: string } | null }>);
  return data.map(toProduct);
}

/** Insert (id === 0) or update one product. */
export async function saveAccessoryProduct(product: AccessoryProduct): Promise<AccessoryProduct> {
  const payload = {
    code: product.code.trim(),
    name: product.name.trim(),
    brand: product.brand,
    category: product.category,
    subcategory: product.subcategory,
    model: product.model,
    buying_price: product.buyingPrice,
    selling_price: product.sellingPrice,
    stock: product.stock,
    min_stock: product.minStock,
    supplier: product.supplier,
    added_date: product.addedDate,
    insight: product.insight ?? "",
  };

  const sb = getSupabaseBrowserClient();
  const query = product.id
    ? sb.from("accessory_products").update(payload).eq("id", product.id)
    : sb.from("accessory_products").insert(payload);

  const { data, error } = await query.select("id").single();

  if (error) {
    if (error.code === "23505") throw new Error(`Code "${payload.code}" is already used by another product.`);
    throw new Error(error.message);
  }

  const id = (data as { id: number }).id;
  const { error: bcError } = await sb.rpc("set_accessory_barcodes", {
    p_product_id: id,
    p_barcodes: product.barcodes.map(b => b.trim()).filter(Boolean),
  });
  if (bcError) throw new Error(`Product saved, but its barcodes were not: ${bcError.message}`);

  // Read back after the barcodes are in, so the row returned carries them.
  const { data: row, error: readError } = await sb
    .from("accessory_products").select(PRODUCT_COLUMNS).eq("id", id).single();
  if (readError) throw new Error(readError.message);
  return toProduct(row as ProductRow);
}

/**
 * Changes only the name. saveAccessoryProduct writes every column, so using it
 * for a bulk rename could put back a stock count from before a sale on another
 * till. Returns false, changing nothing, if someone renamed it in the meantime.
 */
export async function renameAccessoryProduct(id: number, oldName: string, newName: string): Promise<boolean> {
  const { data, error } = await getSupabaseBrowserClient()
    .from("accessory_products")
    .update({ name: newName.trim() })
    .eq("id", id)
    .eq("name", oldName)
    .select("id");
  if (error) throw new Error(error.message);
  return (data ?? []).length > 0;
}

/**
 * Links one manufacturer barcode to a product — the "unknown barcode, which
 * product is this?" step at the counter. Linking a code the product already
 * has is a no-op, not an error.
 */
export async function linkAccessoryBarcode(productId: number, barcode: string): Promise<void> {
  const code = barcode.trim();
  if (!code) return;
  const { error } = await getSupabaseBrowserClient()
    .from("accessory_barcodes")
    .upsert({ product_id: productId, barcode: code }, { onConflict: "product_id,barcode", ignoreDuplicates: true });
  if (error) throw new Error(error.message);
}

export async function deleteAccessoryProduct(id: number): Promise<void> {
  const { error } = await getSupabaseBrowserClient().from("accessory_products").delete().eq("id", id);
  if (error?.code === "23503") {
    throw new Error("This product was bought on a supplier invoice, so its history has to stay — set its stock to 0 instead of deleting it.");
  }
  if (error) throw new Error(error.message);
}

/**
 * Deducts stock for a whole cart in one transaction — see
 * sell_accessory_stock() in the migration for why this can't be a client-side
 * read-modify-write. Throws (and sells nothing) if any line is short on stock.
 */
export async function sellAccessoryStock(items: { id: number; qty: number }[], saleKey?: string): Promise<void> {
  if (items.length === 0) return;
  const sb = getSupabaseBrowserClient();
  let { error } = await sb.rpc("sell_accessory_stock", saleKey ? { p_items: items, p_sale_key: saleKey } : { p_items: items });
  // A database without migration 20261021000085 has only the one-argument
  // function. Sell anyway — the key only links batch movements to the invoice.
  if (error && saleKey && (error.code === "PGRST202" || /p_sale_key/.test(error.message))) {
    ({ error } = await sb.rpc("sell_accessory_stock", { p_items: items }));
  }
  if (error) throw new Error(error.message);
}
