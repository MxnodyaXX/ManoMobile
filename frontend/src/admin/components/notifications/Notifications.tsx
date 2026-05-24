"use client";

import { useState } from "react";
import { useIsMobile } from "@/cashier/hooks/useIsMobile";
import { Bell, MessageSquare, Mail, Smartphone, ToggleLeft, ToggleRight, Eye, CheckCircle, XCircle, Clock, AlertTriangle } from "lucide-react";
import { useAdmin, type NotificationChannel } from "@/admin/contexts/AdminContext";

const AA = "#a78bfa";
const ff = "'Plus Jakarta Sans', sans-serif";

const CHANNEL_CFG: Record<NotificationChannel, { color: string; bg: string; border: string; icon: any }> = {
  SMS:       { color: "#34d399", bg: "rgba(52,211,153,0.1)",  border: "rgba(52,211,153,0.25)",  icon: Smartphone   },
  WhatsApp:  { color: "#4ade80", bg: "rgba(74,222,128,0.1)",  border: "rgba(74,222,128,0.25)",  icon: MessageSquare },
  Email:     { color: "#60a5fa", bg: "rgba(96,165,250,0.1)",  border: "rgba(96,165,250,0.25)",  icon: Mail          },
};

const LOG_STATUS_CFG = {
  Sent:      { color: "#9ca3af", icon: Clock        },
  Delivered: { color: "#34d399", icon: CheckCircle  },
  Failed:    { color: "#f87171", icon: XCircle      },
  Pending:   { color: "#fbbf24", icon: AlertTriangle },
};

