"use client";

import { useState } from "react";
import { Plus, Search, Edit2, X, UserCheck, UserX, AlertCircle, KeyRound } from "lucide-react";
import StaffPermissionsEditor from "@/admin/components/permissions/StaffPermissionsEditor";
import { useIsMobile } from "@/cashier/hooks/useIsMobile";
import {
  useStaff, createStaff, updateStaff,
  type StaffProfile, type StaffRoleName, type StaffStatusName,
} from "@/lib/staff/api";
import { useToast } from "@/lib/ui/toast";

const AA = "#a78bfa";
const ff = "'Plus Jakarta Sans', sans-serif";

/** Must match the staff_role enum in the database — anything else fails on save. */
const ROLES: StaffRoleName[] = ["Admin", "Cashier", "Technician", "Accounts"];

const ROLE_COLORS: Record<StaffRoleName, string> = {
  Admin: "#a78bfa", Cashier: "#6355ff", Technician: "#34d399", Accounts: "#f59e0b",
};
const STATUS_COLORS: Record<StaffStatusName, { bg: string; text: string; border: string }> = {
  Active:    { bg: "rgba(52,211,153,0.1)",  text: "#34d399", border: "rgba(52,211,153,0.25)"  },
  Inactive:  { bg: "rgba(107,114,128,0.1)", text: "#9ca3af", border: "rgba(107,114,128,0.25)" },
  Suspended: { bg: "rgba(248,113,113,0.1)", text: "#f87171", border: "rgba(248,113,113,0.25)" },
};

const inp: React.CSSProperties = {
  background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 8,
  padding: "9px 12px", fontSize: 12.5, color: "var(--text-primary)", fontFamily: ff,
  outline: "none", width: "100%", boxSizing: "border-box",
};
const lbl: React.CSSProperties = {
  fontSize: 10.5, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase",
  letterSpacing: "0.05em", fontFamily: ff, marginBottom: 6, display: "block",
};

/**
 * Add or edit a staff member.
 *
 * Adding creates a real login (email + password), because a technician who
 * cannot sign in is not on the rota. Editing never touches the password —
 * that is reset from Supabase Auth.
 */
