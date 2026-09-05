"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

/**
 * Money the shop hands back.
 *
 * Everything else in this system moves one way — a repair is charged, a sale is
 * paid, a balance is written off. This is the other direction, and it is a
 * ledger rather than an adjustment: the original advance stays exactly as it
 * was recorded, and the refund is a second, later fact sitting beside it.
 *
 * Writes go through the two database functions, never through a plain insert.
 * A refund is three linked facts — the money out, the flag on the job, and the
 * reversal of any credit charge the job raised — and a client that writes them
 * one at a time can leave the shop having paid out money it has no record of.
 * See migration 20260904000023.
 */

export type CashReturnKind = "Advance Refund" | "Dealer Cash Return" | "Sale Refund";

export interface CashReturn {
  id: string;
  /** CR-000012. Its own series, deliberately not the invoice sequence. */
  ref: string;
  kind: CashReturnKind;
  returnedOn: string;
  amount: number;
  reason: string;
  method: string | null;
  jobId: string | null;
  dealerId: number | null;
  creditAccountId: string | null;
  creditEntryId: number | null;
  invoiceNo: string | null;
  payee: string | null;
  payeePhone: string | null;
  createdAt: string;
}

type Row = Record<string, unknown>;
const num = (v: unknown) => (v == null ? 0 : Number(v));

const COLUMNS =
  "id, ref, kind, returned_on, amount, reason, method, job_id, dealer_id, " +
  "credit_account_id, credit_entry_id, invoice_no, payee, payee_phone, created_at";

const toCashReturn = (r: Row): CashReturn => ({
  id: r.id as string,
  ref: r.ref as string,
  kind: r.kind as CashReturnKind,
  returnedOn: r.returned_on as string,
  amount: num(r.amount),
  reason: (r.reason as string) ?? "",
  method: (r.method as string | null) ?? null,
  jobId: (r.job_id as string | null) ?? null,
  dealerId: (r.dealer_id as number | null) ?? null,
  creditAccountId: (r.credit_account_id as string | null) ?? null,
  creditEntryId: (r.credit_entry_id as number | null) ?? null,
  invoiceNo: (r.invoice_no as string | null) ?? null,
  payee: (r.payee as string | null) ?? null,
  payeePhone: (r.payee_phone as string | null) ?? null,
  createdAt: r.created_at as string,
});

