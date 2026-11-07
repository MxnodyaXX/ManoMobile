"use client";

import { useMemo, useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import type { PublicProduct } from "./catalogue";
import ProductCard from "./ProductCard";
import { delay } from "./ui";

type Sort = "featured" | "price-asc" | "price-desc" | "name";

export default function ShopBrowser({ products }: { products: PublicProduct[] }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const [sort, setSort] = useState<Sort>("featured");
  const [inStock, setInStock] = useState(false);

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of products) counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c).filter(Boolean);
  }, [products]);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = products.filter(p =>
      (cat === "All" || p.category === cat) &&
      (!inStock || p.stock > 0) &&
      (!s || [p.name, p.brand, p.model, p.category, p.subcategory, p.code].some(v => v.toLowerCase().includes(s))));
    const by: Record<Sort, (a: PublicProduct, b: PublicProduct) => number> = {
      featured: (a, b) => Number(b.stock > 0) - Number(a.stock > 0) || a.name.localeCompare(b.name),
      "price-asc": (a, b) => a.price - b.price,
      "price-desc": (a, b) => b.price - a.price,
      name: (a, b) => a.name.localeCompare(b.name),
    };
    return [...list].sort(by[sort]);
  }, [products, q, cat, sort, inStock]);

  return (
    <div>
      <div className="sticky top-16 z-30 -mx-5 border-b border-neutral-200 bg-white/95 px-5 py-4 md:-mx-8 md:px-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search chargers, cables, covers, your phone model…"
              className="h-12 w-full rounded-full border border-neutral-200 bg-neutral-50 pl-11 pr-10 text-[14px] outline-none transition-colors placeholder:text-neutral-400 focus:border-neutral-900 focus:bg-white" />
            {q && <button onClick={() => setQ("")} aria-label="Clear" className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center text-neutral-400"><X size={15} /></button>}
          </div>
          <div className="flex items-center gap-3">
            <label className="flex min-h-10 cursor-pointer items-center gap-2 text-[12px] text-neutral-600">
              <input type="checkbox" checked={inStock} onChange={e => setInStock(e.target.checked)} className="h-4 w-4 accent-neutral-950" />
              In stock only
            </label>
            <div className="relative">
              <SlidersHorizontal size={14} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500" />
              <select value={sort} onChange={e => setSort(e.target.value as Sort)}
                className="h-12 appearance-none rounded-full border border-neutral-200 bg-white pl-9 pr-5 text-[12px] outline-none focus:border-neutral-900">
                <option value="featured">Featured</option>
                <option value="price-asc">Price: low to high</option>
                <option value="price-desc">Price: high to low</option>
                <option value="name">Name</option>
              </select>
            </div>
          </div>
        </div>
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {["All", ...categories].map(c => (
            <button key={c} onClick={() => setCat(c)}
              className={`min-h-10 shrink-0 rounded-full border px-4 py-2 text-[12px] transition-colors ${cat === c ? "border-neutral-950 bg-neutral-950 text-white" : "border-neutral-200 text-neutral-600 hover:border-neutral-400"}`}>
              {c}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-8 text-[12px] text-neutral-400">{shown.length} item{shown.length === 1 ? "" : "s"}</p>
      {shown.length === 0 ? (
        <div className="py-24 text-center">
          <p className="text-[15px] text-neutral-700">Nothing matches that.</p>
          <p className="mt-1 text-[13px] text-neutral-400">Try another word, or ask us — we may have it in the back.</p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-x-5 gap-y-12 md:grid-cols-3 lg:grid-cols-4">
          {shown.map((p, i) => <div key={p.id} data-reveal style={delay((i % 4) * 70)}><ProductCard p={p} /></div>)}
        </div>
      )}
    </div>
  );
}
