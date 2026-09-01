"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { SaleTx, TxCategory, TxStatus } from "@/cashier/contexts/SalesContext";

/**
 * Storing the sales that invoice numbers name.
 *
 * The number was always real — INV-000123 comes from a Postgres sequence. What
 * it named was not: SalesContext held the list in useState, so every invoice
 * the shop issued disappeared on the next refresh. This is the missing half.
 *
 * The SaleTx shape is unchanged so Sales History, Invoice History and the Daily
 * Summary keep working exactly as they are — they were reading an empty array,
 * and now they read the same shape from the database.
 */

export interface SaleExtras {
  customerPhone?: string | null;
  dealerId?: number | null;
  creditAccountId?: string | null;
  jobIds?: string[];
}

type Row = Record<string, unknown>;

const num = (v: unknown) => (v == null ? undefined : Number(v));

const toSale = (r: Row): SaleTx => ({
  id: r.id as string,
  invoiceNo: r.invoice_no as string,
  date: r.sold_on as string,
  customer: r.customer as string,
  category: r.category as TxCategory,
  items: (r.items as string) ?? "",
  total: Number(r.total ?? 0),
  subtotal: num(r.subtotal),
  discountAmount: Number(r.discount ?? 0),
  paid: num(r.paid),
  badDebt: Number(r.bad_debt ?? 0),
  status: r.status as TxStatus,
  returnedAmount: num(r.returned_amount),
  returnReason: (r.return_reason as string | null) ?? undefined,
  returnDate: (r.return_date as string | null) ?? undefined,
  paymentMethod: (r.payment_method as SaleTx["paymentMethod"]) ?? undefined,
  cashAmount: num(r.cash_amount),
  cardAmount: num(r.card_amount),
  cardRef: (r.card_ref as string | null) ?? undefined,
  discountPct: num(r.discount_pct),
  taxPct: num(r.tax_pct),
  taxAmount: num(r.tax_amount),
  cashier: (r.cashier as string | null) ?? undefined,
  shiftId: (r.shift_id as string | null) ?? undefined,
  dealerId: (r.dealer_id as number | null) ?? null,
});

function explain(message: string, code?: string): string {
  if (code === "23505" && /invoice_no/.test(message)) {
    return "That invoice number has already been recorded.";
  }
  if (code === "42501") {
    return "You do not have permission to record sales.";
  }
  if (/relation .*sales.* does not exist|Could not find the table/i.test(message)) {
    return "The sales ledger is not set up yet — run migration 20260901000011_sales.sql.";
  }
  return message;
}

