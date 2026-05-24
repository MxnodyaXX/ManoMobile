"use client";

import { useState } from "react";
import { Plus, Search, Edit2, X, Truck, Phone, Mail, MapPin, ExternalLink } from "lucide-react";
import { useAdmin, type Supplier, type SupplierCategory } from "@/admin/contexts/AdminContext";

const AA = "#a78bfa";
const ff = "'Plus Jakarta Sans', sans-serif";

const CATEGORIES: SupplierCategory[] = ["Parts", "Phones", "Accessories", "Equipment", "Services", "Other"];
const CAT_COLORS: Record<SupplierCategory, string> = {
  Parts: "#60a5fa", Phones: "#a78bfa", Accessories: "#f59e0b",
  Equipment: "#34d399", Services: "#f97316", Other: "#6b7280",
};

const BLANK: Omit<Supplier, "id"> = {
  name: "", contactPerson: "", phone: "", email: "", address: "",
  category: "Parts", vatNumber: "", paymentTerms: "Net 30", balance: 0,
  status: "Active", createdAt: new Date().toISOString().slice(0, 10),
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
  fontFamily: ff, marginBottom: 6, display: "block",
};

function SupplierModal({ initial, onSave, onClose }: {
  initial?: Supplier;
  onSave: (s: Omit<Supplier, "id"> | Supplier) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Omit<Supplier, "id">>(initial ? { ...initial } : { ...BLANK });
  const set = (k: keyof typeof form, v: any) => setForm(p => ({ ...p, [k]: v }));
  const valid = form.name.trim() && form.contactPerson.trim() && form.phone.trim() && form.email.trim();

  return (
    <>
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 70 }} onClick={onClose} />
      <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 71, padding: 20 }}>
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 18, padding: "28px 28px 24px", width: "100%", maxWidth: 540, display: "flex", flexDirection: "column", gap: 20, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 24px 64px rgba(0,0,0,0.5)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>{initial ? "Edit Supplier" : "Add Supplier"}</p>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}><X size={16} /></button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div style={{ gridColumn: "span 2" }}>
              <label style={lbl}>Company Name *</label>
              <input style={inp} value={form.name} onChange={e => set("name", e.target.value)} placeholder="TechParts Lanka (Pvt) Ltd" />
            </div>
            <div>
              <label style={lbl}>Contact Person *</label>
              <input style={inp} value={form.contactPerson} onChange={e => set("contactPerson", e.target.value)} placeholder="Mahesh Dias" />
            </div>
            <div>
              <label style={lbl}>Category</label>
              <select style={{ ...inp }} value={form.category} onChange={e => set("category", e.target.value as SupplierCategory)}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Phone *</label>
              <input style={inp} value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="011-234-5678" />
            </div>
            <div>
              <label style={lbl}>Email *</label>
              <input style={inp} type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="info@supplier.lk" />
            </div>
            <div style={{ gridColumn: "span 2" }}>
              <label style={lbl}>Address</label>
              <input style={inp} value={form.address} onChange={e => set("address", e.target.value)} placeholder="42, Galle Rd, Colombo 03" />
            </div>
            <div>
              <label style={lbl}>Payment Terms</label>
              <select style={{ ...inp }} value={form.paymentTerms} onChange={e => set("paymentTerms", e.target.value)}>
                {["COD", "Net 7", "Net 15", "Net 30", "Net 60", "Prepaid"].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>VAT Number</label>
              <input style={inp} value={form.vatNumber ?? ""} onChange={e => set("vatNumber", e.target.value)} placeholder="VAT-123456" />
            </div>
            <div>
              <label style={lbl}>AP Balance (Rs.)</label>
              <input style={inp} type="number" min={0} value={form.balance} onChange={e => set("balance", Number(e.target.value))} />
            </div>
            <div>
              <label style={lbl}>Status</label>
              <select style={{ ...inp }} value={form.status} onChange={e => set("status", e.target.value as "Active" | "Inactive")}>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", paddingTop: 4, borderTop: "1px solid var(--border)" }}>
            <button onClick={onClose} style={{ padding: "9px 18px", borderRadius: 9, background: "var(--bg-secondary)", border: "1px solid var(--border)", cursor: "pointer", fontSize: 12.5, fontWeight: 600, color: "var(--text-secondary)", fontFamily: ff }}>Cancel</button>
            <button disabled={!valid} onClick={() => valid && onSave(initial ? { ...form, id: initial.id } : form)} style={{ padding: "9px 20px", borderRadius: 9, background: valid ? `${AA}18` : "var(--bg-secondary)", border: `1px solid ${valid ? AA + "50" : "var(--border)"}`, cursor: valid ? "pointer" : "not-allowed", fontSize: 12.5, fontWeight: 700, color: valid ? AA : "var(--text-muted)", fontFamily: ff }}>
              {initial ? "Save Changes" : "Add Supplier"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default function Suppliers() {
  const { suppliers, addSupplier, updateSupplier } = useAdmin();
  const [query, setQuery]           = useState("");
  const [catFilter, setCatFilter]   = useState<SupplierCategory | "All">("All");
  const [statusFilter, setStatus]   = useState<"All" | "Active" | "Inactive">("All");
  const [modal, setModal]           = useState<"add" | Supplier | null>(null);

  const filtered = suppliers.filter(s => {
    const q = query.toLowerCase();
    const matchQ = !q || s.name.toLowerCase().includes(q) || s.contactPerson.toLowerCase().includes(q) || s.email.toLowerCase().includes(q);
    const matchC = catFilter === "All" || s.category === catFilter;
    const matchS = statusFilter === "All" || s.status === statusFilter;
    return matchQ && matchC && matchS;
  });

  const totalBalance = suppliers.reduce((acc, s) => acc + s.balance, 0);
  const activeCount  = suppliers.filter(s => s.status === "Active").length;

  const handleSave = (data: any) => {
    if (data.id) updateSupplier(data.id, data);
    else          addSupplier(data);
    setModal(null);
  };

  const filterBtn = (active: boolean): React.CSSProperties => ({
    padding: "6px 12px", borderRadius: 7, border: `1px solid ${active ? AA + "50" : "var(--border)"}`,
    background: active ? `${AA}12` : "var(--bg-card)", cursor: "pointer",
    fontSize: 11.5, fontWeight: active ? 700 : 500, color: active ? AA : "var(--text-secondary)",
    fontFamily: ff, transition: "all 0.15s",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, fontFamily: ff }}>

      <div className="fade-up" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em", marginBottom: 4, fontFamily: ff }}>Suppliers</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", fontFamily: ff }}>{activeCount} active · Rs. {totalBalance.toLocaleString()} total AP balance</p>
        </div>
        <button onClick={() => setModal("add")} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 9, background: `${AA}18`, border: `1px solid ${AA}40`, cursor: "pointer", fontSize: 12.5, fontWeight: 700, color: AA, fontFamily: ff }}>
          <Plus size={14} /> Add Supplier
        </button>
      </div>

      {/* Filters */}
      <div className="fade-up" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 9, padding: "0 12px", flex: "0 0 240px" }}>
          <Search size={13} color="var(--text-muted)" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search suppliers…" style={{ background: "none", border: "none", outline: "none", fontSize: 12.5, color: "var(--text-primary)", fontFamily: ff, padding: "9px 0", width: "100%" }} />
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {(["All", ...CATEGORIES] as const).map(c => (
            <button key={c} onClick={() => setCatFilter(c as any)} style={filterBtn(catFilter === c)}>{c}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
          {(["All", "Active", "Inactive"] as const).map(s => (
            <button key={s} onClick={() => setStatus(s)} style={filterBtn(statusFilter === s)}>{s}</button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="fade-up" style={{ borderRadius: 14, border: "1px solid var(--border)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)" }}>
              {["Supplier", "Category", "Contact", "Payment Terms", "AP Balance", "Status", ""].map(h => (
                <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600, fontFamily: ff }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: "48px 0", textAlign: "center", color: "var(--text-muted)", fontFamily: ff }}>No suppliers found</td></tr>
            ) : filtered.map((s, i) => (
              <tr key={s.id} style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "transparent" : "var(--bg-secondary)" }}>
                <td style={{ padding: "12px 14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 9, background: `${CAT_COLORS[s.category]}15`, border: `1px solid ${CAT_COLORS[s.category]}30`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Truck size={14} color={CAT_COLORS[s.category]} />
                    </div>
                    <div>
                      <p style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>{s.name}</p>
                      {s.vatNumber && <p style={{ fontSize: 10.5, color: "var(--text-muted)", fontFamily: ff }}>{s.vatNumber}</p>}
                    </div>
                  </div>
                </td>
                <td style={{ padding: "12px 14px" }}>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 20, background: `${CAT_COLORS[s.category]}12`, color: CAT_COLORS[s.category], border: `1px solid ${CAT_COLORS[s.category]}25`, fontFamily: ff }}>
                    {s.category}
                  </span>
                </td>
                <td style={{ padding: "12px 14px" }}>
                  <p style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)", fontFamily: ff }}>{s.contactPerson}</p>
                  <div style={{ display: "flex", gap: 10, marginTop: 2 }}>
                    <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: ff, display: "flex", alignItems: "center", gap: 3 }}><Phone size={9} />{s.phone}</span>
                    <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: ff, display: "flex", alignItems: "center", gap: 3 }}><Mail size={9} />{s.email}</span>
                  </div>
                </td>
                <td style={{ padding: "12px 14px", color: "var(--text-secondary)", fontFamily: ff }}>{s.paymentTerms}</td>
                <td style={{ padding: "12px 14px" }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: s.balance > 0 ? "#f59e0b" : "var(--text-muted)", fontFamily: ff }}>
                    Rs. {s.balance.toLocaleString()}
                  </span>
                </td>
                <td style={{ padding: "12px 14px" }}>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 20, fontFamily: ff,
                    background: s.status === "Active" ? "rgba(52,211,153,0.1)" : "rgba(107,114,128,0.1)",
                    color: s.status === "Active" ? "#34d399" : "#6b7280",
                    border: `1px solid ${s.status === "Active" ? "rgba(52,211,153,0.25)" : "rgba(107,114,128,0.2)"}`,
                  }}>{s.status}</span>
                </td>
                <td style={{ padding: "12px 14px" }}>
                  <button onClick={() => setModal(s)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 6, borderRadius: 7, transition: "all 0.15s" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-card)"; (e.currentTarget as HTMLButtonElement).style.color = AA; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "none"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)"; }}
                  >
                    <Edit2 size={13} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <SupplierModal
          initial={modal === "add" ? undefined : modal}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
