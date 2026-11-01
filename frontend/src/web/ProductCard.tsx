"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, Plus } from "lucide-react";
import type { PublicProduct } from "./catalogue";
import { useCart } from "./cart";
import { ProductArt, StockBadge, rs } from "./ui";

export default function ProductCard({ p }: { p: PublicProduct }) {
  const { add } = useCart();
  const [added, setAdded] = useState(false);
  const out = p.stock <= 0;

  return (
    <div className="group flex flex-col transition-transform duration-500 hover:-translate-y-1">
      <Link href={`/web/shop/${p.id}`} className="block aspect-[4/5] overflow-hidden rounded-3xl">
        <div className="h-full w-full transition-transform duration-500 group-hover:scale-[1.03]">
          <ProductArt category={p.category} brand={p.brand} />
        </div>
      </Link>
      <div className="mt-4 flex items-start justify-between gap-3">
        <Link href={`/web/shop/${p.id}`} className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.2em] text-neutral-400">{p.category}</p>
          <p className="mt-1 line-clamp-2 text-[14px] font-medium leading-snug text-neutral-950">{p.name}</p>
          {p.model && <p className="mt-0.5 truncate text-[12px] text-neutral-500">{p.model}</p>}
        </Link>
        <button
          onClick={() => {
            add({ id: p.id, name: p.name, brand: p.brand, category: p.category, price: p.price, stock: p.stock });
            setAdded(true);
            setTimeout(() => setAdded(false), 1400);
          }}
          disabled={out}
          aria-label={`Add ${p.name} to basket`}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-neutral-900 bg-neutral-950 text-white transition-all hover:scale-105 disabled:border-neutral-200 disabled:bg-white disabled:text-neutral-300"
        >
          {added ? <Check size={16} /> : <Plus size={16} />}
        </button>
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[15px] font-semibold">{rs(p.price)}</span>
        <StockBadge stock={p.stock} />
      </div>
    </div>
  );
}