/** Every recorded invoice, newest first. */
export async function fetchSales(): Promise<SaleTx[]> {
  const { data, error } = await getSupabaseBrowserClient()
    .from("sales")
    .select("*")
    .order("sold_on", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw new Error(explain(error.message, error.code));
  return ((data ?? []) as Row[]).map(toSale);
}

/**
 * Write the sale down, and stamp its number onto the jobs it covered.
 *
 * Returns the stored row so the caller holds the database's id rather than a
 * client-invented one — the difference matters the moment somebody tries to
 * void or return the sale from another screen.
 */
export async function insertSale(sale: Omit<SaleTx, "id">, extras: SaleExtras = {}): Promise<SaleTx> {
  const sb = getSupabaseBrowserClient();
  const { data: { user } } = await sb.auth.getUser();

  const { data, error } = await sb
    .from("sales")
    .insert({
      invoice_no: sale.invoiceNo,
      sold_on: sale.date,
      category: sale.category,
      status: sale.status,
      customer: sale.customer || "Walk-in",
      customer_phone: extras.customerPhone ?? null,
      dealer_id: extras.dealerId ?? null,
      credit_account_id: extras.creditAccountId ?? null,
      items: sale.items ?? "",
      job_ids: extras.jobIds ?? [],
      total: sale.total,
      subtotal: sale.subtotal ?? null,
      discount: sale.discountAmount ?? 0,
      paid: sale.paid ?? null,
      discount_pct: sale.discountPct ?? null,
      tax_pct: sale.taxPct ?? null,
      tax_amount: sale.taxAmount ?? null,
      payment_method: sale.paymentMethod ?? null,
      cash_amount: sale.cashAmount ?? null,
      card_amount: sale.cardAmount ?? null,
      card_ref: sale.cardRef ?? null,
      cashier: sale.cashier ?? null,
      shift_id: sale.shiftId ?? null,
      created_by: user?.id ?? null,
    })
    .select("*")
    .single();

  if (error) throw new Error(explain(error.message, error.code));

  const jobIds = extras.jobIds ?? [];
  if (jobIds.length > 0) {
    // Best effort on purpose. The sale is recorded either way, and a job left
    // without its invoice number is a cosmetic gap — failing the whole sale
    // over it would be the wrong trade at a counter with a customer waiting.
    await sb.from("repair_jobs").update({ invoice_no: sale.invoiceNo }).in("id", jobIds);
    // Same for the credit charge the handover trigger raised: it knows the job
    // but not the invoice, and this is the moment the invoice exists. Through an
    // RPC because amending a credit entry is Admin-only — this one function is
    // allowed to fill in a blank invoice number and nothing else.
    await sb.rpc("stamp_invoice_on_credit_charges", {
      p_invoice_no: sale.invoiceNo,
      p_job_ids: jobIds,
    });
  }

  return toSale(data as Row);
}

/** One invoice, by its number — for showing the bill behind a credit charge. */
export async function fetchSaleByInvoiceNo(invoiceNo: string): Promise<(SaleTx & SaleExtras) | null> {
  const { data, error } = await getSupabaseBrowserClient()
    .from("sales")
    .select("*")
    .eq("invoice_no", invoiceNo)
    .maybeSingle();

  if (error) throw new Error(explain(error.message, error.code));
  if (!data) return null;

  const r = data as Row;
  return {
    ...toSale(r),
    customerPhone: (r.customer_phone as string | null) ?? null,
    dealerId: (r.dealer_id as number | null) ?? null,
    creditAccountId: (r.credit_account_id as string | null) ?? null,
    jobIds: (r.job_ids as string[] | null) ?? [],
  };
}

/**
 * Which counter each of these invoices was rung up at.
 *
 * A credit charge knows its invoice number but not what kind of sale raised it,
 * and "INV-000010" alone does not tell somebody chasing a balance whether it
 * was a repair, a phone or a case. The sales ledger is what knows, so this asks
 * it for the whole set at once rather than a query per row.
 *
 * Never throws. A missing label is a cosmetic gap; a credit history that
 * refuses to open because a label could not be read is not.
 */
export async function fetchSaleCategories(invoiceNos: string[]): Promise<Record<string, TxCategory>> {
  const wanted = [...new Set(invoiceNos.filter(Boolean))];
  if (wanted.length === 0 || !isSupabaseConfigured()) return {};

  const { data, error } = await getSupabaseBrowserClient()
    .from("sales")
    .select("invoice_no, category")
    .in("invoice_no", wanted);

  if (error) return {};

  const out: Record<string, TxCategory> = {};
  for (const r of (data ?? []) as Row[]) {
    out[r.invoice_no as string] = r.category as TxCategory;
  }
  return out;
}

/** The same lookup for a component. Keyed on the numbers themselves, so it
 *  re-runs when the list changes and not on every render. */
export function useInvoiceCategories(invoiceNos: string[]): Record<string, TxCategory> {
  const [map, setMap] = useState<Record<string, TxCategory>>({});
  const key = [...new Set(invoiceNos.filter(Boolean))].sort().join(",");

  useEffect(() => {
    if (!key) return;
    let active = true;
    fetchSaleCategories(key.split(","))
      .then(m => { if (active) setMap(m); })
      .catch(() => { /* labels are optional */ });
    return () => { active = false; };
  }, [key]);

  return map;
}

/** A void or a return. The row always survives — an issued invoice number
 *  cannot become an absence. */
export async function updateSale(id: string, changes: Partial<SaleTx>): Promise<void> {
  const row: Record<string, unknown> = {};
  if (changes.status         !== undefined) row.status          = changes.status;
  if (changes.returnedAmount !== undefined) row.returned_amount = changes.returnedAmount;
  if (changes.returnReason   !== undefined) row.return_reason   = changes.returnReason;
  if (changes.returnDate     !== undefined) row.return_date     = changes.returnDate;
  if (changes.customer       !== undefined) row.customer        = changes.customer;
  if (changes.total          !== undefined) row.total           = changes.total;
  if (Object.keys(row).length === 0) return;

  const { error } = await getSupabaseBrowserClient().from("sales").update(row).eq("id", id);
  if (error) throw new Error(explain(error.message, error.code));
}

export const salesConfigured = isSupabaseConfigured;
