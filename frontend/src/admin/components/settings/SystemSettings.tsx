"use client";

import { useState } from "react";
import { Settings, Clock, Save, Check, User, Shield } from "lucide-react";
import { useAdmin, type SystemSettings as SS } from "@/admin/contexts/AdminContext";

const AA = "#a78bfa";
const ff = "'Plus Jakarta Sans', sans-serif";

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

function SectionHead({ title }: { title: string }) {
  return (
    <div style={{ padding: "6px 0 10px", borderBottom: "1px solid var(--border)", marginBottom: 14 }}>
      <span style={{ fontSize: 10.5, fontWeight: 700, color: AA, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: ff }}>{title}</span>
    </div>
  );
}

function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "var(--bg-secondary)", borderRadius: 9, border: "1px solid var(--border)" }}>
      <span style={{ fontSize: 12.5, color: "var(--text-primary)", fontFamily: ff }}>{label}</span>
      <button onClick={() => onChange(!value)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: value ? AA : "var(--text-muted)", transition: "color 0.2s", display: "flex", alignItems: "center" }}>
        <div style={{ width: 38, height: 20, borderRadius: 10, background: value ? `${AA}30` : "var(--bg-card)", border: `1px solid ${value ? AA + "50" : "var(--border)"}`, position: "relative", transition: "all 0.2s" }}>
          <div style={{ width: 14, height: 14, borderRadius: 7, background: value ? AA : "var(--text-muted)", position: "absolute", top: 2, left: value ? 21 : 3, transition: "left 0.2s" }} />
        </div>
      </button>
    </div>
  );
}

