"use client";

import { useState } from "react";
import { Plus, Search, Edit2, X, Smartphone, AlertTriangle, CheckCircle, Wrench } from "lucide-react";
import { useAdmin, type DeviceRecord, type DeviceStatus } from "@/admin/contexts/AdminContext";

const AA = "#a78bfa";
const ff = "'Plus Jakarta Sans', sans-serif";

const STATUSES: DeviceStatus[] = ["Clean", "Blacklisted", "In Repair", "Repaired", "For Sale", "Returned"];

const STATUS_CFG: Record<DeviceStatus, { color: string; bg: string; border: string }> = {
  Clean:       { color: "#34d399", bg: "rgba(52,211,153,0.1)",   border: "rgba(52,211,153,0.25)"  },
  Blacklisted: { color: "#f87171", bg: "rgba(248,113,113,0.1)",  border: "rgba(248,113,113,0.25)" },
  "In Repair": { color: "#fbbf24", bg: "rgba(251,191,36,0.1)",   border: "rgba(251,191,36,0.25)"  },
  Repaired:    { color: "#60a5fa", bg: "rgba(96,165,250,0.1)",   border: "rgba(96,165,250,0.25)"  },
  "For Sale":  { color: "#a78bfa", bg: "rgba(167,139,250,0.1)",  border: "rgba(167,139,250,0.25)" },
  Returned:    { color: "#9ca3af", bg: "rgba(107,114,128,0.1)",  border: "rgba(107,114,128,0.2)"  },
};

const BLANK: Omit<DeviceRecord, "id"> = {
  imei: "", imei2: "", make: "", model: "", color: "", storage: "",
  ownerName: "", ownerPhone: "", status: "Clean",
  repairCount: 0, notes: "", registeredAt: new Date().toISOString().slice(0, 10),
};

const inp: React.CSSProperties = {
  background: "var(--bg-secondary)", border: "1px solid var(--border)",
  borderRadius: 8, padding: "9px 12px", fontSize: 12.5,
  color: "var(--text-primary)", fontFamily: ff, outline: "none",
  width: "100%", boxSizing: "border-box",
};
const lbl: React.CSSProperties = {
  fontSize: 10.5, fontWeight: 600, color: "var(--text-muted)",
  textTransform: "uppercase", letterSpacing: "0.05em",
  fontFamily: ff, marginBottom: 5, display: "block",
};

