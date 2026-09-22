"use client";

import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { DeviceRecord } from "@/cashier/contexts/DevicesContext";

/**
 * Data access for the mobile device (phone) inventory. See
 * supabase/migrations/20260922000056_mobile_device_inventory.sql — mirrors
 * lib/inventory/accessories.ts, but a device is tracked one unit at a time by
 * IMEI rather than as a countable stock number.
 */

interface DeviceRow {
  id: number;
  imei: string;
  imei2: string | null;
  serial_number: string | null;
  name: string;
  model_number: string | null;
  brand: string;
  storage: string;
  ram: string | null;
  color: string;
  buying_price: number | string;
  selling_price: number | string;
  min_selling_price: number | string;
  supplier: string;
  status: "available" | "sold" | "reserved";
  notes: string | null;
  added_date: string;
}

const num = (v: number | string) => Number(v);

const DEVICE_COLUMNS =
  "id, imei, imei2, serial_number, name, model_number, brand, storage, ram, color, buying_price, selling_price, min_selling_price, supplier, status, notes, added_date";

function toDevice(row: DeviceRow): DeviceRecord {
  return {
    id: row.id,
    imei: row.imei,
    imei2: row.imei2 ?? "",
    serialNumber: row.serial_number ?? "",
    name: row.name,
    modelNumber: row.model_number ?? "",
    brand: row.brand,
    storage: row.storage,
    ram: row.ram ?? "",
    color: row.color,
    buyingPrice: num(row.buying_price),
    suggestedPrice: num(row.selling_price),
    minSellingPrice: num(row.min_selling_price),
    supplier: row.supplier,
    status: row.status,
    notes: row.notes ?? "",
    addedDate: row.added_date,
  };
}

export async function fetchDevices(): Promise<DeviceRecord[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await getSupabaseBrowserClient()
    .from("mobile_devices")
    .select(DEVICE_COLUMNS)
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);
  return (data as DeviceRow[]).map(toDevice);
}

/** Insert (id === 0) or update one device. */
export async function saveDevice(device: DeviceRecord): Promise<DeviceRecord> {
  const payload = {
    imei: device.imei.trim(),
    imei2: device.imei2.trim(),
    serial_number: device.serialNumber.trim(),
    name: device.name.trim(),
    model_number: device.modelNumber.trim(),
    brand: device.brand,
    storage: device.storage,
    ram: device.ram,
    color: device.color,
    buying_price: device.buyingPrice,
    selling_price: device.suggestedPrice,
    min_selling_price: device.minSellingPrice,
    supplier: device.supplier,
    status: device.status,
    notes: device.notes ?? "",
    added_date: device.addedDate,
  };

  const sb = getSupabaseBrowserClient();
  const query = device.id
    ? sb.from("mobile_devices").update(payload).eq("id", device.id)
    : sb.from("mobile_devices").insert(payload);

  const { data, error } = await query.select(DEVICE_COLUMNS).single();

  if (error) {
    if (error.code === "23505") {
      if (error.message.includes("imei2")) throw new Error(`IMEI 2 "${payload.imei2}" is already used by another device.`);
      if (error.message.includes("serial_number")) throw new Error(`Serial number "${payload.serial_number}" is already used by another device.`);
      throw new Error(`IMEI "${payload.imei}" is already used by another device.`);
    }
    throw new Error(error.message);
  }
  return toDevice(data as DeviceRow);
}

export async function deleteDevice(id: number): Promise<void> {
  const { error } = await getSupabaseBrowserClient().from("mobile_devices").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
