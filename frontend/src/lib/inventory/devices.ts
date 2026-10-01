"use client";

import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { DeviceRecord, DeviceStatus } from "@/cashier/contexts/DevicesContext";

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
  status: DeviceStatus;
  // Added by 20260924000059 / 20260927000060 — optional so a database without
  // those migrations still loads.
  sold_invoice_no?: string | null;
  sold_price?: number | string | null;
  returned_from_invoice?: string | null;
  return_reason?: string | null;
  notes: string | null;
  added_date: string;
}

const num = (v: number | string) => Number(v);

// "*" rather than a column list, so columns added by later migrations come
// through when present and their absence never breaks the inventory.
const DEVICE_COLUMNS = "*";

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
    soldInvoiceNo: row.sold_invoice_no ?? null,
    soldPrice: row.sold_price == null ? null : Number(row.sold_price),
    returnedFromInvoice: row.returned_from_invoice ?? null,
    returnReason: row.return_reason ?? null,
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

/**
 * Sell a mobile sale's stock and take its invoice number, in one transaction —
 * see sell_mobile_sale() in migration 20260924000059. Every device is marked
 * sold and every accessory line deducted, or (on any refusal: already sold,
 * below minimum price, short on stock) nothing moves and no number is burned.
 */
export async function sellMobileSale(
  devices: { id: number; price: number }[],
  accessories: { id: number; qty: number }[],
  /** Required by the database when any device is under its minimum price —
   *  see migration 20261001000064. Booked to the Below-Minimum Sales account. */
  belowMinReason?: string,
): Promise<string> {
  const { data, error } = await getSupabaseBrowserClient().rpc("sell_mobile_sale", {
    p_devices: devices,
    p_accessories: accessories,
    p_below_min_reason: belowMinReason?.trim() || null,
  });
  if (error) {
    if (/Could not find the function|PGRST202/.test(error.message)) {
      throw new Error("Mobile sales are not set up yet — run migration 20260924000059_mobile_device_sales.sql.");
    }
    throw new Error(error.message);
  }
  if (typeof data !== "string" || !data) throw new Error("The sale was not recorded — no invoice number came back.");
  return data;
}

export type ReplacementDisposition = "resell" | "return_to_company";

export interface DeviceReplacement {
  id: number;
  invoiceNo: string;
  returnedDeviceId: number;
  replacementDeviceId: number;
  returnedImei: string;
  replacementImei: string;
  reason: string;
  disposition: ReplacementDisposition;
  returnedPrice: number;
  replacementPrice: number;
  priceDifference: number;
  topupInvoiceNo: string | null;
  createdAt: string;
}

const toReplacement = (r: Record<string, unknown>): DeviceReplacement => ({
  id: Number(r.id),
  invoiceNo: r.invoice_no as string,
  returnedDeviceId: Number(r.returned_device_id),
  replacementDeviceId: Number(r.replacement_device_id),
  returnedImei: r.returned_imei as string,
  replacementImei: r.replacement_imei as string,
  reason: r.reason as string,
  disposition: r.disposition as ReplacementDisposition,
  returnedPrice: Number(r.returned_price ?? 0),
  replacementPrice: Number(r.replacement_price ?? 0),
  priceDifference: Number(r.price_difference ?? 0),
  topupInvoiceNo: (r.topup_invoice_no as string | null) ?? null,
  createdAt: r.created_at as string,
});

const replacementsMissing = (msg: string) =>
  /Could not find the (function|table)|PGRST202|PGRST205|device_replacements/.test(msg)
    ? "Device replacement is not set up yet — run migration 20260927000060_mobile_device_replacements.sql."
    : msg;

/**
 * Swap a returned phone for another on the same invoice — see
 * replace_mobile_device() in migration 20260927000060. One transaction: the
 * replacement is sold, the returned unit goes to resale or to the supplier
 * pile, and the swap is logged. topupInvoiceNo is set when the customer owes
 * a difference, so the caller can receipt it.
 */
export async function replaceMobileDevice(a: {
  invoiceNo: string;
  returnedId: number;
  replacementId: number;
  reason: string;
  disposition: ReplacementDisposition;
  replacementPrice: number;
}): Promise<DeviceReplacement> {
  const { data, error } = await getSupabaseBrowserClient().rpc("replace_mobile_device", {
    p_invoice_no: a.invoiceNo,
    p_returned_id: a.returnedId,
    p_replacement_id: a.replacementId,
    p_reason: a.reason,
    p_disposition: a.disposition,
    p_replacement_price: a.replacementPrice,
  });
  if (error) throw new Error(replacementsMissing(error.message));
  return toReplacement(data as Record<string, unknown>);
}

/** Every swap made on one invoice, oldest first. Empty when there were none. */
export async function fetchReplacements(invoiceNo: string): Promise<DeviceReplacement[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await getSupabaseBrowserClient()
    .from("device_replacements")
    .select("*")
    .eq("invoice_no", invoiceNo)
    .order("created_at");
  if (error) throw new Error(replacementsMissing(error.message));
  return ((data ?? []) as Record<string, unknown>[]).map(toReplacement);
}

export async function deleteDevice(id: number): Promise<void> {
  const { error } = await getSupabaseBrowserClient().from("mobile_devices").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
