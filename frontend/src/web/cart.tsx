"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

/**
 * The website's basket — kept in this browser only (localStorage). Placing a
 * reservation/order isn't wired to the shop yet; this is the UI for it.
 */

export interface CartLine {
  id: number;
  name: string;
  brand: string;
  category: string;
  price: number;
  stock: number;
  qty: number;
}

interface CartApi {
  lines: CartLine[];
  count: number;
  total: number;
  add: (p: Omit<CartLine, "qty">, qty?: number) => void;
  setQty: (id: number, qty: number) => void;
  remove: (id: number) => void;
  clear: () => void;
}

const Ctx = createContext<CartApi | null>(null);
const KEY = "mano-web-cart";

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);

  // Read once on mount — after hydration, so server and client first render agree.
  useEffect(() => {
    let saved: CartLine[] = [];
    try { saved = JSON.parse(localStorage.getItem(KEY) ?? "[]") as CartLine[]; } catch { /* private window */ }
    const t = setTimeout(() => { setLines(Array.isArray(saved) ? saved : []); setReady(true); }, 0);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(KEY, JSON.stringify(lines)); } catch { /* ignore */ }
  }, [lines, ready]);

  const add = useCallback((p: Omit<CartLine, "qty">, qty = 1) => {
    setLines(prev => {
      const have = prev.find(l => l.id === p.id);
      const cap = Math.max(1, p.stock);
      return have
        ? prev.map(l => l.id === p.id ? { ...l, qty: Math.min(cap, l.qty + qty) } : l)
        : [...prev, { ...p, qty: Math.min(cap, qty) }];
    });
  }, []);
  const setQty = useCallback((id: number, qty: number) =>
    setLines(prev => prev.map(l => l.id === id ? { ...l, qty: Math.max(1, Math.min(Math.max(1, l.stock), qty)) } : l)), []);
  const remove = useCallback((id: number) => setLines(prev => prev.filter(l => l.id !== id)), []);
  const clear = useCallback(() => setLines([]), []);

  const value = useMemo(() => ({
    lines, add, setQty, remove, clear,
    count: lines.reduce((s, l) => s + l.qty, 0),
    total: lines.reduce((s, l) => s + l.qty * l.price, 0),
  }), [lines, add, setQty, remove, clear]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart(): CartApi {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCart must be inside <CartProvider>");
  return c;
}
