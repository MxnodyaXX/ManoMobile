"use client";

import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
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
}

const num = (v: number | string) => Number(v);

const PRODUCT_COLUMNS =
  "id, code, name, brand, category, subcategory, model, buying_price, selling_price, stock, min_stock, supplier, added_date, insight";

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
  };
}

export async function fetchAccessoryProducts(): Promise<AccessoryProduct[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await getSupabaseBrowserClient()
    .from("accessory_products")
    .select(PRODUCT_COLUMNS)
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);
  return (data as ProductRow[]).map(toProduct);
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

  const { data, error } = await query.select(PRODUCT_COLUMNS).single();

  if (error) {
    if (error.code === "23505") throw new Error(`Code "${payload.code}" is already used by another product.`);
    throw new Error(error.message);
  }
  return toProduct(data as ProductRow);
}

export async function deleteAccessoryProduct(id: number): Promise<void> {
  const { error } = await getSupabaseBrowserClient().from("accessory_products").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/**
 * Deducts stock for a whole cart in one transaction — see
 * sell_accessory_stock() in the migration for why this can't be a client-side
 * read-modify-write. Throws (and sells nothing) if any line is short on stock.
 */
export async function sellAccessoryStock(items: { id: number; qty: number }[]): Promise<void> {
  if (items.length === 0) return;
  const { error } = await getSupabaseBrowserClient()
    .rpc("sell_accessory_stock", { p_items: items });
  if (error) throw new Error(error.message);
}
