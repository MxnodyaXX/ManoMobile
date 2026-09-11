"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, Search, PackageCheck, RefreshCw, X } from "lucide-react";
import { useRepair, findDealer, IN_HOUSE_DEALER, type RepairJob } from "@/cashier/contexts/RepairContext";
import { fetchTransfers, transferCost, type AgentTransfer } from "@/lib/repair/agents";
import ReceiveFromAgentModal from "@/technician/components/agents/ReceiveFromAgentModal";
import { useIsMobile } from "@/cashier/hooks/useIsMobile";

const TA = "#34d399";
const AGENT = "#a78bfa";
const ff = "'Plus Jakarta Sans', sans-serif";
const rs = (n: number) => `Rs. ${Math.round(n).toLocaleString("en-LK")}`;
const day = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const daysSince = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
const daysLate = (t: AgentTransfer) => {
  if (!t.expectedReturn) return 0;
  const due = new Date(`${t.expectedReturn}T23:59:59`).getTime();
  return isNaN(due) ? 0 : Math.max(0, Math.floor((Date.now() - due) / 86_400_000));
};

type Tab = "out" | "back";

/**
 * Every device the shop has sent to an outside workshop.
 *
 * The bench section answers "what of mine is out". This answers the shop's
 * version of the question, which is a different one: all of it, whoever sent
 * it, searchable, and with the money on it. A phone at an agent is stock the
 * shop is holding somewhere else, and until now the only way to count it was
 * to remember.
 *
 * Two tabs, because a transfer has two lives:
 *   Out       still at the agent — chase these
 *   Back      returned, job not closed yet — the charge is known, the repair
 *             is not finished, and both numbers belong side by side
 *
 * A transfer leaves this screen when its job is delivered or cancelled. Job
 * History is where finished work lives; this is a working list.
 */
