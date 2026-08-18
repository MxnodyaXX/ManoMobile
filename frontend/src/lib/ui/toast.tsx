"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

/**
 * Action feedback, in two weights.
 *
 *  dialog — a centred pop-up that stops and says "this happened". For actions
 *           you would otherwise go and re-check: creating a job, deleting a
 *           dealer, adding staff.
 *  toast  — a corner note that fades by itself. For rapid, repeatable actions
 *           such as flipping a permission switch, where a modal every time
 *           would be punishing.
 *
 * Deleting a dealer with no confirmation leaves you refreshing the page to find
 * out whether it worked, which is how records end up deleted twice.
 */

export type ToastKind = "success" | "error" | "info";

interface Toast { id: number; kind: ToastKind; title: string; detail?: string; ttl: number }
interface DialogMsg { id: number; kind: ToastKind; title: string; detail?: string; actionLabel: string }

interface ToastApi {
  success: (title: string, detail?: string) => void;
  error: (title: string, detail?: string) => void;
  info: (title: string, detail?: string) => void;
  /** Centred pop-up, for actions worth stopping for. */
  dialog: (kind: ToastKind, title: string, detail?: string, actionLabel?: string) => void;
}

const noop: ToastApi = { success: () => {}, error: () => {}, info: () => {}, dialog: () => {} };
const ToastContext = createContext<ToastApi>(noop);

const ff = "'Plus Jakarta Sans', sans-serif";

const KIND = {
  success: { color: "#34d399", ring: "rgba(52,211,153,0.16)", fg: "#04231a", icon: CheckCircle2 },
  error:   { color: "#f87171", ring: "rgba(248,113,113,0.16)", fg: "#2a0b0b", icon: AlertCircle },
  info:    { color: "#60a5fa", ring: "rgba(96,165,250,0.16)", fg: "#08203a", icon: Info },
} as const;

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [queue, setQueue] = useState<DialogMsg[]>([]);

  const dismissToast = useCallback((id: number) => setToasts(p => p.filter(t => t.id !== id)), []);
  const closeDialog = useCallback(() => setQueue(q => q.slice(1)), []);

  const push = useCallback((kind: ToastKind, title: string, detail?: string) => {
    const ttl = kind === "error" ? 7000 : 3200;
    setToasts(prev => [...prev.slice(-3), { id: nextId++, kind, title, detail, ttl }]);
  }, []);

  const api: ToastApi = {
    success: (t, d) => push("success", t, d),
    error: (t, d) => push("error", t, d),
    info: (t, d) => push("info", t, d),
    // Queued rather than replaced: two quick actions each get their moment.
    dialog: (kind, title, detail, actionLabel = "Done") =>
      setQueue(q => [...q, { id: nextId++, kind, title, detail, actionLabel }]),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
      {queue[0] && <ActionDialog msg={queue[0]} onClose={closeDialog} />}
    </ToastContext.Provider>
  );
}

/* ─── Centred pop-up ─────────────────────────────────────────────────────── */