function StaffModal({ initial, onSaved, onClose }: {
  initial?: StaffProfile;
  onSaved: () => void;
  onClose: () => void;
}) {
  const editing = Boolean(initial);
  const [fullName, setFullName] = useState(initial?.fullName ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<StaffRoleName>(initial?.role ?? "Technician");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [speciality, setSpeciality] = useState(initial?.speciality ?? "");
  const [status, setStatus] = useState<StaffStatusName>(initial?.status ?? "Active");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  const valid = editing
    ? fullName.trim().length > 0
    : fullName.trim() && email.trim().includes("@") && password.length >= 8;

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      if (editing && initial) {
        await updateStaff(initial.id, {
          fullName: fullName.trim(), role, phone: phone.trim(), speciality: speciality.trim(), status,
        });
      } else {
        const res = await createStaff({
          email: email.trim(), password, fullName: fullName.trim(), role,
          phone: phone.trim(), speciality: speciality.trim(),
        });
        if (!res.ok) { setError(res.error ?? "Could not add the staff member."); return; }
      }
      toast.dialog("success", editing ? "Staff member updated" : "Staff member added",
        editing ? fullName.trim() : `${fullName.trim()} can sign in with the email and password you set.`);
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 70 }} onClick={onClose} />
      <div style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
        width: "min(520px, calc(100vw - 24px))", maxHeight: "90vh", overflowY: "auto",
        background: "var(--bg-card)", borderRadius: 16, border: "1px solid var(--border)",
        zIndex: 71, boxShadow: "0 24px 64px rgba(0,0,0,0.5)", fontFamily: ff,
      }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>
            {editing ? "Edit Staff Member" : "Add New Staff"}
          </p>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}><X size={15} /></button>
        </div>

        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={lbl}>Full Name *</label>
              <input value={fullName} onChange={e => setFullName(e.target.value)} style={inp} placeholder="Kamal Rajapaksa" />
            </div>
            <div>
              <label style={lbl}>Role</label>
              <select value={role} onChange={e => setRole(e.target.value as StaffRoleName)} style={{ ...inp, cursor: "pointer" }}>
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            <div>
              <label style={lbl}>Email {editing ? "" : "*"}</label>
              <input
                value={email}
                onChange={e => setEmail(e.target.value)}
                disabled={editing}
                style={{ ...inp, opacity: editing ? 0.6 : 1 }}
                placeholder="name@manomobile.lk"
              />
            </div>
            <div>
              <label style={lbl}>Phone</label>
              <input value={phone} onChange={e => setPhone(e.target.value)} style={inp} placeholder="071 234 5678" />
            </div>

            {!editing && (
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={lbl}>Password * (minimum 8 characters)</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} style={inp} placeholder="Set their first password" />
              </div>
            )}

            {role === "Technician" && (
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={lbl}>Speciality</label>
                <input value={speciality} onChange={e => setSpeciality(e.target.value)} style={inp} placeholder="Screen & Battery" />
              </div>
            )}

            {editing && (
              <div>
                <label style={lbl}>Status</label>
                <select value={status} onChange={e => setStatus(e.target.value as StaffStatusName)} style={{ ...inp, cursor: "pointer" }}>
                  {(["Active", "Inactive", "Suspended"] as StaffStatusName[]).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}
          </div>

          {!editing && (
            <p style={{ display: "flex", gap: 7, fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.5 }}>
              <KeyRound size={13} style={{ flexShrink: 0, marginTop: 1 }} />
              This creates a login they can use straight away. Jobs are matched to a technician by
              name, so use the name that should appear on job cards.
            </p>
          )}

          {error && (
            <div style={{ display: "flex", gap: 8, padding: "9px 12px", borderRadius: 9, background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.35)" }}>
              <AlertCircle size={14} color="#f87171" style={{ flexShrink: 0, marginTop: 1 }} />
              <p style={{ fontSize: 12, color: "#f87171", fontWeight: 600 }}>{error}</p>
            </div>
          )}

          {/* Only on an existing person: permissions are keyed by profile id,
              and a new staff member has none until they are created. */}
          {editing && initial && (
            <StaffPermissionsEditor profileId={initial.id} role={role} />
          )}

          <button
            onClick={save}
            disabled={!valid || busy}
            style={{
              padding: "11px", borderRadius: 10, border: "none", fontSize: 13, fontWeight: 600,
              background: valid && !busy ? AA : "var(--bg-secondary)",
              color: valid && !busy ? "#fff" : "var(--text-muted)",
              cursor: valid && !busy ? "pointer" : "not-allowed", fontFamily: ff,
            }}
          >
            {busy ? "Saving…" : editing ? "Save Changes" : "Add Staff Member"}
          </button>
        </div>
      </div>
    </>
  );
}

export default function StaffManagement() {
  const { staff, loading, error, reload, configured } = useStaff();
  const toast = useToast();
  const isMobile = useIsMobile();
  const [query, setQuery] = useState("");
  const [roleFilter, setRole] = useState<StaffRoleName | "All">("All");
  const [modal, setModal] = useState<"add" | StaffProfile | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const filtered = staff.filter(s =>
    (roleFilter === "All" || s.role === roleFilter) &&
    (s.fullName.toLowerCase().includes(query.toLowerCase()) ||
     (s.email ?? "").toLowerCase().includes(query.toLowerCase()))
  );

  const setStatus = async (s: StaffProfile, status: StaffStatusName) => {
    setActionError(null);
    try {
      await updateStaff(s.id, { status });
      await reload();
      toast.success(`${s.fullName} is now ${status}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setActionError(msg);
      toast.error("Could not update the staff member", msg);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, fontFamily: ff }}>
      <div className="fade-up" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em", marginBottom: 4 }}>Staff Management</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
            {staff.filter(s => s.status === "Active").length} active · {staff.length} total
          </p>
        </div>
        <button onClick={() => setModal("add")} style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 18px", borderRadius: 10, border: "none", background: AA, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: ff }}>
          <Plus size={14} /> Add Staff
        </button>
      </div>

      {(!configured || error || actionError) && (
        <div className="fade-up" style={{ display: "flex", gap: 9, padding: "11px 14px", borderRadius: 10, background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.4)" }}>
          <AlertCircle size={15} color="#fbbf24" style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.55 }}>
            {!configured
              ? "Connect Supabase to manage staff — this list comes from the staff directory."
              : actionError ?? error}
          </p>
        </div>
      )}

      {/* Filters */}
      <div className="fade-up" style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 14px", borderRadius: 10, background: "var(--bg-card)", border: "1px solid var(--border)", height: 38, flex: isMobile ? undefined : 1, minWidth: 200 }}>
          <Search size={13} color="var(--text-muted)" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by name or email…" style={{ border: "none", background: "none", outline: "none", fontSize: 12.5, color: "var(--text-primary)", fontFamily: ff, flex: 1 }} />
        </div>
        <div className={isMobile ? "tabs-scroll" : undefined}>
          <div style={{ display: "flex", gap: 6, width: "fit-content" }}>
            {(["All", ...ROLES] as const).map(r => (
              <button key={r} onClick={() => setRole(r as StaffRoleName | "All")} style={{
                padding: "8px 14px", borderRadius: 9, fontSize: 12, fontWeight: roleFilter === r ? 600 : 400,
                border: `1px solid ${roleFilter === r ? (ROLE_COLORS[r as StaffRoleName] || AA) + "40" : "var(--border)"}`,
                background: roleFilter === r ? `${ROLE_COLORS[r as StaffRoleName] || AA}12` : "var(--bg-card)",
                color: roleFilter === r ? (ROLE_COLORS[r as StaffRoleName] || AA) : "var(--text-secondary)",
                cursor: "pointer", fontFamily: ff, whiteSpace: "nowrap",
              }}>
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
                <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ padding: "48px 0", textAlign: "center", color: "var(--text-muted)" }}>Loading staff…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: "48px 0", textAlign: "center", color: "var(--text-muted)" }}>
                {staff.length === 0 ? "No staff yet — add your technicians and cashiers to get started." : "No staff match this filter"}
              </td></tr>
            ) : filtered.map((s, i) => {
              const sc = STATUS_COLORS[s.status];
              const rc = ROLE_COLORS[s.role] ?? AA;
              return (
                <tr key={s.id} style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "transparent" : "var(--bg-secondary)" }}>
                  <td style={{ padding: "12px 14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: `${rc}14`, border: `1px solid ${rc}25`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: rc, flexShrink: 0 }}>
                        {s.fullName.charAt(0).toUpperCase() || "?"}
                      </div>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{s.fullName || "(no name)"}</p>
                        <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{s.staffId ?? s.speciality ?? ""}</p>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    <span style={{ fontSize: 11.5, fontWeight: 600, padding: "3px 9px", borderRadius: 20, background: `${rc}14`, color: rc, border: `1px solid ${rc}25` }}>{s.role}</span>
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    <p style={{ fontSize: 12.5, color: "var(--text-primary)" }}>{s.email ?? "—"}</p>
                    <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{s.phone ?? ""}</p>
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    <span style={{ fontSize: 11.5, fontWeight: 600, padding: "3px 9px", borderRadius: 20, background: sc.bg, color: sc.text, border: `1px solid ${sc.border}` }}>{s.status}</span>
                  </td>
                  <td style={{ padding: "12px 14px", color: "var(--text-secondary)", fontSize: 12 }}>{s.joinDate ?? "—"}</td>
                  <td style={{ padding: "12px 14px", color: "var(--text-muted)", fontSize: 12 }}>
                    {s.lastLogin ? new Date(s.lastLogin).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "Never"}
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => setModal(s)} title="Edit" style={{ width: 30, height: 30, borderRadius: 7, border: `1px solid ${AA}30`, background: `${AA}10`, color: AA, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Edit2 size={12} />
                      </button>
                      <button
                        onClick={() => setStatus(s, s.status === "Active" ? "Suspended" : "Active")}
                        title={s.status === "Active" ? "Suspend — they keep their history but cannot sign in or take jobs" : "Reactivate"}
                        style={{
                          width: 30, height: 30, borderRadius: 7, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                          border: `1px solid ${s.status === "Active" ? "rgba(248,113,113,0.3)" : "rgba(52,211,153,0.3)"}`,
                          background: s.status === "Active" ? "rgba(248,113,113,0.1)" : "rgba(52,211,153,0.1)",
                          color: s.status === "Active" ? "#f87171" : "#34d399",
                        }}
                      >
                        {s.status === "Active" ? <UserX size={12} /> : <UserCheck size={12} />}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {modal === "add" && <StaffModal onSaved={reload} onClose={() => setModal(null)} />}
      {modal && modal !== "add" && <StaffModal initial={modal} onSaved={reload} onClose={() => setModal(null)} />}
    </div>
  );
}
