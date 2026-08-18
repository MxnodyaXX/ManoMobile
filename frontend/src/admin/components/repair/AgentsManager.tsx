"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Search, Plus, Pencil, Trash2, Building2, AlertCircle } from "lucide-react";
import { useAgents, saveAgent, deleteAgent, type RepairAgent } from "@/lib/repair/agents";
import { useToast } from "@/lib/ui/toast";

const ff = "'Plus Jakarta Sans', sans-serif";
const today = () => new Date().toISOString().slice(0, 10);

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid var(--border)",
  background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 13,
  fontFamily: ff, outline: "none", boxSizing: "border-box",
};
const labelStyle: React.CSSProperties = {
  fontSize: 11.5, fontWeight: 700, color: "var(--text-secondary)", letterSpacing: "0.05em",
  textTransform: "uppercase", marginBottom: 5, display: "block", fontFamily: ff,
};
const thStyle: React.CSSProperties = {
  padding: "11px 14px", textAlign: "left", fontSize: 11, color: "var(--text-muted)",
  textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600,
  borderBottom: "1px solid var(--border)", whiteSpace: "nowrap",
};
const tdStyle: React.CSSProperties = {
  padding: "11px 14px", fontSize: 13, color: "var(--text-primary)",
  borderBottom: "1px solid var(--border)", verticalAlign: "middle",
};
const btnAccent: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 8,
  border: "none", background: "var(--accent)", color: "var(--accent-fg)",
  fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: ff, whiteSpace: "nowrap",
};

// ─── Add / edit ──────────────────────────────────────────────────────────────

