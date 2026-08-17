"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Save, RotateCcw, AlertCircle, Smartphone } from "lucide-react";
import {
  DEFAULT_SMS_BODIES, JOB_SMS_TRIGGER, JOB_SMS_VARIABLES, SAMPLE_JOB,
  SMS_VARIABLES, renderTemplate,
} from "@/lib/sms/templates";
import { smsPartCount } from "@/lib/sms/client";
import type { SmsTemplate } from "@/lib/sms/templatesApi";

const AA = "#a78bfa";
const ff = "'Plus Jakarta Sans', sans-serif";

/**
 * Edit one customer SMS template.
 *
 * The preview renders the real message against a sample job, and the part
 * counter shows what each send will cost — wording changes move that number,
 * and it is better to see it here than on the monthly bill.
 */
export default function SmsTemplateEditor({ template, onSave, onClose }: {
  template: SmsTemplate;
  onSave: (t: SmsTemplate) => Promise<void>;
  onClose: () => void;
}) {
  const [body, setBody] = useState(template.body);
  const [isActive, setIsActive] = useState(template.isActive);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const preview = renderTemplate(body, SAMPLE_JOB);
  const parts = smsPartCount(preview);
  const allowed = JOB_SMS_VARIABLES[template.event];
  const unknown = [...body.matchAll(/\{(\w+)\}/g)]
    .map(m => m[1])
    .filter(t => !SMS_VARIABLES.some(v => v.token === t));

  /** Insert a token where the cursor is, rather than making them type braces. */
  const insert = (token: string) => {
    const el = bodyRef.current;
    const chip = `{${token}}`;
    if (!el) { setBody(b => b + chip); return; }
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    const next = body.slice(0, start) + chip + body.slice(end);
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + chip.length;
    });
  };

  const save = async () => {
    if (!body.trim()) { setError("The message cannot be empty."); return; }
    setBusy(true);
    setError(null);
    try {
      await onSave({ ...template, body, isActive });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 1200, background: "rgba(0,0,0,0.65)",
        backdropFilter: "blur(5px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      }}
    >
      <div style={{
        width: "min(880px, calc(100vw - 24px))", maxHeight: "92vh", display: "flex", flexDirection: "column",
        background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16,
        boxShadow: "0 24px 64px rgba(0,0,0,0.5)", fontFamily: ff, overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: `${AA}14`, border: `1px solid ${AA}35`, display: "flex", alignItems: "center", justifyContent: "center", color: AA }}>
              <Smartphone size={15} />
            </div>
            <div>
              <p style={{ fontSize: 14.5, fontWeight: 700, color: "var(--text-primary)" }}>{template.name}</p>
              <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>{JOB_SMS_TRIGGER[template.event]}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={14} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Variables */}
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 7 }}>
              Insert a value
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {SMS_VARIABLES.filter(v => allowed.includes(v.token)).map(v => (
                <button
                  key={v.token}
                  onClick={() => insert(v.token)}
                  title={v.description}
                  style={{
                    padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                    background: `${AA}10`, border: `1px solid ${AA}35`, color: AA,
                    cursor: "pointer", fontFamily: ff,
                  }}
                >
                  {`{${v.token}}`}
                </button>
              ))}
            </div>
          </div>

          {/* Editor + preview */}
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 340px", minWidth: 280 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 7 }}>Message</p>
              <textarea
                ref={bodyRef}
                value={body}
                onChange={e => setBody(e.target.value)}
                rows={16}
                style={{
                  width: "100%", padding: "11px 13px", borderRadius: 10,
                  border: "1px solid var(--border)", background: "var(--bg-secondary)",
                  color: "var(--text-primary)", fontSize: 12.5, fontFamily: "'JetBrains Mono', monospace",
                  lineHeight: 1.6, outline: "none", resize: "vertical", boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ flex: "1 1 300px", minWidth: 260 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 7 }}>
                What the customer receives
              </p>
              <div style={{
                padding: "12px 14px", borderRadius: 10, minHeight: 200,
                background: "var(--bg-secondary)", border: "1px solid var(--border)",
                fontSize: 12.5, color: "var(--text-primary)", lineHeight: 1.65, whiteSpace: "pre-wrap",
              }}>
                {preview}
              </div>
              <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 7 }}>
                {preview.length} characters ·{" "}
                <strong style={{ color: parts > 3 ? "#fbbf24" : "var(--text-secondary)" }}>
                  {parts} SMS credit{parts > 1 ? "s" : ""}
                </strong>{" "}
                per send
              </p>
            </div>
          </div>

          {unknown.length > 0 && (
            <div style={{ display: "flex", gap: 8, padding: "9px 12px", borderRadius: 9, background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.35)" }}>
              <AlertCircle size={14} color="#fbbf24" style={{ flexShrink: 0, marginTop: 1 }} />
              <p style={{ fontSize: 11.5, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                Unknown value{unknown.length > 1 ? "s" : ""} <strong>{unknown.map(u => `{${u}}`).join(", ")}</strong> —
                these will be sent to the customer exactly as written. Use the buttons above to insert a valid one.
              </p>
            </div>
          )}

          {error && (
            <div style={{ display: "flex", gap: 8, padding: "9px 12px", borderRadius: 9, background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.35)" }}>
              <AlertCircle size={14} color="var(--danger)" style={{ flexShrink: 0, marginTop: 1 }} />
              <p style={{ fontSize: 12, color: "var(--danger)", fontWeight: 600 }}>{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 20px", borderTop: "1px solid var(--border)", flexWrap: "wrap" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginRight: "auto" }}>
            <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} style={{ width: 15, height: 15, cursor: "pointer", accentColor: AA }} />
            <span style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>
              Send this message automatically
            </span>
          </label>

          <button
            onClick={() => setBody(DEFAULT_SMS_BODIES[template.event])}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", fontSize: 12.5, cursor: "pointer", fontFamily: ff }}
          >
            <RotateCcw size={13} /> Reset to default
          </button>
          <button onClick={onClose} style={{ padding: "9px 16px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", fontSize: 12.5, cursor: "pointer", fontFamily: ff }}>
            Cancel
          </button>
          <button
            onClick={save}
            disabled={busy}
            style={{
              display: "flex", alignItems: "center", gap: 7, padding: "9px 18px", borderRadius: 8, border: "none",
              background: AA, color: "#1a1330", fontSize: 13, fontWeight: 700,
              cursor: busy ? "wait" : "pointer", opacity: busy ? 0.7 : 1, fontFamily: ff,
            }}
          >
            <Save size={14} /> {busy ? "Saving…" : "Save Template"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
