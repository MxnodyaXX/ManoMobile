"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { fetchSales } from "@/lib/sales/api";
import type { SaleTx } from "@/cashier/contexts/SalesContext";
import type { SaleItemKind } from "@/lib/sales/saleItems";
import { fetchCashReturns, type CashReturn } from "@/lib/accounts/cashReturns";
import { useCreditAccounts, type CreditAccount } from "@/lib/credit/api";
import { useStaff, type StaffProfile } from "@/lib/staff/api";
import { useRepair, type RepairJob, type RepairDealer } from "@/cashier/contexts/RepairContext";
import { useAccessories, type AccessoryProduct } from "@/cashier/contexts/AccessoriesContext";
import { useParts, type SparePart } from "@/cashier/contexts/PartsContext";
import { useAdmin, type Supplier, type PurchaseOrder } from "@/admin/contexts/AdminContext";

/**
 * Everything Analytics reads, loaded once and shared by every tab.
 *
 * The contexts the admin shell already holds — jobs, dealers, products,
 * parts, suppliers, purchase orders, staff, credit accounts — are taken from
 * there. What no context holds is read here directly: the sales ledger and
 * its lines, every credit entry, cash returns, the SMS log, and the job
 * event trail. All of it is read once on mount; the tabs only filter.
 *
 * Nothing here writes. Analytics is a reader.
 */

export interface SaleLine {
  id: number;
  invoiceNo: string;
  kind: SaleItemKind;
  referenceId: string | null;
  description: string;
  qty: number;
  unitPrice: number;
  discount: number;
  lineTotal: number;
}

export interface CreditEntryLite {
  id: number;
  accountId: string;
  kind: "Charge" | "Payment" | "Write-off" | "Refund";
  amount: number;
  occurredOn: string;
  dueOn: string | null;
  jobId: string | null;
  invoiceNo: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface SmsRecord {
  id: number;
  status: string;
  purpose: string | null;
  jobId: string | null;
  cost: number | null;
  count: number | null;
  sentByName: string | null;
  createdAt: string;
}

export interface JobEvent {
  id: number;
  jobId: string;
  from: string | null;
  to: string;
  note: string | null;
  changedBy: string | null;
  changedAt: string;
  /** Set on claims, reassignments and releases — whose bench it left and joined. */
  technicianFrom: string | null;
  technicianTo: string | null;
}

export interface AnalyticsData {
  sales: SaleTx[];
  saleLines: SaleLine[];
  creditEntries: CreditEntryLite[];
  cashReturns: CashReturn[];
  sms: SmsRecord[];
  events: JobEvent[];
  jobs: RepairJob[];
  dealers: RepairDealer[];
  /** What repair agents charged, per job id — see RepairContext. */
  agentCosts: Record<string, number>;
  products: AccessoryProduct[];
  parts: SparePart[];
  suppliers: Supplier[];
  purchaseOrders: PurchaseOrder[];
  staff: StaffProfile[];
  accounts: CreditAccount[];
  loading: boolean;
  error: string | null;
  configured: boolean;
  reload: () => Promise<void>;
}

const Ctx = createContext<AnalyticsData | null>(null);

type Row = Record<string, unknown>;
const num = (v: unknown) => (v == null ? 0 : Number(v));
const str = (v: unknown) => (v == null ? null : String(v));

async function fetchAllSaleLines(): Promise<SaleLine[]> {
  const { data, error } = await getSupabaseBrowserClient()
    .from("sale_items")
    .select("id, invoice_no, kind, reference_id, description, qty, unit_price, discount, line_total")
    .order("id", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Row[]).map(r => ({
    id: Number(r.id), invoiceNo: String(r.invoice_no), kind: r.kind as SaleItemKind, referenceId: str(r.reference_id),
    description: String(r.description ?? ""), qty: num(r.qty), unitPrice: num(r.unit_price), discount: num(r.discount), lineTotal: num(r.line_total),
  }));
}

async function fetchAllCreditEntries(): Promise<CreditEntryLite[]> {
  const { data, error } = await getSupabaseBrowserClient()
    .from("credit_entries")
    .select("id, account_id, kind, amount, occurred_on, due_on, job_id, invoice_no, created_by, created_at")
    .order("id", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Row[]).map(r => ({
    id: Number(r.id), accountId: String(r.account_id), kind: r.kind as CreditEntryLite["kind"], amount: num(r.amount),
    occurredOn: String(r.occurred_on), dueOn: str(r.due_on), jobId: str(r.job_id), invoiceNo: str(r.invoice_no),
    createdBy: str(r.created_by), createdAt: String(r.created_at),
  }));
}

async function fetchSms(): Promise<SmsRecord[]> {
  const { data, error } = await getSupabaseBrowserClient()
    .from("sms_messages")
    .select("id, status, purpose, job_id, cost, sms_count, sent_by_name, created_at")
    .order("id", { ascending: false })
    .limit(5000);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Row[]).map(r => ({
    id: Number(r.id), status: String(r.status), purpose: str(r.purpose), jobId: str(r.job_id),
    cost: r.cost == null ? null : Number(r.cost), count: r.sms_count == null ? null : Number(r.sms_count),
    sentByName: str(r.sent_by_name), createdAt: String(r.created_at),
  }));
}

