import { useCallback, useMemo, useState } from "react";
import type { CartLine, Party, Product, SaleSnapshot } from "./types";

export function useCart() {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [party, setPartyState] = useState<Party | null>(null);
  const [discountAmount, setDiscountAmountState] = useState(0);
  const [writeOffAmount, setWriteOffAmountState] = useState(0);
  // null = "paid" auto-tracks the total (the common case); a number means the
  // cashier has typed a specific amount (partial payment, credit sale, etc.)
  const [paidOverride, setPaidOverride] = useState<number | null>(null);

  /** Adds one, never past what is on the shelf. */
  const addProduct = useCallback((product: Product) => {
    setLines(prev => {
      const existing = prev.find(l => l.product.id === product.id);
      if (existing) {
        if (existing.qty >= product.stock) return prev;
        return prev.map(l => (l.product.id === product.id ? { ...l, qty: l.qty + 1 } : l));
      }
      if (product.stock <= 0) return prev;
      return [...prev, { id: crypto.randomUUID(), product, qty: 1, addedAt: Date.now() }];
    });
  }, []);

  const incQty = useCallback((lineId: string) => {
    setLines(prev => prev.map(l => (l.id === lineId && l.qty < l.product.stock ? { ...l, qty: l.qty + 1 } : l)));
  }, []);

  const decQty = useCallback((lineId: string) => {
    setLines(prev =>
      prev.flatMap(l => (l.id === lineId ? (l.qty <= 1 ? [] : [{ ...l, qty: l.qty - 1 }]) : [l])),
    );
  }, []);

  const removeLine = useCallback((lineId: string) => {
    setLines(prev => prev.filter(l => l.id !== lineId));
  }, []);

  const setParty = useCallback((p: Party | null) => setPartyState(p), []);

  const setDiscountAmount = useCallback((v: number) => setDiscountAmountState(Math.max(0, v || 0)), []);
  const setWriteOffAmount = useCallback((v: number) => setWriteOffAmountState(Math.max(0, v || 0)), []);
  const setPaidAmount = useCallback((v: number) => setPaidOverride(Math.max(0, v || 0)), []);
  const resetPaidToFull = useCallback(() => setPaidOverride(null), []);

  const clear = useCallback(() => {
    setLines([]);
    setPartyState(null);
    setDiscountAmountState(0);
    setWriteOffAmountState(0);
    setPaidOverride(null);
  }, []);

  const restore = useCallback((snapshot: SaleSnapshot) => {
    setLines(snapshot.lines);
    setPartyState(snapshot.party);
    setDiscountAmountState(snapshot.discountAmount);
    setWriteOffAmountState(snapshot.writeOffAmount);
    setPaidOverride(snapshot.paidOverride);
  }, []);

  const subtotal = useMemo(() => lines.reduce((sum, l) => sum + l.product.price * l.qty, 0), [lines]);
  const total = useMemo(
    () => Math.max(0, subtotal - discountAmount - writeOffAmount),
    [subtotal, discountAmount, writeOffAmount],
  );
  const paidAmount = paidOverride === null ? total : paidOverride;
  const due = total - paidAmount;
  const itemCount = useMemo(() => lines.reduce((n, l) => n + l.qty, 0), [lines]);

  const snapshot: SaleSnapshot = { lines, party, discountAmount, writeOffAmount, paidOverride };

  return {
    lines,
    party,
    setParty,
    addProduct,
    incQty,
    decQty,
    removeLine,
    clear,
    restore,
    snapshot,
    subtotal,
    discountAmount,
    setDiscountAmount,
    writeOffAmount,
    setWriteOffAmount,
    total,
    paidAmount,
    paidIsAuto: paidOverride === null,
    setPaidAmount,
    resetPaidToFull,
    due,
    itemCount,
  };
}

export type CartApi = ReturnType<typeof useCart>;
