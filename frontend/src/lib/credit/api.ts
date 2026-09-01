"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

/**
 * Credit accounts and the entries that make up their balances.
 *
 * One store for what used to be five. The Credit Customers screen and the
 * credit pickers inside Mobile, Accessory, Other and Repair Sales each held
 * their own useState([]) — a customer put on account at one counter did not
 * exist at the next, and none of it survived a refresh. Everything now reads
 * and writes here.
 *
 * A balance is never carried in the client either. It comes from the
 * v_credit_accounts view, which sums the entries, so a stale copy of a balance
 * cannot outlive the history that explains it.
 */

export type HolderKind = "Customer" | "Dealer";
export type CreditStatus = "Active" | "Overdue" | "Settled";
export type EntryKind = "Charge" | "Payment" | "Write-off";

export interface CreditAccount {
  id: string;
  holderKind: HolderKind;
  name: string;
  phone: string | null;
  nic: string | null;
  email: string | null;
  address: string | null;
  dealerId: number | null;
  creditLimit: number;
  termsDays: number;
  /** Opened by the system to hold an unpaid handover, not by a deliberate
   *  decision to extend credit. Worth showing: the two mean different things. */
  autoOpened: boolean;
  notes: string | null;
  totalCharged: number;
  totalPaid: number;
  totalWrittenOff: number;
  balance: number;
  firstChargeOn: string | null;
  lastPaymentOn: string | null;
  chargeCount: number;
  status: CreditStatus;
  createdAt: string;
}

export interface CreditEntry {
  id: number;
  accountId: string;
  kind: EntryKind;
  amount: number;
  occurredOn: string;
  dueOn: string | null;
  jobId: string | null;
  invoiceNo: string | null;
  method: string | null;
  note: string | null;
  createdAt: string;
}

export interface NewAccount {
  holderKind: HolderKind;
  name: string;
  phone?: string;
  nic?: string;
  email?: string;
  address?: string;
  dealerId?: number | null;
  creditLimit: number;
  termsDays?: number;
  notes?: string;
}

/* ── row mapping ─────────────────────────────────────────────────────────── */

// numeric(12,2) arrives as a string over PostgREST; every money field needs it.
const num = (v: unknown) => Number(v ?? 0);

type AccountRow = Record<string, unknown>;

const toAccount = (r: AccountRow): CreditAccount => ({
  id: r.id as string,
  holderKind: r.holder_kind as HolderKind,
  name: r.name as string,
  phone: (r.phone as string | null) ?? null,
  nic: (r.nic as string | null) ?? null,
  email: (r.email as string | null) ?? null,
  address: (r.address as string | null) ?? null,
  dealerId: (r.dealer_id as number | null) ?? null,
  creditLimit: num(r.credit_limit),
  termsDays: Number(r.terms_days ?? 30),
  autoOpened: !!r.auto_opened,
  notes: (r.notes as string | null) ?? null,
  totalCharged: num(r.total_charged),
  totalPaid: num(r.total_paid),
  totalWrittenOff: num(r.total_written_off),
  balance: num(r.balance),
  firstChargeOn: (r.first_charge_on as string | null) ?? null,
  lastPaymentOn: (r.last_payment_on as string | null) ?? null,
  chargeCount: Number(r.charge_count ?? 0),
  status: r.status as CreditStatus,
  createdAt: r.created_at as string,
});

const toEntry = (r: AccountRow): CreditEntry => ({
  id: Number(r.id),
  accountId: r.account_id as string,
  kind: r.kind as EntryKind,
  amount: num(r.amount),
  occurredOn: r.occurred_on as string,
  dueOn: (r.due_on as string | null) ?? null,
  jobId: (r.job_id as string | null) ?? null,
  invoiceNo: (r.invoice_no as string | null) ?? null,
  method: (r.method as string | null) ?? null,
  note: (r.note as string | null) ?? null,
  createdAt: r.created_at as string,
});

/**
 * Turn a Postgres complaint into something a cashier can act on.
 *
 * A raw "new row violates row-level security policy" tells the person at the
 * counter nothing about what to do next; naming the permission and who has it
 * does.
 */