async function fetchEvents(): Promise<JobEvent[]> {
  const { data, error } = await getSupabaseBrowserClient()
    .from("repair_job_events")
    .select("id, job_id, from_status, to_status, note, changed_by, changed_at, technician_from, technician_to")
    .order("id", { ascending: false })
    .limit(20000);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Row[]).map(r => ({
    id: Number(r.id), jobId: String(r.job_id), from: str(r.from_status), to: String(r.to_status),
    note: str(r.note), changedBy: str(r.changed_by), changedAt: String(r.changed_at),
    technicianFrom: str(r.technician_from), technicianTo: str(r.technician_to),
  }));
}

/**
 * Every ledger, in one round. Each read stands alone: a table that fails to
 * read leaves a note and an empty list, not a blank page.
 */
async function readLedgers() {
  const problems: string[] = [];
  const safe = async <T,>(name: string, p: Promise<T>, empty: T): Promise<T> => {
    try { return await p; } catch (e) { problems.push(`${name}: ${e instanceof Error ? e.message : String(e)}`); return empty; }
  };
  const [sales, saleLines, creditEntries, cashReturns, sms, events] = await Promise.all([
    safe("sales", fetchSales(), [] as SaleTx[]),
    safe("sale lines", fetchAllSaleLines(), [] as SaleLine[]),
    safe("credit entries", fetchAllCreditEntries(), [] as CreditEntryLite[]),
    safe("cash returns", fetchCashReturns(5000), [] as CashReturn[]),
    safe("SMS log", fetchSms(), [] as SmsRecord[]),
    safe("job events", fetchEvents(), [] as JobEvent[]),
  ]);
  return { data: { sales, saleLines, creditEntries, cashReturns, sms, events }, problems };
}

export function AnalyticsProvider({ children }: { children: ReactNode }) {
  const configured = isSupabaseConfigured();
  const { jobs, dealers, agentCosts } = useRepair();
  const { products } = useAccessories();
  const { parts } = useParts();
  const { suppliers, purchaseOrders } = useAdmin();
  const { staff } = useStaff();
  const { accounts, reload: reloadAccounts } = useCreditAccounts();

  // `loaded` rides with the data it describes, so there is one state write
  // per read rather than a loading flag set from inside an effect.
  const [own, setOwn] = useState<{ loaded: boolean; sales: SaleTx[]; saleLines: SaleLine[]; creditEntries: CreditEntryLite[]; cashReturns: CashReturn[]; sms: SmsRecord[]; events: JobEvent[] }>({
    loaded: !configured, sales: [], saleLines: [], creditEntries: [], cashReturns: [], sms: [], events: [],
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!configured) return;
    let live = true;
    (async () => {
      const r = await readLedgers();
      if (!live) return;
      setOwn({ loaded: true, ...r.data });
      setError(r.problems.length ? r.problems.join(" · ") : null);
    })();
    return () => { live = false; };
  }, [configured]);

  const reload = useCallback(async () => {
    if (!configured) return;
    const [r] = await Promise.all([readLedgers(), reloadAccounts()]);
    setOwn({ loaded: true, ...r.data });
    setError(r.problems.length ? r.problems.join(" · ") : null);
  }, [configured, reloadAccounts]);

  const value = useMemo<AnalyticsData>(() => {
    const { loaded, ...rest } = own;
    return { ...rest, jobs, dealers, agentCosts, products, parts, suppliers, purchaseOrders, staff, accounts, loading: !loaded, error, configured, reload };
  }, [own, jobs, dealers, agentCosts, products, parts, suppliers, purchaseOrders, staff, accounts, error, configured, reload]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAnalytics(): AnalyticsData {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAnalytics must be used inside AnalyticsProvider");
  return v;
}