export default function Notifications() {
  const { templates, notificationLog, toggleTemplate } = useAdmin();
  const [tab, setTab]             = useState<"templates" | "log">("templates");
  const [chanFilter, setChan]     = useState<NotificationChannel | "All">("All");
  const isMobile = useIsMobile();
  const [preview, setPreview]     = useState<string | null>(null);

  const filteredTemplates = templates.filter(t => chanFilter === "All" || t.channel === chanFilter);
  const filteredLog       = notificationLog.filter(l => chanFilter === "All" || l.channel === chanFilter);
  const activeCount       = templates.filter(t => t.isActive).length;
  const failedCount       = notificationLog.filter(l => l.status === "Failed").length;

  const previewTpl = templates.find(t => t.id === preview);

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: active ? 700 : 500,
    color: active ? AA : "var(--text-secondary)", background: active ? `${AA}12` : "transparent",
    border: `1px solid ${active ? AA + "45" : "transparent"}`, cursor: "pointer", fontFamily: ff, transition: "all 0.15s",
  });

  const filterBtn = (active: boolean): React.CSSProperties => ({
    padding: "5px 11px", borderRadius: 7, fontSize: 11.5, fontWeight: active ? 700 : 500,
    color: active ? AA : "var(--text-secondary)", background: active ? `${AA}12` : "var(--bg-card)",
    border: `1px solid ${active ? AA + "45" : "var(--border)"}`, cursor: "pointer", fontFamily: ff,
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, fontFamily: ff }}>

      <div className="fade-up" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em", marginBottom: 4, fontFamily: ff }}>Notifications</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", fontFamily: ff }}>{activeCount} active templates · {notificationLog.length} sent · {failedCount > 0 ? `${failedCount} failed` : "all delivered"}</p>
        </div>
        {failedCount > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 14px", borderRadius: 9, background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)" }}>
            <AlertTriangle size={13} color="#f87171" />
            <span style={{ fontSize: 12, fontWeight: 600, color: "#f87171", fontFamily: ff }}>{failedCount} failed</span>
          </div>
        )}
      </div>

      {/* Tabs + channel filter */}
      <div className="fade-up" style={{ display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "flex-start" : "center", justifyContent: "space-between", gap: 10 }}>
        <div className={isMobile ? "tabs-scroll" : undefined}>
          <div style={{ display: "flex", gap: 4, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, padding: 4, width: "fit-content" }}>
            <button onClick={() => setTab("templates")} style={tabStyle(tab === "templates")}>Templates</button>
            <button onClick={() => setTab("log")} style={tabStyle(tab === "log")}>Send Log ({notificationLog.length})</button>
          </div>
        </div>
        <div className={isMobile ? "tabs-scroll" : undefined}>
          <div style={{ display: "flex", gap: 6, width: "fit-content" }}>
            <button onClick={() => setChan("All")} style={filterBtn(chanFilter === "All")}>All</button>
            {(["SMS", "WhatsApp", "Email"] as NotificationChannel[]).map(c => (
              <button key={c} onClick={() => setChan(c)} style={filterBtn(chanFilter === c)}>{c}</button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Templates tab ── */}
      {tab === "templates" && (
        <div className="fade-up" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filteredTemplates.map(t => {
            const cfg = CHANNEL_CFG[t.channel];
            const Icon = cfg.icon;
            return (
              <div key={t.id} style={{ padding: "16px 18px", background: "var(--bg-card)", borderRadius: 12, border: `1px solid ${t.isActive ? cfg.border : "var(--border)"}`, transition: "border-color 0.2s" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: t.isActive ? cfg.bg : "var(--bg-secondary)", border: `1px solid ${t.isActive ? cfg.border : "var(--border)"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.2s" }}>
                    <Icon size={15} color={t.isActive ? cfg.color : "var(--text-muted)"} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>{t.name}</span>
                      <span style={{ fontSize: 10.5, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, fontFamily: ff }}>{t.channel}</span>
                      <span style={{ fontSize: 10.5, color: "var(--text-muted)", fontFamily: ff }}>Event: {t.event}</span>
                    </div>
                    {t.subject && <p style={{ fontSize: 11.5, color: "var(--text-secondary)", fontFamily: ff, marginBottom: 4 }}>Subject: {t.subject}</p>}
                    <p style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: ff, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 500 }}>{t.body}</p>
                    {t.variables.length > 0 && (
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 8 }}>
                        {t.variables.map(v => (
                          <span key={v} style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 5, background: "var(--bg-secondary)", color: AA, border: `1px solid ${AA}25`, fontFamily: ff }}>{v}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    <button onClick={() => setPreview(t.id)} title="Preview template" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 6, borderRadius: 7, transition: "all 0.15s" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-secondary)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "none"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)"; }}
                    >
                      <Eye size={14} />
                    </button>
                    <button onClick={() => toggleTemplate(t.id)} title={t.isActive ? "Disable template" : "Enable template"} style={{ background: "none", border: "none", cursor: "pointer", color: t.isActive ? cfg.color : "var(--text-muted)", padding: 4 }}>
                      {t.isActive ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Log tab ── */}
      {tab === "log" && (
        <div className="fade-up" style={{ borderRadius: 14, border: "1px solid var(--border)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)" }}>
                {["Template", "Channel", "Recipient", "Status", "Sent At", "Job"].map(h => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600, fontFamily: ff }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredLog.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: "48px 0", textAlign: "center", color: "var(--text-muted)", fontFamily: ff }}>No log entries</td></tr>
              ) : filteredLog.map((l, i) => {
                const chanCfg   = CHANNEL_CFG[l.channel];
                const statusCfg = LOG_STATUS_CFG[l.status];
                const StatusIcon = statusCfg.icon;
                return (
                  <tr key={l.id} style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "transparent" : "var(--bg-secondary)" }}>
                    <td style={{ padding: "11px 14px", fontWeight: 600, color: "var(--text-primary)", fontFamily: ff }}>{l.templateName}</td>
                    <td style={{ padding: "11px 14px" }}>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: chanCfg.bg, color: chanCfg.color, border: `1px solid ${chanCfg.border}`, fontFamily: ff }}>{l.channel}</span>
                    </td>
                    <td style={{ padding: "11px 14px", color: "var(--text-secondary)", fontFamily: ff }}>{l.recipient}</td>
                    <td style={{ padding: "11px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <StatusIcon size={12} color={statusCfg.color} />
                        <span style={{ fontSize: 12, fontWeight: 600, color: statusCfg.color, fontFamily: ff }}>{l.status}</span>
                      </div>
                    </td>
                    <td style={{ padding: "11px 14px", color: "var(--text-muted)", fontFamily: ff, fontSize: 12 }}>{l.sentAt}</td>
                    <td style={{ padding: "11px 14px", color: "var(--text-muted)", fontFamily: ff }}>{l.jobId ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Preview modal */}
      {previewTpl && (
        <>
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 70 }} onClick={() => setPreview(null)} />
          <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 71, padding: 20 }}>
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 18, padding: "26px 28px 22px", width: "100%", maxWidth: 500, boxShadow: "0 24px 64px rgba(0,0,0,0.5)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Bell size={15} color={AA} />
                  <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>{previewTpl.name}</p>
                  <span style={{ fontSize: 10.5, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: CHANNEL_CFG[previewTpl.channel].bg, color: CHANNEL_CFG[previewTpl.channel].color, border: `1px solid ${CHANNEL_CFG[previewTpl.channel].border}`, fontFamily: ff }}>{previewTpl.channel}</span>
                </div>
                <button onClick={() => setPreview(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}>×</button>
              </div>
              {previewTpl.subject && (
                <div style={{ marginBottom: 10 }}>
                  <span style={{ fontSize: 10.5, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: ff }}>Subject</span>
                  <p style={{ fontSize: 12.5, color: "var(--text-primary)", fontFamily: ff, marginTop: 4 }}>{previewTpl.subject}</p>
                </div>
              )}
              <div style={{ marginBottom: 14 }}>
                <span style={{ fontSize: 10.5, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: ff }}>Message Body</span>
                <pre style={{ marginTop: 8, padding: "14px 16px", background: "var(--bg-secondary)", borderRadius: 10, border: "1px solid var(--border)", fontSize: 12.5, color: "var(--text-primary)", fontFamily: ff, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{previewTpl.body}</pre>
              </div>
              <div>
                <span style={{ fontSize: 10.5, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: ff }}>Variables</span>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                  {previewTpl.variables.map(v => (
                    <span key={v} style={{ fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 6, background: `${AA}10`, color: AA, border: `1px solid ${AA}25`, fontFamily: ff }}>{v}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
