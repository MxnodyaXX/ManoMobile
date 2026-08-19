"use client";

import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type {
  SparePart,
  PartCategory,
  PartRequest,
  PartRequestStatus,
} from "@/cashier/contexts/PartsContext";

/**
 * Data access for the repair spare-parts catalogue and its request workflow.
 *
 * Two things here go through Postgres functions rather than plain table
 * writes, because both change stock and a browser cannot do a
 * read-modify-write safely: create_part_request() and resolve_part_request().
 * See migration 20260819000010 for why.
 */

// ─── Row shapes ──────────────────────────────────────────────────────────────

interface PartRow {
  id: number;
  sku: string;
  name: string;
  category: PartCategory;
  compatible_with: string[] | null;
  stock: number;
  reorder_level: number;
  cost_price: number | string;
  location: string | null;
}

interface RequestRow {
  id: number;
  job_id: string;
  job_device: string | null;
  technician_name: string;
  part_sku: string | null;
  part_name: string;
  quantity: number;
  status: PartRequestStatus;
  note: string | null;
  requested_at: string;
  resolved_at: string | null;
  installed_at: string | null;
}

// numeric(12,2) arrives as a string over PostgREST, so never trust the type.
const num = (v: number | string | null | undefined) => (v == null ? 0 : Number(v));

function toPart(row: PartRow): SparePart {
  return {
    id: String(row.id),
    sku: row.sku,
    name: row.name,
    category: row.category,
    compatibleWith: row.compatible_with ?? [],
    stock: row.stock,
    reorderLevel: row.reorder_level,
    costPrice: num(row.cost_price),
    location: row.location ?? "",
  };
}

function toRequest(row: RequestRow): PartRequest {
  return {
    id: String(row.id),
    jobId: row.job_id,
    jobDevice: row.job_device ?? "",
    technicianName: row.technician_name,
    partName: row.part_name,
    partSku: row.part_sku ?? "",
    quantity: row.quantity,
    status: row.status,
    note: row.note ?? undefined,
    requestedAt: new Date(row.requested_at),
    resolvedAt: row.resolved_at ? new Date(row.resolved_at) : undefined,
    installedAt: row.installed_at ? new Date(row.installed_at) : undefined,
  };
}

const PART_COLUMNS =
  "id, sku, name, category, compatible_with, stock, reorder_level, cost_price, location";

// ─── Catalogue ───────────────────────────────────────────────────────────────

export async function fetchParts(): Promise<SparePart[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await getSupabaseBrowserClient()
    .from("repair_parts")
    .select(PART_COLUMNS)
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);
  return (data as PartRow[] | null)?.map(toPart) ?? [];
}

/**
 * Insert or update one part. A blank id means "new" — the database assigns it,
 * rather than the form inventing one, so two browsers adding a part at the
 * same time can't land on the same key.
 */
export async function savePart(part: SparePart): Promise<SparePart> {
  const payload = {
    sku: part.sku.trim(),
    name: part.name.trim(),
    category: part.category,
    compatible_with: part.compatibleWith,
    stock: part.stock,
    reorder_level: part.reorderLevel,
    cost_price: part.costPrice,
    location: part.location,
  };

  const sb = getSupabaseBrowserClient();
  const existingId = /^\d+$/.test(part.id) ? Number(part.id) : null;

  const query = existingId === null
    ? sb.from("repair_parts").insert(payload)
    : sb.from("repair_parts").update(payload).eq("id", existingId);

  const { data, error } = await query.select(PART_COLUMNS).single();

  if (error) {
    // 23505 is unique_violation — always the SKU here, and worth saying so
    // plainly since "duplicate key value violates..." means nothing at a counter.
    if (error.code === "23505") {
      throw new Error(`SKU "${payload.sku}" is already used by another part.`);
    }
    throw new Error(error.message);
  }
  return toPart(data as PartRow);
}

export async function deletePart(id: string): Promise<void> {
  const { error } = await getSupabaseBrowserClient()
    .from("repair_parts")
    .delete()
    .eq("id", Number(id));
  if (error) throw new Error(error.message);
}

