"use client";

import { useMemo, useRef, useState } from "react";
import { Search, Check, AlertCircle, Loader2, Wand2, Percent, Eraser, ShieldAlert, Sparkles } from "lucide-react";
import { useRepair, type RepairJob } from "@/cashier/contexts/RepairContext";
import { useParts } from "@/cashier/contexts/PartsContext";
import { useAuth } from "@/lib/auth/AuthContext";
import { useToast } from "@/lib/ui/toast";
import { isFinished, recordedRepairCost } from "@/lib/analytics/overview";
import { saveCostEstimates } from "@/lib/repair/costEstimates";

const ff = "'Plus Jakarta Sans', sans-serif";
const rs = (n: number) => `Rs. ${Math.round(n).toLocaleString("en-LK")}`;
const PAGE = 60;

const AMBER = "#fbbf24", GREEN = "#34d399", BLUE = "#60a5fa", RED = "#f87171", VIOLET = "#a78bfa";

type View = "todo" | "done" | "all";

/** How the repair ended, as the jobs list shows it. */
const OUTCOME: Record<string, { label: string; color: string }> = {
  Normal:        { label: "NORMAL",      color: "#34d399" },
  Return:        { label: "RETURN",      color: "#f87171" },
  FOC:           { label: "FOC",         color: "#a78bfa" },
  "Cash Return": { label: "CASH RETURN", color: "#60a5fa" },
};
type RowState = "saving" | "saved" | "error";

