"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Play, Pause, CheckCircle, Package, MoreHorizontal,
  Stethoscope, StickyNote, AlertTriangle, Send, MessageSquare, History, Hand, Smartphone,
} from "lucide-react";
import type { RepairJob } from "@/cashier/contexts/RepairContext";
import { isUnassigned } from "@/lib/repair/api";

const TA = "#34d399";
const ff = "'Plus Jakarta Sans', sans-serif";

/**
 * One job on the bench.
 *
 * Everything a technician does to a job in a normal day is on the card itself —
 * start it, pause it, finish it, ask for a part. The six things they do
 * occasionally live behind one ⋯ button, because eight equally-weighted
 * actions per job is what made the old screen unusable: nothing looked more
 * important than anything else, so every job needed reading before it could be
 * acted on.
 *
 * Touch targets are 44px minimum throughout — the bench uses phones, tablets
 * and desktops roughly equally, and a target sized for a mouse is a target a
 * thumb misses.
 */

export type BenchAction =
  | "start" | "claim" | "pause" | "resume" | "complete" | "parts"
  | "device" | "diagnostic" | "notes" | "escalate" | "transfer" | "message" | "activity";

const PRIORITY: Record<string, { color: string; bg: string }> = {
  Low:    { color: "#94a3b8", bg: "rgba(148,163,184,0.10)" },
  Normal: { color: "#60a5fa", bg: "rgba(96,165,250,0.10)"  },
  High:   { color: "#fbbf24", bg: "rgba(251,191,36,0.10)"  },
  Urgent: { color: "#f87171", bg: "rgba(248,113,113,0.10)" },
};

const OVERFLOW: { id: BenchAction; label: string; icon: typeof StickyNote }[] = [
  // First, because it is the one that has to be done while the phone is in
  // your hand — the rest can wait until it is back on the shelf.
  { id: "device",     label: "Device details",    icon: Smartphone    },
  { id: "diagnostic", label: "Diagnostic",        icon: Stethoscope   },
  { id: "notes",      label: "Internal notes",    icon: StickyNote    },
  { id: "escalate",   label: "Escalate",          icon: AlertTriangle },
  { id: "transfer",   label: "Send to agent",     icon: Send          },
  { id: "message",    label: "Message customer",  icon: MessageSquare },
  { id: "activity",   label: "Activity log",      icon: History       },
];

