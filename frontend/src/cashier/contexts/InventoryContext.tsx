"use client";

import {
  createContext, useCallback, useContext, useEffect, useState,
  type Dispatch, type SetStateAction, type ReactNode,
} from "react";
import { fetchDefaultTemplate } from "@/lib/inventory/barcodeTemplates";
import {
  fetchAccessoryCategories, saveAccessoryCategory, deleteAccessoryCategory, setAccessoryCategoryActive,
  fetchAccessorySubcategories, saveAccessorySubcategory, deleteAccessorySubcategory, setAccessorySubcategoryActive,
  fetchAccessoryBrands, saveAccessoryBrand, deleteAccessoryBrand, setAccessoryBrandActive,
  fetchAccessorySuppliers, saveAccessorySupplier, deleteAccessorySupplier, setAccessorySupplierActive,
} from "@/lib/inventory/reference";
import { isSupabaseConfigured } from "@/lib/supabase/client";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Brand {
  id: number;
  name: string;
  type: "device" | "accessory" | "both";
  categoryIds: number[]; // which accessory categories this brand belongs to; [] = all
  /** Inactive brands stay on record (existing products keep their label) but
   *  drop out of the Add/Edit Product picker. */
  active: boolean;
}

export interface Category { id: number; name: string; active: boolean; }

/** One level under Category, e.g. "Chargers" -> "Type-C" / "Micro USB" /
 *  "Lightning". Belongs to exactly one category — the product form's
 *  subcategory picker narrows to whichever category is chosen first. */
export interface Subcategory { id: number; categoryId: number; name: string; active: boolean; }

export interface Supplier {
  id: number;
  name: string;
  phone: string;
  email: string;
  brandIds: number[]; // which brands this supplier carries; [] = all brands
  active: boolean;
}

export interface BarcodeSettings {
  format: "CODE128" | "CODE39" | "EAN13";
  width: number;
  height: number;
  fontSize: number;
  showText: boolean;
  prefix: string;
  /** Physical label size (mm) for the thermal label printer. */
  labelWidthMm: number;
  labelHeightMm: number;
  /** Blank margin (mm) kept on the left/right of the barcode content —
   *  vertical spacing is handled separately since it's already tight. */
  labelMarginMm: number;
}

export interface AdminCredentials { username: string; password: string; }

interface InventoryContextType {
  brands:      Brand[];
  categories:  Category[];
  subcategories: Subcategory[];
  suppliers:   Supplier[];
  loading:     boolean;
  error:       string | null;
  /** False when Supabase env vars are missing. */
  configured:  boolean;
  reload:      () => Promise<void>;

  addCategory:    (name: string) => Promise<Category>;
  updateCategory: (id: number, name: string) => Promise<Category>;
  setCategoryActive: (id: number, active: boolean) => Promise<Category>;
  deleteCategory: (id: number) => Promise<void>;

  addSubcategory:    (s: Omit<Subcategory, "id" | "active">) => Promise<Subcategory>;
  updateSubcategory: (id: number, s: Omit<Subcategory, "id" | "active">) => Promise<Subcategory>;
  setSubcategoryActive: (id: number, active: boolean) => Promise<Subcategory>;
  deleteSubcategory: (id: number) => Promise<void>;

  addBrand:    (b: Omit<Brand, "id" | "active">) => Promise<Brand>;
  updateBrand: (id: number, b: Omit<Brand, "id" | "active">) => Promise<Brand>;
  setBrandActive: (id: number, active: boolean) => Promise<Brand>;
  deleteBrand: (id: number) => Promise<void>;

  addSupplier:    (s: Omit<Supplier, "id" | "active">) => Promise<Supplier>;
  updateSupplier: (id: number, s: Omit<Supplier, "id" | "active">) => Promise<Supplier>;
  setSupplierActive: (id: number, active: boolean) => Promise<Supplier>;
  deleteSupplier: (id: number) => Promise<void>;

  barcodeSettings:     BarcodeSettings;
  setBarcodeSettings:  Dispatch<SetStateAction<BarcodeSettings>>;
  adminCredentials:    AdminCredentials;
  setAdminCredentials: Dispatch<SetStateAction<AdminCredentials>>;
}

const InventoryContext = createContext<InventoryContextType | null>(null);

const INITIAL_BARCODE: BarcodeSettings = {
  format: "CODE128", width: 2, height: 60, fontSize: 12, showText: true, prefix: "MM",
  labelWidthMm: 50, labelHeightMm: 25, labelMarginMm: 3,
};

const INITIAL_ADMIN: AdminCredentials = { username: "admin", password: "admin123" };

// ─── Provider ─────────────────────────────────────────────────────────────────

