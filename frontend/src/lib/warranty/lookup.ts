"use client";

import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { RepairJob } from "@/cashier/contexts/RepairContext";
import { effectiveStatus, type Warranty } from "@/cashier/contexts/WarrantyContext";
import { periodOf } from "@/lib/repair/warrantyLine";

/**
 * "Is this still under warranty?" — for anything the shop sold or repaired.
 *
 * One box takes whatever the customer has: an invoice number, a job number,
 * an IMEI, an accessory's item code, or a phone number. Everything that
 * reference leads to is gathered and each item gets a verdict:
 *
 *   repairs      the job's issued warranty (warranties table), or the period
 *                written on an older job, from the day it was handed over;
 *   phones       warranty_policies 'device', from the sale date;
 *   accessories  warranty_policies 'accessory' — the category's own rule if
 *                there is one — from the sale date;
 *   parts/other  their policy, from the sale date.
 *
 * Voided invoices are never "covered". See migration 20261006000066.
 */

export type CoverageKind = "Repair" | "Phone" | "Accessory" | "Part" | "Other";
export type CoverageState = "Active" | "Expired" | "Pending" | "None" | "Void";

export interface CoverageItem {
  key: string;
  kind: CoverageKind;
  title: string;
  /** IMEI, item code, fault — whatever identifies the thing itself. */
  detail: string;
  invoiceNo: string | null;
  jobId: string | null;
  customer: string | null;
  phone: string | null;
  /** The day cover starts: sale date, or handover for a repair. */
  startsOn: string | null;
  durationDays: number;
  expiresOn: string | null;
  state: CoverageState;
  /** Days left while Active; days since expiry when Expired. */
  days: number | null;
  /** What the cover is called and what it means. */
  label: string;
  terms: string;
  /** Set for a repair with an issued warranty record (WR-…). */
  warranty?: Warranty;
  /** Why the state is what it is, when it is not obvious. */
  note?: string;
  /** Phones only: the device record, what it sold for, and whether it is
   *  still the unit on this sale (a replaced or refunded one is not). */
  deviceId?: number;
  soldPrice?: number;
  claimable?: boolean;
}

export interface WarrantyPolicy {
  id: number;
  kind: "device" | "accessory" | "part" | "other";
  category: string | null;
  durationDays: number;
  label: string;
  terms: string;
}

export interface LookupResult {
  query: string;
  /** What the query was recognised as — shown so the cashier knows why. */
  matchedAs: string[];
  items: CoverageItem[];
}

type Row = Record<string, unknown>;
const DAY = 86_400_000;

const PERIOD_DAYS: Record<string, number> = {
  "NO WARRANTY": 0, "7 DAYS WARRANTY": 7, "1 MONTH WARRANTY": 30,
  "3 MONTHS WARRANTY": 90, "6 MONTHS WARRANTY": 180, "1 YEAR WARRANTY": 365,
};

function verdict(startsOn: string | null, days: number): Pick<CoverageItem, "expiresOn" | "state" | "days"> {
  if (days <= 0) return { expiresOn: null, state: "None", days: null };
  if (!startsOn) return { expiresOn: null, state: "Pending", days: null };
  const start = new Date(/^\d{4}-\d{2}-\d{2}$/.test(startsOn) ? `${startsOn}T00:00:00` : startsOn).getTime();
  const end = start + days * DAY;
  const left = Math.ceil((end - Date.now()) / DAY);
  return {
    expiresOn: new Date(end).toISOString().slice(0, 10),
    state: left >= 0 ? "Active" : "Expired",
    days: left >= 0 ? left : -left,
  };
}

// ── Policies ────────────────────────────────────────────────────────────────

export async function fetchPolicies(): Promise<WarrantyPolicy[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await getSupabaseBrowserClient()
    .from("warranty_policies").select("*").order("kind").order("category", { nullsFirst: true });
  if (error) {
    if (/warranty_policies|PGRST205|Could not find/.test(error.message)) {
      throw new Error("Warranty policies are not set up yet — run migration 20261006000066_warranty_center.sql.");
    }
    throw new Error(error.message);
  }
  return ((data ?? []) as Row[]).map(r => ({
    id: Number(r.id),
    kind: r.kind as WarrantyPolicy["kind"],
    category: (r.category as string | null) ?? null,
    durationDays: Number(r.duration_days ?? 0),
    label: String(r.label ?? ""),
    terms: String(r.terms ?? ""),
  }));
}

