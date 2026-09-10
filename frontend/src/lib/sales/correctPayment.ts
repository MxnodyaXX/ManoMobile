"use client";

import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

/**
 * Correcting how much of an invoice actually came in.
 *
 * The case this exists for: a repair rung up as settled in cash when the
 * customer was taking it on account. The invoice, the job's received total and
 * the credit ledger were all left agreeing with each other and all wrong, and
 * the only tool was Void — which throws away a good invoice, and its number,
 * over one mistyped field.
 *
 * One database call because the three have to move together; any two of them
 * agreeing while the third does not is worse than the original mistake,
 * because it looks settled. See migration 20260909000044.
 */
export async function correctSalePayment(
  invoiceNo: string,
  received: number,
  method?: string,
  note?: string,
): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const { error } = await getSupabaseBrowserClient().rpc("correct_sale_payment", {
    p_invoice_no: invoiceNo,
    p_received: received,
    p_method: method ?? null,
    p_note: note ?? null,
  });

  if (error) {
    throw new Error(
      error.code === "42501"
        ? "Correcting a recorded payment needs an admin cashier."
        // undefined_function: the migration has not been run yet.
        : error.code === "42883"
          ? "Payment corrections need migration 20260909000044 — run it and try again."
          : error.message,
    );
  }
}
