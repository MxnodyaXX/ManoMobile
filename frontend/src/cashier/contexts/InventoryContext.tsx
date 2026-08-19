"use client";

import {
  createContext, useContext, useEffect, useState,
  type Dispatch, type SetStateAction, type ReactNode,
} from "react";
import { fetchDefaultTemplate } from "@/lib/inventory/barcodeTemplates";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Brand {
  id: number;
  name: string;
  type: "device" | "accessory" | "both";
  categoryIds: number[]; // which accessory categories this brand belongs to; [] = all
}

export interface Category { id: number; name: string; }

export interface Supplier {
  id: number;
  name: string;
  phone: string;
  email: string;
  brandIds: number[]; // which brands this supplier carries; [] = all brands
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
  brands:              Brand[];
  setBrands:           Dispatch<SetStateAction<Brand[]>>;
  categories:          Category[];
  setCategories:       Dispatch<SetStateAction<Category[]>>;
  suppliers:           Supplier[];
  setSuppliers:        Dispatch<SetStateAction<Supplier[]>>;
  barcodeSettings:     BarcodeSettings;
  setBarcodeSettings:  Dispatch<SetStateAction<BarcodeSettings>>;
  adminCredentials:    AdminCredentials;
  setAdminCredentials: Dispatch<SetStateAction<AdminCredentials>>;
}

const InventoryContext = createContext<InventoryContextType | null>(null);

// ─── Seed data ────────────────────────────────────────────────────────────────
// Category IDs: Screen Protector=1, Case=2, Cable=3, Charger=4, Audio=5,
//               Power Bank=6, Memory Card=7, Holder/Stand=8

const INITIAL_BRANDS: Brand[] = [];

const INITIAL_CATEGORIES: Category[] = [];

const INITIAL_SUPPLIERS: Supplier[] = [];

const INITIAL_BARCODE: BarcodeSettings = {
  format: "CODE128", width: 2, height: 60, fontSize: 12, showText: true, prefix: "MM",
  labelWidthMm: 50, labelHeightMm: 25, labelMarginMm: 3,
};

const INITIAL_ADMIN: AdminCredentials = { username: "admin", password: "admin123" };

// ─── Provider ─────────────────────────────────────────────────────────────────

export function InventoryProvider({ children }: { children: ReactNode }) {
  const [brands,            setBrands]            = useState<Brand[]>(INITIAL_BRANDS);
  const [categories,        setCategories]        = useState<Category[]>(INITIAL_CATEGORIES);
  const [suppliers,         setSuppliers]         = useState<Supplier[]>(INITIAL_SUPPLIERS);
  const [barcodeSettings,   setBarcodeSettings]   = useState<BarcodeSettings>(INITIAL_BARCODE);
  const [adminCredentials,  setAdminCredentials]  = useState<AdminCredentials>(INITIAL_ADMIN);

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

  return (
    <InventoryContext.Provider value={{
      brands, setBrands, categories, setCategories,
      suppliers, setSuppliers, barcodeSettings, setBarcodeSettings,
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