export async function savePolicy(p: Omit<WarrantyPolicy, "id"> & { id?: number }): Promise<void> {
  const sb = getSupabaseBrowserClient();
  const row = {
    kind: p.kind, category: p.category?.trim() || null, duration_days: Math.max(0, Math.round(p.durationDays)),
    label: p.label.trim(), terms: p.terms.trim(), updated_at: new Date().toISOString(),
  };
  const { error } = p.id
    ? await sb.from("warranty_policies").update(row).eq("id", p.id)
    : await sb.from("warranty_policies").insert(row);
  if (error) {
    if (error.code === "23505") throw new Error("There is already a rule for that kind and category.");
    if (error.code === "42501") throw new Error("Only an Admin or Admin Cashier can change warranty policies.");
    throw new Error(error.message);
  }
}

export async function deletePolicy(id: number): Promise<void> {
  const { data, error } = await getSupabaseBrowserClient().from("warranty_policies").delete().eq("id", id).select("id");
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error("Only an Admin or Admin Cashier can change warranty policies.");
}

function policyFor(policies: WarrantyPolicy[], kind: WarrantyPolicy["kind"], category?: string | null): WarrantyPolicy | null {
  const cat = (category ?? "").trim().toLowerCase();
  return (cat && policies.find(p => p.kind === kind && (p.category ?? "").toLowerCase() === cat))
    || policies.find(p => p.kind === kind && !p.category)
    || null;
}

// ── The lookup ──────────────────────────────────────────────────────────────

/** "207", "inv207", "INV-207" → "INV-000207". */
function asInvoiceNo(q: string): string | null {
  const m = q.trim().toUpperCase().replace(/\s+/g, "").match(/^(?:INV-?)?(\d{1,7})$/);
  return m ? `INV-${m[1].padStart(6, "0")}` : null;
}

/** "584", "rm584", "RM-584" → "RM-584". */
function asJobId(q: string): string | null {
  const m = q.trim().toUpperCase().replace(/\s+/g, "").match(/^(?:RM-?)?(\d{1,6})$/);
  return m ? `RM-${m[1].padStart(3, "0")}` : null;
}

