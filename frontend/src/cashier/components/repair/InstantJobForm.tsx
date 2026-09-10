"use client";

import { useMemo, useRef, useState } from "react";
import { Zap, Plus, X, Check, AlertCircle, Users, Smartphone, Wrench, Package } from "lucide-react";
import { useRepair, type RepairDealer, type RepairJob } from "@/cashier/contexts/RepairContext";
import { useParts } from "@/cashier/contexts/PartsContext";
import { useTechnicians } from "@/lib/repair/technicians";
import { useDeviceFaults, FALLBACK_FAULTS } from "@/lib/repair/deviceFaults";
import { useDeviceBrands } from "@/lib/repair/brands";
import { useToast } from "@/lib/ui/toast";
import { notifyJobEvent } from "@/lib/sms/notify";
import { IssueJobModal, RepairInvoicePreview } from "@/cashier/components/repair/JobsTable";
import { useIssueJob, type IssueFormData } from "@/lib/repair/issueJob";
import type { IssueInvoiceData } from "@/cashier/components/repair/JobIssuePrintable";
import { useJobSlot } from "@/lib/repair/useJobSlot";

const ff = "'Plus Jakarta Sans', sans-serif";

/**
 * A repair that was finished before anyone typed it in.
 *
 * Four customers at the counter with five-minute faults: the shop fixes them
 * while they wait and writes them up afterwards. The normal wizard would have
 * the cashier create a job, assign a technician, have that technician accept,
 * start and finish it, and only then bill — six steps recording a sequence
 * that never happened, with four people watching.
 *
 * So this asks only what nobody can reconstruct later: who it was for, what
 * the device is, what was wrong, who fixed it, what came out of stock, and
 * what it cost. Everything the normal form collects to PLAN work — an
 * estimate, a promised date, an advance, cosmetic condition, the passcode,
 * which technician to give it to — is left out, because all of it is a
 * question about a future that has already happened.
 *
 * What it produces is not a special kind of record. It is an ordinary
 * Completed repair job with `creationType: "Instant"`, its parts issued
 * through the same request path that deducts stock, ready for the cashier to
 * invoice. Sales, repair income, technician reports, dealer accounts, customer
 * history and IMEI re-job detection all read it without knowing the
 * difference — see migration 20260906000031.
 */

const input: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", padding: "9px 11px", borderRadius: 9,
  border: "1px solid var(--border)", background: "var(--bg-secondary)",
  color: "var(--text-primary)", fontSize: 13, fontFamily: ff, outline: "none",
};

const label: React.CSSProperties = {
  fontSize: 10.5, fontWeight: 700, color: "var(--text-muted)",
  textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4, display: "block",
  fontFamily: ff,
};

interface UsedPart { sku: string; name: string; qty: number }

