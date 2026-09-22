"use client";

import { useMemo, useState } from "react";
import { ClipboardList, CheckCircle2, Box, TrendingUp, Wallet, CalendarClock } from "lucide-react";
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
 * The same row serves both scopes on the bench. Passed this technician's jobs
 * it reads as personal figures — revenue is what the shop charged for THEIR
 * jobs, charges are what THEY billed. Passed the whole shop's, the tiles mean
 * the shop's version of the same five questions, and the wording follows
 * (`scope`), because "finished by you" over a shop total would be a lie told
 * in small grey text.
 */

const rs = (n: number) => `Rs. ${Math.round(n || 0).toLocaleString("en-LK")}`;
const dev = (j: RepairJob) => [j.brand, j.model].filter(Boolean).join(" ") || "—";
const day = (v?: string) => (v ? new Date(v).toLocaleDateString("en-GB") : "—");

interface Tile { key: string; label: string; value: string; hint: string; icon: typeof Box; tint: string }

function TileGrid({ tiles, onOpen }: { tiles: Tile[]; onOpen: (key: string) => void }) {
  return (
    <div style={{
      display: "grid", gap: 12, alignItems: "stretch",
      // Same container-driven sizing as the bench cards: five across when
      // there is room, wrapping to fewer rather than shrinking to unreadable.
      gridTemplateColumns: "repeat(auto-fill, minmax(max(190px, 19%), 1fr))",
    }}>
      {tiles.map(t => {
        const Icon = t.icon;
        return (
          <button
            key={t.key}
            onClick={() => onOpen(t.key)}
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
  );
}

const isFinished = (j: RepairJob) =>
  j.status === "Completed" || j.status === "Delivered" || (!!j.completedAt && !!j.completionType);

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
const isOnDate = (v: string | Date | undefined, ref: Date) => !!v && sameDay(new Date(v), ref);
const todayStr = () => new Date().toISOString().slice(0, 10);

interface Spec {
  title: string;
  subtitle: string;
  columns: InsightColumn[];
  rows: InsightRow[];
  summary?: InsightSummary[];
  note?: string;
  emptyText: string;
}

export default function PersonalInsights({ jobs, partRequests, catalog, technicianName, scope = "mine" }: {
  /** The jobs these figures cover — this technician's, or the shop's. */
  jobs: RepairJob[];
  partRequests: PartRequest[];
  catalog: SparePart[];
  technicianName: string;
  /** Which set `jobs` is. Changes only the wording, never the arithmetic. */
  scope?: "mine" | "shop";
}) {
  const shop = scope === "shop";
  const [open, setOpen] = useState<string | null>(null);

  // The "Today" section, but for whatever date is picked — defaults to
  // today, same figures either way, just measured against a chosen day
  // instead of always the current one.
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const isSelectedToday = selectedDate === todayStr();
  const refDate = useMemo(() => new Date(`${selectedDate}T00:00:00`), [selectedDate]);
  const dayLabel = refDate.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const sectionLabel = isSelectedToday ? "Today" : dayLabel;

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

  // The selected day's slice of the same figures — finished-that-day jobs,
  // and parts resolved (approved/issued) that day. A part drawn that day
  // against a job that finished on a different day still counts as that
  // day's parts spend; a job finished that day still counts even if its
  // parts were drawn earlier.
  const doneToday = done.filter(j => isOnDate(j.completedAt, refDate));
  const partsToday = usedParts.filter(r => isOnDate(r.resolvedAt, refDate));
  const partsCostToday = partsToday.reduce((t, r) => t + costOf(r), 0);
  const revenueToday = doneToday.reduce((t, j) => t + j.estimatedCost, 0);
  const chargesToday = doneToday.reduce((t, j) => t + (j.labourCost ?? 0), 0);
  const uncostedToday = doneToday.filter(j => j.labourCost === undefined).length;
  // startedAt is stamped the moment a job is claimed off the bench (status
  // moves to "Issued") — that's "taken", as opposed to "completed".
  const takenToday = jobs.filter(j => isOnDate(j.startedAt, refDate));

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
      subtitle: shop ? "Every repair in the shop" : `Every repair assigned to ${technicianName}`,
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
      subtitle: shop ? "Repairs the shop has finished" : "Repairs you have finished",
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

    completedToday: {
      title: isSelectedToday ? "Jobs Completed Today" : `Jobs Completed — ${dayLabel}`,
      subtitle: shop ? `Repairs the shop finished ${isSelectedToday ? "today" : `on ${dayLabel}`}` : `Repairs you finished ${isSelectedToday ? "today" : `on ${dayLabel}`}`,
      columns: [
        { key: "job", label: "Job" }, { key: "device", label: "Device" },
        { key: "type", label: "Outcome" }, { key: "finished", label: "Finished" },
        { key: "charge", label: "Charged", numeric: true },
      ],
      rows: doneToday.map(j => ({
        id: j.id,
        cells: {
          job: j.id, device: dev(j), type: j.completionType ?? "Normal",
          finished: day(j.completedAt), charge: rs(j.estimatedCost),
        },
      })),
      summary: [{ label: `Completed ${isSelectedToday ? "today" : "that day"}`, value: String(doneToday.length), strong: true }],
      emptyText: isSelectedToday ? "Nothing finished yet today." : `Nothing finished on ${dayLabel}.`,
    },

    revenueToday: {
      title: isSelectedToday ? "Total Earned Today" : `Total Earned — ${dayLabel}`,
      subtitle: shop
        ? `What the shop charged for repairs finished ${isSelectedToday ? "today" : `on ${dayLabel}`}`
        : `What the shop charged for repairs you finished ${isSelectedToday ? "today" : `on ${dayLabel}`}`,
      columns: [
        { key: "job", label: "Job" }, { key: "device", label: "Device" },
        { key: "finished", label: "Finished" },
        { key: "charge", label: "Charged", numeric: true },
        { key: "paid", label: "Paid", numeric: true },
      ],
      rows: doneToday.map(j => ({
        id: j.id,
        cells: {
          job: j.id, device: dev(j), finished: day(j.completedAt),
          charge: rs(j.estimatedCost), paid: rs(j.advancePaid),
        },
      })),
      summary: [
        { label: `Charged ${isSelectedToday ? "today" : "that day"}`, value: rs(revenueToday), strong: true, hint: `${doneToday.length} job${doneToday.length === 1 ? "" : "s"}` },
        { label: "Collected", value: rs(doneToday.reduce((t, j) => t + j.advancePaid, 0)) },
      ],
      note: "The shop's income from repairs finished that day, before parts and labour charges come out of it.",
      emptyText: isSelectedToday ? "No finished repairs yet today, so nothing has been charged." : `No repairs finished on ${dayLabel}.`,
    },

    partsToday: {
      title: isSelectedToday ? "Today's Parts Cost" : `Parts Cost — ${dayLabel}`,
      subtitle: `What ${isSelectedToday ? "today's" : `${dayLabel}'s`} parts cost the shop`,
      columns: [
        { key: "job", label: "Job" }, { key: "part", label: "Part" },
        { key: "qty", label: "Qty", numeric: true },
        { key: "unit", label: "Unit cost", numeric: true },
        { key: "line", label: "Total", numeric: true },
      ],
      rows: partsToday.map(r => {
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
      summary: [{ label: `Parts cost ${isSelectedToday ? "today" : "that day"}`, value: rs(partsCostToday), strong: true, hint: `${partsToday.length} part${partsToday.length === 1 ? "" : "s"}` }],
      note: "This is what the shop paid for the parts, not what the customer was charged for them.",
      emptyText: isSelectedToday ? "No parts drawn against your jobs today." : `No parts drawn against your jobs on ${dayLabel}.`,
    },

    chargesToday: {
      title: isSelectedToday ? "Today's Labour Charges" : `Labour Charges — ${dayLabel}`,
      subtitle: `What you billed for work finished ${isSelectedToday ? "today" : `on ${dayLabel}`}`,
      columns: [
        { key: "job", label: "Job" }, { key: "device", label: "Device" },
        { key: "finished", label: "Finished" },
        { key: "charge", label: "Job charged", numeric: true },
        { key: "mine", label: "Your charge", numeric: true },
      ],
      rows: doneToday.map(j => ({
        id: j.id,
        dim: j.labourCost === undefined,
        cells: {
          job: j.id, device: dev(j), finished: day(j.completedAt),
          charge: rs(j.estimatedCost),
          mine: j.labourCost === undefined ? "—" : rs(j.labourCost),
        },
      })),
      summary: [
        { label: `Charged ${isSelectedToday ? "today" : "that day"}`, value: rs(chargesToday), strong: true },
        { label: "Jobs", value: String(doneToday.length - uncostedToday), hint: uncostedToday ? `${uncostedToday} not recorded` : undefined },
      ],
      note: uncostedToday > 0
        ? `${uncostedToday} job${uncostedToday === 1 ? " was" : "s were"} finished without a charge recorded, so ${uncostedToday === 1 ? "it is" : "they are"} shown as — and not counted.`
        : `What you entered when finishing each job ${isSelectedToday ? "today" : `on ${dayLabel}`}.`,
      emptyText: isSelectedToday ? "No charges recorded today." : `No charges recorded on ${dayLabel}.`,
    },

    takenToday: {
      title: isSelectedToday ? "Jobs Taken Today" : `Jobs Taken — ${dayLabel}`,
      subtitle: shop
        ? `Repairs the shop claimed off the bench ${isSelectedToday ? "today" : `on ${dayLabel}`}`
        : `Repairs you claimed off the bench ${isSelectedToday ? "today" : `on ${dayLabel}`}`,
      columns: JOB_COLS,
      rows: takenToday.map(j => ({
        id: j.id,
        cells: {
          job: j.id, device: dev(j), customer: j.customerName || "—",
          status: isFinished(j) ? "Finished" : j.status === "Issued" ? "In progress" : j.status === "Pending" ? "Waiting" : "To start",
          charge: rs(j.estimatedCost),
        },
      })),
      summary: [{ label: `Taken ${isSelectedToday ? "today" : "that day"}`, value: String(takenToday.length), strong: true }],
      emptyText: isSelectedToday ? "Nothing taken off the bench yet today." : `Nothing taken off the bench on ${dayLabel}.`,
    },
  };

  const TILES: Tile[] = [
    { key: "total",     label: "Total Jobs",      value: String(jobs.length), hint: `${jobs.length - done.length} still open`, icon: ClipboardList, tint: "#a78bfa" },
    { key: "completed", label: "Jobs Completed",  value: String(done.length), hint: shop ? "finished by the shop" : "finished by you", icon: CheckCircle2, tint: "#34d399" },
    { key: "parts",     label: "Parts Cost Used", value: rs(partsCost),       hint: `${usedParts.length} part${usedParts.length === 1 ? "" : "s"}`, icon: Box, tint: "#60a5fa" },
    { key: "revenue",   label: shop ? "Shop Revenue" : "Revenue To Company", value: rs(revenue), hint: shop ? "from all finished jobs" : "from your finished jobs", icon: TrendingUp, tint: "#fbbf24" },
    { key: "charges",   label: shop ? "Technician Charges" : "Your Charges", value: rs(myCharges), hint: uncosted ? `${uncosted} not recorded` : shop ? "billed by technicians" : "billed by you", icon: Wallet, tint: "#f472b6" },
  ];

  const TILES_TODAY: Tile[] = [
    { key: "takenToday",     label: "Taken",      value: String(takenToday.length), hint: shop ? "claimed off the bench" : "claimed by you", icon: ClipboardList, tint: "#a78bfa" },
    { key: "completedToday", label: "Completed",  value: String(doneToday.length), hint: shop ? "finished by the shop" : "finished by you", icon: CalendarClock, tint: "#34d399" },
    { key: "revenueToday",   label: shop ? "Shop Earned" : "Total Earned", value: rs(revenueToday), hint: shop ? "from repairs finished" : "from your finished repairs", icon: TrendingUp, tint: "#fbbf24" },
    { key: "partsToday",     label: "Parts Cost", value: rs(partsCostToday), hint: `${partsToday.length} part${partsToday.length === 1 ? "" : "s"}`, icon: Box, tint: "#60a5fa" },
    { key: "chargesToday",   label: shop ? "Technician Charges" : "Your Charges", value: rs(chargesToday), hint: uncostedToday ? `${uncostedToday} not recorded` : shop ? "billed by technicians" : "billed by you", icon: Wallet, tint: "#f472b6" },
  ];

  const spec = open ? specs[open] : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <h2 style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--text-muted)", fontFamily: ff }}>
        {shop ? "Shop Insights" : "Personal Insights"}
      </h2>
      <TileGrid tiles={TILES} onOpen={setOpen} />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 4, flexWrap: "wrap" }}>
        <h2 style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--text-muted)", fontFamily: ff }}>
          {sectionLabel}
        </h2>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {!isSelectedToday && (
            <button
              onClick={() => setSelectedDate(todayStr())}
              style={{
                background: "none", border: "none", padding: 0, cursor: "pointer",
                fontSize: 11, color: "var(--accent)", fontWeight: 700, fontFamily: ff,
              }}
            >
              Back to today
            </button>
          )}
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value || todayStr())}
            style={{
              fontSize: 12, fontFamily: ff, color: "var(--text-primary)",
              background: "var(--bg-card)", border: "1px solid var(--border)",
              borderRadius: 8, padding: "5px 9px", outline: "none",
            }}
          />
        </div>
      </div>
      <TileGrid tiles={TILES_TODAY} onOpen={setOpen} />

      {spec && <InsightModal {...spec} onClose={() => setOpen(null)} />}
    </div>
  );
}
