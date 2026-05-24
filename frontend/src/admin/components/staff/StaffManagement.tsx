"use client";

import { useState } from "react";
import { Plus, Search, Edit2, Trash2, X, UserCheck, UserX } from "lucide-react";
import { useIsMobile } from "@/cashier/hooks/useIsMobile";
import { useAdmin, type StaffMember, type StaffRole, type StaffStatus } from "@/admin/contexts/AdminContext";

const AA = "#a78bfa";
const ff = "'Plus Jakarta Sans', sans-serif";

const ROLES: StaffRole[]   = ["Admin", "Cashier", "Technician", "Accounts", "Procurement"];
const ROLE_COLORS: Record<StaffRole, string> = { Admin: "#a78bfa", Cashier: "#6355ff", Technician: "#34d399", Accounts: "#f59e0b", Procurement: "#60a5fa" };
const STATUS_COLORS: Record<StaffStatus, { bg: string; text: string; border: string }> = {
  Active:    { bg: "rgba(52,211,153,0.1)",  text: "#34d399", border: "rgba(52,211,153,0.25)"  },
  Inactive:  { bg: "rgba(107,114,128,0.1)", text: "#9ca3af", border: "rgba(107,114,128,0.25)" },
  Suspended: { bg: "rgba(248,113,113,0.1)", text: "#f87171", border: "rgba(248,113,113,0.25)" },
};

const BLANK: Omit<StaffMember, "id"> = { name: "", role: "Cashier", email: "", phone: "", status: "Active", joinDate: "2026-05-22" };

function StaffModal({ initial, onSave, onClose }: { initial?: StaffMember; onSave: (s: any) => void; onClose: () => void }) {
  const [form, setForm] = useState<Omit<StaffMember, "id">>(initial ? { ...initial } : { ...BLANK });
  const set = (k: keyof typeof form, v: any) => setForm(p => ({ ...p, [k]: v }));
  const valid = form.name.trim() && form.email.trim() && form.phone.trim();

  const inp: React.CSSProperties = { background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 8, padding: "9px 12px", fontSize: 12.5, color: "var(--text-primary)", fontFamily: ff, outline: "none", width: "100%", boxSizing: "border-box" };
  const lbl: React.CSSProperties = { fontSize: 10.5, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: ff, marginBottom: 6, display: "block" };

  return (
    <>
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 70 }} onClick={onClose} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 480, background: "var(--bg-card)", borderRadius: 16, border: "1px solid var(--border)", zIndex: 71, boxShadow: "0 24px 64px rgba(0,0,0,0.5)", fontFamily: ff }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>{initial ? "Edit Staff Member" : "Add New Staff"}</p>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}><X size={15} /></button>
        </div>
        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div><label style={lbl}>Full Name</label><input value={form.name} onChange={e => set("name", e.target.value)} style={inp} placeholder="Kamal Rajapaksa" /></div>
            <div>
              <label style={lbl}>Role</label>
              <select value={form.role} onChange={e => set("role", e.target.value as StaffRole)} style={{ ...inp, cursor: "pointer" }}>
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div><label style={lbl}>Email</label><input value={form.email} onChange={e => set("email", e.target.value)} style={inp} placeholder="name@manomobile.lk" /></div>
            <div><label style={lbl}>Phone</label><input value={form.phone} onChange={e => set("phone", e.target.value)} style={inp} placeholder="071-XXX-XXXX" /></div>
            <div>
              <label style={lbl}>Status</label>
              <select value={form.status} onChange={e => set("status", e.target.value as StaffStatus)} style={{ ...inp, cursor: "pointer" }}>
                {(["Active","Inactive","Suspended"] as StaffStatus[]).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div><label style={lbl}>Join Date</label><input type="date" value={form.joinDate} onChange={e => set("joinDate", e.target.value)} style={inp} /></div>
          </div>
          <button onClick={() => { onSave(form); onClose(); }} disabled={!valid} style={{ padding: "11px", borderRadius: 10, border: "none", fontSize: 13, fontWeight: 600, background: valid ? AA : "var(--bg-secondary)", color: valid ? "#fff" : "var(--text-muted)", cursor: valid ? "pointer" : "not-allowed", fontFamily: ff }}>
            {initial ? "Save Changes" : "Add Staff Member"}
          </button>
        </div>
      </div>
    </>
  );
}

