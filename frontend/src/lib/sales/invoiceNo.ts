"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

/**
 * Real invoice numbers, shared by every sale flow — Accessories, Mobile,
 * Other, Repair Sales, and the Job Issue invoice. All of them used to make
 * up their own number in the browser (Date.now(), Math.random()), in four
 * different formats, none of it checked against anything two cashiers could
 * collide on. This draws from one Postgres sequence instead — see migration
 * 20260821000001_invoice_numbers.sql — so "INV-000123" always means exactly
 * one sale, the same guarantee repair job numbers (RM-001, RM-002…) already
 * have.
 */

/** Only used when Supabase isn't configured yet, so the app still works
 *  before it's connected — not sequential, not guaranteed unique, exactly
 *  the fallback every call site used unconditionally before this existed. */
function fallbackInvoiceNo(): string {
  return `INV-${Date.now().toString().slice(-8)}`;
}

/**
 * Assigns and returns the next invoice number. This *reserves* it —
 * `next_invoice_no()` advances the sequence every time it's called — so only
 * call this once a sale is genuinely being finalised (the Complete Sale /
 * Generate Invoice / Issue Job click itself), never on mount or while a cart
 * is still being edited. Calling it early just burns numbers a cancelled
 * sale never used, leaving gaps in the sequence.
 */
export async function fetchNextInvoiceNo(): Promise<string> {
  if (!isSupabaseConfigured()) return fallbackInvoiceNo();
  const { data, error } = await getSupabaseBrowserClient().rpc("next_invoice_no");
  return !error && typeof data === "string" && data ? data : fallbackInvoiceNo();
}

/**
 * The number the next sale would get, WITHOUT taking it.
 *
 * fetchNextInvoiceNo above assigns; this one only looks. The distinction is the
 * whole reason both exist: a cashier needs to see the invoice number while they
 * are still billing — to write it in a book, to quote it to a customer — but
 * reserving it the moment a billing panel opens would burn a number every time
 * somebody opened a sale and walked away, leaving gaps in an invoice book that
 * has to be explainable.
 *
 * So this is a preview and the UI says so. Two cashiers billing at once both
 * see INV-000124; whoever finalises first gets it, the other gets 125.
 */
export async function peekNextInvoiceNo(): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  const { data, error } = await getSupabaseBrowserClient().rpc("peek_next_invoice_no");
  return !error && typeof data === "string" && data ? data : null;
}

/**
 * The preview, for a billing panel.
 *
 * `refreshKey` re-reads it — pass something that changes when a sale completes,
 * so the panel does not keep showing a number that has just been handed out.
 */
export function useNextInvoiceNo(refreshKey?: unknown): string | null {
  const [next, setNext] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    peekNextInvoiceNo()
      .then(n => { if (active) setNext(n); })
      // No number is better than a wrong one: the panel simply shows nothing.
      .catch(() => { if (active) setNext(null); });
    return () => { active = false; };
  }, [refreshKey]);

  return next;
}
