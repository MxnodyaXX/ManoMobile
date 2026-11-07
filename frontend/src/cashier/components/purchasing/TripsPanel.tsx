"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapPin, Plus } from "lucide-react";
import { useRealtimeTable } from "@/lib/supabase/useRealtime";
import {
  deletePurchaseTrip, fetchTrips, savePurchaseTrip, today,
  type PurchaseInvoice, type PurchaseTrip,
} from "@/lib/purchasing/api";
import { Btn, ErrorNote, Modal, Rs, card, fmtDate, input, label, td, th } from "./ui";

/**
 * Buying trips: one row per trip with what its bills came to and what the trip
 * itself cost. Each bill stays its own, owed to its own supplier. The trip only
 * links them, and its cost is owed to nobody.
 */
export default function TripsPanel({ invoices, onOpenInvoice }: {
  invoices: PurchaseInvoice[];
  onOpenInvoice: (id: number) => void;
}) {
  const [trips, setTrips] = useState<PurchaseTrip[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<PurchaseTrip | "new" | null>(null);

  const load = useCallback(async () => {
    try { setTrips(await fetchTrips()); setError(null); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }, []);
  useEffect(() => { (async () => { await load(); })(); }, [load]);
  useRealtimeTable(["purchase_trips"], load);

  const rows = useMemo(() => trips.map(t => {
    const bills = invoices.filter(i => i.tripId === t.id && i.status === "Open");
    const onBills = bills.reduce((s, i) => s + i.total, 0);
    return { t, bills, onBills, paid: bills.reduce((s, i) => s + i.paid, 0), spent: onBills + t.cost };
  }), [trips, invoices]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <ErrorNote>{error}</ErrorNote>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Btn onClick={() => setEditing("new")}><Plus size={13} /> New trip</Btn>
      </div>
      <div style={{ ...card, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 680 }}>
          <thead><tr>
            <th style={th}>Trip</th><th style={th}>Date</th><th style={{ ...th, textAlign: "right" }}>Bills</th>
            <th style={{ ...th, textAlign: "right" }}>On the bills</th><th style={{ ...th, textAlign: "right" }}>Paid</th>
            <th style={{ ...th, textAlign: "right" }}>Trip cost</th><th style={{ ...th, textAlign: "right" }}>Total spent</th>
          </tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={7} style={{ ...td, color: "var(--text-muted)" }}>No trips yet. Add one here, or while entering a bill.</td></tr>}
            {rows.map(({ t, bills, onBills, paid, spent }) => (
              <tr key={t.id} onClick={() => setEditing(t)} style={{ cursor: "pointer" }}>
                <td style={td}><strong>{t.name}</strong>{t.notes && <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>{t.notes}</div>}</td>
                <td style={td}>{fmtDate(t.tripDate)}</td>
                <td style={{ ...td, textAlign: "right" }}>{bills.length}</td>
                <td style={{ ...td, textAlign: "right" }}>{Rs(onBills)}</td>
                <td style={{ ...td, textAlign: "right" }}>{Rs(paid)}</td>
                <td style={{ ...td, textAlign: "right" }}>{t.cost ? Rs(t.cost) : "—"}</td>
                <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>{Rs(spent)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing && (
        <TripModal
          trip={editing === "new" ? null : editing}
          bills={editing === "new" ? [] : invoices.filter(i => i.tripId === editing.id && i.status !== "Void")}
          onOpenInvoice={id => { setEditing(null); onOpenInvoice(id); }}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); void load(); }}
        />
      )}
    </div>
  );
}

function TripModal({ trip, bills, onOpenInvoice, onClose, onSaved }: {
  trip: PurchaseTrip | null;
  bills: PurchaseInvoice[];
  onOpenInvoice: (id: number) => void;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(trip?.name ?? "");
  const [date, setDate] = useState(trip?.tripDate ?? today());
  const [cost, setCost] = useState(trip?.cost ? String(trip.cost) : "");
  const [notes, setNotes] = useState(trip?.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);

  async function run(action: () => Promise<unknown>) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try { await action(); onSaved(); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { busyRef.current = false; setBusy(false); }
  }

  return (
    <Modal
      title={<span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><MapPin size={15} /> {trip ? trip.name : "New trip"}</span>}
      subtitle="The trip cost counts towards profit in the period of the trip date. No supplier is owed it."
      onClose={onClose}
      width={560}
      busy={busy}
      footer={
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <ErrorNote>{error}</ErrorNote>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
            {trip && (
              <Btn kind="danger" disabled={busy} onClick={() => {
                if (confirm(`Delete the trip "${trip.name}"? Its bills stay, just no longer linked to a trip.`)) void run(() => deletePurchaseTrip(trip.id));
              }}>Delete trip</Btn>
            )}
            <Btn onClick={onClose} disabled={busy}>Cancel</Btn>
            <Btn kind="primary" disabled={busy || !name.trim()} onClick={() => void run(() => savePurchaseTrip({ id: trip?.id ?? null, name, tripDate: date, cost: parseFloat(cost) || 0, notes }))}>
              {busy ? "Saving…" : "Save trip"}
            </Btn>
          </div>
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div><span style={label}>Trip name</span><input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Colombo" style={input} /></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div><span style={label}>Date</span><input type="date" value={date} onChange={e => setDate(e.target.value)} style={input} /></div>
          <div><span style={label}>Trip cost (bus, fuel…)</span><input value={cost} onChange={e => setCost(e.target.value)} inputMode="decimal" placeholder="0" style={input} /></div>
        </div>
        <div><span style={label}>Notes</span><input value={notes} onChange={e => setNotes(e.target.value)} style={input} /></div>
        {bills.length > 0 && (
          <div>
            <span style={label}>Bills on this trip</span>
            <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
              {bills.map(b => (
                <button key={b.id} onClick={() => onOpenInvoice(b.id)} style={{ display: "flex", justifyContent: "space-between", gap: 10, width: "100%", padding: "9px 12px", border: "none", borderBottom: "1px solid var(--border)", background: "transparent", color: "var(--text-primary)", cursor: "pointer", fontSize: 12.5, fontFamily: "inherit", textAlign: "left" }}>
                  <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{b.supplierName} · {b.invoiceNo}{b.status === "Draft" ? " (draft)" : ""}</span>
                  <strong style={{ whiteSpace: "nowrap" }}>{Rs(b.total)}</strong>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
