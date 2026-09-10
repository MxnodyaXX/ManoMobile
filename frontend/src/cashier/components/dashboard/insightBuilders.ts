"use client";

import type { RepairJob } from "@/cashier/contexts/RepairContext";
import type { PartRequest, SparePart } from "@/cashier/contexts/PartsContext";
import type { InsightColumn, InsightRow, InsightSummary, InsightGroup } from "./InsightModal";
import { labourForJob, describeRate } from "@/lib/repair/labour";
import type { EffectiveRules } from "@/lib/settings/staffRules";

/** Rates keyed by technician name, since that is what a job records. */
export type RateLookup = (technicianName: string) => EffectiveRules | null;

/**
 * The rows behind each dashboard figure.
 *
 * Every builder derives from the same job list the card totalled, rather than
 * re-querying with its own filter — two filters that disagree would show a
 * breakdown whose rows don't add up to the headline, which is worse than no
 * breakdown at all.
 */

export interface InsightSpec {
  title: string;
  subtitle?: string;
  columns: InsightColumn[];
  rows: InsightRow[];
  summary?: InsightSummary[];
  /** The same rows, gathered. Offered as an alternative view, never a
   *  replacement — see InsightModal's toggle. */
  groups?: InsightGroup[];
  /** The toggle's label. Only meaningful alongside `groups`. */
  groupLabel?: string;
  note?: string;
  emptyText?: string;
  actionLabel?: string;
}

const rs = (n: number) => `Rs. ${Math.round(n).toLocaleString()}`;
const dateOf = (v?: string) => (v ? new Date(v).toLocaleDateString("en-GB") : "—");
const device = (j: RepairJob) => [j.brand, j.model].filter(Boolean).join(" ") || "—";

/** Parts drawn against one job, priced from the catalogue. */
export function partsCostForJob(jobId: string, requests: PartRequest[], catalog: SparePart[]): number {
  return requests
    .filter(r => r.jobId === jobId && (r.status === "Approved" || r.status === "Issued"))
    .reduce((sum, r) => sum + (catalog.find(p => p.sku === r.partSku)?.costPrice ?? 0) * r.quantity, 0);
}

/* ── Job-list breakdowns ─────────────────────────────────────────────────── */

const JOB_COLUMNS: InsightColumn[] = [
  { key: "job", label: "Job" },
  { key: "customer", label: "Customer" },
  { key: "device", label: "Device" },
  { key: "tech", label: "Technician" },
  { key: "issued", label: "Issued" },
  { key: "amount", label: "Charged", numeric: true },
  { key: "paid", label: "Paid", numeric: true },
];

/**
 * What this job did to the shop's income, signed.
 *
 * A Cash Return is money going the other way, so it counts negatively — the
 * whole reason a period with one in it must not be read as if the repair had
 * simply been free.
 */
function signedAmount(j: RepairJob): number {
  return j.completionType === "Cash Return"
    ? -(j.cashReturnAmount ?? 0)
    : j.estimatedCost;
}

/** Brackets for money out, the same convention the jobs list and invoice use. */
const signedRs = (n: number) => (n < 0 ? `(${rs(-n)})` : rs(n));

function jobRows(jobs: RepairJob[]): InsightRow[] {
  return jobs.map(j => ({
    id: j.id,
    cells: {
      job: j.id,
      customer: j.customerName || "—",
      device: device(j),
      tech: j.technician || "Unassigned",
      issued: dateOf(j.handover?.handedOverAt ?? j.completedAt),
      amount: j.completionType === "Cash Return"
        ? `Cash Return ${signedRs(signedAmount(j))}`
        : rs(j.estimatedCost),
      paid: rs(j.advancePaid),
    },
  }));
}

/**
 * The same jobs, gathered under the invoice each was billed on.
 *
 * Two jobs on one invoice — a repair charged and a Cash Return against it —
 * are one piece of paper the customer signed and one net figure the shop
 * banked. Listed separately they read as unrelated records and the arithmetic
 * that produced the invoice total is invisible.
 *
 * Jobs with no invoice number are collected at the end rather than dropped:
 * they are handed-over work that has not been billed yet, which is a real
 * state and worth seeing.
 */