function ActionDialog({ msg, onClose }: { msg: DialogMsg; onClose: () => void }) {
  const [leaving, setLeaving] = useState(false);
  const cfg = KIND[msg.kind];
  const Icon = cfg.icon;

  const close = useCallback(() => {
    setLeaving(true);
    setTimeout(onClose, 180);
  }, [onClose]);

  // Enter and Escape both dismiss — the button is the only action, so the
  // keyboard should agree with that rather than trapping anyone.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter") { e.preventDefault(); close(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      onClick={e => { if (e.target === e.currentTarget) close(); }}
      className={leaving ? "dlg-backdrop-out" : "dlg-backdrop-in"}
      style={{
        position: "fixed", inset: 0, zIndex: 4000,
        background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      }}
    >
      <div
        className={leaving ? "dlg-card-out" : "dlg-card-in"}
        style={{
          width: "min(400px, 100%)", background: "var(--bg-card)",
          border: "1px solid var(--border)", borderRadius: 26,
          padding: "34px 30px 28px", textAlign: "center", position: "relative",
          boxShadow: "0 30px 70px rgba(0,0,0,0.4)", fontFamily: ff,
        }}
      >
        <button
          onClick={close}
          aria-label="Close"
          style={{
            position: "absolute", top: 16, right: 16, width: 30, height: 30, borderRadius: 9,
            border: "none", background: "transparent", color: "var(--text-muted)", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <X size={17} />
        </button>

        {/* Two rings pulse outward once, then the icon pops in on top */}
        <div style={{ position: "relative", width: 96, height: 96, margin: "4px auto 20px" }}>
          <span className="dlg-ring" style={{ position: "absolute", inset: 0, borderRadius: "50%", background: cfg.ring }} />
          <span className="dlg-ring dlg-ring-2" style={{ position: "absolute", inset: 10, borderRadius: "50%", background: cfg.ring }} />
          <span
            className="dlg-icon"
            style={{
              position: "absolute", inset: 20, borderRadius: "50%",
              background: "var(--bg-secondary)", border: `2px solid ${cfg.color}`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <Icon size={28} color={cfg.color} strokeWidth={2.4} />
          </span>
        </div>

        <h2 style={{ fontSize: 21, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em", marginBottom: 8 }}>
          {msg.title}
        </h2>
        {msg.detail && (
          <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>{msg.detail}</p>
        )}

        <button
          onClick={close}
          autoFocus
          style={{
            marginTop: 22, width: "100%", padding: "13px", borderRadius: 999, border: "none",
            background: cfg.color, color: cfg.fg, fontSize: 14, fontWeight: 800,
            letterSpacing: "0.04em", cursor: "pointer", fontFamily: ff,
          }}
        >
          {msg.actionLabel}
        </button>
      </div>
    </div>,
    document.body,
  );
}

/* ─── Corner toasts ──────────────────────────────────────────────────────── */

function ToastViewport({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <div style={{
      position: "fixed", right: 18, bottom: 18, zIndex: 3000,
      display: "flex", flexDirection: "column", gap: 10,
      pointerEvents: "none", maxWidth: "min(380px, calc(100vw - 32px))",
    }}>
      {toasts.map(t => <ToastCard key={t.id} toast={t} onDismiss={onDismiss} />)}
    </div>,
    document.body,
  );
}

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  const [leaving, setLeaving] = useState(false);
  const cfg = KIND[toast.kind];
  const Icon = cfg.icon;

  useEffect(() => {
    // Animate out first, then unmount, or it disappears with a jump.
    const out = setTimeout(() => setLeaving(true), toast.ttl);
    const gone = setTimeout(() => onDismiss(toast.id), toast.ttl + 260);
    return () => { clearTimeout(out); clearTimeout(gone); };
  }, [toast.id, toast.ttl, onDismiss]);

  return (
    <div
      className={leaving ? "toast-out" : "toast-in"}
      style={{
        pointerEvents: "auto", display: "flex", alignItems: "flex-start", gap: 10,
        padding: "12px 13px", borderRadius: 12, background: "var(--bg-card)",
        border: `1px solid ${cfg.color}55`, boxShadow: "0 12px 34px rgba(0,0,0,0.32)",
        fontFamily: ff, position: "relative", overflow: "hidden",
      }}
    >
      <span style={{
        width: 26, height: 26, borderRadius: 8, flexShrink: 0,
        background: `${cfg.color}18`, border: `1px solid ${cfg.color}45`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Icon size={14} color={cfg.color} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-primary)" }}>{toast.title}</p>
        {toast.detail && <p style={{ fontSize: 11.5, color: "var(--text-secondary)", marginTop: 2, lineHeight: 1.45 }}>{toast.detail}</p>}
      </div>
      <button onClick={() => onDismiss(toast.id)} aria-label="Dismiss"
        style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 2, flexShrink: 0 }}>
        <X size={13} />
      </button>
      {/* Time remaining, so it never feels like it vanished at random */}
      <span style={{
        position: "absolute", left: 0, bottom: 0, height: 2, background: cfg.color, width: "100%",
        animation: `toastTimer ${toast.ttl}ms linear forwards`,
      }} />
    </div>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