function DeviceModal({ initial, onSave, onClose }: {
  initial?: DeviceRecord;
  onSave: (d: any) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Omit<DeviceRecord, "id">>(initial ? { ...initial } : { ...BLANK });
  const set = (k: keyof typeof form, v: any) => setForm(p => ({ ...p, [k]: v }));
  const valid = form.imei.trim().length >= 10 && form.make.trim() && form.model.trim();

  return (
    <>
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 70 }} onClick={onClose} />
      <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 71, padding: 20 }}>
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 18, padding: "26px 26px 22px", width: "100%", maxWidth: 520, display: "flex", flexDirection: "column", gap: 18, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 24px 64px rgba(0,0,0,0.5)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>{initial ? "Edit Device" : "Register Device"}</p>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}><X size={16} /></button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={lbl}>IMEI 1 *</label>
              <input style={inp} value={form.imei} onChange={e => set("imei", e.target.value)} placeholder="15-digit IMEI" maxLength={17} />
            </div>
            <div>
              <label style={lbl}>IMEI 2 (Dual SIM)</label>
              <input style={inp} value={form.imei2 ?? ""} onChange={e => set("imei2", e.target.value)} placeholder="Optional" maxLength={17} />
            </div>
            <div>
              <label style={lbl}>Make / Brand *</label>
              <input style={inp} value={form.make} onChange={e => set("make", e.target.value)} placeholder="Apple, Samsung…" />
            </div>
            <div>
              <label style={lbl}>Model *</label>
              <input style={inp} value={form.model} onChange={e => set("model", e.target.value)} placeholder="iPhone 14, A54…" />
            </div>
            <div>
              <label style={lbl}>Colour</label>
              <input style={inp} value={form.color ?? ""} onChange={e => set("color", e.target.value)} placeholder="Midnight Black" />
            </div>
            <div>
              <label style={lbl}>Storage</label>
              <input style={inp} value={form.storage ?? ""} onChange={e => set("storage", e.target.value)} placeholder="128GB, 256GB…" />
            </div>
            <div>
              <label style={lbl}>Owner Name</label>
              <input style={inp} value={form.ownerName ?? ""} onChange={e => set("ownerName", e.target.value)} placeholder="Chaminda Wijesinghe" />
            </div>
            <div>
              <label style={lbl}>Owner Phone</label>
              <input style={inp} value={form.ownerPhone ?? ""} onChange={e => set("ownerPhone", e.target.value)} placeholder="071-111-2222" />
            </div>
            <div>
              <label style={lbl}>Status</label>
              <select style={{ ...inp }} value={form.status} onChange={e => set("status", e.target.value as DeviceStatus)}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Repair Count</label>
              <input style={inp} type="number" min={0} value={form.repairCount} onChange={e => set("repairCount", Number(e.target.value))} />
            </div>
            <div style={{ gridColumn: "span 2" }}>
              <label style={lbl}>Notes</label>
              <textarea style={{ ...inp, resize: "vertical", minHeight: 64 }} value={form.notes ?? ""} onChange={e => set("notes", e.target.value)} placeholder="e.g. Reported stolen — PD ref: 2026/CR/4521" />
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", borderTop: "1px solid var(--border)", paddingTop: 4 }}>
            <button onClick={onClose} style={{ padding: "9px 18px", borderRadius: 9, background: "var(--bg-secondary)", border: "1px solid var(--border)", cursor: "pointer", fontSize: 12.5, fontWeight: 600, color: "var(--text-secondary)", fontFamily: ff }}>Cancel</button>
            <button disabled={!valid} onClick={() => valid && onSave(initial ? { ...form, id: initial.id } : form)} style={{ padding: "9px 20px", borderRadius: 9, background: valid ? `${AA}18` : "var(--bg-secondary)", border: `1px solid ${valid ? AA + "50" : "var(--border)"}`, cursor: valid ? "pointer" : "not-allowed", fontSize: 12.5, fontWeight: 700, color: valid ? AA : "var(--text-muted)", fontFamily: ff }}>
              {initial ? "Save Changes" : "Register Device"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default function DeviceRegistry() {
  const { devices, addDevice, updateDevice } = useAdmin();
  const [query, setQuery]         = useState("");
  const [statusFilter, setFilt]   = useState<DeviceStatus | "All">("All");
  const [modal, setModal]         = useState<"add" | DeviceRecord | null>(null);

  const filtered = devices.filter(d => {
    const q = query.toLowerCase();
    const matchQ = !q || d.imei.includes(q) || d.model.toLowerCase().includes(q) || d.make.toLowerCase().includes(q) || (d.ownerName ?? "").toLowerCase().includes(q) || (d.ownerPhone ?? "").includes(q);
    const matchS = statusFilter === "All" || d.status === statusFilter;
    return matchQ && matchS;
  });

  const blacklisted = devices.filter(d => d.status === "Blacklisted").length;

  const handleSave = (data: any) => {
    if (data.id) updateDevice(data.id, data);
    else          addDevice(data);
    setModal(null);
  };

  const filterBtn = (active: boolean): React.CSSProperties => ({
    padding: "5px 11px", borderRadius: 7, fontSize: 11.5, fontWeight: active ? 700 : 500,
    color: active ? AA : "var(--text-secondary)", background: active ? `${AA}12` : "var(--bg-card)",
    border: `1px solid ${active ? AA + "45" : "var(--border)"}`, cursor: "pointer", fontFamily: ff,
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, fontFamily: ff }}>

      <div className="fade-up" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em", marginBottom: 4, fontFamily: ff }}>Device Registry</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", fontFamily: ff }}>{devices.length} registered · {blacklisted} blacklisted</p>
        </div>
        <button onClick={() => setModal("add")} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 9, background: `${AA}18`, border: `1px solid ${AA}40`, cursor: "pointer", fontSize: 12.5, fontWeight: 700, color: AA, fontFamily: ff }}>
          <Plus size={14} /> Register Device
        </button>
      </div>

      {blacklisted > 0 && (
        <div className="fade-up" style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.25)", display: "flex", alignItems: "center", gap: 10 }}>
          <AlertTriangle size={14} color="#f87171" />
          <span style={{ fontSize: 12.5, color: "#f87171", fontFamily: ff, fontWeight: 600 }}>{blacklisted} blacklisted device{blacklisted > 1 ? "s" : ""} in registry</span>
        </div>
      )}

      {/* Filters */}
      <div className="fade-up" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 9, padding: "0 12px", flex: "0 0 260px" }}>
          <Search size={13} color="var(--text-muted)" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search IMEI, model, owner…" style={{ background: "none", border: "none", outline: "none", fontSize: 12.5, color: "var(--text-primary)", fontFamily: ff, padding: "9px 0", width: "100%" }} />
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button onClick={() => setFilt("All")} style={filterBtn(statusFilter === "All")}>All</button>
          {STATUSES.map(s => (
            <button key={s} onClick={() => setFilt(s)} style={filterBtn(statusFilter === s)}>{s}</button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="fade-up" style={{ borderRadius: 14, border: "1px solid var(--border)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)" }}>
              {["Device", "IMEI", "Owner", "Repairs", "Status", "Registered", ""].map(h => (
                <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600, fontFamily: ff }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: "48px 0", textAlign: "center", color: "var(--text-muted)", fontFamily: ff }}>No devices found</td></tr>
            ) : filtered.map((d, i) => {
              const cfg = STATUS_CFG[d.status];
              return (
                <tr key={d.id} style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "transparent" : "var(--bg-secondary)" }}>
                  <td style={{ padding: "12px 14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 34, height: 34, borderRadius: 9, background: `${cfg.color}12`, border: `1px solid ${cfg.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        {d.status === "Blacklisted" ? <AlertTriangle size={13} color={cfg.color} /> : d.status === "In Repair" ? <Wrench size={13} color={cfg.color} /> : <Smartphone size={13} color={cfg.color} />}
                      </div>
                      <div>
                        <p style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>{d.make} {d.model}</p>
                        <p style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: ff }}>{[d.color, d.storage].filter(Boolean).join(" · ") || "—"}</p>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", fontFamily: ff, letterSpacing: "0.02em" }}>{d.imei}</p>
                    {d.imei2 && <p style={{ fontSize: 10.5, color: "var(--text-muted)", fontFamily: ff }}>{d.imei2}</p>}
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    {d.ownerName ? (
                      <>
                        <p style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)", fontFamily: ff }}>{d.ownerName}</p>
                        <p style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: ff }}>{d.ownerPhone}</p>
                      </>
                    ) : <span style={{ color: "var(--text-muted)", fontFamily: ff }}>—</span>}
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <Wrench size={11} color="var(--text-muted)" />
                      <span style={{ fontSize: 12.5, color: "var(--text-secondary)", fontFamily: ff }}>{d.repairCount}×</span>
                    </div>
                    {d.lastJobId && <p style={{ fontSize: 10.5, color: "var(--text-muted)", fontFamily: ff }}>{d.lastJobId}</p>}
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 20, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, fontFamily: ff }}>{d.status}</span>
                  </td>
                  <td style={{ padding: "12px 14px", color: "var(--text-muted)", fontFamily: ff, fontSize: 12 }}>{d.registeredAt}</td>
                  <td style={{ padding: "12px 14px" }}>
                    <button onClick={() => setModal(d)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 6, borderRadius: 7, transition: "all 0.15s" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-card)"; (e.currentTarget as HTMLButtonElement).style.color = AA; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "none"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)"; }}
                    >
                      <Edit2 size={13} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {modal && (
        <DeviceModal
          initial={modal === "add" ? undefined : modal}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
