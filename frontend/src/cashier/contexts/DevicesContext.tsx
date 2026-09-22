"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useRealtimeTable } from "@/lib/supabase/useRealtime";
import { fetchDevices, saveDevice as saveDeviceRow, deleteDevice as deleteDeviceRow } from "@/lib/inventory/devices";
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
  status: "available" | "sold" | "reserved";
  notes: string;
}

interface DevicesContextType {
  devices: DeviceRecord[];
  /** Insert (id 0) or update one device. Throws on failure so the caller can
   *  keep the form open rather than reporting a false success. */
  saveDevice: (device: DeviceRecord) => Promise<DeviceRecord>;
  deleteDevice: (id: number) => Promise<void>;

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

  return (
    <DevicesContext.Provider value={{ devices, saveDevice, deleteDevice, loading, error, configured, reload }}>
      {children}
    </DevicesContext.Provider>
  );
}

export function useDevices() {
  const ctx = useContext(DevicesContext);
  if (!ctx) throw new Error("useDevices must be inside <DevicesProvider>");
  return ctx;
}
