"use client";

import { useState } from "react";
import {
  Search, Filter, ChevronDown, Eye, MoreHorizontal,
  CheckCircle, Clock, AlertCircle, XCircle, Wrench
} from "lucide-react";

export type JobStatus = "Non-Issued" | "Issued" | "Pending" | "Completed" | "Cancelled";

export interface RepairJob {
  id: string;
  customerName: string;
  phone: string;
  brand: string;
  model: string;
  issue: string;
  technician: string;
  status: JobStatus;
  priority: "Low" | "Normal" | "High" | "Urgent";
  estimatedCost: number;
  advancePaid: number;
  createdAt: string;
  estimatedCompletion: string;
}

const mockJobs: RepairJob[] = [
  { id: "RM-001", customerName: "Kasun Perera", phone: "+94 77 123 4567", brand: "Apple", model: "iPhone 14 Pro", issue: "Screen Damage", technician: "Kamal", status: "Non-Issued", priority: "High", estimatedCost: 25000, advancePaid: 5000, createdAt: "2025-04-20", estimatedCompletion: "2025-04-22" },
  { id: "RM-002", customerName: "Nimali Silva", phone: "+94 71 234 5678", brand: "Samsung", model: "Galaxy S23", issue: "Battery", technician: "Nimal", status: "Issued", priority: "Normal", estimatedCost: 8000, advancePaid: 2000, createdAt: "2025-04-21", estimatedCompletion: "2025-04-23" },
  { id: "RM-003", customerName: "Roshan Fernando", phone: "+94 76 345 6789", brand: "Xiaomi", model: "Redmi Note 12", issue: "Charging Port", technician: "Suresh", status: "Pending", priority: "Urgent", estimatedCost: 4500, advancePaid: 1000, createdAt: "2025-04-19", estimatedCompletion: "2025-04-21" },
  { id: "RM-004", customerName: "Dilini Rajapaksa", phone: "+94 70 456 7890", brand: "Apple", model: "iPhone 13", issue: "Camera", technician: "Kamal", status: "Completed", priority: "Normal", estimatedCost: 15000, advancePaid: 15000, createdAt: "2025-04-18", estimatedCompletion: "2025-04-20" },
  { id: "RM-005", customerName: "Pradeep Jayawardena", phone: "+94 75 567 8901", brand: "Oppo", model: "Reno 8", issue: "Speaker / Mic", technician: "Nimal", status: "Non-Issued", priority: "Low", estimatedCost: 3000, advancePaid: 0, createdAt: "2025-04-22", estimatedCompletion: "2025-04-25" },
  { id: "RM-006", customerName: "Samantha Bandara", phone: "+94 78 678 9012", brand: "Samsung", model: "Galaxy A54", issue: "Water Damage", technician: "Suresh", status: "Issued", priority: "High", estimatedCost: 12000, advancePaid: 3000, createdAt: "2025-04-21", estimatedCompletion: "2025-04-24" },
  { id: "RM-007", customerName: "Chamara Wijesinghe", phone: "+94 72 789 0123", brand: "Huawei", model: "P30 Pro", issue: "Software", technician: "Kamal", status: "Pending", priority: "Normal", estimatedCost: 5000, advancePaid: 2000, createdAt: "2025-04-20", estimatedCompletion: "2025-04-22" },
  { id: "RM-008", customerName: "Isuru Madushanka", phone: "+94 74 890 1234", brand: "OnePlus", model: "Nord 3", issue: "Back Glass", technician: "Nimal", status: "Completed", priority: "Low", estimatedCost: 6000, advancePaid: 6000, createdAt: "2025-04-17", estimatedCompletion: "2025-04-19" },
];

const statusConfig: Record<JobStatus, { color: string; bg: string; border: string; icon: any }> = {
  "Non-Issued": { color: "#94a3b8", bg: "rgba(148,163,184,0.08)", border: "rgba(148,163,184,0.2)", icon: Clock },
  "Issued":     { color: "#60a5fa", bg: "rgba(96,165,250,0.08)",  border: "rgba(96,165,250,0.2)",  icon: Wrench },
  "Pending":    { color: "#fbbf24", bg: "rgba(251,191,36,0.08)",  border: "rgba(251,191,36,0.2)",  icon: AlertCircle },
  "Completed":  { color: "#4ade80", bg: "rgba(74,222,128,0.08)",  border: "rgba(74,222,128,0.2)",  icon: CheckCircle },
  "Cancelled":  { color: "#f87171", bg: "rgba(248,113,113,0.08)", border: "rgba(248,113,113,0.2)", icon: XCircle },
};

