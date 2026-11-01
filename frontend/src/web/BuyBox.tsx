"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Minus, Plus, Store, Truck } from "lucide-react";
import type { PublicProduct } from "./catalogue";
import { useCart } from "./cart";

export default function BuyBox({ p }: { p: PublicProduct }) {
  const { add } = useCart();
  const router = useRouter();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const out = p.stock <= 0;
  const line = { id: p.id, name: p.name, brand: p.brand, category: p.category, price: p.price, stock: p.stock };

  return (
    <div className="flex flex-col gap-5">
      {!out && (
        <div className="flex items-center gap-4">
          <div className="flex h-12 items-center rounded-full border border-neutral-200">
            <button onClick={() => setQty(q => Math.max(1, q - 1))} aria-label="Less" className="flex h-12 w-12 items-center justify-center text-neutral-600"><Minus size={15} /></button>
            <span className="w-8 text-center text-[15px] font-semibold">{qty}</span>
            <button onClick={() => setQty(q => Math.min(p.stock, q + 1))} aria-label="More" className="flex h-12 w-12 items-center justify-center text-neutral-600"><Plus size={15} /></button>
          </div>
          <span className="text-[12px] text-neutral-400">{p.stock} available</span>
        </div>
      )}
      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          disabled={out}
          onClick={() => { add(line, qty); router.push("/web/cart?mode=pickup"); }}
          className="inline-flex h-14 flex-1 items-center justify-center gap-2 rounded-full bg-neutral-950 text-[13px] font-medium text-white transition-transform hover:scale-[1.01] disabled:bg-neutral-200 disabled:text-neutral-400">
          <Store size={16} /> Reserve &amp; collect
        </button>
        <button
          disabled={out}
          onClick={() => { add(line, qty); setAdded(true); setTimeout(() => setAdded(false), 1600); }}
          className="inline-flex h-14 flex-1 items-center justify-center gap-2 rounded-full border border-neutral-900/20 text-[13px] font-medium transition-colors hover:border-neutral-900 disabled:text-neutral-300">
          {added ? <><Check size={16} /> Added to basket</> : <>Add to basket</>}
        </button>
      </div>
      {out && <p className="text-[13px] text-neutral-500">Out of stock right now — message us and we&apos;ll tell you when it&apos;s back.</p>}
      <div className="grid gap-3 border-t border-neutral-200 pt-5 text-[13px] text-neutral-600">
        <p className="flex items-center gap-3"><Store size={16} strokeWidth={1.5} /> Reserve online, pay and collect at the shop — held for 48 hours</p>
        <p className="flex items-center gap-3"><Truck size={16} strokeWidth={1.5} /> Or have it delivered to your door</p>
      </div>
    </div>
  );
}