function AgentModal({ agent, onSave, onClose }: {
  agent: RepairAgent | null;
  onSave: (a: RepairAgent) => Promise<void>;
  onClose: () => void;
}) {
  const blank: RepairAgent = {
    id: 0, name: "", contact: "", address: "", speciality: "",
    active: true, joinedAt: today(), remarks: "",
  };
  const [form, setForm] = useState<RepairAgent>(agent ?? blank);
  const [errors, setErrors] = useState<{ name?: string; contact?: string }>({});
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const set = <K extends keyof RepairAgent>(k: K, v: RepairAgent[K]) => {
    setForm(f => ({ ...f, [k]: v }));
    setErrors(p => ({ ...p, [k]: undefined }));
  };

  const handleSave = async () => {
    const e: typeof errors = {};
    if (!form.name.trim()) e.name = "Agent name is required";
    if (!form.contact.trim()) e.contact = "Contact number is required";
    setErrors(e);
    if (Object.keys(e).length) return;

    setBusy(true);
    setSaveError(null);
    try {
      await onSave({ ...form, name: form.name.trim(), contact: form.contact.trim(), address: form.address.trim() });
      onClose();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, zIndex: 1200, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
    >
      <div style={{ width: "min(520px, calc(100vw - 24px))", maxHeight: "90vh", overflow: "auto", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, fontFamily: ff, boxShadow: "0 24px 64px rgba(0,0,0,0.45)" }}>
        <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--border)" }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>
            {agent ? "Edit Repair Agent" : "Add Repair Agent"}
          </h3>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
            External workshops technicians can send devices out to.
          </p>
        </div>

        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 15 }}>
          <div>
            <label style={labelStyle}>Agent Name *</label>
            <input autoFocus value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. ChipLevel Labs"
              style={{ ...inputStyle, borderColor: errors.name ? "var(--danger)" : "var(--border)" }} />
            {errors.name && <div style={{ fontSize: 11, color: "var(--danger)", marginTop: 3 }}>{errors.name}</div>}
          </div>
          <div>
            <label style={labelStyle}>Contact Number *</label>
            <input value={form.contact} onChange={e => set("contact", e.target.value)} placeholder="+94 11 234 5678"
              style={{ ...inputStyle, borderColor: errors.contact ? "var(--danger)" : "var(--border)" }} />
            {errors.contact && <div style={{ fontSize: 11, color: "var(--danger)", marginTop: 3 }}>{errors.contact}</div>}
          </div>
          <div>
            <label style={labelStyle}>Speciality</label>
            <input value={form.speciality ?? ""} onChange={e => set("speciality", e.target.value)} placeholder="e.g. Motherboard / IC rework" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Address</label>
            <textarea value={form.address} onChange={e => set("address", e.target.value)} placeholder="e.g. 22 Station Road, Colombo 06" style={{ ...inputStyle, resize: "vertical", minHeight: 58 }} />
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Working since</label>
              <input type="date" max={today()} value={form.joinedAt} onChange={e => set("joinedAt", e.target.value)} style={inputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Status</label>
              <select value={form.active ? "Active" : "Inactive"} onChange={e => set("active", e.target.value === "Active")} style={{ ...inputStyle, cursor: "pointer" }}>
                <option>Active</option>
                <option>Inactive</option>
              </select>
            </div>
          </div>
          <div>
            <label style={labelStyle}>Remarks</label>
            <textarea value={form.remarks ?? ""} onChange={e => set("remarks", e.target.value)} placeholder="e.g. 3-day turnaround, 30-day workmanship guarantee" style={{ ...inputStyle, resize: "vertical", minHeight: 58 }} />
          </div>

          {saveError && (
            <div style={{ display: "flex", gap: 8, padding: "9px 12px", borderRadius: 9, background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.35)" }}>
              <AlertCircle size={14} color="var(--danger)" style={{ flexShrink: 0, marginTop: 1 }} />
              <p style={{ fontSize: 12, color: "var(--danger)", fontWeight: 600 }}>{saveError}</p>
            </div>
          )}
        </div>

        <div style={{ padding: "16px 24px 20px", borderTop: "1px solid var(--border)", display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "9px 20px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer", fontSize: 13, fontFamily: ff }}>Cancel</button>
          <button onClick={handleSave} disabled={busy} style={{ ...btnAccent, padding: "9px 20px", opacity: busy ? 0.7 : 1, cursor: busy ? "wait" : "pointer" }}>
            {busy ? "Saving…" : agent ? "Save Changes" : "Add Agent"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ─── Manager ─────────────────────────────────────────────────────────────────

/**
 * Admin's register of external repair agents. Technicians pick from this list
 * when transferring a device out, so an inactive agent disappears from their
 * picker without the historic transfers losing who did the work.
 */
export default function AgentsManager() {
  const { agents, loading, error, reload, configured } = useAgents();
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<RepairAgent | null | "new">(null);
  const [deleteTarget, setDeleteTarget] = useState<RepairAgent | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const q = search.trim().toLowerCase();
  const filtered = agents.filter(a =>
    !q || a.name.toLowerCase().includes(q) || (a.speciality ?? "").toLowerCase().includes(q) || a.contact.toLowerCase().includes(q)
  );

  const handleSave = async (a: RepairAgent) => {
    if (!configured) throw new Error("Supabase isn't configured — agents cannot be saved in demo mode.");
    const isEdit = agents.some(x => x.id === a.id);
    await saveAgent(a);
    await reload();
    toast.dialog("success", isEdit ? "Agent updated" : "Agent added", a.name);
  };

  const handleDelete = async (a: RepairAgent) => {
    setActionError(null);
    try {
      await deleteAgent(a.id);
      await reload();
      toast.dialog("success", "Agent deleted", `${a.name} has been removed.`);
      setDeleteTarget(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setActionError(msg);
      toast.error("Could not delete the agent", msg);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, fontFamily: ff }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 180, maxWidth: 380 }}>
          <Search size={13} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, speciality, contact…" style={{ ...inputStyle, paddingLeft: 34, fontSize: 12 }} />
        </div>
        <button onClick={() => setModal("new")} style={btnAccent}><Plus size={13} /> Add Agent</button>
      </div>

      {(error || actionError) && (
        <div style={{ display: "flex", gap: 9, padding: "11px 14px", borderRadius: 10, background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.35)" }}>
          <AlertCircle size={15} color="var(--danger)" style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>{actionError ?? error}</p>
        </div>
      )}

      {!configured && (
        <div style={{ display: "flex", gap: 9, padding: "11px 14px", borderRadius: 10, background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.4)" }}>
          <AlertCircle size={15} color="var(--warning)" style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>
            <strong style={{ color: "var(--warning)" }}>Demo mode.</strong> These are sample agents — connect Supabase to manage a real list.
          </p>
        </div>
      )}

      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", minWidth: 760, borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, width: 48 }}>#</th>
                <th style={thStyle}>Agent</th>
                <th style={thStyle}>Speciality</th>
                <th style={thStyle}>Contact</th>
                <th style={thStyle}>Since</th>
                <th style={thStyle}>Status</th>
                <th style={{ ...thStyle, width: 90 }}></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ ...tdStyle, textAlign: "center", padding: 36, color: "var(--text-muted)" }}>Loading agents…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} style={{ ...tdStyle, textAlign: "center", padding: 36, color: "var(--text-muted)" }}>
                  {search ? "No agents match" : "No repair agents yet — add the workshops you send devices to."}
                </td></tr>
              ) : filtered.map((a, i) => (
                <tr key={a.id}>
                  <td style={{ ...tdStyle, color: "var(--text-muted)", fontSize: 12 }}>{i + 1}</td>
                  <td style={tdStyle}>
                    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                      <div style={{ width: 30, height: 30, borderRadius: 8, background: "var(--accent-dim)", border: "1px solid var(--accent-glow)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent)", flexShrink: 0 }}>
                        <Building2 size={13} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 600 }}>{a.name}</div>
                        {a.address && <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{a.address}</div>}
                      </div>
                    </div>
                  </td>
                  <td style={{ ...tdStyle, color: "var(--text-secondary)" }}>{a.speciality || "—"}</td>
                  <td style={{ ...tdStyle, color: "var(--text-secondary)" }}>{a.contact}</td>
                  <td style={{ ...tdStyle, color: "var(--text-muted)", fontSize: 12 }}>{a.joinedAt}</td>
                  <td style={tdStyle}>
                    <span style={{
                      fontSize: 10.5, fontWeight: 700, padding: "2px 9px", borderRadius: 20,
                      background: a.active ? "rgba(52,211,153,0.12)" : "rgba(148,163,184,0.12)",
                      color: a.active ? "#16a34a" : "var(--text-muted)",
                    }}>
                      {a.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => setModal(a)} title="Edit" style={{ padding: "5px 7px", borderRadius: 7, background: "none", border: "1px solid var(--border)", color: "var(--text-muted)", cursor: "pointer" }}>
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => setDeleteTarget(a)} title="Delete" style={{ padding: "5px 7px", borderRadius: 7, background: "none", border: "1px solid var(--border)", color: "var(--text-muted)", cursor: "pointer" }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal !== null && (
        <AgentModal
          agent={modal === "new" ? null : modal}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}

      {deleteTarget && typeof document !== "undefined" && createPortal(
        <div
          onClick={e => { if (e.target === e.currentTarget) setDeleteTarget(null); }}
          style={{ position: "fixed", inset: 0, zIndex: 1250, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
        >
          <div style={{ width: "min(420px, calc(100vw - 24px))", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: "22px 24px", fontFamily: ff }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>Delete {deleteTarget.name}?</h3>
            <p style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.55, marginBottom: 18 }}>
              Agents with repairs recorded against them cannot be deleted — set them{" "}
              <strong>Inactive</strong> instead so past transfers keep their history.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setDeleteTarget(null)} style={{ padding: "9px 18px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer", fontSize: 13, fontFamily: ff }}>Cancel</button>
              <button onClick={() => handleDelete(deleteTarget)} style={{ padding: "9px 18px", borderRadius: 8, border: "none", background: "var(--danger)", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: ff }}>Delete</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
