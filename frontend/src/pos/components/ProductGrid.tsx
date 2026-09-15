"use client";

import { PackageSearch, Plus } from "lucide-react";
import { categoryStyle } from "../categoryStyle";
import { formatCurrency } from "../format";
import type { Product } from "../types";

interface Props {
  products: Product[];
  onAdd: (product: Product) => void;
  /** True while the catalogue is still being read. */
  loading?: boolean;
  /** Set when the catalogue could not be read at all. */
  error?: string | null;
}

export function ProductGrid({ products, onAdd, loading, error }: Props) {
  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 py-20 text-center text-rose-500">
        <PackageSearch size={32} strokeWidth={1.5} />
        <p className="text-sm font-medium">Could not load the catalogue</p>
        <p className="text-xs text-slate-400 dark:text-slate-500">{error}</p>
      </div>
    );
  }
  if (products.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 py-20 text-center text-slate-400 dark:text-slate-600">
        <PackageSearch size={32} strokeWidth={1.5} />
        <p className="text-sm font-medium">{loading ? "Loading products…" : "No products match your search"}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
      {products.map(product => (
        <ProductCard key={product.id} product={product} onAdd={onAdd} />
      ))}
    </div>
  );
}

function ProductCard({ product, onAdd }: { product: Product; onAdd: (product: Product) => void }) {
  const style = categoryStyle(product.category);
  const Icon = style.icon;
  const out = product.stock <= 0;
  const lowStock = !out && product.stock <= 10;

  return (
    <button
      type="button"
      onClick={() => onAdd(product)}
      disabled={out}
      className="group relative flex flex-col items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-md active:translate-y-0 active:scale-[0.98] disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:border-slate-200 disabled:hover:shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:hover:border-violet-700 dark:disabled:hover:border-slate-800"
    >
      <div className="flex w-full items-start justify-between">
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${style.chip}`}>
          <Icon size={18} strokeWidth={2} />
        </span>
        {!out && (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-white opacity-0 transition group-hover:opacity-100 dark:bg-violet-600">
            <Plus size={15} strokeWidth={2.5} />
          </span>
        )}
      </div>

      <div className="w-full">
        <p className="line-clamp-2 text-sm font-semibold leading-snug text-slate-900 dark:text-slate-100">
          {product.name}
        </p>
        <p className="mt-0.5 font-mono text-[11px] text-slate-400 dark:text-slate-500">{product.sku}</p>
      </div>

      <div className="flex w-full items-center justify-between pt-1">
        <span className="font-mono text-[15px] font-bold text-slate-900 dark:text-white">
          {formatCurrency(product.price)}
        </span>
        {out && (
          <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">
            Out of stock
          </span>
        )}
        {lowStock && (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
            {product.stock} left
          </span>
        )}
      </div>
    </button>
  );
}