export default function StaffManagement() {
  const { staff, addStaff, updateStaff, removeStaff } = useAdmin();
  const isMobile = useIsMobile();
  const [query,    setQuery]    = useState("");
  const [roleFilter, setRole]  = useState<StaffRole | "All">("All");
  const [modal,    setModal]    = useState<"add" | StaffMember | null>(null);
  const [confirm,  setConfirm]  = useState<StaffMember | null>(null);

  const filtered = staff.filter(s =>
    (roleFilter === "All" || s.role === roleFilter) &&
    (s.name.toLowerCase().includes(query.toLowerCase()) || s.email.toLowerCase().includes(query.toLowerCase()))
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, fontFamily: ff }}>
      <div className="fade-up" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em", marginBottom: 4, fontFamily: ff }}>Staff Management</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", fontFamily: ff }}>{staff.filter(s=>s.status==="Active").length} active · {staff.length} total</p>
        </div>
        <button onClick={() => setModal("add")} style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 18px", borderRadius: 10, border: "none", background: AA, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: ff }}>
          <Plus size={14} /> Add Staff
        </button>
      </div>

      {/* Filters */}
      <div className="fade-up" style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 14px", borderRadius: 10, background: "var(--bg-card)", border: "1px solid var(--border)", height: 38, flex: isMobile ? undefined : 1, minWidth: 200 }}>
          <Search size={13} color="var(--text-muted)" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by name or email…" style={{ border: "none", background: "none", outline: "none", fontSize: 12.5, color: "var(--text-primary)", fontFamily: ff, flex: 1 }} />
        </div>
        <div className={isMobile ? "tabs-scroll" : undefined}>
        <div style={{ display: "flex", gap: 6, width: "fit-content" }}>
          {(["All", ...ROLES] as const).map(r => (
            <button key={r} onClick={() => setRole(r as any)} style={{ padding: "8px 14px", borderRadius: 9, fontSize: 12, fontWeight: roleFilter === r ? 600 : 400, border: `1px solid ${roleFilter === r ? (ROLE_COLORS[r as StaffRole] || AA) + "40" : "var(--border)"}`, background: roleFilter === r ? `${ROLE_COLORS[r as StaffRole] || AA}12` : "var(--bg-card)", color: roleFilter === r ? (ROLE_COLORS[r as StaffRole] || AA) : "var(--text-secondary)", cursor: "pointer", fontFamily: ff, whiteSpace: "nowrap" }}>
              {r}
            </button>
          ))}
        </div>
        </div>
      </div>

      {/* Table */}
      <div className="fade-up" style={{ borderRadius: 14, border: "1px solid var(--border)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)" }}>
              {["Staff Member", "Role", "Contact", "Status", "Joined", "Last Login", "Actions"].map(h => (
                <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600, fontFamily: ff }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: "48px 0", textAlign: "center", color: "var(--text-muted)", fontFamily: ff }}>No staff found</td></tr>
            ) : filtered.map((s, i) => {
              const sc = STATUS_COLORS[s.status];
              const rc = ROLE_COLORS[s.role];
              return (
                <tr key={s.id} style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "transparent" : "var(--bg-secondary)" }}>
                  <td style={{ padding: "12px 14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: `${rc}14`, border: `1px solid ${rc}25`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: rc, flexShrink: 0 }}>
                        {s.name[0]}
                      </div>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", fontFamily: ff }}>{s.name}</p>
                        <p style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: ff }}>{s.id}</p>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    <span style={{ fontSize: 11.5, fontWeight: 600, padding: "3px 9px", borderRadius: 20, background: `${rc}14`, color: rc, border: `1px solid ${rc}25`, fontFamily: ff }}>{s.role}</span>
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    <p style={{ fontSize: 12.5, color: "var(--text-primary)", fontFamily: ff }}>{s.email}</p>
                    <p style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: ff }}>{s.phone}</p>
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    <span style={{ fontSize: 11.5, fontWeight: 600, padding: "3px 9px", borderRadius: 20, background: sc.bg, color: sc.text, border: `1px solid ${sc.border}`, fontFamily: ff }}>{s.status}</span>
                  </td>
                  <td style={{ padding: "12px 14px", color: "var(--text-secondary)", fontSize: 12, fontFamily: ff }}>{s.joinDate}</td>
                  <td style={{ padding: "12px 14px", color: "var(--text-muted)", fontSize: 12, fontFamily: ff }}>{s.lastLogin ?? "—"}</td>
                  <td style={{ padding: "12px 14px" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => setModal(s)} title="Edit" style={{ width: 30, height: 30, borderRadius: 7, border: `1px solid ${AA}30`, background: `${AA}10`, color: AA, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Edit2 size={12} /></button>
                      <button onClick={() => updateStaff(s.id, { status: s.status === "Active" ? "Suspended" : "Active" })} title={s.status === "Active" ? "Suspend" : "Activate"} style={{ width: 30, height: 30, borderRadius: 7, border: `1px solid ${s.status==="Active"?"rgba(248,113,113,0.3)":"rgba(52,211,153,0.3)"}`, background: s.status==="Active"?"rgba(248,113,113,0.1)":"rgba(52,211,153,0.1)", color: s.status==="Active"?"#f87171":"#34d399", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {s.status === "Active" ? <UserX size={12} /> : <UserCheck size={12} />}
                      </button>
                      <button onClick={() => setConfirm(s)} title="Remove" style={{ width: 30, height: 30, borderRadius: 7, border: "1px solid rgba(248,113,113,0.25)", background: "rgba(248,113,113,0.08)", color: "#f87171", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Trash2 size={12} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modals */}
      {modal === "add" && <StaffModal onSave={addStaff} onClose={() => setModal(null)} />}
      {modal && modal !== "add" && <StaffModal initial={modal} onSave={patch => updateStaff(modal.id, patch)} onClose={() => setModal(null)} />}

      {confirm && (
        <>
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 70 }} onClick={() => setConfirm(null)} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 380, background: "var(--bg-card)", borderRadius: 16, border: "1px solid var(--border)", zIndex: 71, padding: 24, fontFamily: ff, boxShadow: "0 24px 64px rgba(0,0,0,0.5)" }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8, fontFamily: ff }}>Remove Staff Member?</p>
            <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 20, fontFamily: ff }}>This will permanently remove <strong style={{ color: "var(--text-primary)" }}>{confirm.name}</strong> from the system. This action cannot be undone.</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setConfirm(null)} style={{ flex: 1, padding: "10px", borderRadius: 9, border: "1px solid var(--border)", background: "var(--bg-secondary)", color: "var(--text-secondary)", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: ff }}>Cancel</button>
              <button onClick={() => { removeStaff(confirm.id); setConfirm(null); }} style={{ flex: 1, padding: "10px", borderRadius: 9, border: "none", background: "#f87171", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: ff }}>Remove</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