function invoiceGroups(jobs: RepairJob[]): InsightGroup[] {
  const byInvoice = new Map<string, RepairJob[]>();
  const unbilled: RepairJob[] = [];

  for (const j of jobs) {
    const no = j.invoiceNo?.trim();
    if (!no) { unbilled.push(j); continue; }
    const list = byInvoice.get(no);
    if (list) list.push(j); else byInvoice.set(no, [j]);
  }

  const group = (id: string, title: string, list: RepairJob[]): InsightGroup => {
    const net = list.reduce((sum, j) => sum + signedAmount(j), 0);
    return {
      id,
      title,
      subtitle: `${list.length} job${list.length === 1 ? "" : "s"}`,
      value: signedRs(net),
      negative: net < 0,
      rows: jobRows(list),
    };
  };

  const groups = [...byInvoice.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([no, list]) => group(no, no, list));

  if (unbilled.length > 0) {
    groups.push(group("__unbilled__", "Not yet invoiced", unbilled));
  }
  return groups;
}

export function repairIncomeInsight(jobs: RepairJob[], period: string): InsightSpec {
  // Billed and returned are shown apart before they are netted, because "we
  // took 8,000" and "we gave 5,000 back" are two things a shop wants to see,
  // and a single 3,000 hides both.
  const billed = jobs.reduce((s, j) => s + (j.completionType === "Cash Return" ? 0 : j.estimatedCost), 0);
  const returned = jobs.reduce((s, j) => s + (j.completionType === "Cash Return" ? (j.cashReturnAmount ?? 0) : 0), 0);
  const net = billed - returned;
  const paid = jobs.reduce((s, j) => s + j.advancePaid, 0);

  const summary: InsightSummary[] = [
    { label: "Net income", value: signedRs(net), strong: true, hint: `${jobs.length} job${jobs.length === 1 ? "" : "s"}` },
  ];
  // Only worth the width when there is actually something to return. On an
  // ordinary day these two would just be the net figure repeated.
  if (returned > 0) {
    summary.push({ label: "Repairs billed", value: rs(billed) });
    summary.push({ label: "Cash returns", value: `(${rs(returned)})`, hint: "paid back" });
  }
  // Money in and money still owed are the two figures anybody opens this for,
  // so they are the two that get a colour.
  summary.push({ label: "Paid", value: rs(paid), tone: "good" });
  summary.push({
    label: "Outstanding",
    value: rs(net - paid),
    hint: net - paid > 0 ? "still to collect" : "settled",
    tone: net - paid > 0 ? "warn" : "good",
  });

  return {
    title: "Repair Income",
    subtitle: `Jobs handed to customers · ${period}`,
    columns: JOB_COLUMNS,
    rows: jobRows(jobs),
    // Presentation only. The same jobs and the same arithmetic either way —
    // grouping changes how the total is explained, never what it is.
    groups: invoiceGroups(jobs),
    groupLabel: "Show invoice wise",
    summary,
    note: "Income is counted when the device is collected, not when the repair is finished. Cash Returns count against it.",
    emptyText: "No repairs were issued to customers in this period. Income appears here once a job is handed over.",
    actionLabel: "Open Repair Management",
  };
}

