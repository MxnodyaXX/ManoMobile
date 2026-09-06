"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchAccessoryBrands } from "@/lib/inventory/reference";
import type { Brand } from "@/cashier/contexts/InventoryContext";
import { useRepair } from "@/cashier/contexts/RepairContext";

/**
 * The handset brands this shop actually sees.
 *
 * Three sources, in order of authority:
 *
 *   1. The brand registry — real rows in the database, managed from Admin
 *      Control, filtered to the ones marked as device brands. This is the
 *      shop's own answer to "which brands do we handle".
 *   2. Every brand already on a repair job. A handset booked in last year
 *      under a brand nobody has since added to the registry must still be
 *      selectable, or editing that job would silently change its make.
 *   3. A small seed list, so a shop that has just been set up — no registry
 *      rows, no jobs — still gets a usable dropdown on day one.
 *
 * Merged and sorted rather than layered, because to the person holding the
 * phone they are one list: the question is what is written on the back, not
 * which table it came from.
 *
 * The registry is fetched directly rather than read from InventoryContext:
 * this is used on the technician side, which mounts no InventoryProvider, and
 * useInventory() throws outside one. Wrapping the whole technician app in an
 * inventory provider to fill one dropdown would load the entire accessory
 * catalogue on every bench screen.
 */

/** Day-one fallback. Never the whole list once the shop has any history. */
export const SEED_BRANDS = [
  "Apple", "Samsung", "Xiaomi", "OPPO", "OnePlus",
  "Realme", "Huawei", "Vivo", "Nokia", "Other",
];

export function useDeviceBrands(): string[] {
  const { jobs } = useRepair();
  const [brands, setBrands] = useState<Brand[]>([]);

  useEffect(() => {
    let active = true;
    fetchAccessoryBrands()
      .then(rows => { if (active) setBrands(rows); })
      // A registry that will not load leaves the seed list and the shop's own
      // job history, which is enough to pick a brand from. Failing the whole
      // form over a dropdown's options would be worse.
      .catch(() => { if (active) setBrands([]); });
    return () => { active = false; };
  }, []);

  return useMemo(() => {
    const out = new Set<string>(SEED_BRANDS);

    // Inactive brands are deliberately excluded here but not from the job
    // history below: a retired brand should not be offered for a new device,
    // while a job that already carries one keeps it.
    for (const b of brands) {
      if (b.active && (b.type === "device" || b.type === "both")) out.add(b.name.trim());
    }

    for (const j of jobs) {
      const name = j.brand?.trim();
      if (name) out.add(name);
    }

    out.delete("");
    return [...out].sort((a, b) => a.localeCompare(b));
  }, [brands, jobs]);
}