function fmtElapsed(startedAt: Date): string {
  const secs = Math.max(0, Math.floor((Date.now() - startedAt.getTime()) / 1000));
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  const mm = String(m).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${String(s).padStart(2, "0")}` : `${mm}:${String(s).padStart(2, "0")}`;
}

export default function BenchCard({ job, startedAt, partsPending, onAction }: {
  job: RepairJob;
  /** When the timer started, for a job in progress. */
  startedAt?: Date;
  /** Part requests on this job still waiting on Admin. */
  partsPending?: number;
  onAction: (action: BenchAction, job: RepairJob) => void;
}) {
  /**
   * The ⋯ menu is rendered into document.body, not inside the card.
   *
   * Inside, it was clipped: the accordion section around these cards has
   * overflow:hidden to keep its rounded corners, so a menu taller than the
   * space above the button simply got cut in half. A portal cannot be clipped
   * by an ancestor's overflow, and is immune to the same problem from any
   * transform or stacking context added later.
   *
   * Position is measured from the button and held in state, so it opens
   * upward or downward depending on which way there is room.
   */
  const [menu, setMenu] = useState<{ left: number; top: number; up: boolean } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuOpen = menu !== null;

  const MENU_W = 210;
  const MENU_H = OVERFLOW.length * 42 + 12;

  const toggleMenu = () => {
    if (menuOpen) { setMenu(null); return; }
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const up = r.bottom + MENU_H > window.innerHeight && r.top > MENU_H;
    setMenu({
      // Right-aligned to the button, then pulled back inside the viewport so a
      // card at the right edge does not open a menu half off-screen.
      left: Math.max(8, Math.min(r.right - MENU_W, window.innerWidth - MENU_W - 8)),
      top: up ? r.top - MENU_H - 6 : r.bottom + 6,
      up,
    });
  };

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node;
      if (!menuRef.current?.contains(t) && !btnRef.current?.contains(t)) setMenu(null);
    };
    // Fixed position cannot follow the page, so scrolling closes it rather
    // than leaving the menu floating away from its own card.
    const onScrollOrResize = () => setMenu(null);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMenu(null); };

    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const inProgress = job.status === "Issued";
  const paused     = job.status === "Pending";
  // Finished and waiting for the counter to hand over. Nothing for the
  // technician to do, so it gets no primary action — offering "Start" on a
  // completed repair, which is what a plain else-branch does, is worse than
  // offering nothing.
  const done       = job.status === "Completed" || job.status === "Delivered";
  const notStarted = !inProgress && !paused && !done;
  // Nobody's job yet. Claiming and starting are different acts — one takes
  // responsibility for the device, the other says work has begun — and rolling
  // them together would put a technician on the clock for a phone they only
  // meant to pick up off the pile.
  const unclaimed  = isUnassigned(job.technician);
  const device     = [job.brand, job.model].filter(Boolean).join(" ") || "Device";
  const pc         = PRIORITY[job.priority] ?? PRIORITY.Normal;

  const btn = (kind: "primary" | "quiet" | "warn"): React.CSSProperties => ({
    display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
    minHeight: 44, padding: "0 14px", borderRadius: 11,
    fontSize: 13, fontWeight: 700, fontFamily: ff, cursor: "pointer",
    // Grows to fill the row but never shrinks below a readable label — in a
    // narrow column the buttons wrap to a second line instead of squashing.
    flex: "1 1 auto", minWidth: 92, whiteSpace: "nowrap",
    ...(kind === "primary"
      ? { background: TA, border: "none", color: "#04231a" }
      : kind === "warn"
        ? { background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.4)", color: "#b45309" }
        : { background: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-primary)" }),
  });

  return (
    <div style={{
      background: "var(--bg-card)",
      border: `1px solid ${inProgress ? `${TA}45` : "var(--border)"}`,
      borderRadius: 14, padding: 14,
      display: "flex", flexDirection: "column", gap: 12,
    }}>
      {/* What it is */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--accent)", fontFamily: ff }}>{job.id}</span>
            {job.dealerJobNo && (
              <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: ff }} title="The dealer's own job number">
                #{job.dealerJobNo}
              </span>
            )}
            <span style={{
              fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
              color: pc.color, background: pc.bg, fontFamily: ff,
            }}>
              {job.priority}
            </span>
          </div>
          <p style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff, lineHeight: 1.25 }}>
            {device}
          </p>
          <p style={{ fontSize: 12.5, color: "var(--text-secondary)", fontFamily: ff, marginTop: 3 }}>
            {job.issue || "No fault recorded"}
          </p>
          <p style={{ fontSize: 11.5, color: "var(--text-muted)", fontFamily: ff, marginTop: 2 }}>
            {job.customerName}
          </p>
        </div>

        {/* Timer, or why it is waiting */}
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          {inProgress && startedAt && (
            <>
              <p className="stat-number" style={{ fontSize: 24, color: TA, fontFamily: ff, letterSpacing: "-0.02em" }}>
                {fmtElapsed(startedAt)}
              </p>
              <p style={{ fontSize: 10.5, color: "var(--text-muted)", fontFamily: ff }}>on this job</p>
            </>
          )}
          {!!partsPending && (
            <p style={{ fontSize: 11, color: "#a78bfa", fontFamily: ff, marginTop: 4 }}>
              {partsPending} part{partsPending > 1 ? "s" : ""} awaiting approval
            </p>
          )}
        </div>
      </div>

      {/* Why it stopped — the one thing worth reading on a paused card */}
      {paused && (
        <p style={{
          fontSize: 12, color: "var(--text-secondary)", fontFamily: ff, lineHeight: 1.5,
          padding: "9px 11px", borderRadius: 9,
          background: "rgba(251,191,36,0.07)", border: "1px solid rgba(251,191,36,0.25)",
        }}>
          {job.pauseReason || "On hold — no reason recorded"}
        </p>
      )}

      {/* What to do about it */}
      <div style={{ display: "flex", gap: 8, alignItems: "stretch", flexWrap: "wrap" }}>
        {inProgress && (
          <>
            <button onClick={() => onAction("complete", job)} style={btn("primary")}>
              <CheckCircle size={16} /> Complete
            </button>
            <button onClick={() => onAction("pause", job)} style={btn("warn")}>
              <Pause size={16} /> Pause
            </button>
            <button onClick={() => onAction("parts", job)} style={btn("quiet")}>
              <Package size={16} /> Parts
            </button>
          </>
        )}
        {notStarted && unclaimed && (
          <button onClick={() => onAction("claim", job)} style={btn("primary")}>
            <Hand size={13} strokeWidth={2.4} />
            Claim
          </button>
        )}

        {notStarted && !unclaimed && (
          <button onClick={() => onAction("start", job)} style={btn("primary")}>
            <Play size={16} /> Start
          </button>
        )}
        {done && (
          <span style={{
            display: "flex", alignItems: "center", gap: 7, flex: "1 1 auto",
            minHeight: 44, padding: "0 14px", borderRadius: 11,
            fontSize: 12.5, fontFamily: ff, color: "var(--text-muted)",
            background: "var(--bg-secondary)", border: "1px solid var(--border)",
          }}>
            <CheckCircle size={15} color="#60a5fa" /> Waiting for collection
          </span>
        )}
        {paused && (
          <>
            <button onClick={() => onAction("resume", job)} style={btn("primary")}>
              <Play size={16} /> Resume
            </button>
            <button onClick={() => onAction("parts", job)} style={btn("quiet")}>
              <Package size={16} /> Parts
            </button>
          </>
        )}

        {/* The occasional six, out of the way but one tap deep */}
        <button
          ref={btnRef}
          onClick={toggleMenu}
          aria-label="More actions"
          aria-expanded={menuOpen}
          style={{ ...btn("quiet"), flex: "0 0 auto", width: 48, minWidth: 48, padding: 0 }}
        >
          <MoreHorizontal size={18} />
        </button>
        {menu && typeof document !== "undefined" && createPortal(
          <div
            ref={menuRef}
            style={{
              position: "fixed", left: menu.left, top: menu.top, zIndex: 3000,
              width: MENU_W, padding: 6, borderRadius: 12,
              background: "var(--bg-card)", border: "1px solid var(--border)",
              boxShadow: "0 16px 40px rgba(0,0,0,0.28)",
            }}
          >
            {OVERFLOW.map(item => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => { setMenu(null); onAction(item.id, job); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, width: "100%",
                    minHeight: 42, padding: "0 12px", borderRadius: 8,
                    background: "none", border: "none", cursor: "pointer",
                    fontSize: 13, color: "var(--text-primary)", fontFamily: ff, textAlign: "left",
                  }}
                >
                  <Icon size={15} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                  {item.label}
                </button>
              );
            })}
          </div>,
          document.body,
        )}
      </div>
    </div>
  );
}
