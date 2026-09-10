"use client";

import { Fragment, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Search, Plus, UserCheck, UserX, X,
  Phone, Mail, Hash, Calendar, Wrench, ShoppingBag, Store, User, ChevronRight, Receipt,
} from "lucide-react";
import { useRepair, dealerKey, type RepairJob } from "@/cashier/contexts/RepairContext";
import { useSales } from "@/cashier/contexts/SalesContext";
import { useCreditAccounts } from "@/lib/credit/api";

// ─── Types ────────────────────────────────────────────────────────────────────

type CustomerStatus = "Active" | "Inactive";
type CustomerKind = "Walk-in" | "Dealer";

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
  kind: CustomerKind;
  /** On account with the shop, and what they owe. Null for anyone paying as
   *  they go — which is most people, and the reason this screen exists. */
  credit: { balance: number; onAccount: boolean } | null;
  /**
   * The invoices this customer has been billed on.
   *
   * Collected from their jobs' invoice_no rather than by matching the sales
   * ledger on a name. The sales row records who was billed as free text; the
   * job records which invoice it went out on. One of those is a link and the
   * other is a spelling, and two customers called Kumara would share the
   * spelling.
   */
  invoices: string[];
}

/**
 * Everyone the shop deals with, worked out from the work.
 *
 * This screen held a hard-coded empty list, so a customer who walked in, had a
 * phone repaired and paid cash appeared nowhere in the system afterwards. They
 * were in the jobs and the invoices the whole time; nothing was reading them.
 *
 * There is no customers table to read instead — a customer exists as a name
 * and a number on each job — so the list is built from the jobs themselves,
 * one entry per phone number, and the dealers come from the registry beside
 * them. A dealer is a customer: they bring work in and they settle bills.
 *
 * ── Where the money comes from ──────────────────────────────────────────────
 * advance_paid on the job, which is every rupee received against that repair —
 * the intake advance plus whatever was settled at handover. Not the invoice
 * total, which is what was billed rather than what came in, and not a name
 * match against the sales ledger, which would quietly merge two customers who
 * happen to share a name.
 */
const isoDay = (d: string | undefined | null) => (d ?? "").slice(0, 10);
const digits = (s: string | undefined | null) => (s ?? "").replace(/\D/g, "");

const DAY = 86_400_000;
const activeSince = (iso: string) =>
  iso && Date.now() - new Date(iso).getTime() < 120 * DAY ? "Active" : "Inactive";

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