const finishedOn = (j: RepairJob) => j.completedAt ?? j.createdAt;
const norm = (s?: string) => (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");

/** One figure at the top, styled like the admin dashboard cards. */
function Kpi({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div style={{ padding: "16px 18px", borderRadius: 14, border: "1px solid var(--border)", background: "var(--bg-card)", display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-muted)" }}>{label}</span>
        <span style={{ width: 10, height: 10, borderRadius: 3, background: color }} />
      </div>
      <p style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.03em", lineHeight: 1 }}>{value}</p>
      <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{sub}</p>
    </div>
  );
}

/**
 * Typing in a cost for repairs that were finished before costs were recorded.
 *
 * Hundreds of jobs went through without parts being issued in the system or a
 * technician charge being kept, so every one of them counted as 100% profit.
 * This lists exactly those jobs — finished, nothing recorded — with one box
 * each for what the repair cost (parts and technician together; agent charges
 * are already on record and stay out of it).
 *
 * Built for speed: type a figure and press Enter or Tab and it is saved and
 * the next box is ready. A suggestion from similar jobs is one Enter away, and
 * a whole selection can be given a percentage of its price at once.
 */
export default function RepairCostBackfill() {
  const { jobs, agentCosts } = useRepair();
  const { parts, partRequests } = useParts();
  const { profile } = useAuth();
  const toast = useToast();
  const isAdmin = profile?.role === "Admin";

  const [view, setView] = useState<View>("todo");
  const [month, setMonth] = useState("all");
  const [outcome, setOutcome] = useState<"all" | "Normal" | "Return" | "FOC" | "Cash Return">("all");
  const [q, setQ] = useState("");
  const [shown, setShown] = useState(PAGE);
  const [text, setText] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<Record<string, number | null>>({});
  const [state, setState] = useState<Record<string, RowState>>({});
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [pct, setPct] = useState("35");
  const [bulkBusy, setBulkBusy] = useState(false);
  const inputs = useRef<Map<string, HTMLInputElement>>(new Map());

  const sources = useMemo(() => ({ parts, partRequests }), [parts, partRequests]);
  const estimateOf = (j: RepairJob) => (j.id in saved ? saved[j.id] : j.estimatedRepairCost ?? null);

  // Every finished job. The ones with nothing recorded are what most needs
  // doing, but a job with a technician charge and no parts issued is just as
  // incomplete, so all of them can be given a cost.
  const recordedOf = (j: RepairJob) => recordedRepairCost(j, sources);
  const backlog = useMemo(
    () => jobs.filter(isFinished)
      .sort((a, b) => finishedOn(b).localeCompare(finishedOn(a)) || b.id.localeCompare(a.id)),
    [jobs],
  );

  /**
   * A cost to suggest, from jobs like it: the same model with the same fault,
   * then the same fault on anything. Real recorded costs and the estimates
   * already typed both count, so the suggestions sharpen as the list fills.
   */
  const suggest = useMemo(() => {
    const byModelFault = new Map<string, number[]>();
    const byFault = new Map<string, number[]>();
    const add = (m: Map<string, number[]>, k: string, v: number) => { const l = m.get(k); if (l) l.push(v); else m.set(k, [v]); };
    for (const j of jobs) {
      if (!isFinished(j)) continue;
      // What was entered wins, then what was recorded.
      const entered = j.id in saved ? saved[j.id] : j.estimatedRepairCost ?? null;
      const cost = entered ?? recordedRepairCost(j, sources);
      if (cost == null || cost <= 0) continue;
      const fault = norm(j.issue);
      if (!fault) continue;
      add(byModelFault, `${norm(j.model)}|${fault}`, cost);
      add(byFault, fault, cost);
    }
    const avg = (l: number[]) => Math.round(l.reduce((a, b) => a + b, 0) / l.length / 50) * 50;
    return (j: RepairJob): { cost: number; basis: string } | null => {
      const fault = norm(j.issue);
      if (!fault) return null;
      const a = byModelFault.get(`${norm(j.model)}|${fault}`);
      if (a?.length) return { cost: avg(a), basis: `${a.length} ${j.model || "same model"} job${a.length === 1 ? "" : "s"}, same fault` };
      const b = byFault.get(fault);
      if (b?.length) return { cost: avg(b), basis: `${b.length} job${b.length === 1 ? "" : "s"} with the same fault` };
      return null;
    };
  }, [jobs, sources, saved]);

  const months = useMemo(() => [...new Set(backlog.map(j => finishedOn(j).slice(0, 7)))].sort().reverse(), [backlog]);
  const outcomeCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const j of backlog) { const k = j.completionType ?? "Normal"; m[k] = (m[k] ?? 0) + 1; }
    return m;
  }, [backlog]);

  // "No cost yet": nothing recorded and nothing entered.
  const hasNoCost = (j: RepairJob) => estimateOf(j) == null && recordedOf(j) === 0;
  const list = backlog.filter(j => {
    const entered = estimateOf(j) != null;
    if (view === "todo" && !hasNoCost(j)) return false;
    if (view === "done" && !entered) return false;
    if (month !== "all" && !finishedOn(j).startsWith(month)) return false;
    if (outcome !== "all" && (j.completionType ?? "Normal") !== outcome) return false;
    if (q) {
      const s = q.toLowerCase();
      const hay = `${j.id} ${j.dealerJobNo ?? ""} ${j.brand} ${j.model} ${j.issue} ${j.customerName} ${j.technician ?? ""}`.toLowerCase();
      if (!hay.includes(s)) return false;
    }
    return true;
  });
  const page = list.slice(0, shown);

  const doneCount = backlog.filter(j => estimateOf(j) != null).length;
  const noCostCount = backlog.filter(hasNoCost).length;
  const estimatedTotal = backlog.reduce((t, j) => t + (estimateOf(j) ?? 0), 0);
  const revenueDone = backlog.filter(j => !hasNoCost(j)).reduce((t, j) => t + (j.estimatedCost ?? 0), 0);
  const revenueAll = backlog.reduce((t, j) => t + (j.estimatedCost ?? 0), 0);
  // Share of finished jobs that have some cost, recorded or entered.
  const progress = backlog.length ? (backlog.length - noCostCount) / backlog.length : 0;

  /** Saves one or many, updating the screen first so typing never waits. */
  const commit = async (rows: { jobId: string; cost: number | null }[]) => {
    if (!isAdmin || rows.length === 0) return false;
    setSaved(s => ({ ...s, ...Object.fromEntries(rows.map(r => [r.jobId, r.cost])) }));
    setState(s => ({ ...s, ...Object.fromEntries(rows.map(r => [r.jobId, "saving" as const])) }));
    try {
      await saveCostEstimates(rows);
      setState(s => ({ ...s, ...Object.fromEntries(rows.map(r => [r.jobId, "saved" as const])) }));
      return true;
    } catch (e) {
      setState(s => ({ ...s, ...Object.fromEntries(rows.map(r => [r.jobId, "error" as const])) }));
      toast.dialog("error", "Could not save", e instanceof Error ? e.message : String(e));
      return false;
    }
  };

  const parse = (raw: string): number | null | undefined => {
    const t = raw.replace(/[,\s]|rs\.?/gi, "");
    if (t === "") return null;
    const n = Number(t);
    return Number.isFinite(n) && n >= 0 ? Math.round(n) : undefined;
  };

  const saveRow = (j: RepairJob, useSuggestion = false) => {
    const raw = text[j.id];
    let cost: number | null | undefined;
    if (raw === undefined || raw.trim() === "") {
      const s = useSuggestion ? suggest(j) : null;
      if (!s) return;
      cost = s.cost;
    } else {
      cost = parse(raw);
    }
    if (cost === undefined) { setState(s => ({ ...s, [j.id]: "error" })); return; }
    setText(t => { const n = { ...t }; delete n[j.id]; return n; });
    if (cost === estimateOf(j)) return;
    void commit([{ jobId: j.id, cost }]);
  };

  const focusNext = (id: string) => {
    const i = page.findIndex(j => j.id === id);
    const next = page[i + 1];
    if (next) requestAnimationFrame(() => inputs.current.get(next.id)?.focus());
  };

  const bulk = async (kind: "pct" | "suggest" | "clear") => {
    const target = backlog.filter(j => picked.has(j.id));
    let rows: { jobId: string; cost: number | null }[] = [];
    if (kind === "pct") {
      const p = Number(pct);
      if (!Number.isFinite(p) || p < 0 || p > 100) { toast.dialog("error", "Percentage", "Enter a percentage from 0 to 100."); return; }
      rows = target.map(j => ({ jobId: j.id, cost: Math.round(((j.estimatedCost ?? 0) * p) / 100 / 10) * 10 }));
    } else if (kind === "suggest") {
      rows = target.flatMap(j => { const s = suggest(j); return s ? [{ jobId: j.id, cost: s.cost }] : []; });
      if (rows.length < target.length) toast.dialog("info", "Some had no suggestion", `${target.length - rows.length} of the selected jobs have no similar job to go by and were left as they are.`);
    } else {
      rows = target.filter(j => estimateOf(j) != null).map(j => ({ jobId: j.id, cost: null }));
    }
    if (rows.length === 0) return;
    setBulkBusy(true);
    const ok = await commit(rows);
    setBulkBusy(false);
    if (ok) {
      toast.success(`${kind === "clear" ? "Cleared" : "Saved"} ${rows.length} job${rows.length === 1 ? "" : "s"}`);
      setPicked(new Set());
    }
  };

  const allPicked = page.length > 0 && page.every(j => picked.has(j.id));
  const togglePage = () => setPicked(p => {
    const n = new Set(p);
    if (allPicked) page.forEach(j => n.delete(j.id)); else page.forEach(j => n.add(j.id));
    return n;
  });

  const chip = (on: boolean, color: string): React.CSSProperties => ({
    padding: "7px 13px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: ff,
    border: `1px solid ${on ? color + "66" : "var(--border)"}`, background: on ? `${color}14` : "var(--bg-card)",
    color: on ? "var(--text-primary)" : "var(--text-secondary)",
  });
  const th: React.CSSProperties = { padding: "10px 12px", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--text-muted)", textAlign: "left", whiteSpace: "nowrap", background: "var(--bg-secondary)", position: "sticky", top: 0, zIndex: 1 };
  const td: React.CSSProperties = { padding: "9px 12px", fontSize: 12.5, color: "var(--text-primary)", borderTop: "1px solid var(--border)", verticalAlign: "middle" };


  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, fontFamily: ff }}>
      <div className="fade-up">
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em", marginBottom: 4 }}>Repair Cost Backfill</h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.55, maxWidth: 820 }}>
          Every finished repair, with what was recorded against it. Type what a job really cost — parts and technician together, not agent charges (those are already recorded) — and profit uses that figure for the job instead of what was recorded. Leave a box empty and profit keeps using the recorded cost.
        </p>
      </div>

      {!isAdmin && (
        <div style={{ display: "flex", gap: 9, padding: "11px 14px", borderRadius: 10, background: `${AMBER}14`, border: `1px solid ${AMBER}55` }}>
          <ShieldAlert size={15} color={AMBER} style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>Only an Admin can enter estimated costs. You can look, but the boxes are locked.</p>
        </div>
      )}

      <div className="fade-up" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14 }}>
        <Kpi label="Finished jobs" value={String(backlog.length)} sub="completed or delivered" color={BLUE} />
        <Kpi label="No cost yet" value={String(noCostCount)} sub="nothing recorded, nothing entered" color={AMBER} />
        <Kpi label="Costs entered" value={String(doneCount)} sub={`${rs(estimatedTotal)} parts + technician`} color={VIOLET} />
        <Kpi label="Revenue with a cost" value={rs(revenueDone)} sub={`of ${rs(revenueAll)} · ${(progress * 100).toFixed(0)}% of jobs`} color={GREEN} />
      </div>

      <div style={{ height: 8, borderRadius: 6, background: "var(--bg-secondary)", overflow: "hidden" }}>
        <div style={{ width: `${progress * 100}%`, height: "100%", background: GREEN, transition: "width 0.5s cubic-bezier(0.22, 1, 0.36, 1)" }} />
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button style={chip(view === "todo", AMBER)} onClick={() => { setView("todo"); setShown(PAGE); }}>No cost yet ({noCostCount})</button>
        <button style={chip(view === "done", GREEN)} onClick={() => { setView("done"); setShown(PAGE); }}>Cost entered ({doneCount})</button>
        <button style={chip(view === "all", BLUE)} onClick={() => { setView("all"); setShown(PAGE); }}>All finished ({backlog.length})</button>
        {/* Outcome — one segmented control, each option in its badge colour. */}
        <div style={{ display: "flex", padding: 3, gap: 2, borderRadius: 9, border: "1px solid var(--border)", background: "var(--bg-card)" }}>
          {(["all", "Normal", "Return", "FOC", "Cash Return"] as const).map(o => {
            const on = outcome === o;
            const color = o === "all" ? "var(--text-secondary)" : OUTCOME[o].color;
            const n = o === "all" ? backlog.length : outcomeCounts[o] ?? 0;
            if (o === "Cash Return" && n === 0) return null;
            return (
              <button
                key={o}
                onClick={() => { setOutcome(o); setShown(PAGE); }}
                style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 7, border: "none", cursor: "pointer",
                  fontSize: 11.5, fontWeight: 700, fontFamily: ff, whiteSpace: "nowrap",
                  background: on ? (o === "all" ? "var(--bg-secondary)" : `${OUTCOME[o].color}1c`) : "transparent",
                  color: on ? (o === "all" ? "var(--text-primary)" : color) : "var(--text-muted)",
                }}
              >
                {o !== "all" && <span style={{ width: 7, height: 7, borderRadius: 2, background: color }} />}
                {o === "all" ? "Any outcome" : OUTCOME[o].label}
                <span style={{ fontWeight: 600, opacity: 0.75 }}>{n}</span>
              </button>
            );
          })}
        </div>
        <select value={month} onChange={e => { setMonth(e.target.value); setShown(PAGE); }}
          style={{ padding: "7px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 12, fontFamily: ff, cursor: "pointer" }}>
          <option value="all">Every month</option>
          {months.map(m => <option key={m} value={m}>{new Date(`${m}-01T00:00:00`).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</option>)}
        </select>
        <div style={{ position: "relative", flex: 1, minWidth: 220, maxWidth: 360 }}>
          <Search size={13} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
          <input value={q} onChange={e => { setQ(e.target.value); setShown(PAGE); }} placeholder="Job no, device, fault, customer…"
            style={{ width: "100%", padding: "8px 10px 8px 32px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 12, fontFamily: ff, outline: "none" }} />
        </div>
      </div>

      {/* Bulk actions */}
      {picked.size > 0 && isAdmin && (
        <div className="fade-up" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "10px 14px", borderRadius: 12, border: `1px solid ${VIOLET}55`, background: `${VIOLET}10` }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-primary)" }}>{picked.size} selected</span>
          <span style={{ width: 1, height: 20, background: "var(--border)" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Cost =</span>
            <input value={pct} onChange={e => setPct(e.target.value)} inputMode="decimal"
              style={{ width: 54, padding: "6px 8px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 12.5, textAlign: "center", fontFamily: ff }} />
            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>% of price</span>
            <button disabled={bulkBusy} onClick={() => bulk("pct")} style={{ ...chip(true, VIOLET), display: "flex", alignItems: "center", gap: 5 }}><Percent size={12} />Apply</button>
          </div>
          <button disabled={bulkBusy} onClick={() => bulk("suggest")} style={{ ...chip(false, VIOLET), display: "flex", alignItems: "center", gap: 5 }}><Wand2 size={12} />Use suggestions</button>
          <button disabled={bulkBusy} onClick={() => bulk("clear")} style={{ ...chip(false, RED), display: "flex", alignItems: "center", gap: 5 }}><Eraser size={12} />Clear estimates</button>
          <button onClick={() => setPicked(new Set())} style={{ marginLeft: "auto", background: "none", border: "none", color: "var(--text-muted)", fontSize: 12, cursor: "pointer", fontFamily: ff }}>Deselect</button>
        </div>
      )}

      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: ff }}>
            <thead>
              <tr>
                <th style={{ ...th, width: 34 }}><input type="checkbox" checked={allPicked} onChange={togglePage} disabled={!isAdmin} /></th>
                <th style={th}>Job</th>
                <th style={th}>Outcome</th>
                <th style={th}>Finished</th>
                <th style={th}>Device &amp; fault</th>
                <th style={th}>Technician</th>
                <th style={{ ...th, textAlign: "right" }}>Price</th>
                <th style={{ ...th, textAlign: "right" }} title="Parts issued by tag + technician charge, as recorded">Recorded</th>
                <th style={th}>Suggested</th>
                <th style={{ ...th, width: 170 }}>Cost (parts + tech)</th>
                <th style={{ ...th, textAlign: "right" }} title="Price − cost − agent charges">Profit</th>
              </tr>
            </thead>
            <tbody>
              {page.length === 0 ? (
                <tr><td colSpan={11} style={{ ...td, textAlign: "center", padding: 36, color: "var(--text-muted)" }}>
                  {backlog.length === 0 ? "No finished repairs yet." : view === "todo" ? "Every finished job has a cost, recorded or entered." : "No jobs match."}
                </td></tr>
              ) : page.map(j => {
                const est = estimateOf(j);
                const sg = suggest(j);
                const price = j.estimatedCost ?? 0;
                const typed = text[j.id];
                const recorded = recordedOf(j);
                const agent = agentCosts[j.id] ?? 0;
                const typedCost = typed !== undefined ? parse(typed) : undefined;
                // What profit will use: an entered figure, else what was recorded.
                const shownCost = typedCost !== undefined ? (typedCost ?? recorded) : est ?? recorded;
                const profit = price - shownCost - agent;
                const oc = OUTCOME[j.completionType ?? "Normal"] ?? OUTCOME.Normal;
                const st = state[j.id];
                return (
                  <tr key={j.id} style={{ background: picked.has(j.id) ? `${VIOLET}0c` : undefined }}>
                    <td style={td}><input type="checkbox" disabled={!isAdmin} checked={picked.has(j.id)} onChange={() => setPicked(p => { const n = new Set(p); if (n.has(j.id)) n.delete(j.id); else n.add(j.id); return n; })} /></td>
                    <td style={td}>
                      <div style={{ fontWeight: 700 }}>{j.dealerJobNo ? `#${j.dealerJobNo}` : j.id}</div>
                      {j.dealerJobNo && <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>{j.id}</div>}
                    </td>
                    <td style={td}>
                      <span style={{ display: "inline-block", padding: "3px 8px", borderRadius: 6, fontSize: 10, fontWeight: 800, letterSpacing: "0.04em", color: oc.color, background: `${oc.color}17`, border: `1px solid ${oc.color}4d`, whiteSpace: "nowrap" }}>{oc.label}</span>
                    </td>
                    <td style={{ ...td, whiteSpace: "nowrap", color: "var(--text-secondary)" }}>
                      {new Date(`${finishedOn(j).slice(0, 10)}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" })}
                    </td>
                    <td style={{ ...td, maxWidth: 280 }}>
                      <div style={{ fontWeight: 600 }}>{[j.brand, j.model].filter(Boolean).join(" ") || "—"}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={j.issue}>{j.issue || "—"}</div>
                    </td>
                    <td style={{ ...td, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>{j.technician || "—"}</td>
                    <td style={{ ...td, textAlign: "right", fontWeight: 600, whiteSpace: "nowrap" }}>{rs(price)}</td>
                    <td
                      style={{ ...td, textAlign: "right", whiteSpace: "nowrap", color: recorded > 0 ? "var(--text-primary)" : "var(--text-muted)" }}
                      title={est != null && recorded > 0 ? "Replaced by the cost entered" : "Parts issued by tag + technician charge"}
                    >
                      <span style={{ textDecoration: est != null && recorded > 0 ? "line-through" : undefined }}>{recorded > 0 ? rs(recorded) : "—"}</span>
                      {agent > 0 && <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>+ agent {rs(agent)}</div>}
                    </td>
                    <td style={td}>
                      {sg ? (
                        <button
                          disabled={!isAdmin}
                          onClick={() => { setText(t => ({ ...t, [j.id]: String(sg.cost) })); inputs.current.get(j.id)?.focus(); }}
                          title={`From ${sg.basis}. Click to use, or press Enter on an empty box.`}
                          style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 9px", borderRadius: 7, border: `1px dashed ${VIOLET}88`, background: `${VIOLET}10`, color: "var(--text-primary)", fontSize: 11.5, fontWeight: 600, cursor: isAdmin ? "pointer" : "default", fontFamily: ff, whiteSpace: "nowrap" }}
                        >
                          <Sparkles size={11} color={VIOLET} />{rs(sg.cost)}
                        </button>
                      ) : <span style={{ fontSize: 11, color: "var(--text-muted)" }}>—</span>}
                    </td>
                    <td style={td}>
                      <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ position: "absolute", left: 9, fontSize: 11, color: "var(--text-muted)", pointerEvents: "none" }}>Rs.</span>
                        <input
                          ref={el => { if (el) inputs.current.set(j.id, el); else inputs.current.delete(j.id); }}
                          disabled={!isAdmin}
                          inputMode="numeric"
                          value={typed ?? (est != null ? String(est) : "")}
                          placeholder={sg ? `${sg.cost} ↵` : ""}
                          onChange={e => { setText(t => ({ ...t, [j.id]: e.target.value })); if (st === "error") setState(s => { const n = { ...s }; delete n[j.id]; return n; }); }}
                          onBlur={() => saveRow(j)}
                          onKeyDown={e => {
                            if (e.key === "Enter") { e.preventDefault(); saveRow(j, true); focusNext(j.id); }
                            if (e.key === "Escape") setText(t => { const n = { ...t }; delete n[j.id]; return n; });
                          }}
                          style={{
                            width: 120, padding: "7px 8px 7px 32px", borderRadius: 8, fontSize: 13, fontWeight: 600, fontFamily: ff, outline: "none",
                            border: `1px solid ${st === "error" ? RED : est != null && typed === undefined ? GREEN + "77" : "var(--border)"}`,
                            background: est != null && typed === undefined ? `${GREEN}0d` : "var(--bg-secondary)", color: "var(--text-primary)",
                          }}
                        />
                        <span style={{ width: 16, display: "inline-flex" }}>
                          {st === "saving" && <Loader2 size={14} color="var(--text-muted)" className="spin-icon" />}
                          {st === "saved" && <Check size={14} color={GREEN} />}
                          {st === "error" && <AlertCircle size={14} color={RED} />}
                        </span>
                      </div>
                    </td>
                    <td style={{ ...td, textAlign: "right", fontWeight: 700, whiteSpace: "nowrap", color: profit >= 0 ? GREEN : RED }}>
                      {rs(profit)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 16px", borderTop: "1px solid var(--border)", fontSize: 12, color: "var(--text-muted)", flexWrap: "wrap" }}>
          <span>Showing {page.length} of {list.length} · <strong style={{ color: "var(--text-secondary)" }}>Enter</strong> saves and moves down (on an empty box it takes the suggestion) · <strong style={{ color: "var(--text-secondary)" }}>Tab</strong> saves · <strong style={{ color: "var(--text-secondary)" }}>Esc</strong> undoes a typo</span>
          {list.length > shown && (
            <button onClick={() => setShown(s => s + PAGE)} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer", fontSize: 12, fontFamily: ff }}>
              Show {Math.min(PAGE, list.length - shown)} more
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