export async function lookupWarranty(
  rawQuery: string,
  ctx: { jobs: RepairJob[]; warranties: Warranty[]; policies: WarrantyPolicy[] },
): Promise<LookupResult> {
  const query = rawQuery.trim();
  const q = query.toLowerCase();
  const digits = query.replace(/\D/g, "");
  const matchedAs = new Set<string>();
  const invoiceNos = new Set<string>();
  const jobIds = new Set<string>();
  const sb = getSupabaseBrowserClient();
  const configured = isSupabaseConfigured();

  // Jobs — by number, the dealer's number, IMEI or phone.
  const jobId = asJobId(query);
  for (const j of ctx.jobs) {
    const hit =
      (jobId && j.id.toUpperCase() === jobId) ||
      j.id.toLowerCase() === q ||
      (j.dealerJobNo && j.dealerJobNo.toLowerCase() === q) ||
      (digits.length >= 6 && (j.imei ?? "").replace(/\D/g, "").includes(digits)) ||
      (digits.length >= 9 && j.phone.replace(/\D/g, "").endsWith(digits.slice(-9)));
    if (hit) {
      jobIds.add(j.id);
      matchedAs.add(digits.length >= 9 && j.phone.replace(/\D/g, "").endsWith(digits.slice(-9)) ? "Customer phone" : (digits.length >= 6 && !jobId ? "IMEI" : "Job number"));
      if (j.invoiceNo) invoiceNos.add(j.invoiceNo);
    }
  }
  // Repair warranties by their own number or IMEI.
  for (const w of ctx.warranties) {
    if (w.id.toLowerCase() === q || (digits.length >= 6 && (w.imei ?? "").replace(/\D/g, "").includes(digits))) {
      jobIds.add(w.jobId);
      matchedAs.add(w.id.toLowerCase() === q ? "Warranty number" : "IMEI");
    }
  }

  if (configured) {
    // Invoice number.
    const inv = asInvoiceNo(query);
    if (inv) {
      const { data } = await sb.from("sales").select("invoice_no").eq("invoice_no", inv).limit(1);
      if (data?.length) { invoiceNos.add(inv); matchedAs.add("Invoice number"); }
    }

    // A phone sold — by IMEI.
    if (digits.length >= 6) {
      const { data } = await sb.from("mobile_devices")
        .select("sold_invoice_no, imei, imei2")
        .or(`imei.ilike.%${digits}%,imei2.ilike.%${digits}%`)
        .limit(20);
      for (const d of (data ?? []) as Row[]) {
        if (d.sold_invoice_no) { invoiceNos.add(String(d.sold_invoice_no)); matchedAs.add("IMEI"); }
      }
    }

    // An accessory — by item code.
    if (!/^\d+$/.test(query) || query.length < 6) {
      const { data: prods } = await sb.from("accessory_products").select("id, code").ilike("code", query).limit(5);
      const ids = ((prods ?? []) as Row[]).map(p => String(p.id));
      if (ids.length) {
        matchedAs.add("Item code");
        const { data: lines } = await sb.from("sale_items").select("invoice_no")
          .eq("kind", "accessory").in("reference_id", ids).order("created_at", { ascending: false }).limit(60);
        for (const l of (lines ?? []) as Row[]) invoiceNos.add(String(l.invoice_no));
      }
    }

    // A customer — by phone number on the sale.
    if (digits.length >= 9) {
      const { data } = await sb.from("sales").select("invoice_no").ilike("customer_phone", `%${digits.slice(-9)}%`)
        .order("sold_on", { ascending: false }).limit(40);
      for (const s of (data ?? []) as Row[]) { invoiceNos.add(String(s.invoice_no)); matchedAs.add("Customer phone"); }
    }
  }

  const items: CoverageItem[] = [];
  const coveredJobs = new Set<string>();

  // Every invoice found: its lines, each with a verdict.
  if (configured && invoiceNos.size) {
    const nos = [...invoiceNos];
    const [{ data: sales }, { data: lines }] = await Promise.all([
      sb.from("sales").select("invoice_no, sold_on, status, customer, customer_phone, category, items, total, job_ids").in("invoice_no", nos),
      sb.from("sale_items").select("invoice_no, kind, reference_id, description, qty, line_total").in("invoice_no", nos),
    ]);
    const accIds = ((lines ?? []) as Row[]).filter(l => l.kind === "accessory").map(l => String(l.reference_id));
    const cats = new Map<string, { category: string; code: string }>();
    if (accIds.length) {
      const { data } = await sb.from("accessory_products").select("id, category, code").in("id", accIds);
      for (const p of (data ?? []) as Row[]) cats.set(String(p.id), { category: String(p.category ?? ""), code: String(p.code ?? "") });
    }
    // A phone's own warranty, set on the device in Inventory (migration
    // 20261006000068). Wins over the shop's phone policy when it is set.
    const imeis = ((lines ?? []) as Row[]).filter(l => l.kind === "device" && l.reference_id).map(l => String(l.reference_id));
    type Cover = { id: number; days: number | null; note: string; name: string; soldInvoiceNo: string | null; soldPrice: number | null };
    const deviceCover = new Map<string, Cover>();
    const toCover = (d: Row): Cover => ({
      id: Number(d.id),
      days: d.warranty_days == null ? null : Number(d.warranty_days),
      note: String(d.warranty_note ?? ""),
      name: [d.name, d.storage, d.color].filter(Boolean).join(" · "),
      soldInvoiceNo: (d.sold_invoice_no as string | null) ?? null,
      soldPrice: d.sold_price == null ? null : Number(d.sold_price),
    });
    if (imeis.length) {
      const { data } = await sb.from("mobile_devices").select("*").in("imei", imeis);
      for (const d of (data ?? []) as Row[]) deviceCover.set(String(d.imei), toCover(d));
    }
    // Phones sold on these invoices but not one of their printed lines — the
    // unit handed over as a replacement goes out on the original invoice.
    const { data: onInvoice } = await sb.from("mobile_devices").select("*").in("sold_invoice_no", nos);
    const extraUnits = ((onInvoice ?? []) as Row[]).filter(d => !imeis.includes(String(d.imei)));
    for (const d of extraUnits) deviceCover.set(String(d.imei), toCover(d));

    for (const s of (sales ?? []) as Row[]) {
      const invoiceNo = String(s.invoice_no);
      const voided = s.status === "Voided";
      const soldOn = String(s.sold_on);
      const base = { invoiceNo, customer: (s.customer as string) ?? null, phone: (s.customer_phone as string) ?? null };
      const myLines = ((lines ?? []) as Row[]).filter(l => l.invoice_no === invoiceNo);

      for (const [i, l] of myLines.entries()) {
        const kind = String(l.kind);
        if (kind === "repair_service") {
          const jid = String(l.reference_id ?? "");
          if (jid) { jobIds.add(jid); }
          continue; // repairs are built from the job below, with their own warranty
        }
        const policyKind = kind === "device" ? "device" : kind === "accessory" ? "accessory" : kind === "repair_part" ? "part" : "other";
        const acc = kind === "accessory" ? cats.get(String(l.reference_id)) : undefined;
        const pol = policyFor(ctx.policies, policyKind, acc?.category);
        const own = kind === "device" ? deviceCover.get(String(l.reference_id)) : undefined;
        const ownDays = own?.days ?? null;
        const days = ownDays ?? pol?.durationDays ?? 0;
        const v = verdict(soldOn, days);
        const ownLabel = ownDays === null ? null
          : ownDays === 0 ? "No warranty"
          : ownDays % 365 === 0 ? `${ownDays / 365} year${ownDays === 365 ? "" : "s"} warranty`
          : ownDays % 30 === 0 ? `${ownDays / 30} month${ownDays === 30 ? "" : "s"} warranty`
          : `${ownDays} days warranty`;
        // A phone that has since been replaced or refunded is no longer the
        // customer's — its cover went with the swap, or ended with the refund.
        const gone = kind === "device" && !!own && own.soldInvoiceNo !== invoiceNo;
        items.push({
          key: `${invoiceNo}-${i}`,
          kind: kind === "device" ? "Phone" : kind === "accessory" ? "Accessory" : kind === "repair_part" ? "Part" : "Other",
          title: String(l.description ?? "Item"),
          detail: kind === "device" ? `IMEI ${l.reference_id ?? "—"}` : acc ? `Code ${acc.code}${acc.category ? ` · ${acc.category}` : ""}` : `Qty ${l.qty ?? 1}`,
          jobId: null, ...base,
          startsOn: soldOn, durationDays: days, ...v,
          ...(voided || gone ? { state: "Void" as const, days: null } : {}),
          label: ownLabel
            ? [ownLabel, own?.note].filter(Boolean).join(" · ")
            : [pol?.label || (days ? `${days} days` : "No warranty"), own?.note].filter(Boolean).join(" · "),
          terms: pol?.terms ?? "",
          note: voided ? "This invoice was voided."
            : gone ? "This unit came back — replaced or refunded. It is no longer with the customer."
            : ownLabel || pol ? undefined
            : "No warranty set on this item, and no shop policy for its kind.",
          ...(kind === "device" && own ? {
            deviceId: own.id, soldPrice: own.soldPrice ?? Number(l.line_total ?? 0),
            claimable: !voided && !gone,
          } : {}),
        });
      }

      // Replacement units now on this invoice. Their cover runs on from the
      // original sale — a swap does not start the warranty again.
      for (const d of extraUnits.filter(x => x.sold_invoice_no === invoiceNo)) {
        const own = deviceCover.get(String(d.imei))!;
        const pol = policyFor(ctx.policies, "device");
        const days = own.days ?? pol?.durationDays ?? 0;
        items.push({
          key: `${invoiceNo}-unit-${own.id}`, kind: "Phone",
          title: own.name || "Phone", detail: `IMEI ${d.imei}`,
          jobId: null, ...base, startsOn: soldOn, durationDays: days, ...verdict(soldOn, days),
          ...(voided ? { state: "Void" as const, days: null } : {}),
          label: [own.days == null ? pol?.label ?? "Shop warranty" : `${days} days warranty`, own.note].filter(Boolean).join(" · "),
          terms: pol?.terms ?? "",
          note: "Replacement unit — cover continues from the original sale.",
          deviceId: own.id, soldPrice: own.soldPrice ?? 0, claimable: !voided,
        });
      }

      // An older sale with no lines: say what it was, without inventing cover.
      if (myLines.length === 0 && s.category !== "Repair") {
        items.push({
          key: `${invoiceNo}-summary`, kind: s.category === "Mobile" ? "Phone" : s.category === "Accessories" ? "Accessory" : "Other",
          title: String(s.items || "Sale"), detail: "Itemised lines were not recorded for this sale",
          jobId: null, ...base, startsOn: soldOn, durationDays: 0, expiresOn: null,
          state: voided ? "Void" : "None", days: null, label: "Unknown", terms: "",
          note: "Recorded before itemised invoices — check the printed invoice.",
        });
      }
      for (const jid of ((s.job_ids as string[] | null) ?? [])) jobIds.add(jid);
    }
  }

  // Every repair found: its own warranty.
  for (const jid of jobIds) {
    if (coveredJobs.has(jid)) continue;
    coveredJobs.add(jid);
    const j = ctx.jobs.find(x => x.id === jid);
    const w = ctx.warranties.find(x => x.jobId === jid);
    if (!j && !w) continue;
    const title = j ? [j.brand, j.model].filter(Boolean).join(" ") : w!.deviceModel;
    const base = {
      key: `job-${jid}`, kind: "Repair" as const, title: `${title} — repair`,
      detail: j ? `${j.issue || "Repair"}${j.imei ? ` · IMEI ${j.imei}` : ""}` : (w!.partsCovered.join(", ") || "Repair"),
      invoiceNo: j?.invoiceNo ?? w?.invoiceNo ?? null, jobId: jid,
      customer: j?.customerName ?? w?.customerName ?? null, phone: j?.phone ?? w?.customerPhone ?? null,
    };
    if (w && w.status === "Pending Activation" && j?.status === "Delivered") {
      // Handed over, but the warranty was never started — the checkout did not
      // used to start it (migration 20261006000066 fixes the stored record).
      // The device is in the customer's hands, so the cover runs from handover.
      const start = j.handover?.handedOverAt ?? j.completedAt ?? null;
      const v = verdict(start, w.durationDays);
      items.push({
        ...base, warranty: w,
        startsOn: start ? start.slice(0, 10) : null, durationDays: w.durationDays, ...v,
        label: `${w.durationDays} days · ${w.scope}`,
        terms: w.exclusions.length ? `Not covered: ${w.exclusions.join("; ")}` : "",
        note: start ? undefined : "Handed over, but the handover date was not recorded.",
      });
    } else if (w) {
      const st = effectiveStatus(w);
      const left = w.expiresAt ? Math.ceil((new Date(w.expiresAt).getTime() - Date.now()) / DAY) : null;
      items.push({
        ...base, warranty: w,
        startsOn: w.startsAt?.slice(0, 10) ?? null, durationDays: w.durationDays, expiresOn: w.expiresAt?.slice(0, 10) ?? null,
        state: st === "Active" ? "Active" : st === "Expired" ? "Expired" : st === "Void" ? "Void" : st === "Pending Activation" ? "Pending" : "Active",
        days: left === null ? null : Math.abs(left),
        label: `${w.durationDays} days · ${w.scope}`,
        terms: w.exclusions.length ? `Not covered: ${w.exclusions.join("; ")}` : "",
        note: st === "Pending Activation" ? "Starts when the device is handed back." : st === "Claimed" ? "A claim has been made on this warranty." : w.voidReason,
      });
    } else if (j) {
      // Older jobs: the period written on the job, from the day it went back.
      const days = PERIOD_DAYS[periodOf(j.jobWarranty)] ?? 0;
      const delivered = j.status === "Delivered";
      const start = delivered ? (j.handover?.handedOverAt?.slice(0, 10) ?? j.completedAt ?? null) : null;
      const v = verdict(start, days);
      items.push({
        ...base, startsOn: start, durationDays: days, ...v,
        ...(j.status === "Cancelled" ? { state: "Void" as const } : {}),
        ...(!delivered && days > 0 && j.status !== "Cancelled" ? { state: "Pending" as const } : {}),
        label: j.jobWarranty || "No warranty", terms: "",
        note: j.status === "Cancelled" ? "The job was cancelled." : !delivered && days > 0 ? "Starts when the device is handed back." : undefined,
      });
    }
  }

  // Active first, then pending, then the rest; newest first within each.
  const rank: Record<CoverageState, number> = { Active: 0, Pending: 1, Expired: 2, None: 3, Void: 4 };
  items.sort((a, b) => rank[a.state] - rank[b.state] || (b.startsOn ?? "").localeCompare(a.startsOn ?? ""));

  return { query, matchedAs: [...matchedAs], items };
}
