"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, Search, ShoppingBag, User, X } from "lucide-react";
import { useCart } from "./cart";

const LINKS = [
  { href: "/web", label: "Home" },
  { href: "/web/shop", label: "Shop" },
  { href: "/web/repairs", label: "Repairs" },
  { href: "/web/about", label: "About" },
];

export default function Nav() {
  const pathname = usePathname();
  const { count } = useCart();
  const [open, setOpen] = useState(false);
  // A soft shadow once the page has scrolled under the bar.
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  const active = (href: string) => (href === "/web" ? pathname === "/web" : pathname.startsWith(href));

  return (
    <header className={`sticky top-0 z-40 border-b bg-white/95 transition-shadow duration-500 ${scrolled ? "border-neutral-200/70 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.15)]" : "border-transparent"}`}>
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-5 md:px-8">
        <Link href="/web" className="flex min-h-10 items-center gap-2.5" onClick={() => setOpen(false)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/ManoMobileBlack.png" alt="" className="h-8 w-8 object-contain" />
          <span className="text-[15px] font-semibold tracking-tight text-neutral-950">Mano Mobile</span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {LINKS.map(l => (
            <Link key={l.href} href={l.href}
              className={`group relative text-[13px] transition-colors ${active(l.href) ? "text-neutral-950" : "text-neutral-500 hover:text-neutral-950"}`}>
              {l.label}
              <span className={`absolute -bottom-1.5 left-0 h-px w-full origin-left bg-neutral-950 transition-transform duration-300 ${active(l.href) ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"}`} />
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link href="/web/shop" className="hidden items-center gap-2 rounded-full border border-neutral-200 px-4 py-2 text-[12px] text-neutral-400 transition-colors hover:border-neutral-400 lg:flex">
            <Search size={14} /> Search accessories
          </Link>
          <Link href="/web/account" aria-label="My account" className="flex h-10 w-10 items-center justify-center rounded-full text-neutral-800 transition-colors hover:bg-neutral-100">
            <User size={18} strokeWidth={1.6} />
          </Link>
          <Link href="/web/cart" aria-label="Basket" className="relative flex h-10 w-10 items-center justify-center rounded-full text-neutral-800 transition-colors hover:bg-neutral-100">
            <ShoppingBag size={18} strokeWidth={1.6} />
            {count > 0 && (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-neutral-950 px-1 text-[9px] font-bold text-white">{count}</span>
            )}
          </Link>
          <button onClick={() => setOpen(o => !o)} aria-label="Menu" className="flex h-10 w-10 items-center justify-center rounded-full text-neutral-800 hover:bg-neutral-100 md:hidden">
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {open && (
        <nav className="border-t border-neutral-200 bg-white px-5 py-3 md:hidden">
          {LINKS.map(l => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)}
              className={`block py-3 text-[15px] ${active(l.href) ? "font-semibold text-neutral-950" : "text-neutral-600"}`}>
              {l.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
