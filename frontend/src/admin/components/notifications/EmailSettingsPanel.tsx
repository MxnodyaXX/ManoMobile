"use client";

import { useCallback, useEffect, useState } from "react";
import { Mail, AlertCircle, Check } from "lucide-react";
import {
  fetchEmailSettings, saveEmailSettings, fetchEmailTemplates, saveEmailTemplate,
  BLANK_EMAIL_SETTINGS, type EmailSettings, type EmailTemplate,
} from "@/lib/email/client";
import {
  JOB_EMAIL_EVENTS, JOB_EMAIL_LABEL, JOB_EMAIL_TRIGGER, JOB_EMAIL_VARIABLES,
  EMAIL_VARIABLES, type JobEmailEvent,
} from "@/lib/email/templates";
import { useToast } from "@/lib/ui/toast";

const AA = "#a78bfa";
const TA = "#34d399";
const ff = "'Plus Jakarta Sans', sans-serif";

const input: React.CSSProperties = {
  width: "100%", background: "var(--bg-secondary)", border: "1px solid var(--border)",
  borderRadius: 8, padding: "9px 11px", fontSize: 13, color: "var(--text-primary)",
  fontFamily: ff, outline: "none", boxSizing: "border-box",
};
const label: React.CSSProperties = {
  fontSize: 10.5, fontWeight: 700, color: "var(--text-muted)",
  textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: ff,
};

/**
 * Customer email: who it comes from, and what it says.
 *
 * The sending address is a setting rather than an environment variable because
 * the shop is starting on a personal address and will move to its own domain —
 * that switch should be a form field, not a redeploy.
 */
