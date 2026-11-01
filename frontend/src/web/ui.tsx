import { createElement } from "react";
import {
  BatteryCharging, Cable, Camera, Headphones, Package, PlugZap, ShieldCheck, Smartphone, Speaker, Watch,
  type LucideIcon,
} from "lucide-react";

/** Small shared pieces of the website — safe in server and client components. */

export const rs = (n: number) => `Rs. ${n.toLocaleString("en-LK")}`;

/** A category's picture, until products have photos. */
export function categoryIcon(category: string): LucideIcon {
  const c = category.toLowerCase();
  if (/cable|usb|lightning/.test(c)) return Cable;
  if (/charg|adapter/.test(c)) return PlugZap;
  if (/ear|head|bud|audio/.test(c)) return Headphones;
  if (/lens|camera/.test(c)) return Camera;
  if (/glass|protect|guard/.test(c)) return ShieldCheck;
  if (/cover|case|back/.test(c)) return Smartphone;
  if (/watch|strap/.test(c)) return Watch;
  if (/speaker/.test(c)) return Speaker;
  if (/power ?bank|battery/.test(c)) return BatteryCharging;
  return Package;
}

/**
 * The product "photo": a monochrome tile with the category drawn large and the
 * brand set in thin capitals. Deliberately quiet — it reads as a design choice
 * rather than a missing image.
 */
export function ProductArt({ category, brand, size = "md", dark = false }: {
  category: string; brand: string; size?: "sm" | "md" | "lg"; dark?: boolean;
}) {
  const px = size === "lg" ? 120 : size === "sm" ? 40 : 64;
  return (
    <div className={`relative flex h-full w-full items-center justify-center overflow-hidden ${dark ? "bg-neutral-950 text-white" : "bg-[#efefed] text-neutral-900"}`}>
      {/* the thin slanted rule from the hero, as texture */}
      <svg className="absolute inset-0 h-full w-full opacity-[0.12]" viewBox="0 0 200 200" preserveAspectRatio="none" aria-hidden>
        <path d="M0 140 L70 140 L95 115 L200 115" fill="none" stroke="currentColor" strokeWidth="0.6" />
      </svg>
      {createElement(categoryIcon(category), { size: px, strokeWidth: 0.9 })}
      {brand && (
        <span className={`absolute bottom-3 left-4 text-[10px] font-light uppercase tracking-[0.3em] ${dark ? "text-white/60" : "text-neutral-500"}`}>
          {brand}
        </span>
      )}
    </div>
  );
}

export function StockBadge({ stock }: { stock: number }) {
  if (stock <= 0) return <span className="text-[11px] font-medium uppercase tracking-wider text-neutral-400">Out of stock</span>;
  if (stock <= 3) return <span className="text-[11px] font-medium uppercase tracking-wider text-neutral-900">Only {stock} left</span>;
  return <span className="text-[11px] font-medium uppercase tracking-wider text-neutral-500">In stock</span>;
}

/** Stagger for motion.css: delay this element's animation/reveal by `ms`. */
export const delay = (ms: number, extra?: Record<string, string>) =>
  ({ "--d": `${ms}ms`, ...extra }) as React.CSSProperties;
