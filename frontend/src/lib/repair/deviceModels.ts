"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { normaliseModelNumber, type ModelInfo } from "@/cashier/data/modelNumbers";

/**
 * Model number → brand/model, from the database.
 *
 * Intake used to derive this by scanning past repair_jobs, which meant it
 * learned from every mistyped entry too. This is the corrected reference table
 * (see migration 20260825000003_device_models.sql); job history stays as a
 * fallback for numbers the table has not caught up with yet.
 */

export interface DeviceModel {
  id: string;
  modelNumber: string;
  brand: string;
  model: string;
}

interface ModelRow {
  id: number;
  model_number: string;
  brand: string;
  model: string;
}

const toModel = (r: ModelRow): DeviceModel => ({
  id: String(r.id),
  modelNumber: r.model_number,
  brand: r.brand,
  model: r.model,
});

const COLUMNS = "id, model_number, brand, model";

export async function fetchDeviceModels(): Promise<DeviceModel[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await getSupabaseBrowserClient()
    .from("device_models")
    .select(COLUMNS)
    .order("brand", { ascending: true })
    .order("model", { ascending: true });

  if (error) throw new Error(error.message);
  return (data as ModelRow[] | null)?.map(toModel) ?? [];
}

/**
 * Record what a model number turned out to be.
 *
 * Called after an intake is saved, and deliberately picky: a blank model or the
 * "Other" brand placeholder means nobody actually identified the device, and
 * teaching the lookup from those is what filled the old one with nonsense.
 *
 * Failures are swallowed by the caller — a reference table that could not be
 * updated must never cost the shop the job it just booked in.
 */
export async function rememberDeviceModel(
  modelNumber: string | undefined,
  brand: string | undefined,
  model: string | undefined,
): Promise<void> {
  const num = (modelNumber ?? "").trim();
  const b = (brand ?? "").trim();
  const m = (model ?? "").trim();
  if (!num || !m || !b || b.toLowerCase() === "other") return;
  if (!isSupabaseConfigured()) return;

  const sb = getSupabaseBrowserClient();

  // The unique index is on the normalised number, which PostgREST cannot name
  // in on_conflict, so this is a look-then-write. A race just means two
  // identical facts, and the second insert loses to the index — harmless.
  const { data } = await sb.from("device_models").select("id, model_number");
  const existing = (data as { id: number; model_number: string }[] | null)
    ?.find(r => normaliseModelNumber(r.model_number) === normaliseModelNumber(num));

  if (existing) {
    await sb.from("device_models").update({ brand: b, model: m }).eq("id", existing.id);
  } else {
    await sb.from("device_models").insert({ model_number: num, brand: b, model: m });
  }
}

export async function saveDeviceModel(entry: Omit<DeviceModel, "id"> & { id?: string }): Promise<void> {
  const payload = {
    model_number: entry.modelNumber.trim(),
    brand: entry.brand.trim(),
    model: entry.model.trim(),
  };
  const sb = getSupabaseBrowserClient();
  const { error } = entry.id
    ? await sb.from("device_models").update(payload).eq("id", Number(entry.id))
    : await sb.from("device_models").insert(payload);

  if (error) {
    throw new Error(
      error.code === "23505"
        ? `Model number "${payload.model_number}" is already listed.`
        : error.message,
    );
  }
}

export async function deleteDeviceModel(id: string): Promise<void> {
  const { error } = await getSupabaseBrowserClient()
    .from("device_models").delete().eq("id", Number(id));
  if (error) throw new Error(error.message);
}

/** Normalised number → brand/model, ready for the intake form's lookup. */
export function useDeviceModelLookup(): {
  lookup: Map<string, ModelInfo>;
  models: DeviceModel[];
  reload: () => Promise<void>;
} {
  const [models, setModels] = useState<DeviceModel[]>([]);

  const reload = useCallback(async () => {
    try {
      setModels(await fetchDeviceModels());
    } catch {
      // Table not migrated yet, or offline. Intake falls back to job history.
      setModels([]);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  const lookup = new Map<string, ModelInfo>(
    models.map(m => [normaliseModelNumber(m.modelNumber), { brand: m.brand, model: m.model }]),
  );

  return { lookup, models, reload };
}