// ─── Requests ────────────────────────────────────────────────────────────────

export async function fetchPartRequests(): Promise<PartRequest[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await getSupabaseBrowserClient()
    .from("repair_part_requests")
    .select("*")
    .order("requested_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data as RequestRow[] | null)?.map(toRequest) ?? [];
}

export async function createPartRequest(
  req: Omit<PartRequest, "id" | "requestedAt" | "status" | "installedAt">,
  autoApprove: boolean,
): Promise<PartRequest> {
  const { data, error } = await getSupabaseBrowserClient().rpc("create_part_request", {
    p_job_id: req.jobId,
    p_job_device: req.jobDevice,
    p_technician_name: req.technicianName,
    p_part_sku: req.partSku,
    p_part_name: req.partName,
    p_quantity: req.quantity,
    p_note: req.note ?? "",
    p_auto_approve: autoApprove,
  });

  if (error) throw new Error(error.message);
  return toRequest(data as RequestRow);
}

/** Approve (deducts stock) or reject. Throws if stock ran out in between. */
export async function resolvePartRequest(
  id: string,
  status: "Approved" | "Rejected",
): Promise<PartRequest> {
  const { data, error } = await getSupabaseBrowserClient().rpc("resolve_part_request", {
    p_request_id: Number(id),
    p_status: status,
  });

  if (error) throw new Error(error.message);
  return toRequest(data as RequestRow);
}

/** Stamps when the part actually went into the device. Deliberately leaves
 *  `status` alone: Issued means handed over from stores, which is a separate
 *  fact from having been fitted. */
export async function markRequestInstalled(id: string): Promise<void> {
  const { error } = await getSupabaseBrowserClient()
    .from("repair_part_requests")
    .update({ installed_at: new Date().toISOString() })
    .eq("id", Number(id));
  if (error) throw new Error(error.message);
}

// ─── One-time migration out of localStorage ──────────────────────────────────

/**
 * Parts typed in before this table existed live in localStorage on whichever
 * machine entered them. Rather than making the shop retype the catalogue, the
 * first load after this ships pushes them up, then marks the key done.
 *
 * Conflicts on SKU are ignored rather than overwritten: if the part already
 * exists in the database, that copy is the shared one and a stale local row
 * must not clobber its stock count.
 */
const LEGACY_PARTS_KEY = "mano_repair_parts";
const IMPORT_DONE_KEY = "mano_repair_parts_imported";

export async function importLegacyParts(): Promise<number> {
  if (typeof window === "undefined" || !isSupabaseConfigured()) return 0;
  if (window.localStorage.getItem(IMPORT_DONE_KEY)) return 0;

  let legacy: SparePart[] = [];
  try {
    const raw = window.localStorage.getItem(LEGACY_PARTS_KEY);
    if (raw) legacy = JSON.parse(raw) as SparePart[];
  } catch {
    // Unparseable local data is not worth failing the page load over.
    window.localStorage.setItem(IMPORT_DONE_KEY, "1");
    return 0;
  }

  const rows = legacy
    .filter(p => p?.sku && p?.name)
    .map(p => ({
      sku: p.sku.trim(),
      name: p.name.trim(),
      category: p.category ?? "Other",
      compatible_with: p.compatibleWith ?? [],
      stock: p.stock ?? 0,
      reorder_level: p.reorderLevel ?? 0,
      cost_price: p.costPrice ?? 0,
      location: p.location ?? "",
    }));

  if (rows.length === 0) {
    window.localStorage.setItem(IMPORT_DONE_KEY, "1");
    return 0;
  }

  const { data, error } = await getSupabaseBrowserClient()
    .from("repair_parts")
    .upsert(rows, { onConflict: "sku", ignoreDuplicates: true })
    .select("id");

  // Left unmarked on failure so the next load tries again — better than
  // silently losing a catalogue because one page load had no network.
  if (error) throw new Error(error.message);

  window.localStorage.setItem(IMPORT_DONE_KEY, "1");
  return data?.length ?? 0;
}