export default function InstantJobForm({ onCreated, onCancel }: {
  onCreated: (job: RepairJob) => void;
  onCancel: () => void;
}) {
  const { addJob, dealers } = useRepair();
  const { parts, requestPart } = useParts();
  const { technicians } = useTechnicians();
  const { faults } = useDeviceFaults();
  const brands = useDeviceBrands();
  const toast = useToast();

  const [dealerName, setDealerName] = useState(() => dealers.find(d => d.inHouse)?.name ?? "");
  const [customer, setCustomer] = useState("");
  const [phone, setPhone] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [imei, setImei] = useState("");
  const [fault, setFault] = useState("");
  const [technician, setTechnician] = useState("");
  const [repairCharge, setRepairCharge] = useState("0");
  const [techCharge, setTechCharge] = useState("0");
  const [remarks, setRemarks] = useState("");
  const [used, setUsed] = useState<UsedPart[]>([]);
  const [partSku, setPartSku] = useState("");
  const [partQty, setPartQty] = useState("1");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * The job stays on screen after it is saved, because the counter is not
   * finished with it: the customer is standing there and wants a receipt.
   *
   * So creating it hands straight over to the same billing the normal flow
   * uses — total, discount, amount paid, what is left owing, and the credit
   * approval when something is — and then prints the invoice. Sending the
   * cashier to Non-Issued to find the job they just typed and press Issue
   * would be two extra screens between them and a printer.
   */
  const [billing, setBilling] = useJobSlot();
  const [invoice, setInvoice] = useState<IssueInvoiceData | null>(null);
  const issueJob = useIssueJob();

  /**
   * The job that exists but has not been paid for.
   *
   * Creating it writes the record and takes the parts off stock, so from that
   * moment the form is describing something real. Letting the cashier carry on
   * editing the fields would be editing a job that no longer answers to them —
   * the second Save would create a second job, and the stock would come off
   * twice.
   *
   * So once it is created the form locks, and the only way forward is to
   * settle the payment. Closing the billing sheet does not release the lock;
   * it puts the job back on screen with the amount still owed, because that is
   * what is true.
   */
  const [unsettled, setUnsettled] = useJobSlot();
  const locked = !!unsettled;

  /**
   * "Your device is repaired and ready to collect" — sent only when the visit
   * ends with the phone still here, which is the moment the payment sheet is
   * closed unsettled.
   *
   * The other half, "handed back to you today", is sent by issueJob() rather
   * than from here. Settling can happen twice over — at the counter now, or
   * days later from Non-Issued when the customer returns with the cash — and
   * both are the same event to them. Owning it in one place means the later
   * one is not silently missed.
   *
   * Guarded by a ref so a cashier who closes the sheet, reopens it and closes
   * it again does not have the customer told twice.
   */
  const texted = useRef<string | null>(null);

  const textReadyToCollect = (job: RepairJob) => {
    if (texted.current === job.id) return;
    texted.current = job.id;
    notifyJobEvent("instant", job, {
      // The parts are not on the job row — they live in part_requests, and
      // this form is the only thing holding the list at this moment.
      parts_used: used.length > 0 ? used.map(u => `${u.name} x${u.qty}`).join(", ") : "None",
    });
  };

  const faultOptions = faults.length > 0 ? faults.map(f => f.label) : FALLBACK_FAULTS;
  const dealer: RepairDealer | undefined = dealers.find(d => d.name === dealerName);

  const charge = Math.max(0, parseFloat(repairCharge) || 0);
  const labour = Math.max(0, parseFloat(techCharge) || 0);

  // Only what is genuinely unrecoverable later. A missing estimate can be
  // filled in at billing; a missing "who fixed it" cannot be reconstructed
  // once the counter has moved on.
  const missing =
    !dealerName ? "Choose the repair dealer."
    : !brand.trim() || !model.trim() ? "Enter the device brand and model."
    : !fault.trim() ? "Say what was wrong with it."
    : !technician ? "Choose who completed the repair."
    : null;

  const addPart = () => {
    const p = parts.find(x => x.sku === partSku);
    const qty = Math.max(1, Math.floor(parseFloat(partQty) || 0));
    if (!p || qty <= 0) return;
    setUsed(u => {
      const at = u.findIndex(x => x.sku === p.sku);
      if (at < 0) return [...u, { sku: p.sku, name: p.name, qty }];
      // Same part twice is one line with a bigger number, not two lines the
      // stock deduction would then have to reconcile.
      const next = [...u];
      next[at] = { ...next[at], qty: next[at].qty + qty };
      return next;
    });
    setPartSku("");
    setPartQty("1");
  };

  const partsCost = useMemo(
    () => used.reduce((s, u) => s + (parts.find(p => p.sku === u.sku)?.costPrice ?? 0) * u.qty, 0),
    [used, parts],
  );

  const save = async () => {
    if (missing || busy) return;
    setBusy(true);
    setError(null);
    const now = new Date().toISOString();

    try {
      /**
       * Written as finished, because it is. Status Completed with the same
       * timestamps a normal job would have collected on the way through, so
       * every screen that reads "when was this started / finished" has an
       * answer rather than a gap it has to explain.
       */
      const job = await addJob({
        customerName: customer.trim() || (dealer && !dealer.inHouse ? dealer.name : "Walk-in"),
        phone: phone.trim() || dealer?.contact || "",
        brand: brand.trim(),
        model: model.trim(),
        imei: imei.trim() || undefined,
        issue: fault.trim(),
        technician,
        status: "Completed",
        priority: "Normal",
        estimatedCost: charge,
        advancePaid: 0,
        createdAt: now.slice(0, 10),
        estimatedCompletion: now.slice(0, 10),
        startedAt: now,
        completedAt: now,
        completionType: "Normal",
        // The final charge IS the quote here — there was never an earlier one,
        // and leaving originalEstimate empty would make every instant job look
        // like it had been re-quoted.
        originalEstimate: charge,
        revisedEstimate: charge,
        labourCost: labour,
        techRemarks: remarks.trim() || undefined,
        dealer: dealerName,
        dealerId: dealer?.id,
        assignmentSource: "Assigned",
        creationType: "Instant",
      });

      /**
       * Parts go out through the normal request path with autoApprove, which
       * deducts stock in the same transaction the request is written in. Not a
       * direct stock edit: that would leave the parts with no request behind
       * them, so the job would show no parts used and the shrinkage would look
       * like a counting error.
       *
       * Failures here are reported but do not undo the job. The repair
       * happened and the customer is waiting; a part that could not be booked
       * out is a stock correction, not a reason to lose the record of the work.
       */
      const failed: string[] = [];
      for (const u of used) {
        try {
          await requestPart({
            jobId: job.id,
            jobDevice: `${brand} ${model}`.trim(),
            technicianName: technician,
            partName: u.name,
            partSku: u.sku,
            quantity: u.qty,
            note: "Used on an instant repair",
          }, { autoApprove: true });
        } catch {
          failed.push(`${u.name} × ${u.qty}`);
        }
      }

      if (failed.length > 0) {
        toast.dialog(
          "error",
          `${job.id} saved, but some parts were not booked out`,
          `${failed.join(", ")} — check the stock count and issue them from the job if needed.`,
        );
      } else {
        toast.success(`${job.id} recorded as completed.`);
      }
      // Straight into billing rather than back to a list: the customer is
      // still at the counter and wants a receipt.
      setUnsettled(job);
      setBilling(job);
      setBusy(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  /**
   * One block of the form, as a card.
   *
   * Four labelled groups on a bare page read as one long list of fields with
   * some bold text in it — nothing says where one question ends and the next
   * begins. A surface and a titled head per block is what the rest of this app
   * already does, and it is what makes a compact form scannable rather than
   * merely short.
   */
  const section = (
    title: string,
    Icon: typeof Users,
    tint: string,
    children: React.ReactNode,
  ) => (
    <div style={{
      display: "flex", flexDirection: "column", gap: 13,
      background: "var(--bg-card)", border: "1px solid var(--border)",
      borderRadius: 14, padding: "16px 18px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <span style={{
          width: 28, height: 28, borderRadius: 8, flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: `${tint}18`, border: `1px solid ${tint}40`, color: tint,
        }}>
          <Icon size={14} />
        </span>
        <p style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: "0.04em", color: "var(--text-primary)", fontFamily: ff }}>{title}</p>
      </div>
      {children}
    </div>
  );

  return (
    // No max width: the whole point of this form is that it is one screen, and
    // capping it left two thirds of a desktop empty while Parts Used wrapped
    // onto a row of its own.
    <div style={{ display: "flex", flexDirection: "column", gap: 20, fontFamily: ff, width: "100%" }}>

      {unsettled && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "13px 15px", borderRadius: 12, background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.4)" }}>
          <AlertCircle size={16} style={{ color: "#f87171", flexShrink: 0 }} />
          <p style={{ flex: 1, minWidth: 220, fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.55 }}>
            <strong style={{ color: "var(--text-primary)" }}>{unsettled.id} is saved but not paid for.</strong>{" "}
            The repair is recorded and the parts are off stock. Settle the payment to finish it — the details above are locked until you do.
          </p>
          <button
            onClick={() => setBilling(unsettled)}
            style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 18px", borderRadius: 9, border: "1px solid var(--accent)", background: "var(--accent)", color: "var(--accent-fg)", cursor: "pointer", fontSize: 12.5, fontWeight: 700, fontFamily: ff, whiteSpace: "nowrap" }}
          >
            <Check size={13} /> Settle payment
          </button>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "11px 13px", borderRadius: 10, background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.35)" }}>
        <Zap size={15} style={{ color: "#fbbf24", flexShrink: 0, marginTop: 1 }} />
        <p style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.55 }}>
          <strong style={{ color: "var(--text-primary)" }}>For a repair that is already done.</strong>{" "}
          This saves straight to Completed and skips assignment, estimates, advances and device condition —
          all of which describe work that has not happened yet. It becomes an ordinary completed job:
          billable, counted in the technician&apos;s figures, and findable as a previous repair if the device comes back.
        </p>
      </div>

      {/* Four blocks across on a desktop, folding to two and then one as the
          space narrows. auto-fit rather than a fixed count so the fold happens
          at the width the content actually needs, not at a guessed breakpoint. */}
      <div
        // Locked rather than hidden: the cashier should still be able to read
        // back what they entered while the payment is taken.
        inert={locked || undefined}
        style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 26, alignItems: "start", opacity: locked ? 0.55 : 1, pointerEvents: locked ? "none" : undefined }}
      >

        {section("Who it is for", Users, "#60a5fa", (
          <>
            <div>
              <label style={label}>Repair Dealer *</label>
              <select value={dealerName} onChange={e => setDealerName(e.target.value)} style={{ ...input, cursor: "pointer" }}>
                <option value="">Select dealer…</option>
                {dealers.map(d => <option key={d.id} value={d.name}>{d.name}{d.inHouse ? " (in-house)" : ""}</option>)}
              </select>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={label}>Customer</label>
                <input value={customer} onChange={e => setCustomer(e.target.value)} placeholder="Walk-in" style={input} />
              </div>
              <div>
                <label style={label}>Phone</label>
                <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="07X XXX XXXX" style={input} />
              </div>
            </div>
          </>
        ))}

        {section("The device", Smartphone, "#a78bfa", (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={label}>Brand *</label>
                <select value={brand} onChange={e => setBrand(e.target.value)} style={{ ...input, cursor: "pointer" }}>
                  <option value="">Select brand…</option>
                  {brands.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <label style={label}>Model *</label>
                <input value={model} onChange={e => setModel(e.target.value)} placeholder="e.g. Galaxy A14" style={input} />
              </div>
            </div>
            <div>
              {/* Not required, and worth having: it is what makes this repair
                  findable when the same handset comes back under warranty. */}
              <label style={label}>IMEI</label>
              <input value={imei} onChange={e => setImei(e.target.value.replace(/\D/g, ""))} maxLength={15} inputMode="numeric" placeholder="Dial *#06# on the device" style={{ ...input, fontFamily: "monospace" }} />
            </div>
            <div>
              <label style={label}>Fault *</label>
              <input
                list="instant-faults"
                value={fault}
                onChange={e => setFault(e.target.value)}
                placeholder="What was wrong with it"
                style={input}
              />
              {/* The shop's own fault list, same source the normal form uses,
                  so the two stay comparable in reports. Typed entries are
                  still allowed — a rushed counter should not be blocked by a
                  fault nobody has added yet. */}
              <datalist id="instant-faults">
                {faultOptions.map(f => <option key={f} value={f} />)}
              </datalist>
            </div>
          </>
        ))}

        {section("The work", Wrench, "#34d399", (
          <>
            <div>
              <label style={label}>Task completed by *</label>
              <select value={technician} onChange={e => setTechnician(e.target.value)} style={{ ...input, cursor: "pointer" }}>
                <option value="">Select technician…</option>
                {technicians.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
              </select>
              <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4, lineHeight: 1.5 }}>
                Recorded as the technician who finished it, so it counts in their history, performance and charges.
              </p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={label}>Repair charge (Rs.)</label>
                <input type="number" min={0} value={repairCharge} onChange={e => setRepairCharge(e.target.value)} style={input} />
              </div>
              <div>
                <label style={label}>Technician charge (Rs.)</label>
                <input type="number" min={0} value={techCharge} onChange={e => setTechCharge(e.target.value)} style={input} />
              </div>
            </div>
            <div>
              <label style={label}>Job remarks</label>
              <input value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Anything worth recording" style={input} />
            </div>
          </>
        ))}

        {section("Parts used", Package, "#fbbf24", (
          <>
            <div style={{ display: "flex", gap: 8 }}>
              <select value={partSku} onChange={e => setPartSku(e.target.value)} style={{ ...input, flex: 1, cursor: "pointer" }}>
                <option value="">Select a part…</option>
                {parts.map(p => (
                  <option key={p.sku} value={p.sku} disabled={p.stock <= 0}>
                    {p.name} · {p.stock > 0 ? `${p.stock} in stock` : "out of stock"}
                  </option>
                ))}
              </select>
              <input type="number" min={1} value={partQty} onChange={e => setPartQty(e.target.value)} style={{ ...input, width: 74 }} />
              <button
                onClick={addPart}
                disabled={!partSku}
                style={{ display: "flex", alignItems: "center", gap: 5, padding: "0 13px", borderRadius: 9, border: "1px solid var(--accent)", background: "transparent", color: "var(--accent)", cursor: partSku ? "pointer" : "not-allowed", opacity: partSku ? 1 : 0.4, fontSize: 12.5, fontWeight: 700, fontFamily: ff, whiteSpace: "nowrap" }}
              >
                <Plus size={12} /> Add
              </button>
            </div>

            {used.length === 0 ? (
              <p style={{ fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.5 }}>
                Nothing added. Parts booked out here come off stock exactly as they would from a normal job.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {used.map(u => (
                  <div key={u.sku} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 8, background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.name}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)" }}>× {u.qty}</span>
                    <button onClick={() => setUsed(list => list.filter(x => x.sku !== u.sku))} title="Remove" style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", display: "flex" }}>
                      <X size={13} />
                    </button>
                  </div>
                ))}
                <p style={{ fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.5 }}>
                  Comes off stock when this is saved.
                </p>
              </div>
            )}
          </>
        ))}
      </div>

      {error && (
        <div style={{ display: "flex", gap: 9, padding: "11px 13px", borderRadius: 10, background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.35)" }}>
          <AlertCircle size={15} color="#f87171" style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.55 }}>{error}</p>
        </div>
      )}

      {/* The three figures the job is worth, beside the button that commits
          them. They are entered in two different cards and matter together, so
          they are restated here rather than leaving the cashier to add up what
          they just typed. */}
      <div style={{
        display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
        background: "var(--bg-card)", border: "1px solid var(--border)",
        borderRadius: 14, padding: "14px 18px",
      }}>
        <div style={{ display: "flex", gap: 22, flexWrap: "wrap", flex: 1, minWidth: 220 }}>
          {[
            { k: "To bill", v: `Rs. ${charge.toLocaleString()}`, c: "var(--text-primary)" },
            { k: "Technician", v: `Rs. ${labour.toLocaleString()}`, c: labour > 0 ? "#34d399" : "var(--text-muted)" },
            { k: "Parts cost", v: `Rs. ${partsCost.toLocaleString()}`, c: partsCost > 0 ? "#fbbf24" : "var(--text-muted)" },
          ].map(f => (
            <div key={f.k}>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 3 }}>{f.k}</p>
              <p style={{ fontSize: 15, fontWeight: 800, color: f.c, letterSpacing: "-0.01em" }}>{f.v}</p>
            </div>
          ))}
        </div>

        {missing && !locked && (
          <p style={{ fontSize: 12, color: "#fbbf24", lineHeight: 1.5, flexBasis: "100%", order: 3 }}>
            {missing}
          </p>
        )}

        <div style={{ display: "flex", gap: 9, flexShrink: 0 }}>
          <button
            onClick={onCancel}
            disabled={locked}
            title={locked ? "Settle the payment first" : undefined}
            style={{ padding: "10px 18px", borderRadius: 9, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", cursor: locked ? "not-allowed" : "pointer", opacity: locked ? 0.45 : 1, fontSize: 12.5, fontFamily: ff }}
          >
            Cancel
          </button>
          <button
            onClick={locked ? () => setBilling(unsettled) : save}
            disabled={(!locked && !!missing) || busy}
            style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 24px", borderRadius: 9, border: "1px solid var(--accent)", background: "var(--accent)", color: "var(--accent-fg)", cursor: (!locked && missing) || busy ? "not-allowed" : "pointer", opacity: (!locked && missing) || busy ? 0.45 : 1, fontSize: 13, fontWeight: 700, fontFamily: ff, whiteSpace: "nowrap" }}
          >
            <Check size={14} />{busy ? "Saving…" : locked ? "Settle payment" : "Create Instant Job"}
          </button>
        </div>
      </div>

      {/* The same billing form and the same printable the normal handover
          uses. Not a copy: total, discount, amount paid, what is left owing
          and the credit approval all behave identically, because they are
          literally the same component and the same issueJob() call. */}
      {billing && (
        <IssueJobModal
          job={billing}
          // Closing does not walk away from it. The job is saved and unpaid,
          // and the form behind this is locked until it is settled — so this is
          // the moment the visit ended with the device still here, and the
          // customer is told it is ready to collect.
          onClose={() => { setBilling(null); textReadyToCollect(billing); }}
          onIssued={async (data: IssueFormData) => {
            const done = await issueJob(billing, data);
            setUnsettled(null);
            setBilling(null);
            setInvoice(done);
          }}
        />
      )}

      {invoice && (
        <RepairInvoicePreview
          data={invoice}
          onClose={() => { setInvoice(null); onCreated(invoice.job); }}
        />
      )}
    </div>
  );
}