function explain(message: string, code?: string): string {
  if (code === "42501") {
    return "Only an admin cashier can do that. Ask an Admin to tick you as an admin cashier under Permissions → Cashiers.";
  }
  if (/credit_accounts_one_per_dealer/.test(message)) {
    return "That dealer already has a credit account.";
  }
  if (/credit_accounts_one_per_customer_phone/.test(message)) {
    return "A credit account already exists for that phone number.";
  }
  if (/credit_entries_one_charge_per_job/.test(message)) {
    return "That job has already been charged to an account.";
  }
  if (/relation .*credit_.* does not exist|Could not find the table/i.test(message)) {
    return "Credit management is not set up in the database yet — run migration 20260901000010_credit_management.sql.";
  }
  return message;
}

/* ── reads ───────────────────────────────────────────────────────────────── */

export async function fetchCreditAccounts(): Promise<CreditAccount[]> {
  const { data, error } = await getSupabaseBrowserClient()
    .from("v_credit_accounts")
    .select("*")
    .order("name");

  if (error) throw new Error(explain(error.message, error.code));
  return ((data ?? []) as AccountRow[]).map(toAccount);
}

export async function fetchCreditEntries(accountId: string): Promise<CreditEntry[]> {
  const { data, error } = await getSupabaseBrowserClient()
    .from("credit_entries")
    .select("*")
    .eq("account_id", accountId)
    .order("occurred_on", { ascending: false })
    .order("id", { ascending: false });

  if (error) throw new Error(explain(error.message, error.code));
  return ((data ?? []) as AccountRow[]).map(toEntry);
}

/* ── writes ──────────────────────────────────────────────────────────────── */

export async function openCreditAccount(a: NewAccount): Promise<CreditAccount> {
  const sb = getSupabaseBrowserClient();
  const { data: { user } } = await sb.auth.getUser();

  const { data, error } = await sb
    .from("credit_accounts")
    .insert({
      holder_kind: a.holderKind,
      name: a.name.trim(),
      phone: a.phone?.trim() || null,
      nic: a.nic?.trim() || null,
      email: a.email?.trim() || null,
      address: a.address?.trim() || null,
      dealer_id: a.dealerId ?? null,
      credit_limit: a.creditLimit,
      terms_days: a.termsDays ?? 30,
      notes: a.notes?.trim() || null,
      // Opened by a person deciding to extend credit, which is the whole
      // difference between this and the accounts the handover trigger creates.
      auto_opened: false,
      opened_by: user?.id ?? null,
    })
    .select("id")
    .single();

  if (error) throw new Error(explain(error.message, error.code));

  // Read it back through the view so the caller gets a balance and status
  // rather than a half-populated row it would have to invent them for.
  const all = await fetchCreditAccounts();
  const created = all.find(x => x.id === (data as { id: string }).id);
  if (!created) throw new Error("The account was created but could not be read back.");
  return created;
}

export async function updateCreditAccount(
  id: string,
  patch: Partial<Pick<NewAccount, "name" | "phone" | "nic" | "email" | "address" | "creditLimit" | "termsDays" | "notes">>,
): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.name        !== undefined) row.name         = patch.name.trim();
  if (patch.phone       !== undefined) row.phone        = patch.phone?.trim() || null;
  if (patch.nic         !== undefined) row.nic          = patch.nic?.trim() || null;
  if (patch.email       !== undefined) row.email        = patch.email?.trim() || null;
  if (patch.address     !== undefined) row.address      = patch.address?.trim() || null;
  if (patch.creditLimit !== undefined) row.credit_limit = patch.creditLimit;
  if (patch.termsDays   !== undefined) row.terms_days   = patch.termsDays;
  if (patch.notes       !== undefined) row.notes        = patch.notes?.trim() || null;
  if (Object.keys(row).length === 0) return;

  const { error } = await getSupabaseBrowserClient()
    .from("credit_accounts").update(row).eq("id", id);
  if (error) throw new Error(explain(error.message, error.code));
}

