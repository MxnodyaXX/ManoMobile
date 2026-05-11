"use client";

import {
  createContext, useContext, useState,
  type Dispatch, type SetStateAction, type ReactNode,
} from "react";

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

const INITIAL_BRANDS: Brand[] = [
  { id: 1,  name: "Apple",   type: "device",    categoryIds: [] },
  { id: 2,  name: "Samsung", type: "both",      categoryIds: [] }, // devices + accessories
  { id: 3,  name: "Xiaomi",  type: "device",    categoryIds: [] },
  { id: 4,  name: "OnePlus", type: "device",    categoryIds: [] },
  { id: 5,  name: "Realme",  type: "device",    categoryIds: [] },
  { id: 6,  name: "Nokia",   type: "device",    categoryIds: [] },
  { id: 7,  name: "Baseus",  type: "accessory", categoryIds: [1, 3, 4] }, // SP, Cable, Charger
  { id: 8,  name: "Spigen",  type: "accessory", categoryIds: [1, 2]    }, // SP, Case
  { id: 9,  name: "Anker",   type: "accessory", categoryIds: [3, 4]    }, // Cable, Charger
  { id: 10, name: "JBL",     type: "accessory", categoryIds: [5]       }, // Audio
  { id: 11, name: "Romoss",  type: "accessory", categoryIds: [6]       }, // Power Bank
  { id: 12, name: "Nillkin", type: "accessory", categoryIds: [1, 2]    }, // SP, Case
];

const INITIAL_CATEGORIES: Category[] = [
  { id: 1, name: "Screen Protector" },
  { id: 2, name: "Case"             },
  { id: 3, name: "Cable"            },
  { id: 4, name: "Charger"          },
  { id: 5, name: "Audio"            },
  { id: 6, name: "Power Bank"       },
  { id: 7, name: "Memory Card"      },
  { id: 8, name: "Holder / Stand"   },
];

const INITIAL_SUPPLIERS: Supplier[] = [
  { id: 1, name: "TechImports PVT", phone: "+94 77 123 4567", email: "orders@techimports.lk",  brandIds: [1, 4, 9, 11] }, // Apple, OnePlus, Anker, Romoss
  { id: 2, name: "MobileWorld",     phone: "+94 71 234 5678", email: "supply@mobileworld.lk",   brandIds: [2, 6]        }, // Samsung, Nokia
  { id: 3, name: "XiaomiSL",        phone: "+94 76 345 6789", email: "info@xiaomisl.lk",        brandIds: [3]           }, // Xiaomi
  { id: 4, name: "AccessoryHub",    phone: "+94 75 456 7890", email: "sales@accessoryhub.lk",   brandIds: [7, 8, 12]    }, // Baseus, Spigen, Nillkin
  { id: 5, name: "CableWorld",      phone: "+94 70 567 8901", email: "orders@cableworld.lk",    brandIds: [9]           }, // Anker
  { id: 6, name: "AudioZone",       phone: "+94 77 678 9012", email: "hello@audiozone.lk",      brandIds: [10, 11]      }, // JBL, Romoss
];

const INITIAL_BARCODE: BarcodeSettings = {
  format: "CODE128", width: 2, height: 60, fontSize: 12, showText: true, prefix: "MM",
};

const INITIAL_ADMIN: AdminCredentials = { username: "admin", password: "admin123" };

// ─── Provider ─────────────────────────────────────────────────────────────────

export function InventoryProvider({ children }: { children: ReactNode }) {
  const [brands,            setBrands]            = useState<Brand[]>(INITIAL_BRANDS);
  const [categories,        setCategories]        = useState<Category[]>(INITIAL_CATEGORIES);
  const [suppliers,         setSuppliers]         = useState<Supplier[]>(INITIAL_SUPPLIERS);
  const [barcodeSettings,   setBarcodeSettings]   = useState<BarcodeSettings>(INITIAL_BARCODE);
  const [adminCredentials,  setAdminCredentials]  = useState<AdminCredentials>(INITIAL_ADMIN);

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