export function InventoryProvider({ children }: { children: ReactNode }) {
  const configured = isSupabaseConfigured();

  const [brands,      setBrands]      = useState<Brand[]>([]);
  const [categories,  setCategories]  = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [suppliers,   setSuppliers]   = useState<Supplier[]>([]);
  const [loading,      setLoading]     = useState(configured);
  const [error,        setError]       = useState<string | null>(null);
  const [barcodeSettings,   setBarcodeSettings]   = useState<BarcodeSettings>(INITIAL_BARCODE);
  const [adminCredentials,  setAdminCredentials]  = useState<AdminCredentials>(INITIAL_ADMIN);

  const reload = useCallback(async () => {
    if (!configured) { setLoading(false); return; }
    try {
      const [cats, subs, brs, sups] = await Promise.all([
        fetchAccessoryCategories(), fetchAccessorySubcategories(), fetchAccessoryBrands(), fetchAccessorySuppliers(),
      ]);
      setCategories(cats);
      setSubcategories(subs);
      setBrands(brs);
      setSuppliers(sups);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [configured]);

  useEffect(() => { void reload(); }, [reload]);

  /**
   * Adopt the saved default label template (Admin -> Barcode). INITIAL_BARCODE
   * stays as the value rendered before this resolves — it matches the seeded
   * 'Standard' template, so nothing shifts on screen when it arrives. A failure
   * leaves those defaults in place rather than blocking every label in the app.
   */
  useEffect(() => {
    let active = true;
    fetchDefaultTemplate()
      .then(t => {
        if (!active || !t) return;
        setBarcodeSettings({
          format: t.format, width: t.width, height: t.height, fontSize: t.fontSize,
          showText: t.showText, prefix: t.prefix, labelWidthMm: t.labelWidthMm,
          labelHeightMm: t.labelHeightMm, labelMarginMm: t.labelMarginMm,
        });
      })
      .catch(() => { /* INITIAL_BARCODE applies */ });
    return () => { active = false; };
  }, []);

  const addCategory = useCallback(async (name: string) => {
    const created = await saveAccessoryCategory(null, name);
    setCategories(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
    return created;
  }, []);
  const updateCategory = useCallback(async (id: number, name: string) => {
    const saved = await saveAccessoryCategory(id, name);
    setCategories(prev => prev.map(c => c.id === id ? saved : c));
    return saved;
  }, []);
  const deleteCategory = useCallback(async (id: number) => {
    await deleteAccessoryCategory(id);
    setCategories(prev => prev.filter(c => c.id !== id));
  }, []);
  const setCategoryActive = useCallback(async (id: number, active: boolean) => {
    const saved = await setAccessoryCategoryActive(id, active);
    setCategories(prev => prev.map(c => c.id === id ? saved : c));
    return saved;
  }, []);

  const addSubcategory = useCallback(async (s: Omit<Subcategory, "id" | "active">) => {
    const created = await saveAccessorySubcategory(null, s);
    setSubcategories(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
    return created;
  }, []);
  const updateSubcategory = useCallback(async (id: number, s: Omit<Subcategory, "id" | "active">) => {
    const saved = await saveAccessorySubcategory(id, s);
    setSubcategories(prev => prev.map(x => x.id === id ? saved : x));
    return saved;
  }, []);
  const setSubcategoryActive = useCallback(async (id: number, active: boolean) => {
    const saved = await setAccessorySubcategoryActive(id, active);
    setSubcategories(prev => prev.map(s => s.id === id ? saved : s));
    return saved;
  }, []);
  const deleteSubcategory = useCallback(async (id: number) => {
    await deleteAccessorySubcategory(id);
    setSubcategories(prev => prev.filter(s => s.id !== id));
  }, []);

  const addBrand = useCallback(async (b: Omit<Brand, "id" | "active">) => {
    const created = await saveAccessoryBrand(null, b);
    setBrands(prev => [...prev, created].sort((a, b2) => a.name.localeCompare(b2.name)));
    return created;
  }, []);
  const updateBrand = useCallback(async (id: number, b: Omit<Brand, "id" | "active">) => {
    const saved = await saveAccessoryBrand(id, b);
    setBrands(prev => prev.map(x => x.id === id ? saved : x));
    return saved;
  }, []);
  const setBrandActive = useCallback(async (id: number, active: boolean) => {
    const saved = await setAccessoryBrandActive(id, active);
    setBrands(prev => prev.map(b => b.id === id ? saved : b));
    return saved;
  }, []);
  const deleteBrand = useCallback(async (id: number) => {
    await deleteAccessoryBrand(id);
    setBrands(prev => prev.filter(b => b.id !== id));
  }, []);

  const addSupplier = useCallback(async (s: Omit<Supplier, "id" | "active">) => {
    const created = await saveAccessorySupplier(null, s);
    setSuppliers(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
    return created;
  }, []);
  const updateSupplier = useCallback(async (id: number, s: Omit<Supplier, "id" | "active">) => {
    const saved = await saveAccessorySupplier(id, s);
    setSuppliers(prev => prev.map(x => x.id === id ? saved : x));
    return saved;
  }, []);
  const setSupplierActive = useCallback(async (id: number, active: boolean) => {
    const saved = await setAccessorySupplierActive(id, active);
    setSuppliers(prev => prev.map(s => s.id === id ? saved : s));
    return saved;
  }, []);
  const deleteSupplier = useCallback(async (id: number) => {
    await deleteAccessorySupplier(id);
    setSuppliers(prev => prev.filter(s => s.id !== id));
  }, []);

  return (
    <InventoryContext.Provider value={{
      brands, categories, subcategories, suppliers, loading, error, configured, reload,
      addCategory, updateCategory, setCategoryActive, deleteCategory,
      addSubcategory, updateSubcategory, setSubcategoryActive, deleteSubcategory,
      addBrand, updateBrand, setBrandActive, deleteBrand,
      addSupplier, updateSupplier, setSupplierActive, deleteSupplier,
      barcodeSettings, setBarcodeSettings,
      adminCredentials, setAdminCredentials,
    }}>
      {children}
    </InventoryContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useInventory() {
  const ctx = useContext(InventoryContext);
  if (!ctx) throw new Error("useInventory must be inside <InventoryProvider>");
  return ctx;
}
