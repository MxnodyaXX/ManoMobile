"use client";

import { useState } from "react";
import { useAccessories, type AccessoryProduct } from "@/cashier/contexts/AccessoriesContext";
import RenameListModal, { type RenameItem } from "@/cashier/components/shared/RenameListModal";
import { renameAccessoryProduct } from "@/lib/inventory/accessories";
import { suggestProductName } from "@/lib/inventory/productName";

/** Renames existing accessories to the shop's format. Only the name is written. */
export default function RenameProductsModal({ products, onClose }: {
  products: AccessoryProduct[];
  onClose: () => void;
}) {
  const { reload } = useAccessories();
  const [items] = useState<RenameItem[]>(() => products
    .map(p => ({ key: String(p.id), label: p.code, oldName: p.name, newName: suggestProductName(p) }))
    .filter(i => i.newName && i.newName !== i.oldName));

  return (
    <RenameListModal
      title="Tidy Product Names"
      intro="Check each new name and edit it if needed. Nothing changes until you press Rename. Old invoices keep their printed names."
      items={items}
      catalogue={products.map(p => ({ key: String(p.id), name: p.name }))}
      clashNote="Another product would have this same name. Add a colour or type after a dash."
      rename={(item, newName) => renameAccessoryProduct(Number(item.key), item.oldName, newName)}
      onFinished={reload}
      onClose={onClose}
    />
  );
}