export default function AllCustomers({ only }: {
  /**
   * Which half of the book this is.
   *
   * The rows are built the same way either way — a dealer's spend and a
   * walk-in's spend are both money received against their jobs — so the split
   * is a filter over one derivation rather than two screens that could drift
   * apart on what "paid" means.
   */
  only?: CustomerKind;
} = {}) {
  const { jobs, dealers } = useRepair();
  const { accounts } = useCreditAccounts();
  const { sales } = useSales();
  const [search,        setSearch]        = useState("");
  const [statusFilter,  setStatusFilter]  = useState<CustomerStatus | "All">("All");
  const [kindFilter,    setKindFilter]    = useState<CustomerKind | "All" | "On account">("All");
  const [searchFocused, setSearchFocused] = useState(false);
  const [selected,      setSelected]      = useState<Customer | null>(null);
  /**
   * Whose history is open, by id.
   *
   * One at a time. A list of customers is scanned; a history is read, and two
   * of them open at once turns the scan back into a scroll.
   */
  const [openRow,       setOpenRow]       = useState<string | null>(null);

  const customers = useMemo<Customer[]>(() => {
    /** An account for this person, if the shop has one open. */
    const byPhone = new Map(accounts.filter(a => a.phone).map(a => [digits(a.phone), a]));
    const byDealer = new Map(accounts.filter(a => a.dealerId != null).map(a => [String(a.dealerId), a]));

    // ── Dealers first, so their jobs are claimed before the walk-in pass ────
    //
    // A dealer job carries the dealer's own name and number in the customer
    // fields, so without this they would appear twice: once as the registry
    // entry and once as a "walk-in" of the same name.
    const rows: Customer[] = [];
    const claimed = new Set<string>();

    for (const d of dealers) {
      if (d.inHouse) continue;   // The shop itself is not its own customer.
      const theirs = jobs.filter(j => dealerKey(dealers, j.dealer) === dealerKey(dealers, d.name));
      theirs.forEach(j => claimed.add(j.id));
      const acct = byDealer.get(String(d.id));
      const days = theirs.map(j => isoDay(j.createdAt)).filter(Boolean).sort();
      const invoices = Array.from(new Set(theirs.map(j => j.invoiceNo).filter((v): v is string => !!v)));
      rows.push({
        id: `D-${d.id}`,
        name: d.name,
        phone: d.contact ?? "",
        nic: "",
        email: "",
        address: d.address ?? "",
        kind: "Dealer",
        totalJobs: theirs.length,
        totalSpent: theirs.reduce((n, j) => n + (j.advancePaid ?? 0), 0),
        memberSince: days[0] ?? isoDay(d.joinedAt),
        lastActivity: days[days.length - 1] ?? "",
        status: activeSince(days[days.length - 1] ?? ""),
        credit: acct ? { balance: acct.balance, onAccount: true } : null,
        invoices,
      });
    }

    // ── Then everyone who came in themselves ───────────────────────────────
    //
    // Keyed by phone number, because that is what a shop actually recognises a
    // returning customer by. Where there is no number the name has to do, and
    // where there is neither the job cannot be attributed to anybody.
    const walkIns = new Map<string, { name: string; phone: string; email: string; jobs: RepairJob[] }>();
    for (const j of jobs) {
      if (claimed.has(j.id)) continue;
      const name = (j.customerName ?? "").trim();
      const phone = digits(j.phone);
      const key = phone || name.toLowerCase();
      if (!key) continue;
      const prev = walkIns.get(key);
      walkIns.set(key, {
        // Oldest job first below, so the most recent spelling of a name wins.
        name: name || prev?.name || "Walk-in",
        phone: (j.phone ?? "").trim() || prev?.phone || "",
        email: (j.customerEmail ?? "").trim() || prev?.email || "",
        jobs: [...(prev?.jobs ?? []), j],
      });
    }

    let n = 0;
    for (const c of walkIns.values()) {
      const days = c.jobs.map(j => isoDay(j.createdAt)).filter(Boolean).sort();
      const acct = byPhone.get(digits(c.phone));
      rows.push({
        id: `C-${String(++n).padStart(3, "0")}`,
        name: c.name,
        phone: c.phone,
        nic: "",
        email: c.email,
        address: "",
        kind: "Walk-in",
        totalJobs: c.jobs.length,
        totalSpent: c.jobs.reduce((t, j) => t + (j.advancePaid ?? 0), 0),
        memberSince: days[0] ?? "",
        lastActivity: days[days.length - 1] ?? "",
        status: activeSince(days[days.length - 1] ?? ""),
        credit: acct ? { balance: acct.balance, onAccount: true } : null,
        invoices: Array.from(new Set(c.jobs.map(j => j.invoiceNo).filter((v): v is string => !!v))),
      });
    }

    /**
     * And anybody the shop has an account with who has not been picked up yet.
     *
     * A credit customer is a customer — that is the whole of what the word
     * means here — but the list above is built from repair jobs, so somebody
     * put on account for an accessory sale, or whose only repair predates this
     * system, existed on the credit screen and nowhere else. They are folded
     * in by phone number, the same key everything else matches on, so an
     * account belonging to a customer already listed does not become a second
     * row for the same person.
     *
     * Dealer accounts go to the Dealers half, never here: a dealer sends work
     * in and settles a bill, which makes them an account, not a customer of
     * the shop in the sense this screen means.
     */
    const seen = new Set(rows.map(r => digits(r.phone)).filter(Boolean));
    for (const a of accounts) {
      if (a.holderKind !== "Customer") continue;
      if (a.phone && seen.has(digits(a.phone))) continue;
      rows.push({
        id: `A-${a.id.slice(0, 6)}`,
        name: a.name,
        phone: a.phone ?? "",
        nic: a.nic ?? "",
        email: a.email ?? "",
        address: a.address ?? "",
        kind: "Walk-in",
        totalJobs: 0,
        // What they have actually paid the shop, from the ledger rather than
        // from jobs they do not have.
        totalSpent: a.totalPaid,
        memberSince: (a.firstChargeOn ?? a.createdAt ?? "").slice(0, 10),
        lastActivity: (a.lastPaymentOn ?? a.firstChargeOn ?? "").slice(0, 10),
        status: activeSince((a.lastPaymentOn ?? a.firstChargeOn ?? "").slice(0, 10)),
        credit: { balance: a.balance, onAccount: true },
        invoices: [],
      });
    }

    return rows
      .filter(r => !only || r.kind === only)
      .sort((a, b) => (b.lastActivity || "").localeCompare(a.lastActivity || ""));
  }, [jobs, dealers, accounts, only]);

  const filtered = customers.filter(c => {
    const matchSearch = !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search) ||
      c.nic.toLowerCase().includes(search.toLowerCase()) ||
      c.id.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "All" || c.status === statusFilter;
    const matchKind =
      kindFilter === "All" ? true
      : kindFilter === "On account" ? !!c.credit
      : c.kind === kindFilter;
    return matchSearch && matchStatus && matchKind;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, flex: 1, minHeight: 0 }}>

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

        <div style={{ display: "flex", gap: 6, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, padding: 5 }}>
          {((only ? ["All", "On account"] : ["All", "Walk-in", "Dealer", "On account"]) as (CustomerKind | "All" | "On account")[]).map(k => {
            const on = kindFilter === k;
            const color = k === "Dealer" ? "#a78bfa" : k === "On account" ? "#fbbf24" : "var(--accent)";
            return (
              <button key={k} onClick={() => setKindFilter(k)}
                style={{ padding: "5px 13px", borderRadius: 7, fontSize: 12, fontWeight: on ? 700 : 400, border: on ? `1px solid ${color}44` : "1px solid transparent", background: on ? `${color}14` : "transparent", color: on ? color : "var(--text-muted)", cursor: "pointer", transition: "all 0.15s", whiteSpace: "nowrap" }}
              >{k}</button>
            );
          })}
        </div>

        <span style={{ marginLeft: "auto", fontSize: 12, padding: "4px 12px", borderRadius: 8, background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
          {filtered.length}{" "}
          {only === "Dealer"
            ? (filtered.length === 1 ? "dealer" : "dealers")
            : (filtered.length === 1 ? "customer" : "customers")}
        </span>
      </div>

      {/* Table — bounded and scrolls internally so only rows move; the header
          stays pinned via position: sticky. */}
      <div className="table-scroll" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, flex: 1, minHeight: 0, overflowY: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              {["ID", "Name", "Phone", "NIC", "Jobs", "Paid to Date", "First Job", "Last Job", "Status", ""].map(h => (
                <th key={h} style={{ position: "sticky", top: 0, zIndex: 1, padding: "12px 16px", textAlign: "left", fontSize: 11, color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", whiteSpace: "nowrap", fontFamily: "'Plus Jakarta Sans', sans-serif", background: "var(--bg-secondary)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={10} style={{ padding: "48px 16px", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>No {only === "Dealer" ? "dealers" : "customers"} found</td></tr>
            ) : filtered.map((c, i) => {
              const isActive = c.status === "Active";
              const open = openRow === c.id;
              // Their invoices, newest first. Matched by number rather than by
              // name — see Customer.invoices.
              const theirInvoices = open
                ? sales
                    .filter(x => c.invoices.includes(x.invoiceNo))
                    .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
                : [];
              return (
                <Fragment key={c.id}>
                <tr
                  onClick={() => setOpenRow(prev => prev === c.id ? null : c.id)}
                  style={{ borderBottom: i < filtered.length - 1 || open ? "1px solid var(--border)" : "none", transition: "background 0.15s", cursor: "pointer", background: open ? "var(--bg-secondary)" : undefined }}
                  onMouseEnter={(e) => { if (!open) (e.currentTarget as HTMLTableRowElement).style.background = "var(--bg-card-hover)"; }}
                  onMouseLeave={(e) => { if (!open) (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}
                >
                  <td style={{ padding: "14px 16px" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <ChevronRight
                        size={12}
                        style={{ color: "var(--text-muted)", flexShrink: 0, transform: open ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}
                      />
                      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)" }}>{c.id}</span>
                    </span>
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <p style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                      {c.kind === "Dealer"
                        ? <Store size={11} style={{ color: "#a78bfa", flexShrink: 0 }} />
                        : <User size={11} style={{ color: "var(--text-muted)", flexShrink: 0 }} />}
                      {c.name}
                      {/* On account is worth seeing here rather than only on
                          the credit screen: it is the difference between
                          somebody who pays at the counter and somebody the
                          shop is carrying. */}
                      {c.credit && (
                        <span
                          title={c.credit.balance > 0 ? `Owes Rs. ${Math.round(c.credit.balance).toLocaleString()}` : "On account, nothing outstanding"}
                          style={{
                            fontSize: 9.5, fontWeight: 800, letterSpacing: "0.04em", padding: "2px 7px", borderRadius: 20,
                            color: c.credit.balance > 0 ? "#fbbf24" : "var(--text-muted)",
                            background: c.credit.balance > 0 ? "rgba(251,191,36,0.12)" : "var(--bg-secondary)",
                            border: `1px solid ${c.credit.balance > 0 ? "rgba(251,191,36,0.4)" : "var(--border)"}`,
                          }}
                        >
                          {c.credit.balance > 0 ? `OWES ${Math.round(c.credit.balance).toLocaleString()}` : "ON ACCOUNT"}
                        </span>
                      )}
                    </p>
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

                {open && (
                  <tr>
                    <td colSpan={10} style={{ padding: 0, background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)" }}>
                      <div style={{ padding: "12px 16px 16px 40px" }}>
                        <p style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 10.5, fontWeight: 800, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 9 }}>
                          <Receipt size={11} />Invoice history · {theirInvoices.length}
                        </p>

                        {theirInvoices.length === 0 ? (
                          <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.55 }}>
                            {/* Two different nothings, and the difference is
                                the whole answer: work in progress has not been
                                billed yet, no work at all is a new customer. */}
                            {c.totalJobs > 0
                              ? "Nothing invoiced yet — their jobs have not been handed over."
                              : "No invoices."}
                          </p>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            {theirInvoices.map(inv => {
                              const owing = Math.max(0, (inv.total ?? 0) - (inv.paid ?? 0));
                              return (
                                <div key={inv.invoiceNo} style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "9px 12px", borderRadius: 9, background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)", fontFamily: "monospace", flexShrink: 0 }}>{inv.invoiceNo}</span>
                                  <span style={{ fontSize: 11.5, color: "var(--text-muted)", flexShrink: 0 }}>{inv.date}</span>
                                  <span style={{ flex: 1, minWidth: 120, fontSize: 12, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{inv.items}</span>
                                  <span style={{ fontSize: 11.5, color: "var(--text-muted)", flexShrink: 0 }}>{inv.paymentMethod ?? "—"}</span>
                                  <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-primary)", flexShrink: 0 }}>Rs. {(inv.total ?? 0).toLocaleString()}</span>
                                  {/* What is still owed on it, because an
                                      invoice history that only shows totals
                                      cannot answer the question anybody opens
                                      it to ask. */}
                                  <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, flexShrink: 0, color: owing > 0 ? "#fbbf24" : "#4ade80", background: owing > 0 ? "rgba(251,191,36,0.12)" : "rgba(74,222,128,0.1)", border: `1px solid ${owing > 0 ? "rgba(251,191,36,0.35)" : "rgba(74,222,128,0.3)"}` }}>
                                    {owing > 0 ? `Rs. ${owing.toLocaleString()} due` : "Paid"}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {selected && <CustomerDetailModal customer={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