export async function fetchCashReturns(limit = 200): Promise<CashReturn[]> {
  const { data, error } = await getSupabaseBrowserClient()
    .from("cash_returns")
    .select(COLUMNS)
    .order("returned_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Could not load cash returns: ${error.message}`);
  return (data as Row[]).map(toCashReturn);
}

/** Every return recorded against one repair job. Normally none or one. */
export async function fetchCashReturnsForJob(jobId: string): Promise<CashReturn[]> {
  const { data, error } = await getSupabaseBrowserClient()
    .from("cash_returns")
    .select(COLUMNS)
    .eq("job_id", jobId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Could not load refunds for ${jobId}: ${error.message}`);
  return (data as Row[]).map(toCashReturn);
}

/**
 * Returns for a whole list of jobs at once.
 *
 * One request for the table rather than one per row: the repair sales screen
 * shows every completed job for a dealer, and a hook per row would open
 * dozens of connections to answer a question about a handful of them.
 */
export async function fetchCashReturnsForJobs(jobIds: string[]): Promise<Map<string, CashReturn>> {
  if (jobIds.length === 0) return new Map();

  const { data, error } = await getSupabaseBrowserClient()
    .from("cash_returns")
    .select(COLUMNS)
    .in("job_id", jobIds);

  if (error) throw new Error(`Could not load refunds: ${error.message}`);

  const out = new Map<string, CashReturn>();
  for (const row of data as Row[]) {
    const cr = toCashReturn(row);
    // One advance refund per job is enforced by a unique index, so the first
    // match per job is the only one.
    if (cr.jobId && !out.has(cr.jobId)) out.set(cr.jobId, cr);
  }
  return out;
}

/**
 * Pay back some or all of what a repair job owes.
 *
 * Partial by design: Rs. 6,000 today and Rs. 4,000 on Friday is two calls, and
 * the database caps the cumulative total at what the job actually owes.
 *
 * Deliberately does not take a reason for WHY money is owed — the job already
 * says that, either as a technician-set Cash Return amount or as an advance on
 * a job that was never charged for. The reason here is the note on this
 * particular payment.
 *
 * Every rule is enforced in the database too, so none of it depends on this
 * being the only way in.
 */
export async function refundRepairAdvance(
  jobId: string,
  amount: number,
  reason: string,
  method = "Cash",
): Promise<CashReturn> {
  const { data, error } = await getSupabaseBrowserClient().rpc("refund_repair_advance", {
    p_job_id: jobId, p_amount: amount, p_reason: reason, p_method: method,
  });

  if (error) throw new Error(error.message);
  return toCashReturn(data as Row);
}

// ─── The refund position of a job ────────────────────────────────────────────

/**
 * Where a job stands on refunding, straight from v_job_refunds.
 *
 * The arithmetic lives in the database rather than here so the billing screen,
 * the jobs list and any report all read the same numbers — every screen doing
 * its own subtraction is how "amount to be refunded" ends up meaning two
 * different things.
 */
export interface JobRefund {
  jobId: string;
  advancePaid: number;
  /** What the repair was charged at. Zero on a return: nothing was billed. */
  subtotal: number;
  /** What the technician said should go back, on a Cash Return job. */
  cashReturnAmount: number;
  /**
   * What the job owes back. The Cash Return amount where one was set;
   * otherwise the part of the advance not covering a charge.
   */
  refundable: number;
  refunded: number;
  /** Still owed to the customer. */
  remaining: number;
  /** Set only once nothing is left owing. */
  settledOn: string | null;
  paymentCount: number;
}

const toJobRefund = (r: Row): JobRefund => ({
  jobId: r.job_id as string,
  advancePaid: num(r.advance_paid),
  subtotal: num(r.subtotal),
  cashReturnAmount: num(r.cash_return_amount),
  refundable: num(r.refundable),
  refunded: num(r.refunded),
  remaining: num(r.remaining),
  settledOn: (r.settled_on as string | null) ?? null,
  paymentCount: Number(r.payment_count ?? 0),
});

export async function fetchJobRefunds(jobIds: string[]): Promise<Map<string, JobRefund>> {
  if (jobIds.length === 0) return new Map();

  const { data, error } = await getSupabaseBrowserClient()
    .from("v_job_refunds")
    .select("*")
    .in("job_id", jobIds);

  if (error) throw new Error(`Could not load refund position: ${error.message}`);
  return new Map((data as Row[]).map(r => [r.job_id as string, toJobRefund(r)]));
}

/** The refund position for the jobs on screen, in one request. */
export function useJobRefunds(jobIds: string[]) {
  const key = jobIds.slice().sort().join(",");
  const [byJob, setByJob] = useState<Map<string, JobRefund>>(new Map());
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!isSupabaseConfigured() || key === "") return;
    let active = true;
    (async () => {
      try {
        const map = await fetchJobRefunds(key.split(","));
        if (active) setByJob(map);
      } catch {
        // A billing screen that cannot read the refund position shows none.
        // The database refuses an over-refund regardless, so the worst case is
        // a figure that has to be typed rather than one that is wrong.
        if (active) setByJob(new Map());
      }
    })();
    return () => { active = false; };
  }, [key, nonce]);

  return { byJob, reload: useCallback(() => setNonce(n => n + 1), []) };
}

/**
 * Return cash to a repair dealer.
 *
 * Passing the job is optional to the database and worth insisting on here: it
 * is what turns "balance reduced by 8,500" on the dealer's statement into
 * "Cash Return — RM-041", which is the difference between a statement they
 * accept and one they query.
 */
export async function recordDealerCashReturn(
  accountId: string, amount: number, reason: string, jobId?: string | null, method = "Cash",
): Promise<CashReturn> {
  const { data, error } = await getSupabaseBrowserClient().rpc("record_dealer_cash_return", {
    p_account_id: accountId, p_amount: amount, p_reason: reason,
    p_job_id: jobId || null, p_method: method,
  });

  if (error) throw new Error(error.message);
  return toCashReturn(data as Row);
}

// ─── Reading ─────────────────────────────────────────────────────────────────

/**
 * The refunds on one job.
 *
 * Stamped with the job it belongs to rather than kept alongside a loading flag,
 * so a result arriving after the caller has moved to another job is discarded
 * instead of being shown under the wrong heading.
 */
export function useJobCashReturns(jobId: string | null) {
  const [loaded, setLoaded] = useState<{ forId: string | null; rows: CashReturn[]; error: string | null }>(
    { forId: null, rows: [], error: null },
  );
  // Bumped to re-run the fetch after a refund is recorded, since the effect is
  // keyed on the job and the job has not changed.
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!jobId || !isSupabaseConfigured()) return;
    let active = true;
    (async () => {
      try {
        const rows = await fetchCashReturnsForJob(jobId);
        if (active) setLoaded({ forId: jobId, rows, error: null });
      } catch (e) {
        if (active) setLoaded({ forId: jobId, rows: [], error: e instanceof Error ? e.message : String(e) });
      }
    })();
    return () => { active = false; };
  }, [jobId, nonce]);

  // Stale until the fetch for THIS job has landed, so a result arriving after
  // the caller moved on is never shown under the wrong job.
  const ready = loaded.forId === jobId;
  return {
    returns: ready ? loaded.rows : [],
    loading: !!jobId && isSupabaseConfigured() && !ready,
    error: ready ? loaded.error : null,
    reload: useCallback(() => setNonce(n => n + 1), []),
  };
}

/**
 * Refunds for the jobs currently on screen, keyed by job id.
 *
 * `key` is the job list joined — the effect re-runs when the set of jobs
 * changes, not when the array identity does, so a parent re-render does not
 * refetch the whole table.
 */
export function useCashReturnsForJobs(jobIds: string[]) {
  const key = jobIds.slice().sort().join(",");
  const [byJob, setByJob] = useState<Map<string, CashReturn>>(new Map());
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!isSupabaseConfigured() || key === "") { return; }
    let active = true;
    (async () => {
      try {
        const map = await fetchCashReturnsForJobs(key.split(","));
        if (active) setByJob(map);
      } catch {
        // A table that cannot load its refunds still shows its jobs. The
        // refund column reads as "not refunded", which is the safe direction:
        // it invites a second look rather than hiding money owed back.
        if (active) setByJob(new Map());
      }
    })();
    return () => { active = false; };
  }, [key, nonce]);

  return { byJob, reload: useCallback(() => setNonce(n => n + 1), []) };
}

// ─── Net takings ─────────────────────────────────────────────────────────────

export interface DailyCash {
  onDate: string;
  salesTotal: number;
  saleReturns: number;
  saleCount: number;
  cashReturned: number;
  advanceRefunds: number;
  dealerReturns: number;
  returnCount: number;
  /** Sales, less sale returns, less cash returns. The revenue figure. */
  netTakings: number;
}

/**
 * Takings per day with everything already deducted.
 *
 * Reads the view rather than doing the arithmetic here, so a report cannot
 * forget to subtract — a day with a refund in it would otherwise be overstated
 * by the whole refunded amount with nothing on screen to say so.
 */
export async function fetchDailyCash(fromDate: string, toDate: string): Promise<DailyCash[]> {
  const { data, error } = await getSupabaseBrowserClient()
    .from("v_daily_cash")
    .select("*")
    .gte("on_date", fromDate)
    .lte("on_date", toDate)
    .order("on_date", { ascending: false });

  if (error) throw new Error(`Could not load daily takings: ${error.message}`);
  return (data as Row[]).map(r => ({
    onDate: r.on_date as string,
    salesTotal: num(r.sales_total),
    saleReturns: num(r.sale_returns),
    saleCount: Number(r.sale_count ?? 0),
    cashReturned: num(r.cash_returned),
    advanceRefunds: num(r.advance_refunds),
    dealerReturns: num(r.dealer_returns),
    returnCount: Number(r.return_count ?? 0),
    netTakings: num(r.net_takings),
  }));
}