const priorityColor: Record<string, string> = {
  Low: "#94a3b8", Normal: "#60a5fa", High: "#fbbf24", Urgent: "#f87171"
};

interface JobsTableProps {
  filterStatus?: JobStatus | "All";
  title: string;
}

export default function JobsTable({ filterStatus = "All", title }: JobsTableProps) {
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [brandFilter, setBrandFilter] = useState("All");
  const [searchFocused, setSearchFocused] = useState(false);

  const jobs = mockJobs.filter(j => {
    const matchStatus = filterStatus === "All" || j.status === filterStatus;
    const matchSearch = !search ||
      j.customerName.toLowerCase().includes(search.toLowerCase()) ||
      j.id.toLowerCase().includes(search.toLowerCase()) ||
      j.model.toLowerCase().includes(search.toLowerCase()) ||
      j.brand.toLowerCase().includes(search.toLowerCase());
    const matchPriority = priorityFilter === "All" || j.priority === priorityFilter;
    const matchBrand = brandFilter === "All" || j.brand === brandFilter;
    return matchStatus && matchSearch && matchPriority && matchBrand;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {/* Search */}
        <div style={{ position: "relative", flex: 1, maxWidth: 360 }}>
          <Search size={14} style={{
            position: "absolute", left: 12, top: "50%",
            transform: "translateY(-50%)",
            color: searchFocused ? "var(--accent)" : "var(--text-muted)",
            transition: "color 0.18s", pointerEvents: "none",
          }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder="Search by name, ID, device..."
            style={{
              width: "100%",
              background: "var(--bg-card)",
              border: `1px solid ${searchFocused ? "var(--accent)" : "var(--border)"}`,
              borderRadius: 10, padding: "10px 14px 10px 36px",
              fontSize: 13.5, color: "var(--text-primary)",
              outline: "none", fontFamily: "'DM Sans', sans-serif",
              transition: "border-color 0.18s",
            }}
          />
        </div>

        {/* Filter toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          style={{
            display: "flex", alignItems: "center", gap: 7,
            padding: "10px 16px", borderRadius: 10,
            border: `1px solid ${showFilters ? "var(--accent-glow)" : "var(--border)"}`,
            background: showFilters ? "var(--accent-dim)" : "var(--bg-card)",
            color: showFilters ? "var(--accent)" : "var(--text-secondary)",
            fontSize: 13.5, cursor: "pointer",
            fontFamily: "'DM Sans', sans-serif",
            transition: "all 0.18s",
          }}
        >
          <Filter size={14} />
          Filters
          <ChevronDown size={13} style={{
            transform: showFilters ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s",
          }} />
        </button>

        {/* Stats */}
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <span style={{
            fontSize: 12, padding: "4px 12px", borderRadius: 8,
            background: "var(--bg-card)", border: "1px solid var(--border)",
            color: "var(--text-secondary)",
          }}>
            {jobs.length} {jobs.length === 1 ? "job" : "jobs"}
          </span>
        </div>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div style={{
          background: "var(--bg-card)", border: "1px solid var(--border)",
          borderRadius: 12, padding: "16px 20px",
          display: "flex", gap: 20, alignItems: "flex-end",
          animation: "fadeUp 0.2s ease both",
        }}>
          <div>
            <label style={{
              fontSize: 11, color: "var(--text-muted)", fontWeight: 600,
              letterSpacing: "0.06em", textTransform: "uppercase",
              fontFamily: "'Syne', sans-serif", display: "block", marginBottom: 6,
            }}>Priority</label>
            <div style={{ display: "flex", gap: 6 }}>
              {["All", "Low", "Normal", "High", "Urgent"].map(p => (
                <button
                  key={p}
                  onClick={() => setPriorityFilter(p)}
                  style={{
                    padding: "5px 12px", borderRadius: 8, fontSize: 12,
                    border: `1px solid ${priorityFilter === p ? "var(--accent-glow)" : "var(--border)"}`,
                    background: priorityFilter === p ? "var(--accent-dim)" : "transparent",
                    color: priorityFilter === p ? "var(--accent)" : "var(--text-secondary)",
                    cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                    transition: "all 0.15s",
                  }}
                >{p}</button>
              ))}
            </div>
          </div>
          <div>
            <label style={{
              fontSize: 11, color: "var(--text-muted)", fontWeight: 600,
              letterSpacing: "0.06em", textTransform: "uppercase",
              fontFamily: "'Syne', sans-serif", display: "block", marginBottom: 6,
            }}>Brand</label>
            <div style={{ display: "flex", gap: 6 }}>
              {["All", "Apple", "Samsung", "Xiaomi", "Oppo", "OnePlus", "Huawei"].map(b => (
                <button
                  key={b}
                  onClick={() => setBrandFilter(b)}
                  style={{
                    padding: "5px 12px", borderRadius: 8, fontSize: 12,
                    border: `1px solid ${brandFilter === b ? "var(--accent-glow)" : "var(--border)"}`,
                    background: brandFilter === b ? "var(--accent-dim)" : "transparent",
                    color: brandFilter === b ? "var(--accent)" : "var(--text-secondary)",
                    cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                    transition: "all 0.15s",
                  }}
                >{b}</button>
              ))}
            </div>
          </div>
          <button
            onClick={() => { setPriorityFilter("All"); setBrandFilter("All"); }}
            style={{
              padding: "6px 14px", borderRadius: 8, fontSize: 12,
              border: "1px solid var(--border)", background: "transparent",
              color: "var(--text-muted)", cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif", transition: "all 0.15s",
            }}
          >Clear</button>
        </div>
      )}

      {/* Table */}
      <div style={{
        background: "var(--bg-card)", border: "1px solid var(--border)",
        borderRadius: 14, overflow: "hidden",
      }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              {["Job ID", "Customer", "Device", "Issue", "Technician", "Status", "Priority", "Est. Cost", "Balance", "Date"].map(h => (
                <th key={h} style={{
                  padding: "12px 16px", textAlign: "left",
                  fontSize: 10.5, color: "var(--text-muted)",
                  fontWeight: 600, letterSpacing: "0.07em",
                  textTransform: "uppercase", whiteSpace: "nowrap",
                  fontFamily: "'Syne', sans-serif",
                  background: "var(--bg-secondary)",
                }}>{h}</th>
              ))}
              <th style={{
                padding: "12px 16px",
                background: "var(--bg-secondary)",
                fontSize: 10.5, color: "var(--text-muted)",
              }}></th>
            </tr>
          </thead>
          <tbody>
            {jobs.length === 0 ? (
              <tr>
                <td colSpan={11} style={{
                  padding: "48px 16px", textAlign: "center",
                  color: "var(--text-muted)", fontSize: 13,
                }}>
                  No jobs found
                </td>
              </tr>
            ) : jobs.map((job, i) => {
              const sc = statusConfig[job.status];
              const StatusIcon = sc.icon;
              const balance = job.estimatedCost - job.advancePaid;
              return (
                <tr
                  key={job.id}
                  style={{
                    borderBottom: i < jobs.length - 1 ? "1px solid var(--border)" : "none",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget as HTMLTableRowElement).style.background = "var(--bg-card-hover)"}
                  onMouseLeave={(e) => (e.currentTarget as HTMLTableRowElement).style.background = "transparent"}
                >
                  <td style={{ padding: "14px 16px" }}>
                    <span style={{
                      fontSize: 12, fontWeight: 600,
                      color: "var(--accent)", fontFamily: "'Syne', sans-serif",
                    }}>{job.id}</span>
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <p style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>{job.customerName}</p>
                    <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>{job.phone}</p>
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <p style={{ fontSize: 13, color: "var(--text-primary)" }}>{job.brand} {job.model}</p>
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <span style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>{job.issue}</span>
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <span style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>{job.technician}</span>
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 5,
                      padding: "4px 10px", borderRadius: 8,
                      background: sc.bg, border: `1px solid ${sc.border}`,
                      color: sc.color, fontSize: 11.5, fontWeight: 600,
                      whiteSpace: "nowrap",
                    }}>
                      <StatusIcon size={10} strokeWidth={2.5} />
                      {job.status}
                    </span>
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <span style={{
                      fontSize: 11.5, fontWeight: 600,
                      color: priorityColor[job.priority],
                    }}>● {job.priority}</span>
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <span style={{ fontSize: 13, color: "var(--text-primary)" }}>
                      Rs. {job.estimatedCost.toLocaleString()}
                    </span>
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <span style={{
                      fontSize: 13,
                      color: balance > 0 ? "var(--danger)" : "var(--success)",
                    }}>
                      Rs. {balance.toLocaleString()}
                    </span>
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{job.createdAt}</span>
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <button style={{
                      width: 30, height: 30, borderRadius: 7,
                      border: "1px solid var(--border)",
                      background: "transparent",
                      color: "var(--text-muted)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      cursor: "pointer", transition: "all 0.15s",
                    }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-active)";
                        (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)";
                        (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)";
                      }}
                    >
                      <MoreHorizontal size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}