"use client";

import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { Brand, Category, Subcategory, Supplier } from "@/cashier/contexts/InventoryContext";

/**
 * Data access for the reference lists behind the accessory Add/Edit Product
 * form's cascading category → subcategory → brand → supplier pickers.
 *
 * These used to live only in InventoryContext's useState — gone on refresh,
 * invisible to every other browser, which meant an accessory saved with
 * category "Screen Protector" could no longer find that category in its own
 * dropdown the next time anyone opened the form.
 */

interface CategoryRow { id: number; name: string; active: boolean; }
interface SubcategoryRow { id: number; category_id: number; name: string; active: boolean; }
interface BrandRow { id: number; name: string; type: Brand["type"]; category_ids: number[] | null; active: boolean; }
interface SupplierRow { id: number; name: string; phone: string | null; email: string | null; brand_ids: number[] | null; active: boolean; }

const toCategory = (row: CategoryRow): Category => ({ id: row.id, name: row.name, active: row.active });
const toSubcategory = (row: SubcategoryRow): Subcategory => ({ id: row.id, categoryId: row.category_id, name: row.name, active: row.active });
const toBrand = (row: BrandRow): Brand => ({ id: row.id, name: row.name, type: row.type, categoryIds: row.category_ids ?? [], active: row.active });
const toSupplier = (row: SupplierRow): Supplier => ({ id: row.id, name: row.name, phone: row.phone ?? "", email: row.email ?? "", brandIds: row.brand_ids ?? [], active: row.active });

// ─── Categories ──────────────────────────────────────────────────────────────

export async function fetchAccessoryCategories(): Promise<Category[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await getSupabaseBrowserClient()
    .from("accessory_categories").select("*").order("name");
  if (error) throw new Error(error.message);
  return (data as CategoryRow[]).map(toCategory);
}

export async function saveAccessoryCategory(id: number | null, name: string): Promise<Category> {
  const sb = getSupabaseBrowserClient();
  const query = id === null
    ? sb.from("accessory_categories").insert({ name: name.trim() })
    : sb.from("accessory_categories").update({ name: name.trim() }).eq("id", id);
  const { data, error } = await query.select("*").single();
  if (error) {
    if (error.code === "23505") throw new Error(`Category "${name.trim()}" already exists.`);
    throw new Error(error.message);
  }
  return toCategory(data as CategoryRow);
}

export async function setAccessoryCategoryActive(id: number, active: boolean): Promise<Category> {
  const { data, error } = await getSupabaseBrowserClient()
    .from("accessory_categories").update({ active }).eq("id", id).select("*").single();
  if (error) throw new Error(error.message);
  return toCategory(data as CategoryRow);
}

export async function deleteAccessoryCategory(id: number): Promise<void> {
  const { error } = await getSupabaseBrowserClient().from("accessory_categories").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ─── Subcategories ───────────────────────────────────────────────────────────

export async function fetchAccessorySubcategories(): Promise<Subcategory[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await getSupabaseBrowserClient()
    .from("accessory_subcategories").select("*").order("name");
  if (error) throw new Error(error.message);
  return (data as SubcategoryRow[]).map(toSubcategory);
}

export async function saveAccessorySubcategory(id: number | null, sub: Omit<Subcategory, "id" | "active">): Promise<Subcategory> {
  const payload = { category_id: sub.categoryId, name: sub.name.trim() };
  const sb = getSupabaseBrowserClient();
  const query = id === null
    ? sb.from("accessory_subcategories").insert(payload)
    : sb.from("accessory_subcategories").update(payload).eq("id", id);
  const { data, error } = await query.select("*").single();
  if (error) {
    if (error.code === "23505") throw new Error(`"${payload.name}" already exists under that category.`);
    throw new Error(error.message);
  }
  return toSubcategory(data as SubcategoryRow);
}

export async function setAccessorySubcategoryActive(id: number, active: boolean): Promise<Subcategory> {
  const { data, error } = await getSupabaseBrowserClient()
    .from("accessory_subcategories").update({ active }).eq("id", id).select("*").single();
  if (error) throw new Error(error.message);
  return toSubcategory(data as SubcategoryRow);
}

export async function deleteAccessorySubcategory(id: number): Promise<void> {
  const { error } = await getSupabaseBrowserClient().from("accessory_subcategories").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ─── Brands ──────────────────────────────────────────────────────────────────

export async function fetchAccessoryBrands(): Promise<Brand[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await getSupabaseBrowserClient()
    .from("accessory_brands").select("*").order("name");
  if (error) throw new Error(error.message);
  return (data as BrandRow[]).map(toBrand);
}

export async function saveAccessoryBrand(id: number | null, brand: Omit<Brand, "id" | "active">): Promise<Brand> {
  const payload = { name: brand.name.trim(), type: brand.type, category_ids: brand.categoryIds };
  const sb = getSupabaseBrowserClient();
  const query = id === null
    ? sb.from("accessory_brands").insert(payload)
    : sb.from("accessory_brands").update(payload).eq("id", id);
  const { data, error } = await query.select("*").single();
  if (error) {
    if (error.code === "23505") throw new Error(`Brand "${payload.name}" already exists.`);
    throw new Error(error.message);
  }
  return toBrand(data as BrandRow);
}

export async function setAccessoryBrandActive(id: number, active: boolean): Promise<Brand> {
  const { data, error } = await getSupabaseBrowserClient()
    .from("accessory_brands").update({ active }).eq("id", id).select("*").single();
  if (error) throw new Error(error.message);
  return toBrand(data as BrandRow);
}

export async function deleteAccessoryBrand(id: number): Promise<void> {
  const { error } = await getSupabaseBrowserClient().from("accessory_brands").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ─── Suppliers ───────────────────────────────────────────────────────────────

export async function fetchAccessorySuppliers(): Promise<Supplier[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await getSupabaseBrowserClient()
    .from("accessory_suppliers").select("*").order("name");
  if (error) throw new Error(error.message);
  return (data as SupplierRow[]).map(toSupplier);
}

export async function saveAccessorySupplier(id: number | null, supplier: Omit<Supplier, "id" | "active">): Promise<Supplier> {
  const payload = { name: supplier.name.trim(), phone: supplier.phone, email: supplier.email, brand_ids: supplier.brandIds };
  const sb = getSupabaseBrowserClient();
  const query = id === null
    ? sb.from("accessory_suppliers").insert(payload)
    : sb.from("accessory_suppliers").update(payload).eq("id", id);
  const { data, error } = await query.select("*").single();
  if (error) {
    if (error.code === "23505") throw new Error(`Supplier "${payload.name}" already exists.`);
    throw new Error(error.message);
  }
  return toSupplier(data as SupplierRow);
}

export async function setAccessorySupplierActive(id: number, active: boolean): Promise<Supplier> {
  const { data, error } = await getSupabaseBrowserClient()
    .from("accessory_suppliers").update({ active }).eq("id", id).select("*").single();
  if (error) throw new Error(error.message);
  return toSupplier(data as SupplierRow);
}

export async function deleteAccessorySupplier(id: number): Promise<void> {
  const { error } = await getSupabaseBrowserClient().from("accessory_suppliers").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