export default function EmailSettingsPanel() {
  const toast = useToast();
  const [settings, setSettings] = useState<EmailSettings>(BLANK_EMAIL_SETTINGS);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [editing, setEditing] = useState<JobEmailEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, t] = await Promise.all([fetchEmailSettings(), fetchEmailTemplates()]);
      setSettings(s);
      setTemplates(t);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const persist = async (next: EmailSettings) => {
    setBusy(true);
    setSettings(next);
    try {
      await saveEmailSettings(next);
      toast.success("Email settings saved");
    } catch (e) {
      toast.dialog("error", "Could not save", e instanceof Error ? e.message : String(e));
      await load();   // fall back to what is actually stored
    } finally {
      setBusy(false);
    }
  };

  const persistTemplate = async (t: EmailTemplate) => {
    setBusy(true);
    setTemplates(prev => prev.map(x => (x.event === t.event ? t : x)));
    try {
      await saveEmailTemplate(t);
      toast.success("Template saved");
      setEditing(null);
    } catch (e) {
      toast.dialog("error", "Could not save template", e instanceof Error ? e.message : String(e));
      await load();
    } finally {
      setBusy(false);
    }
  };

  const current = templates.find(t => t.event === editing) ?? null;
  // Gmail and most mailbox providers refuse to send as an address the SMTP
  // account does not own. Worth saying before the first confusing bounce.
  const gmailFrom = /@gmail\.com$/i.test(settings.fromEmail.trim());

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, fontFamily: ff, marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <div style={{ width: 30, height: 30, borderRadius: 9, background: `${AA}14`, border: `1px solid ${AA}35`, display: "flex", alignItems: "center", justifyContent: "center", color: AA }}>
          <Mail size={14} />
        </div>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>Customer Email</h2>
          <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Sent alongside SMS, to customers who gave an email address.
          </p>
        </div>
        <SendSwitch on={settings.enabled} busy={busy} onChange={() => persist({ ...settings, enabled: !settings.enabled })} />
      </div>

      {error && (
        <div style={{ display: "flex", gap: 9, padding: "11px 14px", borderRadius: 10, background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.4)" }}>
          <AlertCircle size={15} color="#fbbf24" style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.55 }}>
            {error} — run migration 20260819000014_customer_email.sql.
          </p>
        </div>
      )}

      {loading ? (
        <p style={{ fontSize: 12.5, color: "var(--text-muted)", padding: "8px 2px" }}>Loading email settings…</p>
      ) : (
        <>
          {/* ── Sending identity ── */}
          <div style={{ padding: "16px 18px", borderRadius: 12, background: "var(--bg-card)", border: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <label style={label}>Sender Name</label>
                <input
                  style={input}
                  value={settings.fromName}
                  onChange={e => setSettings({ ...settings, fromName: e.target.value })}
                  onBlur={() => persist(settings)}
                  placeholder="Mano Mobile"
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <label style={label}>Sending Address</label>
                <input
                  style={input}
                  value={settings.fromEmail}
                  onChange={e => setSettings({ ...settings, fromEmail: e.target.value })}
                  onBlur={() => persist(settings)}
                  placeholder="manomobile@gmail.com"
                />
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <label style={label}>Reply-To (optional)</label>
              <input
                style={input}
                value={settings.replyTo}
                onChange={e => setSettings({ ...settings, replyTo: e.target.value })}
                onBlur={() => persist(settings)}
                placeholder="Leave blank to use the sending address"
              />
            </div>

            <p style={{ fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.55, paddingTop: 4, borderTop: "1px solid var(--border)" }}>
              {gmailFrom
                ? "This is a Gmail address, so it must be the same account configured as SMTP_USER on the server (or one of its verified aliases) — Gmail will not let you send as somebody else. When you buy a domain, change this to an address on it and update the server's SMTP settings to match."
                : "This must be an address the server's SMTP account is allowed to send as. Mail claiming to be from an address the sending server does not own is treated as spam."}
            </p>
          </div>

          {/* ── Wording ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {JOB_EMAIL_EVENTS.map(ev => {
              const t = templates.find(x => x.event === ev);
              return (
                <div key={ev} style={{ padding: "13px 16px", borderRadius: 12, background: "var(--bg-card)", border: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <p style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text-primary)" }}>{JOB_EMAIL_LABEL[ev]}</p>
                      {t?.isActive
                        ? <span style={{ fontSize: 9.5, fontWeight: 800, padding: "1px 7px", borderRadius: 20, background: `${TA}18`, color: TA, border: `1px solid ${TA}40` }}>ON</span>
                        : <span style={{ fontSize: 9.5, fontWeight: 800, padding: "1px 7px", borderRadius: 20, background: "var(--bg-secondary)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>OFF</span>}
                    </div>
                    <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 3, lineHeight: 1.5 }}>{JOB_EMAIL_TRIGGER[ev]}</p>
                  </div>
                  {t && (
                    <>
                      <SendSwitch on={t.isActive} busy={busy} onChange={() => persistTemplate({ ...t, isActive: !t.isActive })} />
                      <button
                        onClick={() => setEditing(ev)}
                        style={{ padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-primary)", cursor: "pointer", fontFamily: ff }}
                      >
                        Edit
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {current && (
        <EmailTemplateEditor
          template={current}
          onSave={persistTemplate}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

/* ── Reused switch, matching the SMS one ── */
function SendSwitch({ on, busy, onChange }: { on: boolean; busy: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      disabled={busy}
      aria-label={on ? "Switch off" : "Switch on"}
      style={{
        width: 44, height: 24, borderRadius: 12, border: "none", position: "relative",
        cursor: busy ? "not-allowed" : "pointer", flexShrink: 0,
        background: on ? TA : "var(--bg-surface)",
        boxShadow: "inset 0 0 0 1px var(--border)", transition: "background 0.2s",
      }}
    >
      <div style={{ position: "absolute", top: 2, left: on ? 22 : 2, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
    </button>
  );
}

/* ── Editor ── */
function EmailTemplateEditor({ template, onSave, onClose }: {
  template: EmailTemplate;
  onSave: (t: EmailTemplate) => void;
  onClose: () => void;
}) {
  const [subject, setSubject] = useState(template.subject);
  const [body, setBody] = useState(template.body);
  const allowed = JOB_EMAIL_VARIABLES[template.event];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, zIndex: 3300, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
    >
      <div style={{ width: "min(680px, 100%)", maxHeight: "88vh", overflowY: "auto", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: 20, fontFamily: ff, display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>{JOB_EMAIL_LABEL[template.event]}</p>
          <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2, lineHeight: 1.5 }}>{JOB_EMAIL_TRIGGER[template.event]}</p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <label style={label}>Subject</label>
          <input style={input} value={subject} onChange={e => setSubject(e.target.value)} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <label style={label}>Body (HTML)</label>
          <textarea
            style={{ ...input, minHeight: 260, fontFamily: "monospace", fontSize: 12, resize: "vertical" }}
            value={body}
            onChange={e => setBody(e.target.value)}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={label}>Available Fields</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {EMAIL_VARIABLES.filter(v => allowed.includes(v.token)).map(v => (
              <button
                key={v.token}
                title={v.description}
                onClick={() => setBody(b => `${b}{${v.token}}`)}
                style={{ padding: "3px 8px", borderRadius: 5, fontSize: 10.5, fontFamily: "monospace", cursor: "pointer", background: "var(--bg-secondary)", border: "1px solid var(--border)", color: AA }}
              >
                {v.token}
              </button>
            ))}
          </div>
          <p style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.5 }}>
            Click to insert. Anything a customer typed is escaped before it goes in, so a name with an
            &amp; or a &lt; cannot break the layout.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "9px 18px", borderRadius: 9, fontSize: 13, background: "none", border: "1px solid var(--border)", color: "var(--text-secondary)", cursor: "pointer", fontFamily: ff }}>Cancel</button>
          <button
            onClick={() => onSave({ ...template, subject, body })}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 18px", borderRadius: 9, fontSize: 13, fontWeight: 700, background: TA, border: "none", color: "#04231a", cursor: "pointer", fontFamily: ff }}
          >
            <Check size={14} /> Save Template
          </button>
        </div>
      </div>
    </div>
  );
}
