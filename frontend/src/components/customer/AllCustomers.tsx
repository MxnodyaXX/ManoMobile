"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import {
  Search, Plus, UserCheck, UserX, X,
  Phone, Mail, Hash, Calendar, Wrench, ShoppingBag,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type CustomerStatus = "Active" | "Inactive";

interface Customer {
  id: string;
  name: string;
  phone: string;
  nic: string;
  email: string;
  address: string;
  totalJobs: number;
  totalSpent: number;
  memberSince: string;
  status: CustomerStatus;
  lastActivity: string;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const INITIAL_CUSTOMERS: Customer[] = [
  { id: "CU-001", name: "Kasun Perera",       phone: "+94 77 123 4567", nic: "942341567V", email: "kasun@email.com",   address: "45 Galle Rd, Colombo 3",       totalJobs: 4,  totalSpent: 62000,  memberSince: "2024-01-15", status: "Active",   lastActivity: "2025-04-22" },
  { id: "CU-002", name: "Nimali Silva",        phone: "+94 71 234 5678", nic: "951234890V", email: "nimali@email.com",  address: "12 Kandy Rd, Peradeniya",      totalJobs: 2,  totalSpent: 18000,  memberSince: "2024-03-20", status: "Active",   lastActivity: "2025-04-21" },
  { id: "CU-003", name: "Roshan Fernando",     phone: "+94 76 345 6789", nic: "900234789V", email: "",                  address: "7 Main St, Negombo",           totalJobs: 6,  totalSpent: 45000,  memberSince: "2023-11-05", status: "Active",   lastActivity: "2025-03-15" },
  { id: "CU-004", name: "Dilini Rajapaksa",    phone: "+94 70 456 7890", nic: "985678901V", email: "dilini@gmail.com",  address: "23 Flower Rd, Colombo 7",      totalJobs: 1,  totalSpent: 15000,  memberSince: "2025-01-10", status: "Active",   lastActivity: "2025-04-18" },
  { id: "CU-005", name: "Pradeep Jayawardena", phone: "+94 75 567 8901", nic: "870456123V", email: "",                  address: "88 Baseline Rd, Colombo 9",    totalJobs: 3,  totalSpent: 21000,  memberSince: "2024-06-18", status: "Active",   lastActivity: "2025-02-28" },
  { id: "CU-006", name: "Samantha Bandara",    phone: "+94 78 678 9012", nic: "955678901V", email: "sam@email.com",     address: "14 Lake Dr, Kandy",            totalJobs: 5,  totalSpent: 73000,  memberSince: "2023-08-22", status: "Active",   lastActivity: "2025-04-21" },
  { id: "CU-007", name: "Chamara Wijesinghe",  phone: "+94 72 789 0123", nic: "881122334V", email: "chamara@mail.com",  address: "3 Baudhaloka Mw, Colombo 7",   totalJobs: 2,  totalSpent: 9000,   memberSince: "2025-02-14", status: "Active",   lastActivity: "2025-04-20" },
  { id: "CU-008", name: "Isuru Madushanka",    phone: "+94 74 890 1234", nic: "920789456V", email: "isuru@yahoo.com",   address: "56 Kirula Rd, Colombo 5",      totalJobs: 3,  totalSpent: 27500,  memberSince: "2024-09-03", status: "Active",   lastActivity: "2025-04-17" },
  { id: "CU-009", name: "Tharaka Pemalatha",   phone: "+94 77 901 2345", nic: "860345678V", email: "",                  address: "22 Hospital Rd, Ratnapura",    totalJobs: 1,  totalSpent: 6000,   memberSince: "2025-03-30", status: "Inactive", lastActivity: "2025-03-30" },
  { id: "CU-010", name: "Nimesha Rodrigo",     phone: "+94 71 012 3456", nic: "930901234V", email: "nimesha@email.com", address: "9 Duplication Rd, Colombo 3",  totalJobs: 7,  totalSpent: 115000, memberSince: "2023-05-11", status: "Active",   lastActivity: "2025-04-19" },
];

// ─── Customer Detail Modal ────────────────────────────────────────────────────

function CustomerDetailModal({ customer, onClose }: { customer: Customer; onClose: () => void }) {
  const sc = customer.status === "Active"
    ? { color: "#4ade80", bg: "rgba(74,222,128,0.08)",  border: "rgba(74,222,128,0.25)",  icon: UserCheck }
    : { color: "#f87171", bg: "rgba(248,113,113,0.08)", border: "rgba(248,113,113,0.25)", icon: UserX };
  const StatusIcon = sc.icon;

  return createPortal(
    <div
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, width: "min(480px, calc(100vw - 24px))", boxShadow: "0 24px 64px rgba(0,0,0,0.45)", display: "flex", flexDirection: "column", overflow: "hidden" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderBottom: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--accent)" }}>{customer.id}</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 9px", borderRadius: 7, background: sc.bg, border: `1px solid ${sc.border}`, color: sc.color, fontSize: 11, fontWeight: 600 }}>
              <StatusIcon size={9} strokeWidth={2.5} />{customer.status}
            </span>
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={14} />
          </button>
        </div>

        <div style={{ padding: "18px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
          <p style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>{customer.name}</p>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { icon: Phone,    label: "Phone",   val: customer.phone },
              { icon: Hash,     label: "NIC",     val: customer.nic || "—" },
              { icon: Mail,     label: "Email",   val: customer.email || "—" },
              { icon: Calendar, label: "Address", val: customer.address || "—" },
            ].map(r => {
              const Icon = r.icon;
              return (
                <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 7, background: "var(--bg-primary)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Icon size={12} color="var(--text-muted)" />
                  </div>
                  <div>
                    <p style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>{r.label}</p>
                    <p style={{ fontSize: 12.5, color: "var(--text-primary)" }}>{r.val}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            {[
              { label: "Total Jobs",  val: customer.totalJobs.toString(),              color: "#60a5fa", icon: Wrench },
              { label: "Total Spent", val: `Rs. ${customer.totalSpent.toLocaleString()}`, color: "#4ade80", icon: ShoppingBag },
              { label: "Member Since",val: customer.memberSince,                       color: "var(--text-secondary)", icon: Calendar },
            ].map(s => {
              const Icon = s.icon;
              return (
                <div key={s.label} style={{ background: "var(--bg-primary)", border: "1px solid var(--border)", borderRadius: 9, padding: "9px 11px", textAlign: "center" }}>
                  <Icon size={14} color={s.color} style={{ marginBottom: 5 }} />
                  <p style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>{s.label}</p>
                  <p style={{ fontSize: 12.5, fontWeight: 700, color: s.color }}>{s.val}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ padding: "12px 18px", borderTop: "1px solid var(--border)", background: "var(--bg-secondary)", display: "flex", justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "8px 18px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer" }}>Close</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── All Customers ────────────────────────────────────────────────────────────

export default function AllCustomers() {
  const [customers,     setCustomers]     = useState<Customer[]>(INITIAL_CUSTOMERS);
  const [search,        setSearch]        = useState("");
  const [statusFilter,  setStatusFilter]  = useState<CustomerStatus | "All">("All");
  const [searchFocused, setSearchFocused] = useState(false);
  const [selected,      setSelected]      = useState<Customer | null>(null);

  const filtered = customers.filter(c => {
    const matchSearch = !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search) ||
      c.nic.toLowerCase().includes(search.toLowerCase()) ||
      c.id.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "All" || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, maxWidth: 360 }}>
          <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: searchFocused ? "var(--accent)" : "var(--text-muted)", transition: "color 0.18s", pointerEvents: "none" }} />
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setSearchFocused(true)} onBlur={() => setSearchFocused(false)}
            placeholder="Search by name, phone, NIC, ID..."
            style={{ width: "100%", background: "var(--bg-card)", border: `1px solid ${searchFocused ? "var(--accent)" : "var(--border)"}`, borderRadius: 10, padding: "10px 14px 10px 36px", fontSize: 13.5, color: "var(--text-primary)", outline: "none", fontFamily: "'Plus Jakarta Sans', sans-serif", transition: "border-color 0.18s" }}
          />
        </div>

        <div style={{ display: "flex", gap: 6, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, padding: 5 }}>
          {(["All", "Active", "Inactive"] as const).map(s => {
            const isActive = statusFilter === s;
            const color = s === "Active" ? "#4ade80" : s === "Inactive" ? "#f87171" : "var(--accent)";
            return (
              <button key={s} onClick={() => setStatusFilter(s)}
                style={{ padding: "5px 13px", borderRadius: 7, fontSize: 12, fontWeight: isActive ? 700 : 400, border: isActive ? `1px solid ${color}44` : "1px solid transparent", background: isActive ? `${color}14` : "transparent", color: isActive ? color : "var(--text-muted)", cursor: "pointer", transition: "all 0.15s" }}
              >{s}</button>
            );
          })}
        </div>

        <span style={{ marginLeft: "auto", fontSize: 12, padding: "4px 12px", borderRadius: 8, background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
          {filtered.length} {filtered.length === 1 ? "customer" : "customers"}
        </span>
      </div>

      {/* Table */}
      <div className="table-scroll">
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              {["ID", "Name", "Phone", "NIC", "Total Jobs", "Total Spent", "Member Since", "Last Activity", "Status", ""].map(h => (
                <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", whiteSpace: "nowrap", fontFamily: "'Plus Jakarta Sans', sans-serif", background: "var(--bg-secondary)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={10} style={{ padding: "48px 16px", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>No customers found</td></tr>
            ) : filtered.map((c, i) => {
              const isActive = c.status === "Active";
              return (
                <tr key={c.id}
                  style={{ borderBottom: i < filtered.length - 1 ? "1px solid var(--border)" : "none", transition: "background 0.15s" }}
                  onMouseEnter={(e) => (e.currentTarget as HTMLTableRowElement).style.background = "var(--bg-card-hover)"}
                  onMouseLeave={(e) => (e.currentTarget as HTMLTableRowElement).style.background = "transparent"}
                >
                  <td style={{ padding: "14px 16px" }}><span style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)" }}>{c.id}</span></td>
                  <td style={{ padding: "14px 16px" }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{c.name}</p>
                    {c.email && <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>{c.email}</p>}
                  </td>
                  <td style={{ padding: "14px 16px" }}><span style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>{c.phone}</span></td>
                  <td style={{ padding: "14px 16px" }}><span style={{ fontSize: 12, color: "var(--text-muted)" }}>{c.nic || "—"}</span></td>
                  <td style={{ padding: "14px 16px" }}><span style={{ fontSize: 13, color: "#60a5fa", fontWeight: 600 }}>{c.totalJobs}</span></td>
                  <td style={{ padding: "14px 16px" }}><span style={{ fontSize: 13, color: "var(--text-primary)" }}>Rs. {c.totalSpent.toLocaleString()}</span></td>
                  <td style={{ padding: "14px 16px" }}><span style={{ fontSize: 12, color: "var(--text-muted)" }}>{c.memberSince}</span></td>
                  <td style={{ padding: "14px 16px" }}><span style={{ fontSize: 12, color: "var(--text-muted)" }}>{c.lastActivity}</span></td>
                  <td style={{ padding: "14px 16px" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 8, background: isActive ? "rgba(74,222,128,0.08)" : "rgba(248,113,113,0.08)", border: `1px solid ${isActive ? "rgba(74,222,128,0.25)" : "rgba(248,113,113,0.25)"}`, color: isActive ? "#4ade80" : "#f87171", fontSize: 11.5, fontWeight: 600 }}>
                      {isActive ? <UserCheck size={10} strokeWidth={2.5} /> : <UserX size={10} strokeWidth={2.5} />}
                      {c.status}
                    </span>
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <button
                      onClick={() => setSelected(c)}
                      style={{ width: 30, height: 30, borderRadius: 7, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}
                      onMouseEnter={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.borderColor = "var(--accent-glow)"; b.style.color = "var(--accent)"; b.style.background = "var(--accent-dim)"; }}
                      onMouseLeave={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.borderColor = "var(--border)"; b.style.color = "var(--text-muted)"; b.style.background = "transparent"; }}
                    >
                      <Search size={13} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      </div>

      {selected && <CustomerDetailModal customer={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
