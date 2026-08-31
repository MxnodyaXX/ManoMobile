"use client";

import { useState } from "react";
import { ClipboardList, CheckCircle2, Box, TrendingUp, Wallet } from "lucide-react";
import type { RepairJob } from "@/cashier/contexts/RepairContext";
import type { PartRequest, SparePart } from "@/cashier/contexts/PartsContext";
import InsightModal, { type InsightColumn, type InsightRow, type InsightSummary } from "@/cashier/components/dashboard/InsightModal";

const ff = "'Plus Jakarta Sans', sans-serif";

/**
 * What this technician's own work adds up to, above the bench.
 *
 * Every figure is clickable, because a number on its own invites the wrong
 * conclusion: "Rs. 15,826 parts" means nothing until you can see it is one
 * screen on one job. The same reasoning as the cashier dashboard tiles, and
 * the same InsightModal behind them.
 *
 * Scoped to this technician throughout — these are personal figures, not the
 * shop's. Revenue here is what the shop charged for THEIR jobs, and charges
 * are what THEY billed for the work.
 */

const rs = (n: number) => `Rs. ${Math.round(n || 0).toLocaleString("en-LK")}`;
const dev = (j: RepairJob) => [j.brand, j.model].filter(Boolean).join(" ") || "—";
const day = (v?: string) => (v ? new Date(v).toLocaleDateString("en-GB") : "—");

const isFinished = (j: RepairJob) =>
  j.status === "Completed" || j.status === "Delivered" || (!!j.completedAt && !!j.completionType);

interface Spec {
  title: string;
  subtitle: string;
  columns: InsightColumn[];
  rows: InsightRow[];
  summary?: InsightSummary[];
  note?: string;
  emptyText: string;
}

