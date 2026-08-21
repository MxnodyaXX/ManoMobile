"use client";

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