export function totalJobsInsight(jobs: RepairJob[], period: string): InsightSpec {
  const byTech = new Map<string, { count: number; value: number }>();
  for (const j of jobs) {
    const key = j.technician || "Unassigned";
    const cur = byTech.get(key) ?? { count: 0, value: 0 };
    byTech.set(key, { count: cur.count + 1, value: cur.value + j.estimatedCost });
  }
  return {
    title: "Jobs Completed",
    subtitle: `Issued to customers · ${period}`,
    columns: [
      { key: "tech", label: "Technician" },
      { key: "count", label: "Jobs", numeric: true },
      { key: "value", label: "Value", numeric: true },
      { key: "avg", label: "Average", numeric: true },
    ],
    rows: [...byTech.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .map(([tech, v]) => ({
        id: tech,
        cells: { tech, count: String(v.count), value: rs(v.value), avg: rs(v.value / v.count) },
      })),
    summary: [
      { label: "Jobs issued", value: String(jobs.length), strong: true },
      { label: "Technicians", value: String(byTech.size) },
    ],
    emptyText: "No jobs were issued in this period.",
    actionLabel: "Open Repair Management",
  };
}

/* ── Cost breakdowns ─────────────────────────────────────────────────────── */

export function partsCostInsight(
  jobs: RepairJob[], requests: PartRequest[], catalog: SparePart[], period: string,
): InsightSpec {
  const ids = new Set(jobs.map(j => j.id));
  const used = requests.filter(r => ids.has(r.jobId) && (r.status === "Approved" || r.status === "Issued"));
  const total = used.reduce((s, r) => s + (catalog.find(p => p.sku === r.partSku)?.costPrice ?? 0) * r.quantity, 0);
  const unpriced = used.filter(r => !catalog.find(p => p.sku === r.partSku)).length;

  return {
    title: "Parts Cost",
    subtitle: `Parts consumed on issued jobs · ${period}`,
    columns: [
      { key: "job", label: "Job" },
      { key: "part", label: "Part" },
      { key: "qty", label: "Qty", numeric: true },
      { key: "unit", label: "Unit cost", numeric: true },
      { key: "line", label: "Total", numeric: true },
    ],
    rows: used.map(r => {
      const cat = catalog.find(p => p.sku === r.partSku);
      return {
        id: r.id,
        dim: !cat,
        cells: {
          job: r.jobId,
          part: r.partName,
          qty: String(r.quantity),
          unit: cat ? rs(cat.costPrice) : "no price",
          line: cat ? rs(cat.costPrice * r.quantity) : "—",
        },
      };
    }),
    summary: [
      { label: "Parts cost", value: rs(total), strong: true, hint: `${used.length} part${used.length === 1 ? "" : "s"}` },
    ],
    note: unpriced > 0
      ? `${unpriced} part${unpriced === 1 ? " is" : "s are"} no longer in the catalogue, so ${unpriced === 1 ? "its cost is" : "their costs are"} not counted in the total.`
      : "Costs come from the catalogue price at the time this was viewed, not the price when the part was bought.",
    emptyText: "No parts were drawn against jobs issued in this period.",
  };
}

export function labourInsight(
  jobs: RepairJob[], rateFor: RateLookup, period: string,
): InsightSpec {
  const lines = jobs.map(j => {
    const rules = rateFor(j.technician || "");
    const lab = labourForJob(j, rules);
    return { job: j, lab, rules };
  });

  const total = lines.reduce((s, l) => s + l.lab.amount, 0);
  const estimated = lines.filter(l => l.lab.estimated && l.lab.amount > 0).length;
  const uncosted = lines.filter(l => l.lab.mode === "none").length;

  return {
    title: "Labour Cost",
    subtitle: `What the shop paid for the work · ${period}`,
    columns: [
      { key: "job", label: "Job" },
      { key: "tech", label: "Technician" },
      { key: "rate", label: "Rate" },
      { key: "charged", label: "Charged", numeric: true },
      { key: "labour", label: "Labour cost", numeric: true },
    ],
    rows: lines.map(({ job, lab, rules }) => ({
      id: job.id,
      dim: lab.estimated,
      cells: {
        job: job.id,
        tech: job.technician || "Unassigned",
        rate: rules ? describeRate(rules.labourCostMode, rules.labourCostValue) : "Not costed",
        charged: rs(job.estimatedCost),
        labour: lab.estimated && lab.amount === 0 ? "—" : rs(lab.amount),
      },
    })),
    summary: [
      { label: "Labour cost", value: rs(total), strong: true, hint: `${jobs.length} job${jobs.length === 1 ? "" : "s"}` },
      { label: "Not costed", value: String(uncosted), hint: uncosted ? "no rate set" : "all covered" },
    ],
    note: estimated > 0
      ? `${estimated} job${estimated === 1 ? " was" : "s were"} finished before labour costing existed, so ${estimated === 1 ? "its figure is" : "their figures are"} estimated from today's rate — shown dimmed. Set each technician's rate under Admin → Permissions.`
      : "Recorded on each job when it was completed, from that technician's rate at the time. Later rate changes do not alter finished jobs.",
    emptyText: "No jobs were issued in this period, so there is no labour cost.",
  };
}

export function profitInsight(
  jobs: RepairJob[], requests: PartRequest[], catalog: SparePart[], rateFor: RateLookup, period: string,
): InsightSpec {
  const lines = jobs.map(j => {
    const parts = partsCostForJob(j.id, requests, catalog);
    const labour = labourForJob(j, rateFor(j.technician || "")).amount;
    return { job: j, parts, labour, profit: j.estimatedCost - parts - labour };
  });

  const charged = lines.reduce((s, l) => s + l.job.estimatedCost, 0);
  const parts = lines.reduce((s, l) => s + l.parts, 0);
  const labour = lines.reduce((s, l) => s + l.labour, 0);
  const profit = charged - parts - labour;
  const losers = lines.filter(l => l.profit < 0);

  return {
    title: "Repair Profit",
    subtitle: `Charge less parts and labour · ${period}`,
    columns: [
      { key: "job", label: "Job" },
      { key: "device", label: "Device" },
      { key: "charged", label: "Charged", numeric: true },
      { key: "parts", label: "Parts", numeric: true },
      { key: "labour", label: "Labour", numeric: true },
      { key: "profit", label: "Profit", numeric: true },
    ],
    // Worst first: a loss-making job is the row worth acting on.
    rows: [...lines].sort((a, b) => a.profit - b.profit).map(l => ({
      id: l.job.id,
      cells: {
        job: l.job.id,
        device: device(l.job),
        charged: rs(l.job.estimatedCost),
        parts: rs(l.parts),
        labour: rs(l.labour),
        profit: `${l.profit < 0 ? "−" : ""}${rs(Math.abs(l.profit))}`,
      },
    })),
    summary: [
      { label: "Profit", value: `${profit < 0 ? "−" : ""}${rs(Math.abs(profit))}`, strong: true,
        hint: charged > 0 ? `${Math.round((profit / charged) * 100)}% margin` : undefined },
      { label: "Charged", value: rs(charged) },
      { label: "Parts", value: rs(parts) },
      { label: "Labour", value: rs(labour) },
    ],
    note: losers.length > 0
      ? `${losers.length} job${losers.length === 1 ? "" : "s"} cost more than ${losers.length === 1 ? "it was" : "they were"} charged — listed first.`
      : "Every job in this period covered its own parts and labour.",
    emptyText: "No jobs were issued in this period, so there is no profit to report.",
  };
}

/* ── Sales ───────────────────────────────────────────────────────────────── */

/**
 * Sales figures have no backend yet. Rather than an empty table, this says so —
 * a shop owner reading "Rs. 0" needs to know whether that means no sales or no
 * system, and those call for very different actions.
 */
export function salesInsight(title: string, period: string): InsightSpec {
  return {
    title,
    subtitle: period,
    columns: [],
    rows: [],
    emptyText:
      "Counter sales are not recorded in the database yet, so this reads zero regardless of what was sold. "
      + "Repair income is tracked and appears under Repairs. Once sales are stored, this figure and its breakdown will fill in automatically.",
  };
}

/* ── Today's snapshot tiles ──────────────────────────────────────────────── */

export function snapshotInsight(title: string, subtitle: string, jobs: RepairJob[], emptyText: string): InsightSpec {
  return {
    title,
    subtitle,
    columns: [
      { key: "job", label: "Job" },
      { key: "customer", label: "Customer" },
      { key: "device", label: "Device" },
      { key: "tech", label: "Technician" },
      { key: "created", label: "Taken in" },
      { key: "estimate", label: "Estimate", numeric: true },
      { key: "balance", label: "Balance", numeric: true },
    ],
    rows: jobs.map(j => ({
      id: j.id,
      cells: {
        job: j.id,
        customer: j.customerName || "—",
        device: device(j),
        tech: j.technician || "Unassigned",
        created: dateOf(j.createdAt),
        estimate: rs(j.estimatedCost),
        balance: rs(Math.max(0, j.estimatedCost - j.advancePaid)),
      },
    })),
    summary: [
      { label: "Jobs", value: String(jobs.length), strong: true },
      { label: "Estimated value", value: rs(jobs.reduce((s, j) => s + j.estimatedCost, 0)) },
      { label: "Balance due", value: rs(jobs.reduce((s, j) => s + Math.max(0, j.estimatedCost - j.advancePaid), 0)) },
    ],
    emptyText,
    actionLabel: "Open Repair Management",
  };
}
