import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

/**
 * The two things the POS does that its own role's policies would refuse —
 * both go through definer functions in migration 20260916000054.
 */

const explain = (msg: string) =>
  /Could not find the function|PGRST202/.test(msg)
    ? "Credit sales from the POS are not set up yet — run migration 20260916000054."
    : msg;

/**
 * Opens (or finds) the credit account a balance can be left on. Returns its id.
 */
export async function posOpenAccount(a: {
  kind: "customer" | "dealer";
  name: string;
  phone?: string | null;
  address?: string | null;
  dealerId?: number | null;
}): Promise<string> {
  if (!isSupabaseConfigured()) throw new Error("Not connected to the database.");
  const { data, error } = await getSupabaseBrowserClient().rpc("pos_open_account", {
    p_kind: a.kind,
    p_name: a.name,
    p_phone: a.phone ?? null,
    p_address: a.address ?? null,
    p_dealer_id: a.dealerId ?? null,
  });
  if (error) throw new Error(explain(error.message));
  if (typeof data !== "string" || !data) throw new Error("The account was not opened.");
  return data;
}

/**
 * Puts the unpaid part of an invoice that already exists on an account.
 * Returns the amount charged (0 when the invoice was fully paid).
 */
export async function posPostCredit(invoiceNo: string, accountId: string): Promise<number> {
  if (!isSupabaseConfigured()) throw new Error("Not connected to the database.");
  const { data, error } = await getSupabaseBrowserClient().rpc("pos_post_credit", {
    p_invoice_no: invoiceNo,
    p_account_id: accountId,
  });
  if (error) throw new Error(explain(error.message));
  return Number(data ?? 0);
}