export default function SystemSettings() {
  const { settings, updateSettings, auditLog } = useAdmin();
  const [tab, setTab]   = useState<"settings" | "audit">("settings");
  const [form, setForm] = useState<SS>({ ...settings });
  const [saved, setSaved] = useState(false);

  const set = (k: keyof SS, v: any) => { setForm(p => ({ ...p, [k]: v })); setSaved(false); };

  const save = () => {
    updateSettings(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const ROLE_COLORS: Record<string, string> = { Admin: "#a78bfa", Cashier: "#6355ff", Technician: "#34d399", Accounts: "#f59e0b", Procurement: "#60a5fa" };

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: active ? 700 : 500,
    color: active ? AA : "var(--text-secondary)", background: active ? `${AA}12` : "transparent",
    border: `1px solid ${active ? AA + "45" : "transparent"}`, cursor: "pointer", fontFamily: ff, transition: "all 0.15s",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, fontFamily: ff }}>

      <div className="fade-up" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em", marginBottom: 4, fontFamily: ff }}>System Settings</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", fontFamily: ff }}>Business configuration and system audit trail</p>
        </div>
        {tab === "settings" && (
          <button onClick={save} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 9, background: saved ? "rgba(52,211,153,0.15)" : `${AA}18`, border: `1px solid ${saved ? "rgba(52,211,153,0.4)" : AA + "40"}`, cursor: "pointer", fontSize: 12.5, fontWeight: 700, color: saved ? "#34d399" : AA, fontFamily: ff, transition: "all 0.2s" }}>
            {saved ? <Check size={13} /> : <Save size={13} />}
            {saved ? "Saved" : "Save Changes"}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="fade-up" style={{ display: "flex", gap: 4, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, padding: 4, width: "fit-content" }}>
        <button onClick={() => setTab("settings")} style={tabStyle(tab === "settings")}>Settings</button>
        <button onClick={() => setTab("audit")} style={tabStyle(tab === "audit")}>Audit Log ({auditLog.length})</button>
      </div>

      {/* ── Settings ── */}
      {tab === "settings" && (
        <div className="fade-up" style={{ display: "flex", flexDirection: "column", gap: 22 }}>

          {/* Business Identity */}
          <div style={{ padding: "20px 22px", background: "var(--bg-card)", borderRadius: 14, border: "1px solid var(--border)" }}>
            <SectionHead title="Business Identity" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label style={lbl}>Business Name</label>
                <input style={inp} value={form.businessName} onChange={e => set("businessName", e.target.value)} />
              </div>
              <div>
                <label style={lbl}>Legal Name</label>
                <input style={inp} value={form.legalName} onChange={e => set("legalName", e.target.value)} />
              </div>
              <div style={{ gridColumn: "span 2" }}>
                <label style={lbl}>Address</label>
                <input style={inp} value={form.address} onChange={e => set("address", e.target.value)} />
              </div>
              <div>
                <label style={lbl}>Phone</label>
                <input style={inp} value={form.phone} onChange={e => set("phone", e.target.value)} />
              </div>
              <div>
                <label style={lbl}>Email</label>
                <input style={inp} type="email" value={form.email} onChange={e => set("email", e.target.value)} />
              </div>
              <div>
                <label style={lbl}>Website</label>
                <input style={inp} value={form.website ?? ""} onChange={e => set("website", e.target.value)} placeholder="www.manomobile.lk" />
              </div>
              <div>
                <label style={lbl}>VAT Number</label>
                <input style={inp} value={form.vatNumber} onChange={e => set("vatNumber", e.target.value)} />
              </div>
            </div>
          </div>

          {/* Financial */}
          <div style={{ padding: "20px 22px", background: "var(--bg-card)", borderRadius: 14, border: "1px solid var(--border)" }}>
            <SectionHead title="Financial" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
              <div>
                <label style={lbl}>Currency Code</label>
                <input style={inp} value={form.currency} onChange={e => set("currency", e.target.value)} placeholder="LKR" />
              </div>
              <div>
                <label style={lbl}>Currency Symbol</label>
                <input style={inp} value={form.currencySymbol} onChange={e => set("currencySymbol", e.target.value)} placeholder="Rs." />
              </div>
              <div>
                <label style={lbl}>VAT Rate (%)</label>
                <input style={inp} type="number" min={0} max={100} value={form.vatRate} onChange={e => set("vatRate", Number(e.target.value))} />
              </div>
              <div>
                <label style={lbl}>Fiscal Year Start</label>
                <select style={{ ...inp }} value={form.fiscalYearStart} onChange={e => set("fiscalYearStart", e.target.value)}>
                  {["January","February","March","April","May","June","July","August","September","October","November","December"].map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={lbl}>Timezone</label>
                <input style={inp} value={form.timezone} onChange={e => set("timezone", e.target.value)} placeholder="Asia/Colombo" />
              </div>
            </div>
          </div>

          {/* Operations */}
          <div style={{ padding: "20px 22px", background: "var(--bg-card)", borderRadius: 14, border: "1px solid var(--border)" }}>
            <SectionHead title="Operations" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={lbl}>Default Warranty (days)</label>
                <input style={inp} type="number" min={0} value={form.warrantyDays} onChange={e => set("warrantyDays", Number(e.target.value))} />
              </div>
              <div>
                <label style={lbl}>Low Stock Threshold (units)</label>
                <input style={inp} type="number" min={1} value={form.lowStockThreshold} onChange={e => set("lowStockThreshold", Number(e.target.value))} />
              </div>
              <div style={{ gridColumn: "span 2" }}>
                <label style={lbl}>Receipt Footer</label>
                <textarea style={{ ...inp, resize: "vertical", minHeight: 60 }} value={form.receiptFooter} onChange={e => set("receiptFooter", e.target.value)} />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14 }}>
              <Toggle value={form.requireDiscountAuth} onChange={v => set("requireDiscountAuth", v)} label="Require authorisation for discounts" />
              <Toggle value={form.autoBackup} onChange={v => set("autoBackup", v)} label="Auto-backup daily" />
            </div>
          </div>
        </div>
      )}

      {/* ── Audit Log ── */}
      {tab === "audit" && (
        <div className="fade-up" style={{ borderRadius: 14, border: "1px solid var(--border)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)" }}>
                {["User", "Module", "Action", "Detail", "Time"].map(h => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600, fontFamily: ff }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {auditLog.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: "48px 0", textAlign: "center", color: "var(--text-muted)", fontFamily: ff }}>No audit entries</td></tr>
              ) : auditLog.map((e, i) => (
                <tr key={e.id} style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "transparent" : "var(--bg-secondary)" }}>
                  <td style={{ padding: "11px 14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: `${ROLE_COLORS[e.role] ?? AA}14`, border: `1px solid ${ROLE_COLORS[e.role] ?? AA}25`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: ROLE_COLORS[e.role] ?? AA, fontFamily: ff, flexShrink: 0 }}>
                        {e.user[0]}
                      </div>
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", fontFamily: ff }}>{e.user}</p>
                        <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 20, background: `${ROLE_COLORS[e.role] ?? AA}12`, color: ROLE_COLORS[e.role] ?? AA, fontFamily: ff }}>{e.role}</span>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "11px 14px", color: "var(--text-secondary)", fontFamily: ff }}>{e.module}</td>
                  <td style={{ padding: "11px 14px", fontWeight: 600, color: "var(--text-primary)", fontFamily: ff }}>{e.action}</td>
                  <td style={{ padding: "11px 14px", color: "var(--text-muted)", fontFamily: ff, fontSize: 12 }}>{e.detail}</td>
                  <td style={{ padding: "11px 14px", color: "var(--text-muted)", fontFamily: ff, fontSize: 11.5, whiteSpace: "nowrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <Clock size={10} />
                      {e.timestamp.split(" ")[1] ?? e.timestamp}
                    </div>
                    <p style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: ff, marginTop: 1 }}>{e.timestamp.split(" ")[0]}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
