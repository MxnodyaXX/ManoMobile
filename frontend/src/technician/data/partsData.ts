export type PartCategory =
  | "Screen"
  | "Battery"
  | "Charging Port"
  | "Speaker / Mic"
  | "Camera"
  | "Back Glass"
  | "Board / IC"
  | "Other";

export interface SparePart {
  id: string;
  sku: string;
  name: string;
  category: PartCategory;
  compatibleWith: string[];
  stock: number;
  reorderLevel: number;
  costPrice: number;
  location: string;
}

export const SPARE_PARTS: SparePart[] = [];

export const PART_CATEGORIES: PartCategory[] = [
  "Screen", "Battery", "Charging Port", "Speaker / Mic", "Camera", "Back Glass", "Board / IC", "Other",
];
