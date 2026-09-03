"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import {
  fetchAccessoryProducts, saveAccessoryProduct as saveProductRow,
  deleteAccessoryProduct as deleteProductRow, sellAccessoryStock,
} from "@/lib/inventory/accessories";
import { isSupabaseConfigured } from "@/lib/supabase/client";

/**
 * Retail accessory stock sold at the counter (screen protectors, cases,
 * cables — accessories sold to a customer, as opposed to PartsContext's
 * repair spare parts, which get consumed inside a device).
 *
 * Supabase-backed (accessory_products). This used to be split across TWO
 * separate, disconnected useState([]) — one on InventoryManagement's
 * Accessories tab, one inside AccessorySales itself — both always empty on
 * load and neither aware the other existed. One shared context here means
 * a product added on the inventory screen is immediately sellable, and a
 * sale here is immediately reflected on the inventory screen.
 *
 * Stock is only ever changed by a direct edit (savePart-style) or by
 * sellStock() at checkout, which runs server-side in one transaction — see
 * sell_accessory_stock() in the migration for why a cart cannot safely do
 * its own read-modify-write.
 */

export interface AccessoryProduct {
  id: number;
  code: string;
  name: string;
  brand: string;
  category: string;
  /** Denormalized subcategory label, e.g. category "Chargers" -> "Type-C". */
  subcategory: string;
  model: string;
  buyingPrice: number;
  sellingPrice: number;
  stock: number;
  minStock: number;
  supplier: string;
  addedDate: string;
  /** Optional merchandising note shown to cashiers, e.g. "Popular add-on". */
  insight?: string;
}

interface AccessoriesContextType {
  products: AccessoryProduct[];
  /** Insert (id 0) or update one product. Throws on failure so the caller can
   *  keep the form open rather than reporting a false success. */
  saveProduct: (product: AccessoryProduct) => Promise<AccessoryProduct>;
  deleteProduct: (id: number) => Promise<void>;
  /** Deducts stock for a whole cart atomically; throws (selling nothing) if
   *  any line is short on stock. Refetches afterwards so the numbers on
   *  screen are the database's, not arithmetic guessed here. */
  sellStock: (items: { id: number; qty: number }[]) => Promise<void>;

  loading: boolean;
  error: string | null;
  /** False when Supabase env vars are missing — the UI shows a notice rather
   *  than pretending an empty catalogue is the real one. */
  configured: boolean;
  reload: () => Promise<void>;
}

const AccessoriesContext = createContext<AccessoriesContextType | null>(null);

export function AccessoriesProvider({ children }: { children: ReactNode }) {
  const configured = isSupabaseConfigured();
  const [products, setProducts] = useState<AccessoryProduct[]>([]);
  const [loading, setLoading] = useState(configured);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!configured) { setLoading(false); return; }
    try {
      setProducts(await fetchAccessoryProducts());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [configured]);

  useEffect(() => { void reload(); }, [reload]);

  const saveProduct = useCallback(async (product: AccessoryProduct) => {
    const saved = await saveProductRow(product);
    setProducts(prev =>
      prev.some(p => p.id === saved.id)
        ? prev.map(p => (p.id === saved.id ? saved : p))
        : [...prev, saved].sort((a, b) => a.name.localeCompare(b.name)),
    );
    return saved;
  }, []);

  const deleteProduct = useCallback(async (id: number) => {
    await deleteProductRow(id);
    setProducts(prev => prev.filter(p => p.id !== id));
  }, []);

  const sellStock = useCallback(async (items: { id: number; qty: number }[]) => {
    await sellAccessoryStock(items);
    // Refetch rather than subtract locally — the database's numbers, not a
    // second copy of the arithmetic that could drift from them.
    try { setProducts(await fetchAccessoryProducts()); } catch { /* next reload corrects it */ }
  }, []);

  return (
    <AccessoriesContext.Provider value={{ products, saveProduct, deleteProduct, sellStock, loading, error, configured, reload }}>
      {children}
    </AccessoriesContext.Provider>
  );
}

export function useAccessories() {
  const ctx = useContext(AccessoriesContext);
  if (!ctx) throw new Error("useAccessories must be inside <AccessoriesProvider>");
  return ctx;
}
