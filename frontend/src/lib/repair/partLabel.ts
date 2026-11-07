import type { SparePart } from "@/cashier/contexts/PartsContext";

/** What a designed part label can print — see LABEL_TOKENS. */
export const partLabelTokens = (p: SparePart) => ({
  partNo: p.partNo ?? "",
  category: p.category,
  location: p.location,
  compatible: p.compatibleWith.join(", "),
  supplier: p.supplier ?? "",
});
