"use client";

import { X, Activity, Wrench, Package, FileText, CheckSquare, AlertTriangle, MessageCircle, Shield } from "lucide-react";
import { useTech, type ActivityType } from "@/technician/contexts/TechContext";
import type { RepairJob } from "@/cashier/contexts/RepairContext";

const TA = "#34d399";
const ff = "'Plus Jakarta Sans', sans-serif";

const TYPE_CFG: Record<ActivityType, { icon: any; color: string; label: string }> = {
  status_change:        { icon: Activity,        color: "#60a5fa", label: "Status Changed"     },
  part_requested:       { icon: Package,          color: "#a78bfa", label: "Part Requested"     },
  part_installed:       { icon: Package,          color: TA,        label: "Part Installed"     },
  note_added:           { icon: FileText,         color: "#fbbf24", label: "Note Added"         },
  diagnostic_done:      { icon: Wrench,           color: TA,        label: "Diagnostic Done"    },
  test_completed:       { icon: CheckSquare,      color: TA,        label: "Tests Completed"    },
  escalated:            { icon: AlertTriangle,    color: "#f87171", label: "Escalated"          },
  escalation_resolved:  { icon: CheckSquare,      color: TA,        label: "Escalation Resolved"},
  message_sent:         { icon: MessageCircle,    color: "#60a5fa", label: "Message Sent"       },
  warranty_issued:      { icon: Shield,           color: "#a78bfa", label: "Warranty Issued"    },
};

function fmtTs(d: Date) {
  return d.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

interface Props { job: RepairJob; onClose: () => void; }

export default function ActivityLogPanel({ job, onClose }: Props) {
  const { activityLog } = useTech();
  const entries = [...(activityLog[job.id] ?? [])].reverse(); // newest first

  return (
    <>
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 70 }} onClick={onClose} />
      <div style={{
        position: "fixed", right: 0, top: 0, bottom: 0, width: 400,
        background: "var(--bg-card)", borderLeft: "1px solid var(--border)",
        display: "flex", flexDirection: "column", zIndex: 71,
        boxShadow: "-8px 0 32px rgba(0,0,0,0.3)", fontFamily: ff,
      }}>
        {/* Header */}
        <div style={{ padding: "18px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Activity size={16} color={TA} />
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>Activity Log</p>
              <p style={{ fontSize: 11.5, color: "var(--text-muted)", fontFamily: ff }}>{job.id} · {job.brand} {job.model}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}><X size={16} /></button>
        </div>

        {/* Timeline */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
          {entries.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 0" }}>
              <Activity size={28} color="var(--text-muted)" style={{ marginBottom: 10 }} />
              <p style={{ fontSize: 13, color: "var(--text-muted)", fontFamily: ff }}>No activity recorded yet</p>
            </div>
          ) : (
            <div style={{ position: "relative" }}>
              {/* Vertical line */}
              <div style={{ position: "absolute", left: 15, top: 16, bottom: 0, width: 1, background: "var(--border)" }} />
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {entries.map((e, i) => {
                  const cfg = TYPE_CFG[e.type] ?? TYPE_CFG.note_added;
                  const Icon = cfg.icon;
                  return (
                    <div key={e.id} style={{ display: "flex", gap: 12, paddingBottom: 20 }}>
                      {/* Icon bubble */}
                      <div style={{
                        width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
                        background: cfg.color + "18", border: `1px solid ${cfg.color}35`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        zIndex: 1,
                      }}>
                        <Icon size={13} color={cfg.color} />
                      </div>
                      {/* Content */}
                      <div style={{ flex: 1, paddingTop: 4 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: cfg.color, fontFamily: ff, textTransform: "uppercase", letterSpacing: "0.05em" }}>{cfg.label}</span>
                          <span style={{ fontSize: 10.5, color: "var(--text-muted)", fontFamily: ff }}>{fmtTs(e.timestamp)}</span>
                        </div>
                        <p style={{ fontSize: 12.5, color: "var(--text-primary)", fontFamily: ff, lineHeight: 1.5 }}>{e.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