async function addEntry(e: {
  accountId: string; kind: EntryKind; amount: number;
  method?: string; note?: string; jobId?: string; invoiceNo?: string; dueOn?: string;
}): Promise<void> {
  const sb = getSupabaseBrowserClient();
  const { data: { user } } = await sb.auth.getUser();

  const { error } = await sb.from("credit_entries").insert({
    account_id: e.accountId,
    kind: e.kind,
    amount: e.amount,
    method: e.method ?? null,
    note: e.note?.trim() || null,
    job_id: e.jobId ?? null,
    invoice_no: e.invoiceNo ?? null,
    due_on: e.dueOn ?? null,
    created_by: user?.id ?? null,
  });
  if (error) throw new Error(explain(error.message, error.code));
}

/** Money received. Any cashier may do this — refusing a payment is worse than
 *  any risk of recording one. */
export const recordPayment = (accountId: string, amount: number, method: string, note?: string) =>
  addEntry({ accountId, kind: "Payment", amount, method, note });

/** Put something on account by hand — a sale, or a correction. */
export const addCharge = (accountId: string, amount: number, note?: string, invoiceNo?: string) =>
  addEntry({ accountId, kind: "Charge", amount, note, invoiceNo });

/**
 * Give up on a balance. Deliberately not a payment: rolled together, the
 * takings would include money nobody paid.
 *
 * Naming the invoice is optional but worth doing. A write-off against the
 * account tells you a dealer cost the shop money; a write-off against an
 * invoice tells you which jobs went bad, which is the figure that says whether
 * a job type, a dealer or a price point is the problem. When one is named, a
 * trigger rolls it onto sales.bad_debt — see migration 20260901000016.
 */
export const writeOff = (accountId: string, amount: number, note?: string, invoiceNo?: string) =>
  addEntry({ accountId, kind: "Write-off", amount, note, invoiceNo });

/**
 * Charge a delivered job's unpaid balance to whoever is collecting.
 *
 * The database does this itself on the Delivered transition; calling it from
 * the handover screen too means the new charge is on screen straight away
 * rather than after the next refresh. Both are idempotent per job, so the pair
 * can only ever produce one charge.
 */
export async function postJobToCredit(jobId: string): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  const { data, error } = await getSupabaseBrowserClient()
    .rpc("post_repair_balance_to_credit", { p_job_id: jobId });
  if (error) throw new Error(explain(error.message, error.code));
  return (data as string | null) ?? null;
}

/* ── hooks ───────────────────────────────────────────────────────────────── */

