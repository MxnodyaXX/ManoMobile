"use client";

import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { fetchAllRows } from "@/lib/supabase/fetchAll";
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
  /** Absent until migration 20261106000092 is applied. */
  part_no?: string | null;
  sku: string;
  name: string;
  category: PartCategory;
  compatible_with: string[] | null;
  stock: number;
  reorder_level: number;
  cost_price: number | string;
  location: string | null;
  /** Absent until migration 20261008000072 is applied. */
  supplier?: string | null;
  /** Absent until migration 20261107000093 is applied. */
  former_names?: string[] | null;
  /** Absent until migration 20261107000094 is applied. */
  brand?: string | null;
  /** Absent until migration 20261107000095 is applied. */
  legacy_cost?: number | string | null;
  /** Absent until migration 20261107000096 is applied. */
  repair_part_barcodes?: { barcode: string }[] | null;
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
  /** Absent until migration 20261107000095 is applied. */
  unit_cost?: number | string | null;
}

// numeric(12,2) arrives as a string over PostgREST, so never trust the type.
const num = (v: number | string | null | undefined) => (v == null ? 0 : Number(v));

function toPart(row: PartRow): SparePart {
  return {
    id: String(row.id),
    partNo: row.part_no ?? "",
    sku: row.sku,
    name: row.name,
    category: row.category,
    compatibleWith: row.compatible_with ?? [],
    stock: row.stock,
    reorderLevel: row.reorder_level,
    costPrice: num(row.cost_price),
    location: row.location ?? "",
    supplier: row.supplier ?? "",
    formerNames: row.former_names ?? undefined,
    brand: row.brand ?? undefined,
    legacyCost: row.legacy_cost == null ? undefined : num(row.legacy_cost),
    barcodes: row.repair_part_barcodes ? row.repair_part_barcodes.map(b => b.barcode).sort() : undefined,
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
    unitCost: row.unit_cost == null ? undefined : num(row.unit_cost),
  };
}

// "*" rather than a list, so the catalogue still loads on a database that has
// not had the supplier column (migration 20261008000072) added yet.
const PART_COLUMNS = "*";

// ─── Catalogue ───────────────────────────────────────────────────────────────

export async function fetchParts(): Promise<SparePart[]> {
  if (!isSupabaseConfigured()) return [];
  const read = (columns: string) => getSupabaseBrowserClient()
    .from("repair_parts")
    .select(columns)
    .order("name", { ascending: true });

  // Without the barcodes table (migration 20261107000096 not applied) the
  // catalogue still loads.
  let { data, error } = await read(`${PART_COLUMNS}, repair_part_barcodes(barcode)`);
  if (error) ({ data, error } = await read(PART_COLUMNS));
  if (error) throw new Error(error.message);
  return (data as unknown as PartRow[] | null)?.map(toPart) ?? [];
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
    supplier: (part.supplier ?? "").trim(),
    brand: (part.brand ?? "").trim(),
  };

  const sb = getSupabaseBrowserClient();
  const existingId = /^\d+$/.test(part.id) ? Number(part.id) : null;

  const run = (body: Partial<typeof payload>) => (existingId === null
    ? sb.from("repair_parts").insert(body)
    : sb.from("repair_parts").update(body).eq("id", existingId)
  ).select(PART_COLUMNS).single();

  let { data, error } = await run(payload);
  // A newer column not there yet (migrations 20261008000072, 20261107000094 not
  // applied): save everything else rather than refuse the whole part.
  const rest: Partial<typeof payload> = { ...payload };
  for (let tries = 0; error && tries < 2; tries++) {
    const message = error.message;
    const missing = (["supplier", "brand"] as const).find(c => c in rest && new RegExp(c, "i").test(message));
    if (!missing) break;
    delete rest[missing];
    ({ data, error } = await run(rest));
  }

  if (error) {
    // 23505 is unique_violation — always the SKU here, and worth saying so
    // plainly since "duplicate key value violates..." means nothing at a counter.
    if (error.code === "23505") {
      throw new Error(`SKU "${payload.sku}" is already used by another part.`);
    }
    throw new Error(error.message);
  }
  const saved = toPart(data as PartRow);
  if (!part.barcodes) return saved;
  const { error: barcodeError } = await sb.rpc("set_repair_part_barcodes", {
    p_part_id: Number(saved.id),
    p_barcodes: part.barcodes,
  });
  if (barcodeError) {
    throw new Error(`Part saved, but its barcodes were not. Run migration 20261107000096_supplier_barcodes.sql. (${barcodeError.message})`);
  }
  return { ...saved, barcodes: part.barcodes };
}

/**
 * Renames all the types of one part in a single statement, so a failure can't
 * leave them split into two groups. Only the name is written, so a stock count
 * can't be put back to an older value. Returns false, changing nothing, if
 * someone renamed them in the meantime.
 */
export async function renameRepairParts(ids: string[], oldNames: string[], newName: string): Promise<boolean> {
  const { data, error } = await getSupabaseBrowserClient()
    .from("repair_parts")
    .update({ name: newName.trim() })
    .in("id", ids.map(Number))
    .in("name", oldNames)
    .select("id");
  if (error) throw new Error(error.message);
  return (data ?? []).length > 0;
}

export async function deletePart(id: string): Promise<void> {
  const { error } = await getSupabaseBrowserClient()
    .from("repair_parts")
    .delete()
    .eq("id", Number(id));
  if (error?.code === "23503") {
    throw new Error("This part was bought on a supplier invoice, so its history has to stay. Set its stock to 0 instead of deleting it.");
  }
  if (error) throw new Error(error.message);
}

// ─── Requests ────────────────────────────────────────────────────────────────

export async function fetchPartRequests(): Promise<PartRequest[]> {
  if (!isSupabaseConfigured()) return [];
  // Paged: a single read stops at 1,000 requests (see fetchAllRows).
  const sb = getSupabaseBrowserClient();
  const data = await fetchAllRows<RequestRow>((from, to) => sb
    .from("repair_part_requests").select("*")
    .order("requested_at", { ascending: false }).order("id", { ascending: false })
    .range(from, to));
  return data.map(toRequest);
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
