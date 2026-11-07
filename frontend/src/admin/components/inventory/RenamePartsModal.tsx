"use client";

import { useState } from "react";
import { useParts, type SparePart } from "@/cashier/contexts/PartsContext";
import RenameListModal, { type RenameItem } from "@/cashier/components/shared/RenameListModal";
import { renameRepairParts } from "@/lib/repair/parts";
import { partGroupKey, suggestPartName } from "@/lib/inventory/productName";

/**
 * Renames existing parts to the shop's format, one line per name. Types with no
 * brand share a name, so they move together in one save. Types with a brand have
 * their own name, so their own line, and stay listed together because the
 * catalogue groups them by the name without the brand.
 */
export default function RenamePartsModal({ parts, onClose }: {
  parts: SparePart[];
  onClose: () => void;
}) {
  const { reload } = useParts();
  const [lines] = useState(() => {
    const m = new Map<string, SparePart[]>();
    for (const p of parts) {
      const key = `${partGroupKey(p)}|${(p.brand ?? "").trim().toUpperCase()}`;
      m.set(key, [...(m.get(key) ?? []), p]);
    }
    return m;
  });
  const [items] = useState<RenameItem[]>(() => {
    // Every type of a part looks at the same devices, so they agree on its model.
    const devicesOf = new Map<string, string[]>();
    for (const p of parts) {
      const key = partGroupKey(p);
      devicesOf.set(key, [...new Set([...(devicesOf.get(key) ?? []), ...p.compatibleWith])]);
    }
    return [...lines].flatMap(([key, members]) => {
      const head = members[0];
      const newName = suggestPartName({
        name: head.name,
        category: head.category,
        brand: head.brand,
        compatibleWith: devicesOf.get(partGroupKey(head)) ?? [],
      });
      return newName && newName !== head.name
        ? [{ key, label: members.map(p => p.sku).join(", "), oldName: head.name, newName }]
        : [];
    });
  });

  // Without former_names a rename would lose the costs of older jobs, and "*"
  // only brings these columns back once the migrations have been run.
  const missingMigration = parts.some(p => p.formerNames === undefined || p.brand === undefined);

  return (
    <RenameListModal
      title="Tidy Part Names"
      intro="Model, then brand, then part. Types with no brand share a line and are renamed together. Nothing changes until you press Rename. Old jobs keep their names and their parts cost."
      items={items}
      catalogue={[...lines].map(([key, members]) => ({ key, name: members[0].name }))}
      clashNote="Another part would have this same name, so they'd be listed together as types of one part."
      blocked={missingMigration
        ? "Run migrations 20261107000093_repair_part_former_names.sql and 20261107000094_repair_part_brand.sql first. Without them, renaming parts would lose the parts cost on older jobs."
        : undefined}
      rename={(item, newName) => {
        const members = lines.get(item.key) ?? [];
        return renameRepairParts(members.map(p => p.id), [...new Set(members.map(p => p.name))], newName);
      }}
      onFinished={reload}
      onClose={onClose}
    />
  );
}
