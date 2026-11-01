import { createClient } from "@supabase/supabase-js";

/**
 * What the public website may know about the shop — read on the server only.
 *
 * The catalogue tables are staff-only under RLS (they carry buying prices and
 * supplier names). Rather than open them to the world, these server-side reads
 * use the service key and hand the browser a deliberately narrow shape: name,
 * selling price, stock, category. Nothing here is ever imported by a client
 * component, so the key never leaves the server.
 *
 * With no key configured (a fresh checkout, a preview deploy) the site still
 * renders, from SAMPLE_PRODUCTS, so the UI can be judged on its own.
 */

export interface PublicProduct {
  id: number;
  code: string;
  name: string;
  brand: string;
  category: string;
  subcategory: string;
  model: string;
  description: string;
  price: number;
  stock: number;
}

export interface ShopFacts {
  repairsDone: number | null;
  productsInStock: number | null;
  categories: number | null;
}

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

type Row = Record<string, unknown>;
const toPublic = (r: Row): PublicProduct => ({
  id: Number(r.id),
  code: String(r.code ?? ""),
  name: String(r.name ?? ""),
  brand: String(r.brand ?? ""),
  category: String(r.category ?? ""),
  subcategory: String(r.subcategory ?? ""),
  model: String(r.model ?? ""),
  description: String(r.description ?? ""),
  price: Number(r.selling_price ?? 0),
  stock: Math.max(0, Number(r.stock ?? 0)),
});

/** Every product with a selling price, in-stock first. */
export async function fetchCatalogue(): Promise<{ products: PublicProduct[]; sample: boolean }> {
  const sb = admin();
  if (!sb) return { products: SAMPLE_PRODUCTS, sample: true };
  // "*" so a column added later (description) doesn't break the read, then
  // narrowed by toPublic — buying_price and supplier stop here.
  const { data, error } = await sb.from("accessory_products").select("*").gt("selling_price", 0);
  if (error || !data) return { products: SAMPLE_PRODUCTS, sample: true };
  const products = (data as Row[]).map(toPublic)
    .sort((a, b) => Number(b.stock > 0) - Number(a.stock > 0) || a.name.localeCompare(b.name));
  return { products, sample: false };
}

export async function fetchProduct(id: number): Promise<{ product: PublicProduct | null; related: PublicProduct[]; warranty: string | null; sample: boolean }> {
  const { products, sample } = await fetchCatalogue();
  const product = products.find(p => p.id === id) ?? null;
  const related = product
    ? products.filter(p => p.id !== id && p.category === product.category && p.stock > 0).slice(0, 4)
    : [];
  let warranty: string | null = null;
  const sb = admin();
  if (product && sb) {
    const { data } = await sb.from("warranty_policies").select("category, duration_days, label").eq("kind", "accessory");
    const rows = (data ?? []) as Row[];
    const pol = rows.find(r => String(r.category ?? "").toLowerCase() === product.category.toLowerCase())
      ?? rows.find(r => r.category == null);
    if (pol && Number(pol.duration_days) > 0) warranty = String(pol.label || `${pol.duration_days} days warranty`);
  }
  return { product, related, warranty, sample };
}

/** Real counts for the home page — null when they can't be read, and then not shown. */
export async function fetchShopFacts(): Promise<ShopFacts> {
  const sb = admin();
  if (!sb) return { repairsDone: null, productsInStock: null, categories: null };
  const [jobs, prods] = await Promise.all([
    sb.from("repair_jobs").select("id", { count: "exact", head: true }),
    sb.from("accessory_products").select("category, stock").gt("stock", 0),
  ]);
  const rows = (prods.data ?? []) as Row[];
  return {
    repairsDone: jobs.error ? null : jobs.count ?? null,
    productsInStock: prods.error ? null : rows.length,
    categories: prods.error ? null : new Set(rows.map(r => String(r.category))).size,
  };
}

// ── Sample catalogue (only when the database can't be read) ───────────────────

export const SAMPLE_PRODUCTS: PublicProduct[] = [
  { id: 1, code: "CH-001", name: "Samsung 25W Super Fast Charger", brand: "Samsung", category: "Chargers", subcategory: "Type-C", model: "Galaxy S / A series", description: "", price: 1950, stock: 12 },
  { id: 2, code: "DC-001", name: "Type-C to Type-C Cable 1m", brand: "Baseus", category: "Data Cable", subcategory: "Type-C", model: "Universal", description: "", price: 850, stock: 30 },
  { id: 3, code: "TG-004", name: "Tempered Glass 9H", brand: "Mano", category: "Tempered Glass", subcategory: "", model: "iPhone 15 Pro", description: "", price: 1200, stock: 18 },
  { id: 4, code: "EP-002", name: "Wireless Earbuds Pro", brand: "Lenovo", category: "Earphones", subcategory: "Bluetooth", model: "Universal", description: "", price: 6500, stock: 4 },
  { id: 5, code: "PB-001", name: "Power Bank 20000mAh", brand: "Anker", category: "Power Bank", subcategory: "", model: "Universal", description: "", price: 8900, stock: 6 },
  { id: 6, code: "BC-010", name: "Clear Silicone Back Cover", brand: "Generic", category: "Back Cover", subcategory: "", model: "Redmi Note 13", description: "", price: 650, stock: 0 },
  { id: 7, code: "CL-001", name: "Camera Lens Protector", brand: "LITO", category: "Camera Lens Protectors", subcategory: "", model: "iPhone 17 Pro", description: "", price: 1500, stock: 9 },
  { id: 8, code: "SW-001", name: "Smart Watch Strap 22mm", brand: "Generic", category: "Watch Straps", subcategory: "", model: "Galaxy Watch", description: "", price: 1100, stock: 7 },
];
