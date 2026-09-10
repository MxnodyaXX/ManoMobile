"use client";

import { useMemo, useState } from "react";
import {
  History, Plus, X, Check, AlertCircle, Users, Smartphone, Wrench, Package,
  Receipt, CalendarClock,
} from "lucide-react";
import { useRepair, type RepairDealer, type RepairJob, type JobStatus, type CompletionType } from "@/cashier/contexts/RepairContext";
import { useParts } from "@/cashier/contexts/PartsContext";
import { useSales } from "@/cashier/contexts/SalesContext";
import { useAuth } from "@/lib/auth/AuthContext";
import { useTechnicians } from "@/lib/repair/technicians";
import { useOpenInvoices, appendJobToInvoice, setInvoiceClosed } from "@/lib/sales/openInvoices";
import { useDeviceFaults, FALLBACK_FAULTS } from "@/lib/repair/deviceFaults";
import { useDeviceBrands } from "@/lib/repair/brands";
import { useToast } from "@/lib/ui/toast";
import Combobox from "@/cashier/components/shared/Combobox";
import { postJobToCredit } from "@/lib/credit/api";
import { fetchNextInvoiceNo } from "@/lib/sales/invoiceNo";
import { cleanImei, imeiIssue, cleanPhone, phoneIssue, FieldWarning } from "@/lib/ui/identifiers";

const ff = "'Plus Jakarta Sans', sans-serif";

/**
 * A repair that happened before this system knew about it.
 *
 * The shop has years of work in a job book: repairs done, phones collected,
 * money taken, none of it here. That history is worth typing in — it is what
 * answers "have we had this handset before" when it comes back under warranty
 * two years later, and what makes last year's figures mean anything.
 *
 * Neither of the other two doors can take it. The normal wizard books work in
 * to be done, and stamps today on it. The instant form writes up a repair
 * finished minutes ago, and also stamps today on it. A record from March needs
 * March — both ends of it, because the received date and the completed date
 * are different facts and each is on the customer's receipt.
 *
 * So this form asks for the whole job at once, dates included, and writes it
 * exactly as it ended: collected and paid, still on the shelf, or cancelled.
 * What it deliberately does NOT do is behave as if any of it were news —
 * see the notes on silence below.
 *
 * ── What it produces ────────────────────────────────────────────────────────
 * An ordinary repair_jobs row with `creationType: "Backdated"` and its real
 * dates. Sales, repair income, technician figures, customer history and IMEI
 * re-job detection read it like any other job, because it is one. The flag
 * only records which door it came through — see migration 20260907000037.
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

const hint: React.CSSProperties = {
  fontSize: 11, color: "var(--text-muted)", marginTop: 4, lineHeight: 1.5,
};

interface UsedPart { sku: string; name: string; qty: number }

/** Where a finished past record lands in the tabs. */
type LandsIn = "Non-Issued" | "Issued" | "Cancelled";

const today = () => new Date().toISOString().slice(0, 10);

/**
 * A typed date, as an instant.
 *
 * Midday, not midnight. `new Date("2026-03-14T00:00:00")` is local midnight,
 * which in this timezone is the 13th once it reaches UTC — so a job entered
 * for the 14th would read back as the 13th on every screen that slices the
 * date off the stored timestamp. Noon is far enough from both edges that no
 * offset can move the day.
 */
const atNoon = (day: string) => new Date(`${day}T12:00:00`).toISOString();

