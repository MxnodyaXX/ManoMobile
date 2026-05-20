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

export const SPARE_PARTS: SparePart[] = [
  // ── Screens ─────────────────────────────────────────────────────────────────
  { id: "P001", sku: "SCR-IP14P-BLK",  name: "iPhone 14 Pro OLED Screen Assembly",     category: "Screen",        compatibleWith: ["iPhone 14 Pro", "iPhone 14 Pro Max"],         stock: 2,  reorderLevel: 3, costPrice: 14500, location: "A1-S1" },
  { id: "P002", sku: "SCR-IP13-BLK",   name: "iPhone 13 OLED Screen Assembly",           category: "Screen",        compatibleWith: ["iPhone 13", "iPhone 13 Mini"],                stock: 4,  reorderLevel: 3, costPrice: 9500,  location: "A1-S2" },
  { id: "P003", sku: "SCR-IP12-BLK",   name: "iPhone 12 LCD Screen Assembly",             category: "Screen",        compatibleWith: ["iPhone 12", "iPhone 12 Mini"],                stock: 3,  reorderLevel: 2, costPrice: 7200,  location: "A1-S3" },
  { id: "P004", sku: "SCR-SS-A54",     name: "Samsung Galaxy A54 AMOLED Screen",          category: "Screen",        compatibleWith: ["Samsung Galaxy A54"],                         stock: 2,  reorderLevel: 2, costPrice: 8800,  location: "A2-S1" },
  { id: "P005", sku: "SCR-SS-A32",     name: "Samsung Galaxy A32 LCD Screen",              category: "Screen",        compatibleWith: ["Samsung Galaxy A32"],                         stock: 5,  reorderLevel: 3, costPrice: 5200,  location: "A2-S2" },
  { id: "P006", sku: "SCR-RN12",       name: "Redmi Note 12 LCD Screen Assembly",          category: "Screen",        compatibleWith: ["Redmi Note 12", "Redmi Note 12 Pro"],         stock: 3,  reorderLevel: 2, costPrice: 4800,  location: "A3-S1" },
  { id: "P007", sku: "SCR-OP-A57",     name: "Oppo A57 LCD Screen Assembly",               category: "Screen",        compatibleWith: ["Oppo A57"],                                   stock: 1,  reorderLevel: 2, costPrice: 3900,  location: "A3-S2" },
  // ── Batteries ───────────────────────────────────────────────────────────────
  { id: "P008", sku: "BAT-IP14",       name: "iPhone 14 / 14 Pro Battery 3,279 mAh",      category: "Battery",       compatibleWith: ["iPhone 14", "iPhone 14 Pro"],                 stock: 6,  reorderLevel: 4, costPrice: 3800,  location: "B1-S1" },
  { id: "P009", sku: "BAT-IP13",       name: "iPhone 13 Battery 3,227 mAh",                category: "Battery",       compatibleWith: ["iPhone 13", "iPhone 13 Mini"],                stock: 8,  reorderLevel: 4, costPrice: 2900,  location: "B1-S2" },
  { id: "P010", sku: "BAT-SS-A54",     name: "Samsung Galaxy A54 Battery 5,000 mAh",       category: "Battery",       compatibleWith: ["Samsung Galaxy A54"],                         stock: 5,  reorderLevel: 3, costPrice: 2200,  location: "B2-S1" },
  { id: "P011", sku: "BAT-RN12",       name: "Redmi Note 12 Battery 5,000 mAh",            category: "Battery",       compatibleWith: ["Redmi Note 12"],                              stock: 7,  reorderLevel: 3, costPrice: 1800,  location: "B2-S2" },
  { id: "P012", sku: "BAT-HW-P30",     name: "Huawei P30 Pro Battery 4,200 mAh",           category: "Battery",       compatibleWith: ["Huawei P30 Pro"],                             stock: 2,  reorderLevel: 2, costPrice: 2600,  location: "B2-S3" },
  // ── Charging Ports ──────────────────────────────────────────────────────────
  { id: "P013", sku: "CHG-LTN-IP",     name: "iPhone Lightning Charging Port Flex",        category: "Charging Port", compatibleWith: ["iPhone 12", "iPhone 13"],                     stock: 10, reorderLevel: 5, costPrice: 1200,  location: "C1-S1" },
  { id: "P014", sku: "CHG-USBC-SS",    name: "Samsung USB-C Charging Port Board",           category: "Charging Port", compatibleWith: ["Samsung Galaxy A54", "Samsung Galaxy A32"],  stock: 8,  reorderLevel: 4, costPrice: 1500,  location: "C1-S2" },
  { id: "P015", sku: "CHG-USB-RN12",   name: "Redmi Note 12 USB-C Charging Port",           category: "Charging Port", compatibleWith: ["Redmi Note 12", "Oppo A57"],                  stock: 4,  reorderLevel: 3, costPrice: 1100,  location: "C1-S3" },
  // ── Cameras ─────────────────────────────────────────────────────────────────
  { id: "P016", sku: "CAM-IP14P-R",    name: "iPhone 14 Pro Rear Camera Module 48MP",       category: "Camera",        compatibleWith: ["iPhone 14 Pro"],                              stock: 1,  reorderLevel: 2, costPrice: 18000, location: "D1-S1" },
  { id: "P017", sku: "CAM-IP13-R",     name: "iPhone 13 Rear Camera Module 12MP",           category: "Camera",        compatibleWith: ["iPhone 13"],                                  stock: 2,  reorderLevel: 2, costPrice: 9500,  location: "D1-S2" },
  // ── Speakers / Mic ──────────────────────────────────────────────────────────
  { id: "P018", sku: "SPK-IP13-EAR",   name: "iPhone 13 Earpiece Speaker",                  category: "Speaker / Mic", compatibleWith: ["iPhone 13", "iPhone 13 Mini"],                stock: 5,  reorderLevel: 3, costPrice: 900,   location: "E1-S1" },
  { id: "P019", sku: "SPK-OP-R8",      name: "Oppo Reno 8 Loudspeaker Module",               category: "Speaker / Mic", compatibleWith: ["Oppo Reno 8"],                                stock: 3,  reorderLevel: 2, costPrice: 1400,  location: "E1-S2" },
  // ── Back Glass ──────────────────────────────────────────────────────────────
  { id: "P020", sku: "BCK-IP14P-DPP",  name: "iPhone 14 Pro Back Glass Deep Purple",        category: "Back Glass",    compatibleWith: ["iPhone 14 Pro"],                              stock: 2,  reorderLevel: 2, costPrice: 6500,  location: "F1-S1" },
  { id: "P021", sku: "BCK-OP3-GRY",    name: "OnePlus Nord 3 Back Cover Grey",               category: "Back Glass",    compatibleWith: ["OnePlus Nord 3"],                             stock: 3,  reorderLevel: 2, costPrice: 2800,  location: "F1-S2" },
];

export const PART_CATEGORIES: PartCategory[] = [
  "Screen", "Battery", "Charging Port", "Speaker / Mic", "Camera", "Back Glass", "Board / IC", "Other",
];