export default function AgentJobs({ technicianName }: { technicianName: string }) {
  const { jobs, dealers, refresh, updateJob } = useRepair();
  const isMobile = useIsMobile();

  const [transfers, setTransfers] = useState<AgentTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const [tab, setTab] = useState<Tab>("out");
  const [search, setSearch] = useState("");
  const [agentFilter, setAgentFilter] = useState<string>("All");
  const [dealerFilter, setDealerFilter] = useState<string>("All");
  const [receiving, setReceiving] = useState<AgentTransfer | null>(null);

  useEffect(() => {
    let live = true;
    fetchTransfers(["Sent", "Returned"])
      .then(rows => { if (live) { setTransfers(rows); setError(null); } })
      .catch(e => { if (live) setError(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [tick]);

  // Keyed once rather than scanned per row: this screen looks a job up for
  // every transfer, twice over, on every keystroke in the search box.
  const jobById = useMemo(() => new Map(jobs.map(j => [j.id, j])), [jobs]);
  const jobFor = useCallback((id: string) => jobById.get(id), [jobById]);

  /**
   * The dealer a job came in under, as a plain name.
   *
   * Mano Mobile's own walk-ins have no dealer row, so they read as the in-house
   * name rather than as a blank — "no dealer" and "our own customer" are the
   * same fact and should say so.
   */
  const dealerOf = useCallback(
    (job: RepairJob | undefined) =>
      job ? findDealer(dealers, job)?.name ?? job.dealer ?? IN_HOUSE_DEALER : "—",
    [dealers],
  );

  const rows = useMemo(() => {
    const wanted: AgentTransfer["status"] = tab === "out" ? "Sent" : "Returned";
    const q = search.trim().toLowerCase();

    return transfers
      .filter(t => t.status === wanted)
      .map(t => ({ transfer: t, job: jobFor(t.jobId) }))
      // Delivered and cancelled work has left the shop; this is a working list.
      .filter(({ job }) => !job || !["Delivered", "Cancelled"].includes(job.status))
      .filter(({ transfer, job }) => {
        if (agentFilter !== "All" && (transfer.agentName ?? "") !== agentFilter) return false;
        if (dealerFilter !== "All" && dealerOf(job) !== dealerFilter) return false;
        if (!q) return true;
        // Both job numbers, the device, and the IMEI — the four things anybody
        // has in their hand when they come asking about a phone.
        return (
          transfer.jobId.toLowerCase().includes(q) ||
          (job?.dealerJobNo ?? "").toLowerCase().includes(q) ||
          [job?.brand, job?.model].filter(Boolean).join(" ").toLowerCase().includes(q) ||
          (job?.imei ?? "").includes(search.trim()) ||
          (job?.customerName ?? "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) =>
        tab === "out"
          ? a.transfer.sentAt.localeCompare(b.transfer.sentAt)                    // longest out first
          : (b.transfer.returnedAt ?? "").localeCompare(a.transfer.returnedAt ?? ""), // newest back first
      );
  }, [transfers, tab, search, agentFilter, dealerFilter, jobFor, dealerOf]);

  const counts = useMemo(() => {
    const live = transfers
      .map(t => ({ t, job: jobFor(t.jobId) }))
      .filter(({ job }) => !job || !["Delivered", "Cancelled"].includes(job.status));
    return {
      out: live.filter(({ t }) => t.status === "Sent").length,
      back: live.filter(({ t }) => t.status === "Returned").length,
    };
  }, [transfers, jobFor]);

  // Only agents and dealers that actually appear, so the pickers do not list
  // twenty names to filter six rows.
  const agentNames = useMemo(
    () => [...new Set(transfers.map(t => t.agentName).filter((n): n is string => !!n))].sort(),
    [transfers],
  );
  const dealerNames = useMemo(
    () => [...new Set(transfers.map(t => dealerOf(jobFor(t.jobId))))].filter(n => n !== "—").sort(),
    [transfers, jobFor, dealerOf],
  );

  const filtering = search.trim() !== "" || agentFilter !== "All" || dealerFilter !== "All";

  const control: React.CSSProperties = {
    padding: "8px 12px", borderRadius: 9, fontSize: 12.5, fontFamily: ff,
    border: "1px solid var(--border)", background: "var(--bg-card)",
    color: "var(--text-primary)", outline: "none",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, fontFamily: ff }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 className="heading-xl" style={{ fontSize: 22, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 9 }}>
            <Building2 size={19} color={AGENT} /> At Repair Agents
          </h1>
          <p style={{ fontSize: 12.5, color: "var(--text-secondary)", marginTop: 4 }}>
            Every device the shop has sent out, and what it came back costing.
          </p>
        </div>
        <button
          onClick={() => setTick(n => n + 1)}
          style={{ display: "flex", alignItems: "center", gap: 7, ...control, cursor: "pointer", fontWeight: 600 }}
        >
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* Which half */}
      <div style={{ display: "flex", gap: 4, padding: 4, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, width: "fit-content" }}>
        {([["out", "Out at agents", counts.out], ["back", "Back, not closed", counts.back]] as const).map(([id, label, n]) => {
          const on = tab === id;
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              style={{
                display: "flex", alignItems: "center", gap: 7, padding: "7px 14px", borderRadius: 7,
                fontSize: 12.5, fontFamily: ff, cursor: "pointer",
                background: on ? "var(--bg-secondary)" : "transparent",
                border: on ? `1px solid ${AGENT}4d` : "1px solid transparent",
                color: on ? "var(--text-primary)" : "var(--text-secondary)",
                fontWeight: on ? 600 : 400,
              }}
            >
              {label}
              {n > 0 && (
                <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 20, background: on ? `${AGENT}2e` : "var(--border)", color: on ? AGENT : "var(--text-muted)" }}>
                  {n}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Search + filters */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: isMobile ? "1 1 100%" : "1 1 280px", minWidth: 0 }}>
          <Search size={13} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Job no, dealer job no, device, IMEI or customer…"
            style={{ ...control, width: "100%", paddingLeft: 32, boxSizing: "border-box" }}
          />
        </div>

        <select value={agentFilter} onChange={e => setAgentFilter(e.target.value)} style={{ ...control, cursor: "pointer" }}>
          <option value="All">All agents</option>
          {agentNames.map(n => <option key={n} value={n}>{n}</option>)}
        </select>

        <select value={dealerFilter} onChange={e => setDealerFilter(e.target.value)} style={{ ...control, cursor: "pointer" }}>
          <option value="All">All dealers</option>
          {dealerNames.map(n => <option key={n} value={n}>{n}</option>)}
        </select>

        {filtering && (
          <button
            onClick={() => { setSearch(""); setAgentFilter("All"); setDealerFilter("All"); }}
            style={{ display: "flex", alignItems: "center", gap: 5, ...control, cursor: "pointer", color: "var(--text-muted)" }}
          >
            <X size={12} /> Clear
          </button>
        )}

        <span style={{ marginLeft: "auto", fontSize: 11.5, color: "var(--text-muted)" }}>
          {rows.length} of {tab === "out" ? counts.out : counts.back}
        </span>
      </div>

      {error && (
        <p style={{ fontSize: 12.5, color: "#f87171", padding: "10px 14px", borderRadius: 10, background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.3)" }}>
          {error}
        </p>
      )}

      {/* The list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {loading ? (
          <p style={{ fontSize: 12.5, color: "var(--text-muted)", padding: "28px 0", textAlign: "center" }}>Loading…</p>
        ) : rows.length === 0 ? (
          <p style={{ fontSize: 12.5, color: "var(--text-muted)", padding: "36px 0", textAlign: "center" }}>
            {filtering
              ? "Nothing matches those filters."
              : tab === "out"
              ? "Nothing is out at an agent — every device is in the shop."
              : "Nothing is waiting to be finished after coming back."}
          </p>
        ) : rows.map(({ transfer, job }) => {
          const late = daysLate(transfer);
          const agentCharge = transferCost(transfer);
          const labour = job?.labourCost;

          return (
            <div
              key={transfer.id}
              style={{
                background: "var(--bg-card)", border: "1px solid var(--border)",
                borderLeft: `3px solid ${late > 0 ? "#f87171" : tab === "out" ? AGENT : TA}`,
                borderRadius: 12, padding: "13px 16px",
                display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap",
              }}
            >
              {/* Who and what */}
              <div style={{ minWidth: 104 }}>
                {job?.dealerJobNo ? (
                  <>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "var(--accent)" }} title="The dealer's own job number">#{job.dealerJobNo}</p>
                    <p style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 1 }} title="Our job number">{transfer.jobId}</p>
                  </>
                ) : (
                  <p style={{ fontSize: 13, fontWeight: 700, color: "var(--accent)" }}>{transfer.jobId}</p>
                )}
                <p style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 3 }}>{dealerOf(job)}</p>
              </div>

              <div style={{ flex: "1 1 190px", minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                  {job ? [job.brand, job.model].filter(Boolean).join(" ") || "—" : "Job not found"}
                </p>
                <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {job?.customerName || "—"}{job?.imei ? ` · ${job.imei}` : ""}
                </p>
                <p style={{ fontSize: 11, color: AGENT, marginTop: 3, fontWeight: 600 }}>
                  {transfer.agentName ?? "Unnamed agent"}
                  {transfer.reason ? <span style={{ color: "var(--text-muted)", fontWeight: 400 }}> · {transfer.reason}</span> : null}
                </p>
              </div>

              {/* When */}
              <div style={{ minWidth: 128, fontSize: 11, color: "var(--text-muted)", lineHeight: 1.7 }}>
                <p>Sent {day(transfer.sentAt)}</p>
                {tab === "out" ? (
                  <p style={{ color: late > 0 ? "#f87171" : "var(--text-muted)", fontWeight: late > 0 ? 700 : 400 }}>
                    {late > 0
                      ? `${late}d late`
                      : transfer.expectedReturn
                      ? `Due ${day(transfer.expectedReturn)}`
                      : `${daysSince(transfer.sentAt)}d out`}
                  </p>
                ) : (
                  <p>Back {day(transfer.returnedAt)}</p>
                )}
              </div>

              {/* The money.
                  Out: the quote, which is all anybody knows yet.
                  Back: what the agent charged and what the technician has
                  booked, because the two together are what this repair has
                  cost the shop — and the second one only exists once the job
                  is finished, which is exactly what this tab is waiting for. */}
              <div style={{ minWidth: 142, fontSize: 11, lineHeight: 1.7, textAlign: "right" }}>
                {tab === "out" ? (
                  <p style={{ color: "var(--text-muted)" }}>
                    Quoted{" "}
                    <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>
                      {transfer.agreedCost != null ? rs(transfer.agreedCost) : "—"}
                    </span>
                  </p>
                ) : (
                  <>
                    <p style={{ color: "var(--text-muted)" }}>
                      Agent{" "}
                      <span style={{ color: AGENT, fontWeight: 700 }}>
                        {transfer.actualCost != null || transfer.agreedCost != null ? rs(agentCharge) : "—"}
                      </span>
                      {transfer.actualCost == null && transfer.agreedCost != null && (
                        <span style={{ color: "#fbbf24" }}> (quote)</span>
                      )}
                    </p>
                    <p style={{ color: "var(--text-muted)" }}>
                      Technician{" "}
                      <span style={{ color: labour === undefined ? "var(--text-muted)" : TA, fontWeight: 700 }}>
                        {labour === undefined ? "not finished" : rs(labour)}
                      </span>
                    </p>
                    {labour !== undefined && (
                      <p style={{ color: "var(--text-secondary)", fontWeight: 700, borderTop: "1px solid var(--border)", marginTop: 3, paddingTop: 3 }}>
                        {rs(agentCharge + labour)}
                      </p>
                    )}
                  </>
                )}
              </div>

              {/* The one action this screen has */}
              {tab === "out" && (
                <button
                  onClick={() => setReceiving(transfer)}
                  style={{
                    display: "flex", alignItems: "center", gap: 6, padding: "8px 13px", borderRadius: 8,
                    border: "none", background: TA, color: "#04231a",
                    fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: ff, whiteSpace: "nowrap",
                  }}
                >
                  <PackageCheck size={13} /> Received
                </button>
              )}
            </div>
          );
        })}
      </div>

      {receiving && (
        <ReceiveFromAgentModal
          transfer={receiving}
          job={jobFor(receiving.jobId)}
          technicianName={technicianName}
          onClose={() => setReceiving(null)}
          onReceived={() => {
            // The device is in the shop and somebody is working on it again.
            // Left as Pending it would sit under "Waiting" saying nothing about
            // why, on a bench that has already been told it came back.
            const job = jobFor(receiving.jobId);
            if (job && job.status === "Pending") {
              void updateJob(job.id, { status: "Issued", pauseReason: undefined, pausedAt: undefined });
            }
            setTick(n => n + 1);
            // Re-reads the agent costs too, so the charge just entered is on
            // the job's cost breakdown before anybody goes looking for it.
            void refresh();
            setTab("back");
          }}
        />
      )}
    </div>
  );
}