export default function PastJobForm({ onCreated, onCancel }: {
  onCreated: (landsIn: LandsIn) => void;
  onCancel: () => void;
}) {
  const { addJob, dealers } = useRepair();
  const { parts, requestPart } = useParts();
  const { addSale } = useSales();
  const { profile } = useAuth();
  const { technicians, loading: techLoading, error: techError } = useTechnicians();
  const { faults } = useDeviceFaults();
  const brands = useDeviceBrands();
  const toast = useToast();

  // ── When ──────────────────────────────────────────────────────────────────
  const [received, setReceived] = useState("");
  const [completed, setCompleted] = useState("");
  const [jobNo, setJobNo] = useState("");
  const [dealerJobNo, setDealerJobNo] = useState("");

  // ── Who ───────────────────────────────────────────────────────────────────
  const [dealerName, setDealerName] = useState(() => dealers.find(d => d.inHouse)?.name ?? "");
  const [customer, setCustomer] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  // ── What ──────────────────────────────────────────────────────────────────
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [modelNumber, setModelNumber] = useState("");
  const [imei, setImei] = useState("");
  const [fault, setFault] = useState("");
  const [priority, setPriority] = useState<RepairJob["priority"]>("Normal");

  // ── The work ──────────────────────────────────────────────────────────────
  const [technician, setTechnician] = useState("");
  const [outcome, setOutcome] = useState<CompletionType>("Normal");
  const [repairCharge, setRepairCharge] = useState("0");
  const [techCharge, setTechCharge] = useState("0");
  const [remarks, setRemarks] = useState("");
  const [futureFaults, setFutureFaults] = useState("");

  // ── Parts ─────────────────────────────────────────────────────────────────
  const [used, setUsed] = useState<UsedPart[]>([]);
  const [partSku, setPartSku] = useState("");
  const [partQty, setPartQty] = useState("1");
  /**
   * Off by default, and that is the important half.
   *
   * The parts on a job from March came off the shelf in March. Today's stock
   * count already reflects that, whether or not this system watched it happen
   * — so deducting them now would take the same screen twice and leave the
   * shop short on paper. The parts are still recorded against the job either
   * way; the checkbox only decides whether stock moves.
   */
  const [deductStock, setDeductStock] = useState(false);

  // ── How it ended ──────────────────────────────────────────────────────────
  /**
   * How the job finished — which is two questions, not one.
   *
   * Whether the device left the shop is a status; who it left with is not. A
   * job that came in through an external dealer goes back to that dealer, not
   * over the counter to its owner, and the shop's own paperwork says so — but
   * the row is Delivered either way. Keeping them as separate endings here
   * means the handover records who actually took it, instead of every past
   * record claiming the customer collected it in person.
   */
  const [ending, setEnding] = useState<"Delivered" | "Dealer" | "Completed" | "Cancelled">("Delivered");
  /** Did the device leave? The half of `ending` most of this form cares about. */
  const collected = ending === "Delivered" || ending === "Dealer";
  const [amountPaid, setAmountPaid] = useState("");
  const [advance, setAdvance] = useState("0");
  const [payMethod, setPayMethod] = useState<"Cash" | "Card" | "Bank Transfer" | "Online">("Cash");
  /**
   * Which invoice this repair goes on.
   *
   * A dealer's month comes back as one bill covering nine phones, so for an
   * outside dealer the useful default is joining an invoice already being
   * built rather than raising a tenth. "new" starts one; anything else is the
   * number of an open invoice to add to.
   */
  const [invoiceMode, setInvoiceMode] = useState<"new" | string>("new");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [closing, setClosing] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [postBalance, setPostBalance] = useState(false);

  const [sessionBrands, setSessionBrands] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** What has gone in during this sitting. Old records arrive in batches, so
   *  the form stays put and counts rather than navigating away each time. */
  const [entered, setEntered] = useState<{ id: string; landsIn: LandsIn }[]>([]);

  /**
   * The brand list, plus anything typed during this sitting.
   *
   * A job book from three years ago has makes the registry has never seen, and
   * a dropdown that cannot take them forces the typist to either mis-file the
   * record under the nearest brand or stop and go and add it in Admin Control.
   * Typed once here, it is on offer for the rest of the batch.
   */
  const brandOptions = useMemo(
    () => Array.from(new Set([...brands, ...sessionBrands])).sort(),
    [brands, sessionBrands],
  );

  const faultOptions = faults.length > 0 ? faults.map(f => f.label) : FALLBACK_FAULTS;
  const dealer: RepairDealer | undefined = dealers.find(d => d.name === dealerName);
  // Scoped to this dealer: an invoice is a bill to somebody, and offering last
  // month's Phone House invoice while entering a Thirasara Max repair is
  // offering a mistake.
  const { invoices: openInvoices, reload: reloadInvoices } =
    useOpenInvoices(dealer && !dealer.inHouse ? dealer.id : null);
  /**
   * Whose customer this is.
   *
   * On an in-house job the shop's customer is the person who owns the phone,
   * so their name and number are the record. On a dealer job the customer IS
   * the dealer — the owner never came here, we do not have their number, and
   * three empty boxes inviting one are three chances to write down whoever
   * happened to be standing at the counter.
   */
  const ownCustomer = !dealerName || !!dealer?.inHouse;

  const charge = Math.max(0, parseFloat(repairCharge) || 0);
  const labour = Math.max(0, parseFloat(techCharge) || 0);
  const advanceAmt = Math.max(0, parseFloat(advance) || 0);
  // On a collected job the paid box is the whole story and the advance is part
  // of it; on one still on the shelf, the advance is all that was ever taken.
  const paid = collected
    ? Math.max(0, amountPaid === "" ? charge : parseFloat(amountPaid) || 0)
    : advanceAmt;
  const balance = Math.max(0, charge - paid);

  const turnaround = useMemo(() => {
    if (!received || !completed) return null;
    const days = Math.round(
      (new Date(`${completed}T12:00:00`).getTime() - new Date(`${received}T12:00:00`).getTime()) / 86_400_000,
    );
    return Number.isFinite(days) ? days : null;
  }, [received, completed]);

  const endLabel = ending === "Cancelled" ? "Cancelled on" : "Completed on";

  const missing =
    !received ? "Enter the date the device was received."
    : !completed ? `Enter the date the job was ${ending === "Cancelled" ? "cancelled" : "completed"}.`
    : received > today() ? "A past record cannot be dated in the future."
    : completed < received ? `The ${endLabel.toLowerCase()} date cannot be before the received date.`
    : completed > today() ? "The completion date cannot be in the future."
    : !dealerName ? "Choose the repair dealer."
    : !brand.trim() || !model.trim() ? "Enter the device brand and model."
    : !fault.trim() ? "Say what was wrong with it."
    : !technician ? "Choose who worked on it."
    : ending === "Cancelled" && !cancelReason.trim() ? "Say why the job was cancelled."
    // The in-house dealer IS this shop. There is nobody to hand it back to.
    : ending === "Dealer" && (!dealer || dealer.inHouse) ? "An in-house job goes back to its own customer — pick the dealer it came from, or Collected by the customer."
    : null;

  const addPart = () => {
    const p = parts.find(x => x.sku === partSku);
    const qty = Math.max(1, Math.floor(parseFloat(partQty) || 0));
    if (!p || qty <= 0) return;
    setUsed(u => {
      const at = u.findIndex(x => x.sku === p.sku);
      if (at < 0) return [...u, { sku: p.sku, name: p.name, qty }];
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

  /**
   * Everything about this device, cleared for the next record.
   *
   * The dates, the dealer and the technician stay: a batch out of one job book
   * is usually the same week, the same dealer and often the same person, and
   * retyping those forty times is how a shop gives up halfway through.
   */
  const clearDevice = () => {
    setJobNo(""); setDealerJobNo("");
    setCustomer(""); setPhone(""); setEmail("");
    setBrand(""); setModel(""); setModelNumber(""); setImei(""); setFault("");
    setPriority("Normal"); setOutcome("Normal");
    setRepairCharge("0"); setTechCharge("0"); setRemarks(""); setFutureFaults("");
    setUsed([]); setPartSku(""); setPartQty("1");
    setAmountPaid(""); setAdvance("0"); setInvoiceNo(""); setCancelReason("");
    setPostBalance(false);
  };

  const save = async () => {
    if (missing || busy) return;
    setBusy(true);
    setError(null);

    const receivedISO = atNoon(received);
    const endedISO = atNoon(completed);
    // Both collected endings are the same status. What separates them is who
    // signed for it, which is a fact about the handover, not about the job.
    const status: JobStatus = collected ? "Delivered" : ending === "Cancelled" ? "Cancelled" : "Completed";
    const landsIn: LandsIn = collected ? "Issued" : ending === "Cancelled" ? "Cancelled" : "Non-Issued";
    const who = customer.trim() || (dealer && !dealer.inHouse ? dealer.name : "Walk-in");

    try {
      /**
       * Written as it ended, with the dates it ended on.
       *
       * createdAt carries a time, which is what tells the row mapper this date
       * was chosen rather than observed — every other path passes a bare day
       * and lets the database stamp now(). See jobToRow.
       */
      const job = await addJob({
        id: jobNo.trim() || undefined,
        customerName: who,
        phone: phone.trim() || dealer?.contact || "",
        customerEmail: email.trim() || undefined,
        brand: brand.trim(),
        model: model.trim(),
        modelNumber: modelNumber.trim() || undefined,
        imei: imei.trim() || undefined,
        issue: fault.trim(),
        technician,
        status,
        priority,
        estimatedCost: charge,
        advancePaid: paid,
        createdAt: receivedISO,
        // Nothing was ever promised on a record of the past, so the promised
        // date is the day it actually finished. Leaving it empty would put
        // every imported job on the overdue list.
        estimatedCompletion: completed,
        startedAt: receivedISO,
        completedAt: ending === "Cancelled" ? undefined : endedISO,
        cancelledAt: ending === "Cancelled" ? endedISO : undefined,
        cancelReason: ending === "Cancelled" ? cancelReason.trim() : undefined,
        cancelledBy: ending === "Cancelled" ? (profile?.fullName?.trim() || "Cashier") : undefined,
        completionType: outcome,
        // The charge IS the quote on a record of finished work — there was no
        // earlier one to compare it against, and an empty original estimate
        // would make every imported job look as if it had been re-quoted.
        originalEstimate: charge,
        revisedEstimate: charge,
        labourCost: labour,
        techRemarks: remarks.trim() || undefined,
        futureFaults: futureFaults.trim() || undefined,
        // Recorded on the job itself rather than only as stock movements,
        // because with the deduction switched off there would otherwise be no
        // trace of what was fitted.
        partsUsed: used.length > 0 ? used.map(u => `${u.name} × ${u.qty}`) : undefined,
        dealer: dealerName,
        dealerId: dealer?.id,
        dealerJobNo: dealerJobNo.trim() || undefined,
        assignmentSource: "Assigned",
        creationType: "Backdated",
        handover: collected ? {
          // Named for whoever actually took it. On a dealer job that is the
          // dealer — the customer never came here, and a handover claiming
          // they did is the kind of record that is quoted back at the shop.
          collectedBy: ending === "Dealer" ? (dealer?.name ?? dealerName) : who,
          relationship: ending === "Dealer" ? "Repair dealer" : "Owner",
          idVerified: false,
          balanceSettled: paid,
          paymentMethod: payMethod,
          handoverSignature: "",
          warrantyCardIssued: false,
          handedOverBy: profile?.fullName?.trim() || "Cashier",
          // The warranty clock starts from the real handover, not from today.
          handedOverAt: endedISO,
        } : undefined,
      });

      // Only if asked. See deductStock.
      const failed: string[] = [];
      if (deductStock) {
        for (const u of used) {
          try {
            await requestPart({
              jobId: job.id,
              jobDevice: `${brand} ${model}`.trim(),
              technicianName: technician,
              partName: u.name,
              partSku: u.sku,
              quantity: u.qty,
              note: "Used on a past repair, entered later",
            }, { autoApprove: true });
          } catch {
            failed.push(`${u.name} × ${u.qty}`);
          }
        }
      }

      /**
       * A collected job was a sale, and it was a sale on the day it was
       * collected — not today. Recording it with its own date is the whole
       * point: it lands in the month it belongs to, so last year's repair
       * income is last year's rather than a spike on the day somebody sat down
       * to type the job book in.
       */
      /**
       * Onto the invoice already open, where one was chosen.
       *
       * Not addSale: that raises a new invoice, which is the thing being
       * avoided. The amounts travel with the job, so the bill stays equal to
       * the lines it is made of.
       */
      if (collected && charge > 0 && invoiceMode !== "new") {
        await appendJobToInvoice(invoiceMode, job.id, charge, paid);
        await reloadInvoices();
      } else if (collected && charge > 0) {
        const no = invoiceNo.trim() || await fetchNextInvoiceNo();
        addSale(
          {
            invoiceNo: no,
            date: completed,
            customer: who,
            category: "Repair",
            items: `${brand} ${model}`.trim() || job.id,
            total: charge,
            subtotal: charge,
            discountAmount: 0,
            paid,
            status: "Paid",
            paymentMethod: payMethod === "Online" ? "Bank Transfer" : payMethod,
            cashier: profile?.fullName?.trim() || undefined,
          },
          {
            customerPhone: phone.trim() || dealer?.contact || null,
            jobIds: [job.id],
            creditAccountId: null,
          },
        );
      }

      /**
       * An old balance only reaches a live account when somebody says so.
       *
       * Posting it automatically would be the wrong default by a distance: a
       * dealer's account is a running total that gets settled, and most of
       * what is being typed in here was paid years ago outside this system.
       * Adding those charges back would make every statement wrong at once.
       */
      if (postBalance && balance > 0) {
        try {
          await postJobToCredit(job.id);
        } catch (e) {
          toast.dialog(
            "error",
            `${job.id} was saved, but the balance did not reach the account`,
            e instanceof Error ? e.message : String(e),
          );
        }
      }

      if (failed.length > 0) {
        toast.dialog(
          "error",
          `${job.id} saved, but some parts were not booked out`,
          `${failed.join(", ")} — check the stock count and issue them from the job if needed.`,
        );
      } else {
        toast.success(
          ending === "Dealer"
            ? `${job.id} recorded — received ${received}, back to ${dealer?.name ?? dealerName} on ${completed}.`
            : `${job.id} recorded — received ${received}, ${ending === "Cancelled" ? "cancelled" : "completed"} ${completed}.`,
        );
      }

      setEntered(list => [{ id: job.id, landsIn }, ...list]);
      clearDevice();
      setBusy(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  /**
   * One block of the form, as a card.
   *
   * `aside` is for the one fact a block can state about itself — the days in
   * the shop, the number of parts — put in the head rather than given a row of
   * its own. A form this long gets long by adding rows that say one word.
   */
  const section = (
    title: string,
    Icon: typeof Users,
    tint: string,
    children: React.ReactNode,
    aside?: React.ReactNode,
  ) => (
    <div style={{
      display: "flex", flexDirection: "column", gap: 11,
      background: "var(--bg-card)", border: "1px solid var(--border)",
      borderRadius: 14, padding: "13px 15px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{
          width: 25, height: 25, borderRadius: 7, flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: `${tint}18`, border: `1px solid ${tint}40`, color: tint,
        }}>
          <Icon size={13} />
        </span>
        <p style={{ flex: 1, fontSize: 12, fontWeight: 800, letterSpacing: "0.04em", color: "var(--text-primary)", fontFamily: ff }}>{title}</p>
        {aside}
      </div>
      {children}
    </div>
  );

  /** The head's one-fact pill. */
  const pill = (text: string, tint: string) => (
    <span style={{
      fontSize: 10, fontWeight: 800, letterSpacing: "0.04em", padding: "2px 7px",
      borderRadius: 6, color: tint, background: `${tint}1a`, border: `1px solid ${tint}40`,
      whiteSpace: "nowrap", flexShrink: 0,
    }}>{text}</span>
  );

  /** A labelled control, with an optional note under it. */
  const field = (text: string, control: React.ReactNode, note?: string) => (
    <div>
      <label style={label}>{text}</label>
      {control}
      {note && <p style={hint}>{note}</p>}
    </div>
  );

  /** Two controls sharing a row — the form's default shape, so it is written once. */
  const two = (a: React.ReactNode, b: React.ReactNode) => (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>{a}{b}</div>
  );

  const check = (on: boolean, set: (v: boolean) => void, text: string, sub: string) => (
    <label style={{ display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer" }}>
      <input type="checkbox" checked={on} onChange={e => set(e.target.checked)} style={{ accentColor: "var(--accent)", marginTop: 1, flexShrink: 0 }} />
      <span>
        <span style={{ fontSize: 12.5, color: "var(--text-primary)", fontWeight: 600 }}>{text}</span>
        <span style={{ ...hint, display: "block", marginTop: 1 }}>{sub}</span>
      </span>
    </label>
  );

  /**
   * The blocks, in three stacks rather than six loose cards.
   *
   * Left to their own devices on an auto-fitting grid, six cards of six
   * different heights tile into a row of ragged columns with a hole under each
   * short one — on a wide screen, more empty space than form. Stacking them in
   * pairs down three columns fills top-down instead, so the only ragged edge
   * left is the bottom of one column.
   *
   * The pairing is also the reading order when it folds to a single column on
   * a narrow screen: when and who, then the device and the work done to it,
   * then what came out of stock and what was paid.
   */
  const stack = (children: React.ReactNode) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>{children}</div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, fontFamily: ff, width: "100%" }}>

      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 13px", borderRadius: 10, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.35)" }}>
        <History size={15} style={{ color: "#f59e0b", flexShrink: 0, marginTop: 1 }} />
        <p style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.55 }}>
          <strong style={{ color: "var(--text-primary)" }}>For work that happened before the system held it.</strong>{" "}
          Both dates are typed, and the record is written exactly as it ended. Nothing is sent to the
          customer, nothing is printed, and stock only moves if you ask it to.
        </p>
      </div>

      {entered.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "10px 14px", borderRadius: 11, background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.4)" }}>
          <Check size={15} style={{ color: "#4ade80", flexShrink: 0 }} />
          <p style={{ flex: 1, minWidth: 200, fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.55 }}>
            <strong style={{ color: "var(--text-primary)" }}>
              {entered.length} record{entered.length === 1 ? "" : "s"} entered — latest {entered[0].id}.
            </strong>{" "}
            The dates, dealer and technician are kept for the next one.
          </p>
          <button
            onClick={() => onCreated(entered[0].landsIn)}
            style={{ padding: "7px 15px", borderRadius: 9, border: "1px solid var(--accent)", background: "transparent", color: "var(--accent)", cursor: "pointer", fontSize: 12.5, fontWeight: 700, fontFamily: ff, whiteSpace: "nowrap" }}
          >
            View in {entered[0].landsIn}
          </button>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(310px, 1fr))", gap: 14, alignItems: "start" }}>

        {stack(<>
          {section("When and from", CalendarClock, "#f59e0b", (
            <>
              {two(
                field("Received on *", <input type="date" max={today()} value={received} onChange={e => setReceived(e.target.value)} style={input} />),
                field(`${endLabel} *`, <input type="date" max={today()} value={completed} onChange={e => setCompleted(e.target.value)} style={input} />),
              )}
              {field("Repair dealer *", (
                <select
                  value={dealerName}
                  onChange={e => {
                    const next = e.target.value;
                    setDealerName(next);
                    // Switching to an outside dealer takes the customer boxes
                    // off screen; leaving their contents behind would file a
                    // walk-in's name against a dealer's job with nothing
                    // visible to say so.
                    const d = dealers.find(x => x.name === next);
                    if (next && !d?.inHouse) { setCustomer(""); setPhone(""); setEmail(""); }
                  }}
                  style={{ ...input, cursor: "pointer" }}
                >
                  <option value="">Select dealer…</option>
                  {dealers.map(d => <option key={d.id} value={d.name}>{d.name}{d.inHouse ? " (in-house)" : ""}</option>)}
                </select>
              ), ownCustomer ? undefined : "The dealer is the customer on this job.")}

              {two(
                field("Job number", <input value={jobNo} onChange={e => setJobNo(e.target.value)} placeholder="Next number" style={{ ...input, fontFamily: "monospace" }} />,
                  // The book already numbered it, and the customer's receipt
                  // says so. Left blank it takes the next one.
                  "Blank takes the next one"),
                field("Dealer job no.", <input value={dealerJobNo} onChange={e => setDealerJobNo(e.target.value)} placeholder="Their docket" style={input} />),
              )}
            </>
          ), turnaround !== null && turnaround >= 0
            ? pill(turnaround === 0 ? "SAME DAY" : `${turnaround} DAY${turnaround === 1 ? "" : "S"}`, "#f59e0b")
            : undefined)}

          {/* Only where there is a customer of our own to name. A dealer job's
              customer is the dealer, already chosen above. */}
          {ownCustomer && section("Who it was for", Users, "#60a5fa", (
            <>
              {two(
                field("Customer", <input value={customer} onChange={e => setCustomer(e.target.value)} placeholder="Walk-in" style={input} />),
                field("Phone", (
                  <>
                    <input value={phone} onChange={e => setPhone(cleanPhone(e.target.value))} inputMode="tel" placeholder="07X XXX XXXX" style={input} />
                    <FieldWarning text={phoneIssue(phone)} />
                  </>
                )),
              )}
              {field("Email", <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Optional" style={input} />)}
            </>
          ))}
        </>)}

        {stack(<>
          {section("The device", Smartphone, "#a78bfa", (
            <>
              {two(
                field("Brand *", (
                  <Combobox
                    value={brand}
                    options={brandOptions}
                    onChange={setBrand}
                    onAddOption={b => setSessionBrands(prev => prev.includes(b) ? prev : [...prev, b])}
                    placeholder="Type or select…"
                  />
                )),
                field("Model *", <input value={model} onChange={e => setModel(e.target.value)} placeholder="e.g. Galaxy A14" style={input} />),
              )}
              {two(
                field("Model number", <input value={modelNumber} onChange={e => setModelNumber(e.target.value)} placeholder="SM-A145F" style={{ ...input, fontFamily: "monospace" }} />),
                // The single most valuable field on an old record: it is what
                // makes this repair findable when the same handset comes back.
                field("IMEI", (
                  <>
                    <input value={imei} onChange={e => setImei(cleanImei(e.target.value))} maxLength={15} inputMode="numeric" placeholder="From the job book" style={{ ...input, fontFamily: "monospace" }} />
                    <FieldWarning text={imeiIssue(imei)} />
                  </>
                )),
              )}
              {two(
                field("Fault *", (
                  <>
                    <input list="past-faults" value={fault} onChange={e => setFault(e.target.value)} placeholder="What was wrong" style={input} />
                    <datalist id="past-faults">
                      {faultOptions.map(x => <option key={x} value={x} />)}
                    </datalist>
                  </>
                )),
                field("Priority", (
                  <select value={priority} onChange={e => setPriority(e.target.value as RepairJob["priority"])} style={{ ...input, cursor: "pointer" }}>
                    {["Low", "Normal", "High", "Urgent"].map(x => <option key={x} value={x}>{x}</option>)}
                  </select>
                )),
              )}
            </>
          ))}

          {section("The work", Wrench, "#34d399", (
            <>
              {two(
                field("Worked on by *", (
                  <select value={technician} onChange={e => setTechnician(e.target.value)} style={{ ...input, cursor: "pointer" }}>
                    <option value="">{techLoading ? "Loading…" : "Select technician…"}</option>
                    {technicians.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                  </select>
                ),
                  /* An empty dropdown is three different problems wearing one
                     face — still loading, failed to load, or nobody on the
                     roster — and the box alone cannot say which. */
                  techError ? `Could not load the roster: ${techError}`
                  : techLoading ? "Loading the roster…"
                  : technicians.length === 0 ? "No technicians on the staff list — add them under Admin Control → Staff."
                  : "Counts in the month it finished"),
                field("Outcome", (
                  <select value={outcome} onChange={e => setOutcome(e.target.value as CompletionType)} style={{ ...input, cursor: "pointer" }}>
                    <option value="Normal">Repaired and charged</option>
                    <option value="FOC">Repaired free of charge</option>
                    <option value="Return">Returned unrepaired</option>
                  </select>
                )),
              )}
              {two(
                field("Repair charge (Rs.)", <input type="number" min={0} value={repairCharge} onChange={e => setRepairCharge(e.target.value)} style={input} />),
                field("Technician charge (Rs.)", <input type="number" min={0} value={techCharge} onChange={e => setTechCharge(e.target.value)} style={input} />),
              )}
              {field("Job remarks", <input value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="What was done" style={input} />)}
              {field("Future faults noted", <input value={futureFaults} onChange={e => setFutureFaults(e.target.value)} placeholder="Anything flagged for next time" style={input} />)}
            </>
          ))}
        </>)}

        {stack(<>
          {section("Parts used", Package, "#fbbf24", (
            <>
              <div style={{ display: "flex", gap: 8 }}>
                {/* Out-of-stock parts stay pickable, unlike the instant form:
                    what was fitted in March does not depend on what is on the
                    shelf today. */}
                <select value={partSku} onChange={e => setPartSku(e.target.value)} style={{ ...input, flex: 1, cursor: "pointer" }}>
                  <option value="">Select a part…</option>
                  {parts.map(x => <option key={x.sku} value={x.sku}>{x.name}</option>)}
                </select>
                <input type="number" min={1} value={partQty} onChange={e => setPartQty(e.target.value)} style={{ ...input, width: 68 }} />
                <button
                  onClick={addPart}
                  disabled={!partSku}
                  style={{ display: "flex", alignItems: "center", gap: 5, padding: "0 12px", borderRadius: 9, border: "1px solid var(--accent)", background: "transparent", color: "var(--accent)", cursor: partSku ? "pointer" : "not-allowed", opacity: partSku ? 1 : 0.4, fontSize: 12.5, fontWeight: 700, fontFamily: ff, whiteSpace: "nowrap" }}
                >
                  <Plus size={12} /> Add
                </button>
              </div>

              {used.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {used.map(u => (
                    <div key={u.sku} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 8, background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
                      <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.name}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)" }}>× {u.qty}</span>
                      <button onClick={() => setUsed(list => list.filter(x => x.sku !== u.sku))} title="Remove" style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", display: "flex" }}>
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {check(
                deductStock, setDeductStock,
                "Take these off current stock",
                "They left the shelf when the repair happened, so today's count usually already includes them.",
              )}
            </>
          ), used.length > 0 ? pill(`${used.length} FITTED`, "#fbbf24") : undefined)}

          {section("How it ended", Receipt, "#f472b6", (
            <>
              {field("Final state *", (
                <select value={ending} onChange={e => setEnding(e.target.value as typeof ending)} style={{ ...input, cursor: "pointer" }}>
                  <option value="Delivered">Collected by the customer</option>
                  <option value="Dealer">Delivered to the dealer</option>
                  <option value="Completed">Repaired, never collected</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              ))}

              {ending === "Cancelled" ? (
                field("Cancellation reason *", <input value={cancelReason} onChange={e => setCancelReason(e.target.value)} placeholder="Why it was called off" style={input} />)
              ) : collected ? (
                <>
                  {two(
                    field("Amount paid (Rs.)", <input type="number" min={0} value={amountPaid} onChange={e => setAmountPaid(e.target.value)} placeholder={String(charge)} style={input} />),
                    field("Paid by", (
                      <select value={payMethod} onChange={e => setPayMethod(e.target.value as typeof payMethod)} style={{ ...input, cursor: "pointer" }}>
                        {["Cash", "Card", "Bank Transfer", "Online"].map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    )),
                  )}
                  {/* An outside dealer's work is billed in batches, so the
                      invoice is something to join rather than a number to type
                      afresh on every record. A walk-in gets one invoice each
                      and never sees this. */}
                  {!ownCustomer && openInvoices.length > 0 && field("Put it on", (
                    <select value={invoiceMode} onChange={e => setInvoiceMode(e.target.value)} style={{ ...input, cursor: "pointer" }}>
                      <option value="new">A new invoice</option>
                      {openInvoices.map(inv => (
                        <option key={inv.invoiceNo} value={inv.invoiceNo}>
                          {inv.invoiceNo} · {inv.soldOn} · {inv.jobIds.length} job{inv.jobIds.length === 1 ? "" : "s"} · Rs. {inv.total.toLocaleString()}
                        </option>
                      ))}
                    </select>
                  ), invoiceMode === "new"
                      ? "Starts an invoice for this dealer and leaves it open for the rest of the batch."
                      : "This repair is added to that invoice, and its total goes up by the charge.")}

                  {invoiceMode === "new" && field("Invoice number", <input value={invoiceNo} onChange={e => setInvoiceNo(e.target.value)} placeholder="Next number" style={{ ...input, fontFamily: "monospace" }} />,
                    `Recorded as a sale dated ${completed || "the completion date"}, so it counts in that month.`)}

                  {/* Shutting it is the last act of entering a batch, so it
                      belongs here rather than on another screen. Reversible,
                      because "that was the last one" is easy to be wrong
                      about — see set_sale_closed. */}
                  {invoiceMode !== "new" && (
                    <button
                      type="button"
                      disabled={closing}
                      onClick={async () => {
                        const no = invoiceMode;
                        setClosing(true);
                        try {
                          await setInvoiceClosed(no, true);
                          await reloadInvoices();
                          setInvoiceMode("new");
                          toast.success(`${no} closed — nothing more can be added to it.`);
                        } catch (e) {
                          setError(e instanceof Error ? e.message : String(e));
                        } finally {
                          setClosing(false);
                        }
                      }}
                      style={{ alignSelf: "flex-start", padding: "7px 14px", borderRadius: 9, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", cursor: closing ? "wait" : "pointer", fontSize: 12, fontWeight: 600, fontFamily: ff }}
                    >
                      {closing ? "Closing…" : `Close ${invoiceMode} — that is the whole batch`}
                    </button>
                  )}
                </>
              ) : (
                field("Advance taken (Rs.)", <input type="number" min={0} value={advance} onChange={e => setAdvance(e.target.value)} style={input} />,
                  "Stays in Non-Issued, waiting for a collection that never came.")
              )}

              {balance > 0 && ending !== "Cancelled" && check(
                postBalance, setPostBalance,
                `Put the Rs. ${balance.toLocaleString()} still owing on the account`,
                "Most of what is typed in here was settled years ago outside this system.",
              )}
            </>
          ))}
        </>)}
      </div>

      {error && (
        <div style={{ display: "flex", gap: 9, padding: "11px 13px", borderRadius: 10, background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.35)" }}>
          <AlertCircle size={15} color="#f87171" style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.55 }}>{error}</p>
        </div>
      )}

      {/* The figures the record is worth, beside the button that commits them.
          They are entered in three different cards and matter together. */}
      <div style={{
        display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
        background: "var(--bg-card)", border: "1px solid var(--border)",
        borderRadius: 14, padding: "12px 16px",
      }}>
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", flex: 1, minWidth: 220 }}>
          {[
            { k: "Charged", v: charge, c: "var(--text-primary)" },
            { k: "Paid", v: paid, c: paid > 0 ? "#34d399" : "var(--text-muted)" },
            { k: "Balance", v: balance, c: balance > 0 ? "#fbbf24" : "var(--text-muted)" },
            { k: "Technician", v: labour, c: labour > 0 ? "#34d399" : "var(--text-muted)" },
            { k: "Parts cost", v: partsCost, c: partsCost > 0 ? "#fbbf24" : "var(--text-muted)" },
          ].map(x => (
            <div key={x.k}>
              <p style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 2 }}>{x.k}</p>
              <p style={{ fontSize: 14.5, fontWeight: 800, color: x.c, letterSpacing: "-0.01em" }}>Rs. {x.v.toLocaleString()}</p>
            </div>
          ))}
        </div>

        {missing && (
          <p style={{ fontSize: 12, color: "#fbbf24", lineHeight: 1.5, flexBasis: "100%", order: 3 }}>
            {missing}
          </p>
        )}

        <div style={{ display: "flex", gap: 9, flexShrink: 0 }}>
          <button
            onClick={onCancel}
            style={{ padding: "9px 17px", borderRadius: 9, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer", fontSize: 12.5, fontFamily: ff }}
          >
            Done
          </button>
          <button
            onClick={save}
            disabled={!!missing || busy}
            style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 22px", borderRadius: 9, border: "1px solid var(--accent)", background: "var(--accent)", color: "var(--accent-fg)", cursor: missing || busy ? "not-allowed" : "pointer", opacity: missing || busy ? 0.45 : 1, fontSize: 13, fontWeight: 700, fontFamily: ff, whiteSpace: "nowrap" }}
          >
            <Check size={14} />{busy ? "Saving…" : "Save past record"}
          </button>
        </div>
      </div>
    </div>
  );
}
