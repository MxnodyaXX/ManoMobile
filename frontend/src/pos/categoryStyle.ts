import {
  BatteryCharging, Cable, Headphones, Package, ShieldCheck, Smartphone, Speaker, Watch, Zap,
  type LucideIcon,
} from "lucide-react";

interface CategoryStyle {
  icon: LucideIcon;
  chip: string;
}

/**
 * An icon and a tint per category, matched on words rather than exact names:
 * the accessory catalogue's categories are typed in by whoever adds stock
 * ("Chargers", "Charger & Cables", "Tempered Glass"), and the card should
 * still look right for any of them.
 */
const RULES: { test: RegExp; style: CategoryStyle }[] = [
  { test: /protect|glass|tempered|guard/i,  style: { icon: ShieldCheck,     chip: "bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400" } },
  { test: /cover|case|pouch|flip/i,         style: { icon: Smartphone,      chip: "bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400" } },
  { test: /cable|wire|otg/i,                style: { icon: Cable,           chip: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400" } },
  { test: /charg|adapter|plug/i,            style: { icon: Zap,             chip: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400" } },
  { test: /ear|head|buds|audio|handsfree/i, style: { icon: Headphones,      chip: "bg-fuchsia-50 text-fuchsia-600 dark:bg-fuchsia-500/10 dark:text-fuchsia-400" } },
  { test: /speaker|sound/i,                 style: { icon: Speaker,         chip: "bg-fuchsia-50 text-fuchsia-600 dark:bg-fuchsia-500/10 dark:text-fuchsia-400" } },
  { test: /power ?bank|battery/i,           style: { icon: BatteryCharging, chip: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400" } },
  { test: /watch|band|strap/i,              style: { icon: Watch,           chip: "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400" } },
];

const FALLBACK: CategoryStyle = {
  icon: Package,
  chip: "bg-slate-100 text-slate-600 dark:bg-slate-500/10 dark:text-slate-400",
};

export function categoryStyle(category: string): CategoryStyle {
  return RULES.find(r => r.test.test(category))?.style ?? FALLBACK;
}