export function useCreditAccounts() {
  const configured = isSupabaseConfigured();
  const [accounts, setAccounts] = useState<CreditAccount[]>([]);
  const [loading, setLoading] = useState(configured);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!configured) return;
    try {
      setAccounts(await fetchCreditAccounts());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [configured]);

  useEffect(() => {
    // No setLoading here: the initial value already accounts for an
    // unconfigured backend, and setting state synchronously in an effect
    // cascades a second render for nothing.
    if (!configured) return;
    let active = true;
    (async () => {
      try {
        const rows = await fetchCreditAccounts();
        if (active) { setAccounts(rows); setError(null); }
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [configured]);

  return { accounts, loading, error, reload, configured };
}

/**
 * One account's ledger, for the history view.
 *
 * State is one object stamped with the account it belongs to, and "loading" is
 * derived from whether that stamp matches what was asked for. The obvious
 * version — setLoading(true) at the top of the effect — sets state during the
 * effect body and cascades an extra render every time the modal opens; worse,
 * it briefly shows the previous account's entries under the new account's name.
 */
export function useCreditEntries(accountId: string | null) {
  const [loaded, setLoaded] = useState<{ forId: string | null; entries: CreditEntry[]; error: string | null }>(
    { forId: null, entries: [], error: null },
  );

  useEffect(() => {
    if (!accountId || !isSupabaseConfigured()) return;
    let active = true;
    (async () => {
      try {
        const rows = await fetchCreditEntries(accountId);
        if (active) setLoaded({ forId: accountId, entries: rows, error: null });
      } catch (e) {
        if (active) setLoaded({ forId: accountId, entries: [], error: e instanceof Error ? e.message : String(e) });
      }
    })();
    return () => { active = false; };
  }, [accountId]);

  const ready = loaded.forId === accountId;
  return {
    entries: ready ? loaded.entries : [],
    loading: !!accountId && isSupabaseConfigured() && !ready,
    error: ready ? loaded.error : null,
  };
}

/* ── grouping ────────────────────────────────────────────────────────────── */

/**
 * One movement on the account as a person would describe it.
 *
 * The ledger stores a charge per repair job, and that is right: the handover
 * trigger fires per job, each job has to be traceable on its own, and a job is
 * what gets paid for. But three phones invoiced on one bill are one thing that
 * happened — the customer signed one invoice for Rs. 1,050, not three for
 * Rs. 350 — and a history that lists them separately does not match the piece
 * of paper they are holding.
 *
 * So charges sharing an invoice number collapse into one row. Nothing is
 * summed that was not billed together, because the invoice number is exactly
 * the record of what was billed together.
 */
export interface CreditEntryGroup {
  key: string;
  kind: EntryKind;
  invoiceNo: string | null;
  /** Summed across the group. A single entry is a group of one. */
  amount: number;
  occurredOn: string;
  dueOn: string | null;
  method: string | null;
  note: string | null;
  jobIds: string[];
  entries: CreditEntry[];
}

export function groupCreditEntries(entries: CreditEntry[]): CreditEntryGroup[] {
  const groups: CreditEntryGroup[] = [];
  const byInvoice = new Map<string, CreditEntryGroup>();

  for (const e of entries) {
    // Only charges group, and only when an invoice says they belong together.
    // A payment is its own event even if two land on the same invoice — part
    // payments are exactly the case somebody opens this history to check.
    const groupable = e.kind === "Charge" && !!e.invoiceNo;
    const existing = groupable ? byInvoice.get(e.invoiceNo!) : undefined;

    if (existing) {
      existing.amount += e.amount;
      existing.entries.push(e);
      if (e.jobId) existing.jobIds.push(e.jobId);
      // The earliest date is when the invoice was raised; a later charge
      // stamped with the same number is part of that same bill.
      if (e.occurredOn < existing.occurredOn) existing.occurredOn = e.occurredOn;
      continue;
    }

    const g: CreditEntryGroup = {
      key: groupable ? `inv:${e.invoiceNo}` : `entry:${e.id}`,
      kind: e.kind,
      invoiceNo: e.invoiceNo,
      amount: e.amount,
      occurredOn: e.occurredOn,
      dueOn: e.dueOn,
      method: e.method,
      note: e.note,
      jobIds: e.jobId ? [e.jobId] : [],
      entries: [e],
    };
    groups.push(g);
    if (groupable) byInvoice.set(e.invoiceNo!, g);
  }

  return groups;
}

/* ── shared presentation ─────────────────────────────────────────────────── */

/**
 * Status colours, in the shape every pill in this app uses: a colour, a wash of
 * it at 0.08, and an edge at 0.2. Same alphas as statusConfig in the jobs
 * table, so a badge here and a badge there are visibly the same component.
 *
 * The text colour is the theme token rather than the fixed hex. The hue is the
 * same family; the token simply carries the readable version of it per theme
 * (#059669 on light, #34d399 on dark) instead of a neon that was chosen against
 * a black background.
 */
export const STATUS_COLOURS: Record<CreditStatus, { color: string; bg: string; border: string }> = {
  Active:  { color: "var(--accent)",  bg: "var(--accent-dim)",      border: "var(--accent-glow)"    },
  Overdue: { color: "var(--danger)",  bg: "rgba(248,113,113,0.08)", border: "rgba(248,113,113,0.2)" },
  Settled: { color: "var(--success)", bg: "rgba(74,222,128,0.08)",  border: "rgba(74,222,128,0.2)"  },
};

/** How much more they may run up. A zero limit means none was ever approved,
 *  so there is no headroom — not unlimited headroom. */
export const headroom = (a: CreditAccount) => Math.max(0, a.creditLimit - a.balance);
export const isOverLimit = (a: CreditAccount) => a.balance > a.creditLimit;