export default function PersonalInsights({ jobs, partRequests, catalog, technicianName }: {
  /** This technician's jobs only. */
  jobs: RepairJob[];
  partRequests: PartRequest[];
  catalog: SparePart[];
  technicianName: string;
}) {
  const [open, setOpen] = useState<string | null>(null);

  const done = jobs.filter(isFinished);
  const ids = new Set(jobs.map(j => j.id));

  // Approved counts, not only installed: an approved request is already off
  // the shelf, so it is a real cost whether or not it was ticked as fitted.
  const usedParts = partRequests.filter(
    r => ids.has(r.jobId) && (r.status === "Approved" || r.status === "Issued"),
  );
  const costOf = (r: PartRequest) =>
    (catalog.find(p => p.sku === r.partSku)?.costPrice ?? 0) * r.quantity;

  const partsCost = usedParts.reduce((t, r) => t + costOf(r), 0);
  const revenue   = done.reduce((t, j) => t + j.estimatedCost, 0);
  // Only what was actually recorded. Jobs finished before labour costing
  // existed carry nothing, and inventing a figure for them would overstate
  // what this technician has earned.
  const myCharges = done.reduce((t, j) => t + (j.labourCost ?? 0), 0);
  const uncosted  = done.filter(j => j.labourCost === undefined).length;

  const JOB_COLS: InsightColumn[] = [
    { key: "job", label: "Job" },
    { key: "device", label: "Device" },
    { key: "customer", label: "Customer" },
    { key: "status", label: "Status" },
    { key: "charge", label: "Charged", numeric: true },
  ];

  const specs: Record<string, Spec> = {
    total: {
      title: "Total Jobs",
      subtitle: `Every repair assigned to ${technicianName}`,
      columns: JOB_COLS,
      rows: jobs.map(j => ({
        id: j.id,
        cells: {
          job: j.id, device: dev(j), customer: j.customerName || "—",
          status: isFinished(j) ? "Finished" : j.status === "Issued" ? "In progress" : j.status === "Pending" ? "Waiting" : "To start",
          charge: rs(j.estimatedCost),
        },
      })),
      summary: [
        { label: "Assigned", value: String(jobs.length), strong: true },
        { label: "Finished", value: String(done.length) },
        { label: "Still open", value: String(jobs.length - done.length) },
      ],
      emptyText: "Nothing has been assigned to you yet.",
    },

    completed: {
      title: "Jobs Completed",
      subtitle: "Repairs you have finished",
      columns: [
        { key: "job", label: "Job" }, { key: "device", label: "Device" },
        { key: "type", label: "Outcome" }, { key: "finished", label: "Finished" },
        { key: "charge", label: "Charged", numeric: true },
      ],
      rows: done.map(j => ({
        id: j.id,
        cells: {
          job: j.id, device: dev(j), type: j.completionType ?? "Normal",
          finished: day(j.completedAt), charge: rs(j.estimatedCost),
        },
      })),
      summary: [
        { label: "Completed", value: String(done.length), strong: true },
        { label: "Returns", value: String(done.filter(j => j.completionType === "Return").length) },
        { label: "Free of charge", value: String(done.filter(j => j.completionType === "FOC").length) },
      ],
      emptyText: "You have not finished any repairs yet.",
    },

    parts: {
      title: "Parts Cost Used",
      subtitle: "What the parts on your jobs cost the shop",
      columns: [
        { key: "job", label: "Job" }, { key: "part", label: "Part" },
        { key: "qty", label: "Qty", numeric: true },
        { key: "unit", label: "Unit cost", numeric: true },
        { key: "line", label: "Total", numeric: true },
      ],
      rows: usedParts.map(r => {
        const cat = catalog.find(p => p.sku === r.partSku);
        return {
          id: r.id,
          dim: !cat,
          cells: {
            job: r.jobId, part: r.partName, qty: String(r.quantity),
            unit: cat ? rs(cat.costPrice) : "no price",
            line: cat ? rs(costOf(r)) : "—",
          },
        };
      }),
      summary: [{ label: "Parts cost", value: rs(partsCost), strong: true, hint: `${usedParts.length} part${usedParts.length === 1 ? "" : "s"}` }],
      note: "This is what the shop paid for the parts, not what the customer was charged for them.",
      emptyText: "No parts have been drawn against your jobs.",
    },

    revenue: {
      title: "Revenue To The Company",
      subtitle: "What the shop charged for repairs you finished",
      columns: [
        { key: "job", label: "Job" }, { key: "device", label: "Device" },
        { key: "finished", label: "Finished" },
        { key: "charge", label: "Charged", numeric: true },
        { key: "paid", label: "Paid", numeric: true },
      ],
      rows: done.map(j => ({
        id: j.id,
        cells: {
          job: j.id, device: dev(j), finished: day(j.completedAt),
          charge: rs(j.estimatedCost), paid: rs(j.advancePaid),
        },
      })),
      summary: [
        { label: "Charged", value: rs(revenue), strong: true, hint: `${done.length} job${done.length === 1 ? "" : "s"}` },
        { label: "Collected", value: rs(done.reduce((t, j) => t + j.advancePaid, 0)) },
      ],
      note: "The shop's income from your work, before parts and your own charge come out of it.",
      emptyText: "No finished repairs yet, so nothing has been charged.",
    },

    charges: {
      title: "Your Charges",
      subtitle: "What you billed for the work",
      columns: [
        { key: "job", label: "Job" }, { key: "device", label: "Device" },
        { key: "finished", label: "Finished" },
        { key: "charge", label: "Job charged", numeric: true },
        { key: "mine", label: "Your charge", numeric: true },
      ],
      rows: done.map(j => ({
        id: j.id,
        dim: j.labourCost === undefined,
        cells: {
          job: j.id, device: dev(j), finished: day(j.completedAt),
          charge: rs(j.estimatedCost),
          mine: j.labourCost === undefined ? "—" : rs(j.labourCost),
        },
      })),
      summary: [
        { label: "Your charges", value: rs(myCharges), strong: true },
        { label: "Jobs", value: String(done.length - uncosted), hint: uncosted ? `${uncosted} not recorded` : undefined },
      ],
      note: uncosted > 0
        ? `${uncosted} job${uncosted === 1 ? " was" : "s were"} finished before charges were recorded, so ${uncosted === 1 ? "it is" : "they are"} shown as — and not counted.`
        : "What you entered when finishing each job.",
      emptyText: "You have not recorded a charge on any job yet.",
    },
  };

  const TILES: { key: string; label: string; value: string; hint: string; icon: typeof Box; tint: string }[] = [
    { key: "total",     label: "Total Jobs",      value: String(jobs.length), hint: `${jobs.length - done.length} still open`, icon: ClipboardList, tint: "#a78bfa" },
    { key: "completed", label: "Jobs Completed",  value: String(done.length), hint: "finished by you",                          icon: CheckCircle2,  tint: "#34d399" },
    { key: "parts",     label: "Parts Cost Used", value: rs(partsCost),       hint: `${usedParts.length} part${usedParts.length === 1 ? "" : "s"}`, icon: Box, tint: "#60a5fa" },
    { key: "revenue",   label: "Revenue To Company", value: rs(revenue),      hint: "from your finished jobs",                  icon: TrendingUp,    tint: "#fbbf24" },
    { key: "charges",   label: "Your Charges",    value: rs(myCharges),       hint: uncosted ? `${uncosted} not recorded` : "billed by you", icon: Wallet, tint: "#f472b6" },
  ];

  const spec = open ? specs[open] : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <h2 style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--text-muted)", fontFamily: ff }}>
        Personal Insights
      </h2>

      <div style={{
        display: "grid", gap: 12, alignItems: "stretch",
        // Same container-driven sizing as the bench cards: five across when
        // there is room, wrapping to fewer rather than shrinking to unreadable.
        gridTemplateColumns: "repeat(auto-fill, minmax(max(190px, 19%), 1fr))",
      }}>
        {TILES.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setOpen(t.key)}
              title={`See what makes up ${t.label}`}
              className="stat-card-clickable"
              style={{
                display: "flex", flexDirection: "column", gap: 8, textAlign: "left",
                background: "var(--bg-card)", border: "1px solid var(--border)",
                borderRadius: 12, padding: "14px 15px", cursor: "pointer", font: "inherit",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: ff }}>
                  {t.label}
                </span>
                <span style={{
                  width: 26, height: 26, borderRadius: 8, flexShrink: 0,
                  background: `${t.tint}18`, border: `1px solid ${t.tint}38`,
                  display: "flex", alignItems: "center", justifyContent: "center", color: t.tint,
                }}>
                  <Icon size={13} />
                </span>
              </div>
              <p className="stat-number" style={{ fontSize: 22, color: "var(--text-primary)", fontFamily: ff, letterSpacing: "-0.02em" }}>
                {t.value}
              </p>
              <p style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: ff }}>{t.hint}</p>
            </button>
          );
        })}
      </div>

      {spec && <InsightModal {...spec} onClose={() => setOpen(null)} />}
    </div>
  );
}
