"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useRealtimeTable } from "@/lib/supabase/useRealtime";
import { fetchDevices, saveDevice as saveDeviceRow, deleteDevice as deleteDeviceRow, sellMobileSale } from "@/lib/inventory/devices";
import { isSupabaseConfigured } from "@/lib/supabase/client";

/**
 * Mobile phone inventory tracked one unit at a time by IMEI (as opposed to
 * AccessoriesContext's accessory_products, which is countable retail stock).
 *
 * Supabase-backed (mobile_devices). This used to be a plain useState([]) on
 * InventoryManagement's Mobile Devices tab — gone on every refresh, invisible
 * to every other browser. One shared context here means a device added or
 * sold on one screen/tab shows up on another without a manual refresh, the
 * same fix AccessoriesContext already made for accessories.
 */

export interface DeviceRecord {
  id: number;
  imei: string;
  imei2: string;
  serialNumber: string;
  name: string;
  modelNumber: string;
  brand: string;
  storage: string;
  ram: string;
  color: string;
  buyingPrice: number;
  minSellingPrice: number;
  suggestedPrice: number;
  supplier: string;
  addedDate: string;
  /** supplier_return: a customer return set aside to go back to the company;
   *  returned_to_supplier: it has gone. See migration 20260927000060. */
  status: DeviceStatus;
  notes: string;
  /** The invoice it is sold on, while it is sold. */
  soldInvoiceNo?: string | null;
  soldPrice?: number | null;
  /** Set when a customer brought this unit back — a customer return, not new stock. */
  returnedFromInvoice?: string | null;
  returnReason?: string | null;
  /** Warranty in days from the sale date. null = the shop default for phones
   *  (Warranty Center → Policies); 0 = sold with no warranty. */
  warrantyDays?: number | null;
  /** Whose warranty and any condition, e.g. "Samsung company warranty". */
  warrantyNote?: string;
}

/** How a device's warranty reads, e.g. "1 year · Samsung company warranty". */
export function deviceWarrantyText(d: Pick<DeviceRecord, "warrantyDays" | "warrantyNote">): string {
  const days = d.warrantyDays;
  const period = days == null ? "Shop default warranty"
    : days === 0 ? "No warranty"
    : days % 365 === 0 ? `${days / 365} year${days === 365 ? "" : "s"} warranty`
    : days % 30 === 0 ? `${days / 30} month${days === 30 ? "" : "s"} warranty`
    : `${days} days warranty`;
  return [period, (d.warrantyNote ?? "").trim()].filter(Boolean).join(" · ");
}

export type DeviceStatus = "available" | "sold" | "reserved" | "supplier_return" | "returned_to_supplier";

export const DEVICE_STATUS_LABEL: Record<DeviceStatus, string> = {
  available: "available",
  sold: "sold",
  reserved: "reserved",
  supplier_return: "return to company",
  returned_to_supplier: "returned to company",
};

interface DevicesContextType {
  devices: DeviceRecord[];
  /** Insert (id 0) or update one device. Throws on failure so the caller can
   *  keep the form open rather than reporting a false success. */
  saveDevice: (device: DeviceRecord) => Promise<DeviceRecord>;
  deleteDevice: (id: number) => Promise<void>;
  /** Marks the devices sold, deducts the accessory lines and returns the new
   *  invoice number — atomically, see sell_mobile_sale(). Throws (selling
   *  nothing) if any device was sold elsewhere or priced below its minimum.
   *  Refetches afterwards so the list is the database's. */
  sellSale: (devices: { id: number; price: number }[], accessories: { id: number; qty: number }[], belowMinReason?: string) => Promise<string>;

  loading: boolean;
  error: string | null;
  /** False when Supabase env vars are missing — the UI shows a notice rather
   *  than pretending an empty inventory is the real one. */
  configured: boolean;
  reload: () => Promise<void>;
}

const DevicesContext = createContext<DevicesContextType | null>(null);

export function DevicesProvider({ children }: { children: ReactNode }) {
  const configured = isSupabaseConfigured();
  const [devices, setDevices] = useState<DeviceRecord[]>([]);
  const [loading, setLoading] = useState(configured);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!configured) { setLoading(false); return; }
    try {
      setDevices(await fetchDevices());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [configured]);

  useEffect(() => { void reload(); }, [reload]);

  // A device added or sold on the other till shouldn't leave this screen
  // showing stale rows until somebody thinks to refresh.
  useRealtimeTable("mobile_devices", reload);

  const saveDevice = useCallback(async (device: DeviceRecord) => {
    const saved = await saveDeviceRow(device);
    setDevices(prev =>
      prev.some(d => d.id === saved.id)
        ? prev.map(d => (d.id === saved.id ? saved : d))
        : [...prev, saved].sort((a, b) => a.name.localeCompare(b.name)),
    );
    return saved;
  }, []);

  const deleteDevice = useCallback(async (id: number) => {
    await deleteDeviceRow(id);
    setDevices(prev => prev.filter(d => d.id !== id));
  }, []);

  const sellSale = useCallback(async (
    lines: { id: number; price: number }[],
    accessories: { id: number; qty: number }[],
    belowMinReason?: string,
  ) => {
    const invoiceNo = await sellMobileSale(lines, accessories, belowMinReason);
    try { setDevices(await fetchDevices()); } catch { /* next reload corrects it */ }
    return invoiceNo;
  }, []);

  return (
    <DevicesContext.Provider value={{ devices, saveDevice, deleteDevice, sellSale, loading, error, configured, reload }}>
      {children}
    </DevicesContext.Provider>
  );
}

export function useDevices() {
  const ctx = useContext(DevicesContext);
  if (!ctx) throw new Error("useDevices must be inside <DevicesProvider>");
  return ctx;
}
