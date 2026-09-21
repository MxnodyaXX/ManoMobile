"use client";

import { useState, useRef, useMemo } from "react";
import { useCashRegister } from "@/cashier/contexts/CashRegisterContext";
import { useSales } from "@/cashier/contexts/SalesContext";
import {
  Search, ArrowLeft, Printer, ChevronDown,
  Building2, CheckCircle, Clock, Wrench, TrendingUp, AlertCircle,
  CreditCard, X, BookUser, Undo2, RotateCcw,
  Pencil, Check, ShoppingBag,
} from "lucide-react";
import { createPortal } from "react-dom";
import CreditCustomerPicker, { type POSCreditCustomer } from "./CreditCustomerPicker";
import RepairInvoicePrintable, { repairInvoicePageCss } from "@/cashier/components/sales/RepairInvoicePrintable";
import { useRepair, findDealer, isInHouseDealer, dealerKey } from "@/cashier/contexts/RepairContext";
import { useCreditAccounts, reconcileJobDiscount } from "@/lib/credit/api";
import type { CompletionType } from "@/cashier/contexts/RepairContext";
import { fetchNextInvoiceNo } from "@/lib/sales/invoiceNo";
import InvoiceNoBadge from "@/cashier/components/sales/InvoiceNoBadge";
import { usePersistInvoiceDocument } from "@/lib/sales/invoiceDoc";
import { useAuth } from "@/lib/auth/AuthContext";
import { useToast } from "@/lib/ui/toast";
import { useMyPermissions } from "@/lib/settings/staffRules";
import { useJobRefunds, refundRepairAdvance } from "@/lib/accounts/cashReturns";
import { cleanImei, cleanPhone } from "@/lib/ui/identifiers";
import { warrantyLine } from "@/lib/repair/warrantyLine";
import { useAccessories } from "@/cashier/contexts/AccessoriesContext";
import AddProductsModal, { extraLineTotal, type ExtraLine } from "@/cashier/components/sales/AddProductsModal";
import type { NewSaleItem } from "@/lib/sales/saleItems";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CompletedRepair {
  id: string;
  dealer: string;
  customerName: string;
  /** The number recorded on the job. Carried through so the invoice can take
   *  the customer straight off the repair rather than have it retyped. */
  phone?: string;
  /**
   * The number on the originating dealer's own docket.
   *
   * A dealer rings up about "#5824", not RM-014 — theirs is the number written
   * on the bag the handset came in, and ours is the one this system uses. A
   * till that can only be searched by ours makes the person at the counter
   * translate before they can look anything up.
   */
  dealerJobNo?: string;
  /** Handed over already, but never billed — see invoiceable. */
  uninvoiced?: boolean;
  /**
   * Why the handset could not be identified, where that was recorded.
   *
   * The difference between "nobody has looked yet" and "this was looked at and
   * cannot be known" — a dead phone has no IMEI to read off it. Carried here
   * so the invoice gate can insist on an IMEI without insisting on the
   * impossible. See migration 20260906000028.
   */
  unidentifiedReason?: string | null;
  brand: string;
  model: string;
  imei: string;
  warranty: string;
  advance: number;
  unitPrice: number;
  discount: number;
  /**
   * How the job ended: Normal, Return (device came back unrepaired) or FOC
   * (done and not charged for). "Rs. 0" in the price column is the one thing
   * that does not tell these apart — or tell them from a job nobody has
   * priced yet.
   */
  completionType?: CompletionType;
  /** What the shop owes back, as the technician set it on a Cash Return job. */
  cashReturnAmount?: number;
  /** The earlier repair this job repeats — printed on the refund so the
   *  invoice says which job the money is coming back from. */
  rejobOf?: string | null;
  /** Set once everything owed has actually been handed back. */
  advanceRefundedOn?: string | null;
  /** Only actually shown for an outside dealer's jobs — see the Step 2 table,
   *  where the customer/advance columns swap for these plus a fault column. */
  issue: string;
  createdAt: string;
  completedAt?: string;
}

interface DealerProfile {
  phone: string;
  address: string;
  since: string;
  stats: { total: number; completed: number; pending: number; inProgress: number };
  totalEarned: number;
  /**
   * What the dealer owes the shop: the balance on their credit account, from
   * the ledger. Null for a dealer with no account — nothing has ever been
   * left unpaid — and for the in-house entry, whose customers each carry
   * their own account rather than the shop owing itself.
   */
  onAccount: number | null;
  /** Finished work not yet invoiced. Not a debt — it has not been billed. */
  unbilled: number;
}

/**
 * What kind of job this was, in one word.
 *
 * Normal is left blank rather than labelled: it is the overwhelming majority,
 * and a column where nearly every row says the same thing trains the eye to
 * skip it — which is exactly when the one row that says Returned gets missed.
 */
function JobTypeTag({ type }: { type?: CompletionType }) {
  const cfg = type === "Cash Return"
    ? { label: "CASH RETURN", color: "#60a5fa", tint: "rgba(96,165,250,0.10)", edge: "rgba(96,165,250,0.30)" }
    : type === "Return"
      ? { label: "RETURNED", color: "#f87171", tint: "rgba(248,113,113,0.10)", edge: "rgba(248,113,113,0.30)" }
      : type === "FOC"
        ? { label: "FOC", color: "#a78bfa", tint: "rgba(167,139,250,0.10)", edge: "rgba(167,139,250,0.30)" }
        : null;

  if (!cfg) return <span style={{ fontSize: 11.5, color: "var(--text-muted)", fontFamily: ff }}>Repair</span>;

  return (
    <span style={{
      display: "inline-block", fontSize: 10, fontWeight: 800, letterSpacing: "0.06em",
      padding: "2px 7px", borderRadius: 6,
      color: cfg.color, background: cfg.tint, border: `1px solid ${cfg.edge}`, fontFamily: ff,
    }}>
      {cfg.label}
    </span>
  );
}

const ff = "'Plus Jakarta Sans', sans-serif";

// ─── Live data only ───────────────────────────────────────────────────────────

const COMPLETED_REPAIRS: CompletedRepair[] = [];

/** Dealer stats are computed from live jobs; no canned figures. */
const DEALER_PROFILES: Record<string, Pick<DealerProfile, "stats" | "totalEarned" | "onAccount" | "unbilled">> = {};

const fmtDate = (d?: string) => {
  if (!d) return "—";
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? d : dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const stepLabel: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: "var(--text-secondary)",
  letterSpacing: "0.07em", textTransform: "uppercase",
  fontFamily: "'Plus Jakarta Sans', sans-serif", marginBottom: 14,
};

const cardHead: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: "var(--text-muted)",
  letterSpacing: "0.1em", textTransform: "uppercase",
  fontFamily: "'Plus Jakarta Sans', sans-serif", marginBottom: 12,
};

const inputSt: React.CSSProperties = {
  width: "100%", padding: "8px 10px", borderRadius: 8,
  border: "1px solid var(--border)", background: "var(--bg-primary)",
  color: "var(--text-primary)", fontSize: 12.5, outline: "none",
  fontFamily: "'Plus Jakarta Sans', sans-serif", boxSizing: "border-box",
};

// A field filled from the dealer registry. Read-only rather than disabled: a
// disabled input is skipped by the keyboard and greys the text out, and this
// text is the answer, not an unavailable one.
/**
 * What an invoice was billed from, frozen at the moment it was generated.
 *
 * Every field here is derived from `invoiceable`, which only keeps jobs with
 * status "Completed". Issuing the jobs moves them to "Delivered" and they all
 * go empty or zero — so anything that runs after that point (the invoice
 * preview, the credit confirmation, recording the sale) has to read this and
 * never the live values.
 */
interface BilledSnapshot {
  repairs: CompletedRepair[];
  /** Accessories taken away with the repair, billed on the same invoice. */
  extras: ExtraLine[];
  extrasTotal: number;
  totalAdvance: number;
  effectiveReceived: number;
  finalDue: number;
  grandTotal: number;
  totalDiscount: number;
  lineDiscounts: number;
  invoiceDiscount: number;
  badDebt: number;
  payMethod: "Cash" | "Card" | "Bank Transfer";
  cardRef: string;
  isCredit: boolean;
  customerName: string;
  customerPhone: string;
  dealerId: number | null;
  creditAccountId: string | null;
}

const lockedSt: React.CSSProperties = {
  background: "var(--bg-secondary)",
  borderColor: "var(--accent-glow)",
  cursor: "default",
};

const labelSt: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, color: "var(--text-muted)",
  letterSpacing: "0.08em", textTransform: "uppercase",
  display: "block", marginBottom: 5,
  fontFamily: "'Plus Jakarta Sans', sans-serif",
};

const fmtRs = (n: number) => `Rs. ${Math.max(0, n).toLocaleString("en-LK")}`;

// ─── Credit Record Confirm Modal ─────────────────────────────────────────────

/**
 * Whose account the balance goes on — asked before anything is written.
 *
 * This used to open after the handover had already been recorded, which made
 * its cancel a trap: the jobs were Delivered and the charge raised, so
 * dismissing it abandoned the paperwork for something that had already
 * happened. Now nothing is committed until one of these buttons is pressed.
 *
 * So cancel means cancel. The two buttons are the two real answers — on the
 * account, or not — and both of them produce an invoice, because a phone
 * going back to its owner is a sale either way.
 */
function CreditRecordConfirmModal({ dealer, dueAmount, busy, onConfirm, onSkip, onCancel }: {
  dealer: string;
  dueAmount: number;
  busy?: boolean;
  onConfirm: () => void;
  onSkip: () => void;
  onCancel: () => void;
}) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      onClick={onCancel}
      style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
    >
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 460, background: "var(--bg-card)", borderRadius: 16, border: "1px solid rgba(251,191,36,0.35)", boxShadow: "0 32px 80px rgba(0,0,0,0.5)", display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <BookUser size={16} color="#fbbf24" />
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Outstanding Amount Detected</p>
              <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Create a credit record for this dealer?</p>
            </div>
          </div>
          <button onClick={onCancel} style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid var(--border)", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", flexShrink: 0 }}>
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ padding: "12px 14px", borderRadius: 10, background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.25)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <p style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Dealer</p>
              <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif", marginTop: 2 }}>{dealer}</p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Credit Due</p>
              <p style={{ fontSize: 18, fontWeight: 800, color: "#fbbf24", fontFamily: "'Plus Jakarta Sans', sans-serif", marginTop: 2 }}>Rs. {dueAmount.toLocaleString()}</p>
            </div>
          </div>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: "'Plus Jakarta Sans', sans-serif", lineHeight: 1.6 }}>
            The total invoice amount exceeds what has been paid. You can create a credit record against <strong style={{ color: "var(--text-primary)" }}>{dealer}</strong>'s account for the outstanding balance, or skip and generate the invoice without recording the credit.
          </p>
        </div>

        {/* Footer */}
        <div style={{ padding: "12px 20px", borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 8 }}>
          {/* Both of these are the commit. Disabled while it runs, because
              this is the click that draws the invoice number, hands the phones
              over and writes the sale — pressing it twice would do all three
              again under a second number. */}
          <button
            onClick={onConfirm}
            disabled={busy}
            style={{ width: "100%", padding: "10px", borderRadius: 9, border: "none", background: "#fbbf24", color: "#000", fontSize: 13, fontWeight: 700, cursor: busy ? "wait" : "pointer", opacity: busy ? 0.6 : 1, fontFamily: "'Plus Jakarta Sans', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}
          >
            <BookUser size={14} />{busy ? "Recording…" : "Create Credit Record & Generate Invoice"}
          </button>
          <button
            onClick={onSkip}
            disabled={busy}
            style={{ width: "100%", padding: "10px", borderRadius: 9, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            Generate Without Credit Record
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Invoice View ─────────────────────────────────────────────────────────────

function InvoiceView({ invoiceNo, createdAt, dealer, customer, isCredit, amountReceivedNow, dueAmount, totalAdvance, invoiceDiscount = 0, creditRecordMade, repairs, extras = [], onBack, onArchived }: {
  invoiceNo: string;
  createdAt: string;
  dealer: string;
  customer: { name: string; phone: string; nic: string };
  isCredit: boolean;
  amountReceivedNow: number;
  dueAmount: number;
  totalAdvance: number;
  /** Taken off the bill as a whole, on top of any per-line discounts. */
  invoiceDiscount?: number;
  creditRecordMade: boolean;
  repairs: CompletedRepair[];
  /** Products sold on the same invoice, printed in their own section. */
  extras?: ExtraLine[];
  onBack: () => void;
  /** Fires once the document is in invoice history — see InvoiceArchive. */
  onArchived?: (invoiceNo: string) => void;
}) {
  const { dealers } = useRepair();
  const invoiceRef = useRef<HTMLDivElement>(null);
  const isManoMobile = isInHouseDealer(dealers, dealer);
  const pageCss = repairInvoicePageCss(isManoMobile);

  // Keep the invoice exactly as it was rendered here. Invoice History shows
  // this, not a summary rebuilt from figures that may since have moved.
  usePersistInvoiceDocument(invoiceNo, invoiceRef, pageCss, onArchived);

  const handlePrint = () => {
    if (!invoiceRef.current) return;
    const printDiv = document.createElement("div");
    printDiv.id = "__rp_inv__";
    printDiv.innerHTML = invoiceRef.current.outerHTML;
    document.body.appendChild(printDiv);
    const styleEl = document.createElement("style");
    styleEl.id = "__rp_inv_style__";
    styleEl.textContent = `
      @page { size: ${isManoMobile ? "A5 landscape" : "A4 landscape"}; margin: ${isManoMobile ? "0" : "12mm"}; }
      #__rp_inv__ { display: none; }
      @media print {
        body { visibility: hidden; }
        #__rp_inv__ { display: block !important; visibility: visible; position: fixed; top: 0; left: 0; width: 100%; }
        #__rp_inv__ * { visibility: visible; }
      }
    `;
    document.head.appendChild(styleEl);
    window.print();
    setTimeout(() => {
      document.getElementById("__rp_inv__")?.remove();
      document.getElementById("__rp_inv_style__")?.remove();
    }, 500);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, flex: 1, minHeight: 0, overflowY: "auto", paddingRight: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button
          onClick={onBack}
          style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 16px", borderRadius: 9, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-secondary)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif", transition: "all 0.15s" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--accent-glow)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--accent)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)"; }}
        >
          <ArrowLeft size={13} /> Back
        </button>
        <button
          onClick={handlePrint}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 18px", borderRadius: 9, border: "1px solid var(--accent)", background: "var(--accent)", color: "var(--accent-fg)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          <Printer size={13} /> Print Invoice
        </button>
      </div>

      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
        <RepairInvoicePrintable
          ref={invoiceRef}
          invoiceNo={invoiceNo}
          createdAt={createdAt}
          dealer={dealer}
          customer={customer}
          isCredit={isCredit}
          amountReceivedNow={amountReceivedNow}
          dueAmount={dueAmount}
          totalAdvance={totalAdvance}
          invoiceDiscount={invoiceDiscount}
          creditRecordMade={creditRecordMade}
          repairs={repairs}
          extras={extras}
        />
      </div>
    </div>
  );
}

// ─── Repair Sales Main ────────────────────────────────────────────────────────

export default function RepairSales({ initialDealer, initialJobId }: {
  /** Sent here to bill one finished repair — see SalesManagement's jobToIssue. */
  initialDealer?: string;
  initialJobId?: string;
} = {}) {
  const { addEntry } = useCashRegister();
  const { addSale } = useSales();
  /**
   * May this person settle below the agreed price?
   *
   * The one permission that defaults OFF, because it is the one that costs the
   * shop money. Without it the Discount column stays read-only text — the
   * cashier can see what was taken off, they just cannot take it off.
   */
  const { can: mayDo, isAdminCashier } = useMyPermissions();
  const mayDiscount = mayDo("canDiscount");
  // Same gate the database enforces on refund_repair_advance — an ordinary
  // cashier can see that money is owed back without being able to pay it out.
  const mayRefundAdvance = isAdminCashier;
  // ── The refundable invoice ───────────────────────────────────────────────
  //
  // A returned job with an advance on it is a bill in reverse, so it goes
  // through this same screen rather than a side door: same job selection, same
  // Bill Info, same Payment card, with the direction flipped and one extra
  // line. What follows is the state that only that mode uses.
  const [refundNow, setRefundNow]       = useState("");
  const [refunding, setRefunding]       = useState(false);
  const [refundError, setRefundError]   = useState<string | null>(null);
  const [refundDone, setRefundDone]     = useState<string | null>(null);
  // Whose till the invoice came off, for the sales ledger.
  const { profile } = useAuth();
  const toast = useToast();
  const { updateJob, jobs, dealers } = useRepair();
  // For the dealer card's balance — what they owe, per the ledger.
  const { accounts: creditAccounts, reload: reloadCredit } = useCreditAccounts();
  const [view,           setView]           = useState<"search" | "invoice">("search");
  const [showIssuedMsg,  setShowIssuedMsg]  = useState(false);
  /**
   * Seeded when somebody was sent straight here to bill one repair.
   *
   * Lazy initialisers rather than an effect: whoever navigated had the job in
   * front of them, so it is already in the register by the time this renders —
   * this is the first render's state, not a reaction to it. Re-navigating
   * remounts this screen (see the key in the cashier shell), so a second job
   * seeds a second time instead of being ignored.
   */
  const [selectedDealer, setSelectedDealer] = useState(initialDealer ?? "");
  /**
   * Filling in an IMEI the counter never took.
   *
   * An invoice without one names a price and a customer but not the object —
   * which is the one thing a warranty claim, a police enquiry or a returning
   * customer needs it to say. The gap is always found here, at the till, and
   * the phone is usually still on the counter, so this is where it gets
   * fixed rather than sent back to intake.
   */
  const [imeiEdit,  setImeiEdit]  = useState<{ id: string; value: string } | null>(null);
  const [imeiSaving, setImeiSaving] = useState(false);
  const [checkedIds,     setCheckedIds]     = useState<Set<string>>(
    () => (initialJobId ? new Set([initialJobId]) : new Set()),
  );
  const [search,         setSearch]         = useState("");

  // Step 3 — Customer Info
  // Filled from the job on arrival, for the same reason the tick below fills
  // them on a click: the invoice is for whoever the repair was for, and
  // landing here with the boxes empty would make the default a lie.
  const seedJob = initialJobId ? jobs.find(j => j.id === initialJobId) : undefined;
  const [custName,  setCustName]  = useState(seedJob?.customerName ?? "");
  const [custPhone, setCustPhone] = useState(seedJob?.phone ?? "");
  const [custNic,   setCustNic]   = useState("");
  /**
   * Bill the dealer instead of the end customer.
   *
   * On a dealer job the shop's customer IS the dealer — Phone House sends the
   * phone, Phone House pays. Their name and number were being retyped on every
   * invoice, which is both wasted keystrokes and a source of "Phone house",
   * "PhoneHouse" and a mistyped number ending up on three invoices for the same
   * account. Ticking this fills the fields from the dealer registry and locks
   * them, so all of it says the same thing.
   */
  const [billToDealer, setBillToDealer] = useState(false);
  /**
   * Take the customer from the job being billed.
   *
   * On by default, because it is right almost every time: the phone belongs to
   * the person named on the job, and their name and number are already in the
   * record two steps up this same screen. Retyping them at the till is how a
   * customer ends up on one invoice as "Dinushi" and on the next as "Dinushy"
   * with a digit missing from the number — and the invoice is what they are
   * handed and what the shop keeps.
   *
   * Not locked, unlike the dealer tick. A name can be wrong on the job and the
   * counter is the moment somebody notices; typing over it simply turns this
   * off, because the fields are then no longer what the job says.
   */
  const [useJobCustomer, setUseJobCustomer] = useState(true);
  // What was typed by hand before either tick, so unticking gives it back
  // rather than throwing away a half-entered customer.
  const manualCustomer = useRef({ name: "", phone: "", nic: "" });

  /**
   * How the money came in.
   *
   * Every other till in the app asks this; the repair counter recorded "Cash"
   * on everything, so a card-paid repair was indistinguishable from a cash one
   * in the sales ledger and in the day's takings.
   */
  const [payMethod, setPayMethod] = useState<"Cash" | "Card" | "Bank Transfer">("Cash");
  const [cardRef,   setCardRef]   = useState("");

  // Step 3 — Amount received now
  const [amountReceived, setAmountReceived] = useState("");

  // Step 3 — Credit customer (Mano Mobile + due)
  const [selectedCreditCustomer, setSelectedCreditCustomer] = useState<POSCreditCustomer | null>(null);

  // Credit record confirmation (non-Mano Mobile + due)
  const [showCreditConfirm,  setShowCreditConfirm]  = useState(false);
  const [creditRecordMade,   setCreditRecordMade]   = useState(false);
  /**
   * Money taken off a line, keyed by job.
   *
   * Held here rather than written onto the job, because a discount is a fact
   * about this invoice, not about the repair. The job keeps recording what it
   * was quoted at — which is also what the handover credit charge is computed
   * from — so lowering a price at the counter can never leave the invoice and
   * the customer's balance disagreeing about the same job.
   */
  const [rowDiscounts, setRowDiscounts] = useState<Record<string, number>>({});
  /**
   * Forgive the residual instead of putting it on account.
   *
   * Rs. 200 left on a Rs. 700 repair is not worth opening a credit account for,
   * and doing so leaves a customer on the ledger owing money nobody will ever
   * chase. Ticking this settles the job and records the gap as bad debt, so the
   * shop still sees what it gave away.
   */
  const [writeOffBalance, setWriteOffBalance] = useState(false);
  /**
   * A discount on the bill as a whole, on top of anything taken off individual
   * jobs.
   *
   * The two are different concessions and both happen: Rs. 100 off a screen
   * because the part came cheaper, and then Rs. 200 off the whole invoice
   * because it is a regular customer with four phones in. Folding the second
   * into the first would spread it across lines it was never about, and the
   * printed invoice would no longer match what was actually agreed.
   */
  const [invDiscount, setInvDiscount] = useState("");
  const [invDiscountMode, setInvDiscountMode] = useState<"Rs" | "%">("Rs");
  /**
   * Products going out with the repair, on the same invoice.
   *
   * A customer collecting a phone buys a glass and a cover at the same
   * counter, and used to walk out with two invoices because they were two
   * screens. These sit in checkout state — nothing written, no stock moved —
   * until Complete Sale, when the stock comes off in one transaction with the
   * accessory counter's own function and the lines go on the invoice.
   */
  const [extras, setExtras] = useState<ExtraLine[]>([]);
  const [addingProducts, setAddingProducts] = useState(false);
  const { sellStock } = useAccessories();
  const extrasTotal = extras.reduce((s, l) => s + extraLineTotal(l), 0);
  const [custMatchOpen, setCustMatchOpen] = useState(false);

  // A frozen copy of the billing figures at the moment the invoice is
  // generated. markIssued() flips the selected jobs' status to "Delivered",
  // which — because `invoiceable` only keeps status === "Completed" — drops
  // them out of the live `selectedRepairs`/`grandTotal`/etc. the instant
  // status updates land, leaving InvoiceView with an empty invoice. Snapshot
  // everything before that flip so the preview keeps showing what was billed.
  const [invoiceSnapshot, setInvoiceSnapshot] = useState<BilledSnapshot | null>(null);

  /**
   * A Mark-As-Issued sale, waiting to be filed.
   *
   * "Mark As Issued" is for the moment nobody wants paper — but the sale is
   * still a real invoice, and the day somebody does want it (a dealer asking
   * for a copy a week on) Sales History could only say nothing was stored,
   * because the document is captured from the invoice as rendered, and this
   * path never rendered one. So it renders one anyway, off-screen, long enough
   * for invoice history to take it, and then lets go. Kept apart from
   * invoiceSnapshot on purpose: the OK on the confirmation resets the form,
   * and that must not be able to pull the invoice out from under the capture
   * while its template is still loading.
   */
  const [archive, setArchive] = useState<{
    invoiceNo: string; snap: BilledSnapshot; dealer: string;
    customer: { name: string; phone: string; nic: string };
  } | null>(null);

  // Assigned for real (from the shared invoice_no_seq sequence) only once a
  // sale is actually completed — see fetchNextInvoiceNo's own comment for why
  // this can't just run on mount.
  const [invoiceNo, setInvoiceNo] = useState<string | null>(null);
  const [invoicing, setInvoicing] = useState(false);
  const createdAt = useMemo(() => new Date().toLocaleString("en-US", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: true }), []);

  // Dealers managed in Admin Control, plus any legacy dealer still attached to
  // a repair row so historic work stays invoiceable.
  const dealerOptions = useMemo(() => {
    const names = dealers.map(d => d.name);
    const known = new Set(names.map(n => dealerKey(dealers, n)));
    const extra = [...COMPLETED_REPAIRS.map(r => r.dealer), ...jobs.map(j => j.dealer ?? "")]
      .filter(n => n && !known.has(dealerKey(dealers, n)));
    return [...names, ...Array.from(new Set(extra)).sort()];
  }, [dealers, jobs]);

  // Repaired-and-awaiting-collection jobs from the live register, shaped like
  // the invoice rows, plus the demo rows that aren't in the register.
  /**
   * What can still be invoiced.
   *
   * Completed work, plus something that should never exist and does: a job
   * handed over with no invoice behind it. The old credit dialog could be
   * dismissed after the handover had already been written, which left the job
   * Delivered, the charge raised, and no sale — and because this list only
   * ever showed Completed jobs, the work then had no way back onto a bill.
   *
   * The dialog cannot do that any more. These are the ones it did do it to,
   * and they belong here until somebody has billed them.
   */
  const invoiceable: CompletedRepair[] = useMemo(() => {
    const live: CompletedRepair[] = jobs
      .filter(j => j.status === "Completed" || (j.status === "Delivered" && !j.invoiceNo))
      .map(j => ({
        id: j.id,
        dealer: findDealer(dealers, j)?.name ?? j.dealer ?? "",
        customerName: j.customerName,
        phone: j.phone,
        dealerJobNo: j.dealerJobNo,
        unidentifiedReason: j.deviceUnidentifiedReason ?? null,
        uninvoiced: j.status === "Delivered" && !j.invoiceNo,
        brand: j.brand,
        model: j.model,
        imei: j.imei ?? "",
        warranty: j.jobWarranty || warrantyLine("NO WARRANTY", j.completionType),
        advance: j.advancePaid,
        unitPrice: j.estimatedCost,
        completionType: j.completionType,
        cashReturnAmount: j.completionType === "Cash Return" ? (j.cashReturnAmount ?? 0) : 0,
        rejobOf: j.rejobOf ?? null,
        advanceRefundedOn: j.advanceRefundedOn ?? null,
        // Was hard-coded 0, so the column rendered a dash on every row and
        // sales.discount recorded "none given" whatever happened at the counter.
        // Applied here so grandTotal, totalDiscount, netDue and the invoice all
        // follow from one place.
        discount: Math.min(rowDiscounts[j.id] ?? 0, j.estimatedCost),
        issue: j.issue,
        createdAt: j.createdAt,
        completedAt: j.completedAt,
      }));
    const liveIds = new Set(live.map(r => r.id));
    return [
      ...live,
      ...COMPLETED_REPAIRS.filter(r => !liveIds.has(r.id))
        .map(r => ({ ...r, discount: Math.min(rowDiscounts[r.id] ?? r.discount, r.unitPrice) })),
    ];
  }, [jobs, dealers, rowDiscounts]);

  // Declared here rather than down with the billing figures: whether the shop
  // is billing its own customer or an outside dealer decides how a Cash Return
  // settles, and that question is asked while the rows are still being picked.
  const isManoMobile = isInHouseDealer(dealers, selectedDealer);

  const q = search.toLowerCase();
  const dealerRepairs = invoiceable.filter(r =>
    !!selectedDealer && dealerKey(dealers, r.dealer) === dealerKey(dealers, selectedDealer) &&
    (!search || r.id.toLowerCase().includes(q) ||
      (r.dealerJobNo ?? "").toLowerCase().includes(q) ||
      r.brand.toLowerCase().includes(q) ||
      r.model.toLowerCase().includes(q) ||
      r.imei.includes(search) ||
      r.customerName.toLowerCase().includes(q))
  );

  const selectedRepairs = invoiceable.filter(r => checkedIds.has(r.id));

  /**
   * The customer named on a set of chosen jobs.
   *
   * Takes a set rather than reading `selectedRepairs`, because the callers are
   * the tick handlers themselves: inside one, the state still holds the
   * selection as it was a moment ago, and filling the fields from that would
   * put the previous job's owner on the invoice.
   *
   * The first job that names anybody wins. Several jobs on one invoice are
   * usually one customer's two handsets; where they are not, the tick says so
   * rather than silently picking.
   */
  const customerOf = (ids: Set<string>) => {
    const first = invoiceable.find(r => ids.has(r.id) && (r.customerName ?? "").trim());
    return { name: (first?.customerName ?? "").trim(), phone: (first?.phone ?? "").trim() };
  };

  // The refund position of whatever is selected, from v_job_refunds — the one
  // place the refund arithmetic lives, so this screen and the jobs list can
  // never disagree about what is owed.
  const { byJob: refundByJob, reload: reloadRefunds } =
    useJobRefunds(selectedRepairs.map(r => r.id));

  /**
   * Is this a bill or a bill in reverse?
   *
   * Two ways a job can owe money out, and the screen recognises both on its
   * own rather than sending the cashier to a separate refund process:
   *
   *   Cash Return — the technician decided money should go back and said how
   *   much. That figure is the amount; it already accounts for what the
   *   customer paid.
   *
   *   Return / FOC with an advance — nobody named a figure, so what is owed is
   *   whatever part of the advance is not covering a charge.
   *
   * v_job_refunds decides which, so nothing here has to branch on the reason
   * and the billing screen cannot disagree with the jobs list about the total.
   *
   * One job at a time: the amount returned belongs to a single job, and
   * splitting one payment across several by any rule this code invented would
   * be a number nobody could explain to a customer.
   */
  const refundCandidates = selectedRepairs.filter(r => {
    // An external dealer is never refunded in cash. Their Cash Return is the
    // negative line above, netted off the bill they are about to be sent — a
    // cash refund AND a reduced bill would be the same money twice.
    if (!isManoMobile) return false;
    const pos = refundByJob.get(r.id);
    if (pos) return pos.refundable > 0;
    // Before the position loads, fall back to what the job itself says, so the
    // screen does not flash a normal bill at a Cash Return job.
    return (r.cashReturnAmount ?? 0) > 0
      || ((r.completionType === "Return" || r.completionType === "FOC") && r.advance > r.unitPrice);
  });
  const refundMode      = refundCandidates.length > 0;
  const refundJob       = refundCandidates.length === 1 ? refundCandidates[0] : null;
  const tooManyToRefund = refundCandidates.length > 1;

  const refundPos = refundJob ? refundByJob.get(refundJob.id) ?? null : null;
  const isCashReturn = refundJob?.completionType === "Cash Return";

  const refundSubtotal  = refundJob ? refundJob.unitPrice : 0;
  const refundAdvance   = refundJob ? refundJob.advance : 0;
  const refundable      = refundPos
    ? refundPos.refundable
    : isCashReturn
      ? (refundJob?.cashReturnAmount ?? 0)
      : Math.max(0, refundAdvance - refundSubtotal);
  const alreadyRefunded = refundPos?.refunded ?? 0;
  const stillRefundable = Math.max(0, refundable - alreadyRefunded);

  const refundNowDisplay = refundNow === "" ? String(stillRefundable) : refundNow;
  const refundNowAmt     = Math.max(0, parseFloat(refundNowDisplay) || 0);
  const refundRemaining  = Math.max(0, stillRefundable - refundNowAmt);

  const canRefund =
    !!refundJob && refundNowAmt > 0 && refundNowAmt <= stillRefundable
    && !refunding && mayRefundAdvance;

  const processRefund = async () => {
    if (!refundJob || !canRefund) return;
    setRefunding(true);
    setRefundError(null);
    try {
      const cr = await refundRepairAdvance(
        refundJob.id,
        refundNowAmt,
        isCashReturn
          ? `Cash Return on ${refundJob.id}`
          : `Advance refunded on returned job ${refundJob.id}`,
        payMethod,
      );
      setRefundDone(cr.ref);
      setRefundNow("");
      reloadRefunds();
    } catch (e) {
      setRefundError(e instanceof Error ? e.message : String(e));
    } finally {
      setRefunding(false);
    }
  };

  // Billing calculations
  // What each selected job contributes to the bill. A Cash Return contributes
  // its amount NEGATIVELY — it is a repair transaction pointing the other way,
  // which is what makes "12,500 less 5,000 = 7,500" fall out of the same sum
  // the invoice has always done rather than needing a second calculation.
  const lineOf = (r: CompletedRepair) =>
    (r.cashReturnAmount ?? 0) > 0 ? -(r.cashReturnAmount ?? 0) : r.unitPrice;

  const cashReturnTotal = selectedRepairs.reduce((s, r) => s + (r.cashReturnAmount ?? 0), 0);
  const repairsTotal    = selectedRepairs.reduce((s, r) => s + ((r.cashReturnAmount ?? 0) > 0 ? 0 : r.unitPrice), 0);

  const lineSubtotal  = selectedRepairs.reduce((s, r) => s + lineOf(r), 0);
  const lineDiscounts = selectedRepairs.reduce((s, r) => s + r.discount, 0);
  // What the lines come to before anything is taken off the bill as a whole —
  // the repairs and the products both, since a whole-invoice discount is a
  // discount on the whole invoice.
  const afterLines    = lineSubtotal - lineDiscounts + extrasTotal;

  // Clamped to the bill: a percentage cannot exceed 100 and an amount cannot
  // exceed what is left, or the invoice ends up owing the customer money.
  const invDiscountAmt = Math.max(0, Math.min(
    invDiscountMode === "%"
      ? Math.round(afterLines * Math.min(100, parseFloat(invDiscount) || 0)) / 100
      : parseFloat(invDiscount) || 0,
    afterLines,
  ));

  const grandTotal    = afterLines - invDiscountAmt;
  const totalAdvance  = selectedRepairs.reduce((s, r) => s + r.advance, 0);
  // Everything the customer was let off, whichever level it was given at —
  // this is what sales.discount records and what the margin reports read.
  const totalDiscount = lineDiscounts + invDiscountAmt;
  const netDue        = Math.max(0, grandTotal - totalAdvance);

  // Amount received now — empty defaults to full net due (no credit)
  const receivedDisplay   = amountReceived === "" ? netDue.toString() : amountReceived;
  const effectiveReceived = parseFloat(receivedDisplay) || 0;
  const finalDue          = Math.max(0, netDue - effectiveReceived);
  const isCredit          = finalDue > 0;
  // Written off means nothing goes on account, so there is no account to pick
  // — the customer section goes back to plain name and number.
  const useCreditPicker   = isManoMobile && isCredit && !writeOffBalance;

  // Identity comes from the Admin Control registry; the stats come from live
  // jobs, falling back to the canned figures for the demo-only dealers.
  const dealerProfile: DealerProfile | undefined = useMemo(() => {
    if (!selectedDealer) return undefined;
    const record  = findDealer(dealers, selectedDealer);
    const canned  = DEALER_PROFILES[selectedDealer];
    const key     = dealerKey(dealers, selectedDealer);
    const mine    = jobs.filter(j => dealerKey(dealers, j) === key);
    const live = {
      stats: {
        total:      mine.length,
        completed:  mine.filter(j => j.status === "Completed" || j.status === "Delivered").length,
        pending:    mine.filter(j => j.status === "Pending").length,
        inProgress: mine.filter(j => j.status === "Issued").length,
      },
      totalEarned: mine.filter(j => j.status === "Delivered").reduce((s, j) => s + j.estimatedCost, 0),
      // The ledger's figure, not one worked out from jobs here. This used to
      // sum the unpaid part of every Completed job — finished work not yet
      // billed — and call it Outstanding, so a dealer with Rs. 55,000 on
      // account and nothing on the bench showed "—", and the in-house entry
      // showed the day's unbilled walk-ins as a debt.
      onAccount: record && !record.inHouse
        ? (creditAccounts.find(a => a.holderKind === "Dealer" && a.dealerId === record.id)?.balance ?? 0)
        : null,
      unbilled: mine.filter(j => j.status === "Completed").reduce((s, j) => s + Math.max(0, j.estimatedCost - j.advancePaid), 0),
    };
    const figures = mine.length > 0 || !canned ? live : canned;
    return {
      phone:   record?.contact || "—",
      address: record?.address || "",
      since:   record?.joinedAt ? new Date(record.joinedAt).getFullYear().toString() : "—",
      ...figures,
    };
  }, [selectedDealer, dealers, jobs, creditAccounts]);

  /**
   * Fill the customer fields from the dealer registry, or hand back what was
   * typed before.
   *
   * Only offered for an outside dealer. On a Mano Mobile job the "dealer" is
   * the shop itself, so billing it to the shop would name us as our own
   * customer.
   */
  const dealerRecord   = selectedDealer ? findDealer(dealers, selectedDealer) : undefined;
  const canBillDealer  = !!selectedDealer && !isManoMobile;

  /**
   * Put the chosen jobs' customer into the fields, if that is what the tick
   * says. Called from the row checkboxes, so the invoice follows the selection
   * instead of keeping whoever was there when the first job was ticked.
   */
  const fillFromJobs = (ids: Set<string>) => {
    if (!useJobCustomer || billToDealer) return;
    const c = customerOf(ids);
    setCustName(c.name);
    setCustPhone(c.phone);
    // No NIC on a repair job — that field stays whatever was typed.
  };

  const toggleJobCustomer = (on: boolean) => {
    if (on) {
      manualCustomer.current = { name: custName, phone: custPhone, nic: custNic };
      const c = customerOf(checkedIds);
      setCustName(c.name);
      setCustPhone(c.phone);
      // The two ticks answer the same question — whose name goes on the
      // invoice — so they cannot both be the answer.
      setBillToDealer(false);
    } else {
      setCustName(manualCustomer.current.name);
      setCustPhone(manualCustomer.current.phone);
      setCustNic(manualCustomer.current.nic);
    }
    setUseJobCustomer(on);
  };

  const toggleBillToDealer = (on: boolean) => {
    if (on) {
      setUseJobCustomer(false);
      manualCustomer.current = { name: custName, phone: custPhone, nic: custNic };
      setCustName(dealerRecord?.name ?? selectedDealer);
      setCustPhone(dealerRecord?.contact ?? "");
      // A dealer is a business; an NIC belongs to a person.
      setCustNic("");
    } else {
      setCustName(manualCustomer.current.name);
      setCustPhone(manualCustomer.current.phone);
      setCustNic(manualCustomer.current.nic);
    }
    setBillToDealer(on);
  };

  /**
   * Everyone the shop has taken a repair from.
   *
   * There is no customers table — a customer exists as a name and a number on
   * each job — so this is built from the jobs themselves, one entry per phone
   * number with the most recent spelling of the name. Without it a returning
   * customer is retyped every visit, which is both slower and how one person
   * ends up on the books three times under three spellings.
   */
  const knownCustomers = useMemo(() => {
    const byPhone = new Map<string, { name: string; phone: string; email?: string; jobs: number }>();
    // Oldest first, so the newest spelling of a name wins.
    for (const j of [...jobs].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
      const phone = (j.phone ?? "").replace(/\D/g, "");
      const name = (j.customerName ?? "").trim();
      if (!phone || !name) continue;
      const prev = byPhone.get(phone);
      byPhone.set(phone, {
        name,
        phone: j.phone,
        email: j.customerEmail || prev?.email,
        jobs: (prev?.jobs ?? 0) + 1,
      });
    }
    return [...byPhone.values()];
  }, [jobs]);

  // Matched on whichever field is being typed. Hidden once the name is already
  // filled in from a match, so it does not hover over a finished form.
  const custQuery = `${custName} ${custPhone}`.trim().toLowerCase();
  const custMatches = custQuery.length < 3 ? [] : knownCustomers.filter(c =>
    c.name.toLowerCase().includes(custName.trim().toLowerCase() || "\u0000") ||
    (custPhone.trim() && c.phone.replace(/\D/g, "").includes(custPhone.replace(/\D/g, ""))),
  ).slice(0, 5);

  const showStep3 = !!selectedDealer && checkedIds.size > 0;

  /**
   * Jobs on this invoice with no IMEI and no reason for not having one.
   *
   * An invoice is the document a warranty claim is made against, and one that
   * cannot say which handset it was for is worth very little a year later when
   * somebody comes back with a screen that failed. The phone is on the counter
   * right now; this is the last moment it is easy to fix.
   *
   * A recorded "cannot be identified" passes — that is an answer, not a gap.
   */
  const missingImei = selectedRepairs.filter(r => !r.imei?.trim() && !r.unidentifiedReason);

  const canGenerate = showStep3 &&
    (useCreditPicker ? !!selectedCreditCustomer : !!custName.trim()) &&
    missingImei.length === 0;

  // What the tick would fill in, said out loud next to it — a tick whose
  // effect you have to press it to discover is a tick nobody presses.
  const jobCustomer = customerOf(checkedIds);
  const jobCustomerVaries =
    new Set(
      selectedRepairs.map(r => (r.customerName ?? "").trim().toLowerCase()).filter(Boolean),
    ).size > 1;

  // Effective customer for invoice
  const invoiceCustomer = useCreditPicker && selectedCreditCustomer
    ? { name: selectedCreditCustomer.name, phone: selectedCreditCustomer.phone ?? "", nic: selectedCreditCustomer.nic ?? "" }
    : { name: custName, phone: custPhone, nic: custNic };

  /** Written onto the job itself, not just the invoice: the missing number is
   *  missing everywhere, and fixing it here fixes the record too. */
  const saveImei = async () => {
    // Exactly fifteen. A short IMEI on an invoice is worse than none: it names
    // a handset that does not exist, and will not match the real one when the
    // customer comes back with it.
    if (!imeiEdit || imeiEdit.value.length !== 15) return;
    setImeiSaving(true);
    const res = await updateJob(imeiEdit.id, { imei: imeiEdit.value.trim() });
    setImeiSaving(false);
    if (!res.ok) return;
    setImeiEdit(null);
  };

  const toggleCheck = (id: string) => {
    // Built here rather than in the updater so the same value can be handed to
    // fillFromJobs. An updater has to be pure — it can be called twice.
    const next = new Set(checkedIds);
    next.has(id) ? next.delete(id) : next.add(id);
    setCheckedIds(next);
    fillFromJobs(next);
    setAmountReceived("");
    setSelectedCreditCustomer(null);
  };

  /** Header checkbox — selects every row currently listed for this dealer
   *  (i.e. whatever the search box has left visible), or clears the lot if
   *  they're already all checked. */
  const allChecked = dealerRepairs.length > 0 && dealerRepairs.every(r => checkedIds.has(r.id));
  const toggleCheckAll = () => {
    const next = new Set(checkedIds);
    if (allChecked) dealerRepairs.forEach(r => next.delete(r.id));
    else dealerRepairs.forEach(r => next.add(r.id));
    setCheckedIds(next);
    fillFromJobs(next);
    setAmountReceived("");
    setSelectedCreditCustomer(null);
  };

  const handleReset = () => {
    setSelectedDealer(""); setCheckedIds(new Set()); setSearch("");
    setBillToDealer(false); setUseJobCustomer(true);
    manualCustomer.current = { name: "", phone: "", nic: "" };
    setCustName(""); setCustPhone(""); setCustNic(""); setAmountReceived("");
    setRowDiscounts({}); setWriteOffBalance(false); setInvDiscount("");
    setPayMethod("Cash"); setCardRef("");
    setSelectedCreditCustomer(null); setShowCreditConfirm(false); setCreditRecordMade(false);
    setInvoiceSnapshot(null); setView("search");
    setInvoiceNo(null);
    setExtras([]);
  };

  const handleDealerChange = (val: string) => {
    setSelectedDealer(val); setCheckedIds(new Set()); setSearch("");
    // The filled-in details belong to the dealer being left behind.
    setUseJobCustomer(true);
    manualCustomer.current = { name: "", phone: "", nic: "" };
    setAmountReceived("");
    setRowDiscounts({}); setWriteOffBalance(false); setInvDiscount("");
    setPayMethod("Cash"); setCardRef("");
    setSelectedCreditCustomer(null); setShowCreditConfirm(false); setCreditRecordMade(false);
    setInvoiceSnapshot(null);
    setInvoiceNo(null);
    setExtras([]);

    // Outside dealer: default to billing it to them — that's who actually
    // gets invoiced for a device they sent in, so ticking it every time was
    // just an extra click on the common case. Can't be done for Mano Mobile
    // itself (selectedDealer/dealerRecord below still reflect the dealer
    // being left, so this checks the incoming value directly).
    const billable = !!val && !isInHouseDealer(dealers, val);
    if (billable) {
      const record = findDealer(dealers, val);
      setCustName(record?.name ?? val);
      setCustPhone(record?.contact ?? "");
      setCustNic("");
    } else {
      setCustName(""); setCustPhone(""); setCustNic("");
    }
    setBillToDealer(billable);
  };

  /**
   * Record the sale from a snapshot taken before the jobs were issued.
   *
   * It MUST NOT read selectedRepairs, grandTotal or isCredit. Those are derived
   * from `invoiceable`, which only keeps status === "Completed" — so the moment
   * markIssued() flips the jobs to Delivered they are all empty or zero.
   *
   * That is not theoretical. On the dealer-credit path this is called from the
   * confirm modal, which renders after the flip has landed, and it was writing
   * sales with total 0 and no jobs attached — which in turn left every credit
   * charge with no invoice number on it, so three phones on one bill still
   * showed as three unlinked charges.
   */
  const recordRepairSale = (no: string, snap: BilledSnapshot) => {
    addSale(
      {
        invoiceNo: no,
        date: new Date().toISOString().slice(0, 10),
        customer: snap.customerName || snap.repairs[0]?.customerName || "Walk-in",
        category: "Repair",
        items: [
          ...snap.repairs.map(r => `${r.brand} ${r.model}`),
          ...snap.extras.map(l => (l.qty > 1 ? `${l.name} ×${l.qty}` : l.name)),
        ].join(", ") || "Repair Invoice",
        total: snap.grandTotal,
        subtotal: snap.grandTotal + snap.totalDiscount,
        discountAmount: snap.totalDiscount,
        // What was billed and then forgiven, as opposed to what was knocked off
        // the price before billing. Different decisions, different reporting.
        badDebt: snap.badDebt,
        // Everything the customer has actually handed over against this bill:
        // whatever was taken as an advance at intake, plus what was taken now.
        // The rest is the balance the credit charge covers.
        paid: snap.totalAdvance + snap.effectiveReceived,
        status: "Paid",
        // Credit describes where the balance went, not how the money arrived,
        // so it only wins when there is actually a balance going on account.
        paymentMethod: snap.isCredit && snap.badDebt === 0 ? "Credit" : snap.payMethod,
        cardRef: snap.cardRef || undefined,
        cardAmount: snap.payMethod === "Card" ? snap.effectiveReceived : undefined,
        cashier: profile?.fullName?.trim() || undefined,
      },
      // What the printed invoice cannot carry: which dealer it was billed to,
      // whose account it landed on, and which jobs it covered. That last one is
      // what lets a job show the invoice it was billed on, and the reverse —
      // and what the credit charges are stamped through.
      {
        customerPhone: snap.customerPhone || null,
        dealerId: snap.dealerId,
        creditAccountId: snap.creditAccountId,
        jobIds: snap.repairs.map(r => r.id),
        // The terse list void_sale() restocks from — accessories only, the
        // same shape the accessory counter writes.
        lineItems: snap.extras.length
          ? snap.extras.map(l => ({ type: "accessory" as const, id: l.productId, qty: l.qty }))
          : undefined,
        // The invoice's own lines, as printed. One per repair, one per product.
        saleItems: [
          ...snap.repairs.map<NewSaleItem>(r => {
            const back = r.cashReturnAmount ?? 0;
            return {
              kind: "repair_service",
              referenceId: r.id,
              description: `${r.brand} ${r.model}${back > 0 ? " — Cash Return" : ""}`.trim(),
              qty: 1,
              unitPrice: back > 0 ? -back : r.unitPrice,
              discount: back > 0 ? 0 : r.discount,
              lineTotal: back > 0 ? -back : r.unitPrice - r.discount,
            };
          }),
          ...snap.extras.map<NewSaleItem>(l => ({
            kind: "accessory",
            referenceId: l.productId,
            description: l.name,
            qty: l.qty,
            unitPrice: l.unitPrice,
            discount: l.discount,
            lineTotal: extraLineTotal(l),
          })),
        ],
      },
    );
  };

  /** Everything the invoice was billed from, frozen before the jobs move. */
  const takeSnapshot = (): BilledSnapshot => ({
    repairs: selectedRepairs,
    extras,
    extrasTotal,
    totalAdvance,
    effectiveReceived,
    finalDue,
    grandTotal,
    totalDiscount,
    lineDiscounts,
    invoiceDiscount: invDiscountAmt,
    badDebt: writeOffBalance ? finalDue : 0,
    payMethod,
    cardRef,
    isCredit,
    customerName: invoiceCustomer.name,
    customerPhone: invoiceCustomer.phone,
    dealerId: dealerRecord ? Number(dealerRecord.id) : null,
    creditAccountId: selectedCreditCustomer?.id ?? null,
  });

  /**
   * Mark the selected repair jobs as issued (collected by the customer).
   *
   * Awaited, and awaited by both callers, because marking a job Delivered is
   * what makes the database raise its credit charge. Recording the sale then
   * stamps the invoice number onto those charges — and if the sale got there
   * first there would be nothing to stamp, so three phones on one bill would
   * stay three unlinked charges in the credit history instead of one invoice.
   *
   * Safe for jobs not present in the live repair list — updateJob simply no-ops.
   */
  const markIssued = async () => {
    const nowISO = new Date().toISOString();
    // Spread across the jobs on the invoice, largest first, so a multi-job bill
    // writes off against real lines rather than dumping it all on the first.
    const remaining = { left: writeOffBalance ? finalDue : 0 };
    const forgiven = (r: CompletedRepair) => {
      if (remaining.left <= 0) return 0;
      const owed = Math.max(0, (r.unitPrice - r.discount) - r.advance);
      const take = Math.min(owed, remaining.left);
      remaining.left -= take;
      return take;
    };
    /**
     * The money actually received, spread across the jobs it paid for.
     *
     * This is what was missing, and it cost the shop a false debt on every
     * cash sale. The till wrote the receipt into handover.balanceSettled and
     * left advance_paid alone — but the database decides what is still owed
     * from `estimated_cost - advance_paid`, so a repair paid in full in cash
     * still looked entirely unpaid, and the Delivered trigger opened a credit
     * account and charged the customer for a bill they had just settled.
     *
     * So the receipt is allocated properly: each job takes what it owes, in
     * the same largest-first order the write-off uses, until the money runs
     * out. The last job on a part-paid invoice is the one left owing, which is
     * what the credit charge should then be for.
     *
     * balanceSettled becomes that job's share too. It was the whole invoice on
     * every line, so three phones on one bill each claimed to have collected
     * the lot.
     */
    const toAllocate = { left: effectiveReceived };
    const share = (r: CompletedRepair) => {
      const owed = Math.max(0, (r.unitPrice - r.discount) - r.advance);
      const take = Math.min(owed, Math.max(0, toAllocate.left));
      toAllocate.left -= take;
      return take;
    };

    await Promise.all([...selectedRepairs]
      .sort((a, b) => (b.unitPrice - b.discount - b.advance) - (a.unitPrice - a.discount - a.advance))
      .map(r => {
        const settled = share(r);
        return updateJob(r.id, {
          writtenOff: forgiven(r),
          status: "Delivered",
          // Everything this job has received, intake advance included — the
          // one figure the credit posting reads.
          advancePaid: r.advance + settled,
          handover: {
            collectedBy: invoiceCustomer.name || r.customerName,
            relationship: "Owner",
            idVerified: true,
            balanceSettled: settled,
            handoverSignature: "",
            warrantyCardIssued: false,
            handedOverBy: "Cashier",
            handedOverAt: nowISO,
          },
        });
      }),
    );
  };

  /**
   * Everything that makes the sale real, in one place.
   *
   * Drawing the invoice number, handing the jobs over and writing the sale
   * happen together or not at all. Split apart they produced the worst state
   * this screen can reach: the jobs delivered, the credit charge raised, and
   * no sale — so the work vanished from this list (it is no longer Completed),
   * the invoice number was drawn and thrown away, and the customer's account
   * carried a charge with no bill behind it.
   */
  const commitSale = async (opts?: { markCredit?: boolean }) => {
    /**
     * Products come off the shelf first, before an invoice number is drawn
     * or a job is handed over. It is the one step that can legitimately
     * refuse — somebody sold the last cover a minute ago — and it refuses
     * for the whole cart at once, so if it fails nothing else has happened
     * yet and the cashier is simply told. A stock failure after the jobs
     * were delivered would be the phone gone and the invoice wrong.
     */
    if (extras.length > 0) {
      await sellStock(extras.map(l => ({ id: l.productId, qty: l.qty })));
    }
    const no = await fetchNextInvoiceNo();
    setInvoiceNo(no);
    // Taken before markIssued() flips these jobs to "Delivered" — see the
    // comment on invoiceSnapshot's declaration.
    const snap = takeSnapshot();
    setInvoiceSnapshot(snap);
    await markIssued();
    if (snap.effectiveReceived > 0) {
      addEntry("in", `Cash — Repair Invoice ${no} (${selectedDealer})`, snap.effectiveReceived);
    }
    setCreditRecordMade(!!opts?.markCredit);
    recordRepairSale(no, snap);
    // markIssued() above may have just opened a credit charge from
    // estimated_cost − advance, before this discount existed anywhere. Left
    // alone, a discounted job still shows as a real debt on the customer's
    // account — see INV-000092/RM-173. Best-effort: the sale itself is
    // already committed, so a reconciliation hiccup surfaces as a toast, not
    // a broken checkout.
    for (const r of snap.repairs) {
      if (r.discount > 0) {
        reconcileJobDiscount(r.id, no, r.discount).catch(e => {
          toast.error(
            `${r.id}'s discount wasn't reflected on the customer's account`,
            e instanceof Error ? e.message : String(e),
          );
        });
      }
    }
    // The dealer card's balance moves with what was just left on account.
    void reloadCredit();
    setView("invoice");
  };

  const handleGenerateInvoice = async () => {
    if (invoicing) return;

    /**
     * A balance going on account is a decision, so it is asked before anything
     * is written rather than after.
     *
     * It used to run the handover first and ask afterwards, which made the
     * dialog's cancel a trap — the jobs were already delivered by then, so
     * dismissing it abandoned the paperwork for something that had already
     * happened. Nothing is committed until a button in the dialog is pressed,
     * so backing out now genuinely leaves the till where it was.
     */
    if (!isManoMobile && isCredit && !writeOffBalance) {
      setShowCreditConfirm(true);
      return;
    }

    setInvoicing(true);
    try {
      await commitSale();
    } catch (e) {
      // Almost always the shelf: "Not enough stock for product 12". Nothing
      // has been written when this fires, so the checkout is exactly as it
      // was and the cashier can take the line off and go again.
      toast.dialog("error", "The sale was not completed", e instanceof Error ? e.message : String(e));
    } finally {
      setInvoicing(false);
    }
  };

  // Mark as issued only — no print/invoice. Still a real completed sale
  // though, so it still gets a real invoice number for the books.
  const handleMarkIssued = async () => {
    if (invoicing) return;
    setInvoicing(true);
    if (extras.length > 0) {
      await sellStock(extras.map(l => ({ id: l.productId, qty: l.qty })));
    }
    const no = await fetchNextInvoiceNo();
    setInvoicing(false);
    const snap = takeSnapshot();
    setInvoiceSnapshot(snap);
    await markIssued();
    if (effectiveReceived > 0) {
      addEntry("in", `Cash — Repair Issued ${selectedDealer}`, effectiveReceived);
    }
    recordRepairSale(no, snap);
    void reloadCredit();
    setArchive({ invoiceNo: no, snap, dealer: selectedDealer, customer: invoiceCustomer });
    setShowIssuedMsg(true);
  };

  if (view === "invoice" && invoiceSnapshot && invoiceNo) {
    return (
      <InvoiceView
        invoiceNo={invoiceNo}
        createdAt={createdAt}
        dealer={selectedDealer}
        customer={invoiceCustomer}
        isCredit={invoiceSnapshot.finalDue > 0}
        amountReceivedNow={invoiceSnapshot.effectiveReceived}
        dueAmount={invoiceSnapshot.finalDue}
        totalAdvance={invoiceSnapshot.totalAdvance}
        invoiceDiscount={invoiceSnapshot.invoiceDiscount}
        creditRecordMade={creditRecordMade}
        repairs={invoiceSnapshot.repairs}
        extras={invoiceSnapshot.extras}
        onBack={() => setView("search")}
      />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, flex: 1, minHeight: 0, overflowY: "auto", paddingRight: 4 }}>

      {/* Step 1 */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
        <p style={stepLabel}>Step 1 — Select a Dealer</p>
        <div style={{ position: "relative" }}>
          <select
            value={selectedDealer}
            onChange={(e) => handleDealerChange(e.target.value)}
            style={{ width: "100%", padding: "10px 36px 10px 14px", borderRadius: 9, border: "1px solid var(--border)", background: "var(--bg-primary)", color: selectedDealer ? "var(--text-primary)" : "var(--text-muted)", fontSize: 13, outline: "none", cursor: "pointer", appearance: "none", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            <option value="">— PLEASE SELECT A DEALER —</option>
            {dealerOptions.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <ChevronDown size={14} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
        </div>
      </div>

      {/* Step 2 */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <p style={stepLabel}>Step 2 — Select Finished Repairs for Invoicing</p>
          {checkedIds.size > 0 && (
            <span style={{ fontSize: 11, color: "var(--accent)", fontWeight: 600, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              {checkedIds.size} selected
            </span>
          )}
        </div>

        <div style={{ position: "relative" }}>
          <Search size={13} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Job no., dealer no., brand, model, IMEI, customer…"
            disabled={!selectedDealer}
            style={{ width: "100%", padding: "9px 14px 9px 32px", borderRadius: 8, border: "1px solid var(--border)", background: selectedDealer ? "var(--bg-primary)" : "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 12.5, outline: "none", fontFamily: "'Plus Jakarta Sans', sans-serif", opacity: selectedDealer ? 1 : 0.5, boxSizing: "border-box" }}
          />
        </div>

        <div className="table-scroll" style={{ border: "1px solid var(--border)", borderRadius: 10, minHeight: 200, background: "var(--bg-primary)" }}>
          {!selectedDealer ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, color: "var(--text-muted)", fontSize: 13, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              Select a dealer to see their completed repairs
            </div>
          ) : dealerRepairs.length === 0 ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, color: "var(--text-muted)", fontSize: 13, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              No completed repairs found
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 940 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
                  {/* Advance and Balance sit after the line total because that
                      is the order the money moved: what the job was billed at,
                      what the customer already put down at intake, and what is
                      left to collect at the counter now. Without them, deciding
                      what to charge meant opening every job.

                      An outside dealer's device has no Mano Mobile customer to
                      name, and no advance of ours on record — the dealer is who
                      we billed, and what they may have taken from the end owner
                      isn't ours to show. In its place: the fault and the two
                      dates that actually matter to a dealer chasing up a job —
                      when it came in, when it was finished. */}
                  {(isManoMobile
                    ? ["", "Job ID", "Job Type", "Customer", "Brand / Model", "IMEI No.", "Warranty", "Unit Price", "Discount", "Line Total", "Advance Paid", "Balance"]
                    : ["", "Job ID", "Job Type", "Brand / Model", "IMEI No.", "Fault", "Job Accepted", "Finished", "Warranty", "Estimate", "Discount", "Line Total", "Balance"]
                  ).map((h, i) => (
                    <th key={h} style={{ padding: "9px 14px", textAlign: h === "" ? "center" : "left", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.06em", textTransform: "uppercase" as const, fontFamily: "'Plus Jakarta Sans', sans-serif", whiteSpace: "nowrap" }}>
                      {i === 0 ? (
                        <input
                          type="checkbox"
                          checked={allChecked}
                          onChange={toggleCheckAll}
                          title={allChecked ? "Deselect all" : "Select all"}
                          style={{ accentColor: "var(--accent)", width: 14, height: 14, cursor: "pointer", verticalAlign: "middle" }}
                        />
                      ) : h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dealerRepairs.map((r, i) => {
                  const checked   = checkedIds.has(r.id);
                  const lineTotal = r.unitPrice - r.discount;
                  // Never negative: an advance larger than the final bill is a
                  // refund, not a balance, and showing it as "− Rs. 200 to
                  // collect" would read as money owed to the shop.
                  const balance   = Math.max(0, lineTotal - r.advance);
                  // Money out. Shown in brackets wherever a total would be, so
                  // no extra column is needed to say which way it goes.
                  const owesBack  = r.cashReturnAmount ?? 0;
                  return (
                    <tr
                      key={r.id}
                      onClick={() => toggleCheck(r.id)}
                      style={{ borderBottom: i < dealerRepairs.length - 1 ? "1px solid var(--border)" : "none", background: checked ? "var(--accent-dim)" : "transparent", cursor: "pointer", transition: "background 0.12s" }}
                      onMouseEnter={(e) => { if (!checked) (e.currentTarget as HTMLTableRowElement).style.background = "var(--bg-card-hover)"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = checked ? "var(--accent-dim)" : "transparent"; }}
                    >
                      <td style={{ padding: "11px 14px", textAlign: "center" }}>
                        <input type="checkbox" checked={checked} onChange={() => toggleCheck(r.id)} onClick={(e) => e.stopPropagation()} style={{ accentColor: "var(--accent)", width: 14, height: 14, cursor: "pointer" }} />
                      </td>
                      {/* Both numbers in the one column, stacked the way Repair
                          Management stacks them: the dealer's leads, because
                          that is what gets quoted down the phone and matched
                          against their docket, and ours sits under it as the
                          reference this system runs on. A job with no dealer
                          number just shows ours. */}
                      <td style={{ padding: "11px 14px" }}>
                        {r.dealerJobNo ? (
                          <>
                            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)", fontFamily: "'Plus Jakarta Sans', sans-serif" }} title="The dealer's own job number">
                              #{r.dealerJobNo}
                            </span>
                            <p style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 2, fontFamily: "'Plus Jakarta Sans', sans-serif" }} title="Our job number">
                              {r.id}
                            </p>
                          </>
                        ) : (
                          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{r.id}</span>
                        )}
                        {/* Already with the customer. Worth saying plainly:
                            the cashier is billing work that has left the shop,
                            and nothing else on the row would tell them. */}
                        {r.uninvoiced && (
                          <p title="Handed over without an invoice — bill it here to put that right" style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: "0.04em", color: "#fbbf24", marginTop: 2, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                            NOT INVOICED
                          </p>
                        )}
                      </td>
                      <td style={{ padding: "11px 14px" }}><JobTypeTag type={r.completionType} /></td>
                      {isManoMobile && (
                        <td style={{ padding: "11px 14px" }}><p style={{ fontSize: 12.5, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{r.customerName}</p></td>
                      )}
                      <td style={{ padding: "11px 14px" }}><p style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{r.brand} {r.model}</p></td>
                      <td style={{ padding: "11px 14px" }} onClick={e => e.stopPropagation()}>
                        {imeiEdit?.id === r.id ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                            <input
                              autoFocus
                              value={imeiEdit.value}
                              onChange={e => setImeiEdit({ id: r.id, value: cleanImei(e.target.value) })}
                              onKeyDown={e => { if (e.key === "Enter") void saveImei(); if (e.key === "Escape") setImeiEdit(null); }}
                              maxLength={15}
                              inputMode="numeric"
                              placeholder="Dial *#06#"
                              style={{ width: 150, padding: "5px 8px", borderRadius: 7, border: "1px solid var(--accent-glow)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 11.5, fontFamily: "monospace", outline: "none" }}
                            />
                            <button onClick={() => void saveImei()} disabled={imeiSaving || imeiEdit.value.length !== 15} title={imeiEdit.value.length === 15 ? "Save" : `15 digits needed — this has ${imeiEdit.value.length}`} style={{ display: "flex", padding: 4, borderRadius: 6, border: "1px solid var(--accent)", background: "transparent", color: "var(--accent)", cursor: imeiEdit.value.length === 15 ? "pointer" : "not-allowed", opacity: imeiEdit.value.length === 15 ? 1 : 0.4 }}>
                              <Check size={12} />
                            </button>
                            <button onClick={() => setImeiEdit(null)} title="Cancel" style={{ display: "flex", padding: 4, borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer" }}>
                              <X size={12} />
                            </button>
                          </span>
                        ) : r.imei ? (
                          <span style={{ fontSize: 11.5, color: "var(--text-muted)", fontFamily: "monospace" }}>{r.imei}</span>
                        ) : r.unidentifiedReason ? (
                          // Looked at and cannot be known. Not a gap to chase,
                          // and not something a pencil can fix.
                          <span title={r.unidentifiedReason} style={{ fontSize: 11, color: "var(--text-muted)", fontStyle: "italic" }}>Not identifiable</span>
                        ) : (
                          <button
                            onClick={() => setImeiEdit({ id: r.id, value: "" })}
                            title="No IMEI on this job — add it before invoicing"
                            style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 8px", borderRadius: 7, border: "1px solid rgba(251,191,36,0.45)", background: "rgba(251,191,36,0.1)", color: "#d97706", cursor: "pointer", fontSize: 11, fontWeight: 700, fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                          >
                            <Pencil size={10} />Add IMEI
                          </button>
                        )}
                      </td>
                      {!isManoMobile && (
                        <>
                          <td style={{ padding: "11px 14px" }}><span style={{ fontSize: 11.5, color: "var(--text-secondary)", fontFamily: "'Plus Jakarta Sans', sans-serif", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }} title={r.issue}>{r.issue || "—"}</span></td>
                          <td style={{ padding: "11px 14px" }}><span style={{ fontSize: 11.5, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif", whiteSpace: "nowrap" }}>{fmtDate(r.createdAt)}</span></td>
                          <td style={{ padding: "11px 14px" }}><span style={{ fontSize: 11.5, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif", whiteSpace: "nowrap" }}>{fmtDate(r.completedAt)}</span></td>
                        </>
                      )}
                      <td style={{ padding: "11px 14px" }}><span style={{ fontSize: 11.5, color: "var(--text-secondary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{r.warranty}</span></td>
                      <td style={{ padding: "11px 14px" }}><span style={{ fontSize: 12, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Rs. {r.unitPrice.toLocaleString()}</span></td>
                      <td style={{ padding: "11px 14px" }} onClick={e => { if (mayDiscount) e.stopPropagation(); }}>
                        {mayDiscount ? (
                          <input
                            type="number"
                            min={0}
                            max={r.unitPrice}
                            value={rowDiscounts[r.id] ?? ""}
                            placeholder="0"
                            onChange={e => {
                              const v = Math.max(0, Math.min(parseFloat(e.target.value) || 0, r.unitPrice));
                              setRowDiscounts(d => {
                                if (v === 0) { const rest = { ...d }; delete rest[r.id]; return rest; }
                                return { ...d, [r.id]: v };
                              });
                            }}
                            style={{
                              width: 92, padding: "5px 8px", borderRadius: 7, fontSize: 12,
                              border: `1px solid ${r.discount > 0 ? "rgba(248,113,113,0.45)" : "var(--border)"}`,
                              background: "var(--bg-primary)",
                              color: r.discount > 0 ? "#f87171" : "var(--text-primary)",
                              fontFamily: "'Plus Jakarta Sans', sans-serif", outline: "none",
                            }}
                          />
                        ) : (
                          <span style={{ fontSize: 12, color: r.discount > 0 ? "#f87171" : "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                            {r.discount > 0 ? `− Rs. ${r.discount.toLocaleString()}` : "—"}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "11px 14px" }}>
                        {/* Brackets rather than an extra column: this is the
                            same total, pointing the other way. */}
                        <span style={{ fontSize: 12, fontWeight: 700, color: owesBack > 0 ? "#60a5fa" : "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                          {owesBack > 0 ? `(Rs. ${owesBack.toLocaleString()})` : `Rs. ${lineTotal.toLocaleString()}`}
                        </span>
                      </td>
                      {isManoMobile && (
                        <td style={{ padding: "11px 14px" }}>
                          <span style={{ fontSize: 12, color: r.advance > 0 ? "#4ade80" : "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                            {r.advance > 0 ? `Rs. ${r.advance.toLocaleString()}` : "—"}
                          </span>
                        </td>
                      )}
                      <td style={{ padding: "11px 14px" }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: owesBack > 0 ? "#60a5fa" : balance > 0 ? "var(--text-primary)" : "#4ade80", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                          {owesBack > 0 ? `(Rs. ${owesBack.toLocaleString()})` : balance > 0 ? `Rs. ${balance.toLocaleString()}` : "Settled"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {!mayDiscount && dealerRepairs.length > 0 && (
            <p style={{ fontSize: 11.5, color: "var(--text-muted)", padding: "10px 14px 0", lineHeight: 1.55, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              Discounts are locked for your account. An Admin can grant{" "}
              <strong>Settle below the agreed price</strong> under Permissions → Cashiers.
            </p>
          )}
        </div>
      </div>

      {/* Step 3: Billing — only when dealer selected + repairs checked */}
      {showStep3 && (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <p style={stepLabel}>Step 3 — Billing</p>
            {/* Refreshed on the assigned number, so once this bill is generated
                the panel moves on instead of still offering the number it just
                used. */}
            <InvoiceNoBadge refreshKey={invoiceNo} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))", gap: 16, alignItems: "start" }}>

            {/* ── Bill Info ── */}
            <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 10, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 0 }}>
              <div style={cardHead}>Bill Info</div>

              {/* Selected items */}
              <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 13 }}>
                {selectedRepairs.map(r => {
                  const back = r.cashReturnAmount ?? 0;
                  return (
                    <div key={r.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                      <span style={{ color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "60%" }}>
                        {r.id} · {r.brand} {r.model}
                        {/* Named on its own line so the dealer can see which
                            job took the money off, not just that something did. */}
                        {back > 0 && <span style={{ color: "#60a5fa", fontWeight: 600 }}> · Cash Return</span>}
                      </span>
                      <span style={{ fontWeight: 600, color: back > 0 ? "#60a5fa" : "var(--text-primary)", flexShrink: 0 }}>
                        {back > 0 ? `(Rs. ${back.toLocaleString()})` : `Rs. ${(r.unitPrice - r.discount).toLocaleString()}`}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* ── Products going out with the repair ───────────────────────
                  On the same bill, under the same number. Asked here, at the
                  moment the customer is standing at the counter with the phone
                  in one hand, because that is when they say "and a glass for
                  it". Nothing moves until Complete Sale. */}
              {!refundMode && (
                <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12, marginBottom: 13, display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", color: "var(--text-muted)", fontFamily: ff }}>
                      ADDITIONAL PRODUCTS{extras.length > 0 ? ` · ${extras.reduce((n, l) => n + l.qty, 0)}` : ""}
                    </span>
                    <button
                      type="button"
                      onClick={() => setAddingProducts(true)}
                      style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 7, fontSize: 11.5, fontWeight: 600, border: "1px solid var(--accent-glow)", background: "var(--accent-dim)", color: "var(--accent)", cursor: "pointer", fontFamily: ff }}
                    >
                      <ShoppingBag size={12} /> {extras.length > 0 ? "Add more" : "Add products / accessories"}
                    </button>
                  </div>

                  {extras.length === 0 ? (
                    <p style={{ fontSize: 11.5, color: "var(--text-muted)", fontFamily: ff, lineHeight: 1.5 }}>
                      Tempered glass, a cover, a charger, a SIM — anything the customer takes away with the phone goes on this invoice.
                    </p>
                  ) : extras.map(l => (
                    <div key={l.productId} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, fontFamily: ff }}>
                      <span style={{ flex: 1, minWidth: 0, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={`${l.code} · ${l.name}`}>
                        {l.name}
                      </span>
                      {/* Quantity, price and a line discount, editable in place —
                          the shelf price is a default, and a cashier who has
                          just agreed Rs. 700 for a Rs. 750 glass should not
                          have to go and change the catalogue. */}
                      <input
                        type="number" min={1} max={l.stock} value={l.qty}
                        onChange={e => setExtras(prev => prev.map(x => x.productId === l.productId ? { ...x, qty: Math.max(1, Math.min(l.stock, parseInt(e.target.value) || 1)) } : x))}
                        title="Quantity"
                        style={{ width: 46, padding: "4px 6px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 12, textAlign: "center", outline: "none", fontFamily: ff }}
                      />
                      <span style={{ color: "var(--text-muted)", fontSize: 11 }}>×</span>
                      <input
                        type="number" min={0} value={l.unitPrice}
                        onChange={e => setExtras(prev => prev.map(x => x.productId === l.productId ? { ...x, unitPrice: Math.max(0, parseFloat(e.target.value) || 0) } : x))}
                        title="Unit price"
                        style={{ width: 74, padding: "4px 6px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 12, textAlign: "right", outline: "none", fontFamily: ff }}
                      />
                      {mayDiscount && (
                        <input
                          type="number" min={0} max={l.qty * l.unitPrice} value={l.discount || ""} placeholder="− 0"
                          onChange={e => setExtras(prev => prev.map(x => x.productId === l.productId ? { ...x, discount: Math.max(0, Math.min(x.qty * x.unitPrice, parseFloat(e.target.value) || 0)) } : x))}
                          title="Discount on this line"
                          style={{ width: 60, padding: "4px 6px", borderRadius: 6, border: `1px solid ${l.discount > 0 ? "rgba(248,113,113,0.45)" : "var(--border)"}`, background: "var(--bg-primary)", color: l.discount > 0 ? "#f87171" : "var(--text-primary)", fontSize: 12, textAlign: "right", outline: "none", fontFamily: ff }}
                        />
                      )}
                      <span style={{ fontWeight: 600, color: "var(--text-primary)", minWidth: 78, textAlign: "right" }}>
                        Rs. {extraLineTotal(l).toLocaleString()}
                      </span>
                      <button
                        type="button"
                        onClick={() => setExtras(prev => prev.filter(x => x.productId !== l.productId))}
                        title="Remove from this invoice"
                        style={{ width: 24, height: 24, borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
                      >
                        <X size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* A returned job with an advance on it is money going out, so
                  the whole card flips rather than the cashier being sent to a
                  separate refund screen. Same job selection, same card, one
                  extra line and the opposite direction. */}
              {refundMode ? (
                <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                    <RotateCcw size={12} style={{ color: "var(--accent)" }} />
                    <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", color: "var(--accent)", fontFamily: ff }}>
                      REFUNDABLE INVOICE
                    </span>
                  </div>

                  {tooManyToRefund ? (
                    <p style={{ fontSize: 12, color: "#fbbf24", lineHeight: 1.55, fontFamily: ff, padding: "9px 11px", borderRadius: 8, background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.35)" }}>
                      {refundCandidates.length} returned jobs with advances are selected. Refund one at a
                      time — Other Charges and the amount returned belong to a single job, and splitting
                      one deduction across several would be a figure nobody could explain to a customer.
                    </p>
                  ) : (
                    <>
                      {/* What the money is, said in the terms the job used.
                          A Cash Return carries a figure the technician set; a
                          returned job with an advance carries the arithmetic
                          that produced one. Showing both framings on every
                          refund would mean half of it was always noise. */}
                      {(isCashReturn
                        ? [
                            { label: "Charged for this repair", value: fmtRs(refundSubtotal), color: "var(--text-muted)" },
                            { label: "Cash Return Amount", value: fmtRs(refundable), color: "#60a5fa" },
                          ]
                        : [
                            { label: "Subtotal",     value: fmtRs(refundSubtotal), color: "var(--text-muted)" },
                            { label: "Advance Paid", value: `+ ${fmtRs(refundAdvance)}`, color: "#4ade80" },
                          ]
                      ).map(row => (
                        <div key={row.label} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13, fontFamily: ff }}>
                          <span style={{ color: "var(--text-muted)" }}>{row.label}</span>
                          <span style={{ fontWeight: 600, color: row.color }}>{row.value}</span>
                        </div>
                      ))}

                      {refundJob?.rejobOf && (
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12, fontFamily: ff }}>
                          <span style={{ color: "var(--text-muted)" }}>Re-job of</span>
                          <span style={{ fontWeight: 600, color: "var(--text-secondary)" }}>{refundJob.rejobOf}</span>
                        </div>
                      )}

                      {alreadyRefunded > 0 && (
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13, fontFamily: ff }}>
                          <span style={{ color: "var(--text-muted)" }}>Already Refunded</span>
                          <span style={{ fontWeight: 600, color: "var(--text-secondary)" }}>− {fmtRs(alreadyRefunded)}</span>
                        </div>
                      )}

                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 16, fontWeight: 800, fontFamily: ff, paddingTop: 10, borderTop: "1px solid var(--border)", marginTop: 8 }}>
                        <span style={{ color: "var(--text-secondary)" }}>
                          {alreadyRefunded > 0 ? "Still to Refund" : "Amount to be Refunded"}
                        </span>
                        <span style={{ color: "var(--accent)" }}>{fmtRs(stillRefundable)}</span>
                      </div>
                    </>
                  )}
                </div>
              ) : (
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  ...(cashReturnTotal > 0
                    ? [
                        { label: "Completed Repairs", value: fmtRs(repairsTotal), color: "var(--text-primary)" },
                        { label: "Less: Cash Returns", value: `(${fmtRs(cashReturnTotal)})`, color: "#60a5fa" },
                      ]
                    : []),
                  { label: cashReturnTotal > 0 ? "Repairs after returns" : "Repair Charges", value: fmtRs(lineSubtotal), color: "var(--text-primary)" },
                  // Only when there are any: a permanent "Products — 0" row on
                  // every repair bill would be a line to read past forty times
                  // a day for the twice it says something.
                  ...(extras.length > 0
                    ? [{ label: `Additional Products (${extras.reduce((n, l) => n + l.qty, 0)})`, value: fmtRs(extrasTotal), color: "var(--text-primary)" }]
                    : []),
                  // Shown apart, not summed, because they answer different
                  // questions later: what was conceded on the work, and what
                  // was conceded on the relationship.
                  { label: "Line Discounts",  value: lineDiscounts > 0 ? `− Rs. ${lineDiscounts.toLocaleString()}` : "—", color: lineDiscounts > 0 ? "#f87171" : "var(--text-muted)" },
                  { label: "Invoice Discount", value: invDiscountAmt > 0 ? `− Rs. ${invDiscountAmt.toLocaleString()}` : "—", color: invDiscountAmt > 0 ? "#f87171" : "var(--text-muted)" },
                  { label: "Net Total",       value: fmtRs(grandTotal), color: "var(--text-primary)" },
                  { label: "Advance Paid",   value: totalAdvance > 0 ? `− Rs. ${totalAdvance.toLocaleString()}` : "—", color: totalAdvance > 0 ? "#4ade80" : "var(--text-muted)" },
                ].map(row => {
                  const lead = row.label === "Net Total";
                  return (
                    <div key={row.label} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: lead ? 14 : 13, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                      <span style={{ color: lead ? "var(--text-secondary)" : "var(--text-muted)", fontWeight: lead ? 600 : 400 }}>{row.label}</span>
                      <span style={{ fontWeight: lead ? 800 : 600, color: row.color }}>{row.value}</span>
                    </div>
                  );
                })}

                {/* Discount on the whole bill */}
                {mayDiscount && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, fontSize: 13, fontFamily: "'Plus Jakarta Sans', sans-serif", marginTop: 6, marginBottom: 2 }}>
                    <span style={{ color: "var(--text-muted)" }}>Discount whole invoice</span>
                    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                      <div style={{ display: "flex", gap: 2, background: "var(--bg-primary)", border: "1px solid var(--border)", borderRadius: 6, padding: 2 }}>
                        {(["Rs", "%"] as const).map(m => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setInvDiscountMode(m)}
                            style={{
                              padding: "4px 9px", borderRadius: 5, fontSize: 12, cursor: "pointer",
                              border: "none", fontFamily: "'Plus Jakarta Sans', sans-serif",
                              fontWeight: invDiscountMode === m ? 700 : 500,
                              background: invDiscountMode === m ? "var(--accent-dim)" : "transparent",
                              color: invDiscountMode === m ? "var(--accent)" : "var(--text-muted)",
                            }}
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                      <input
                        type="number"
                        min={0}
                        max={invDiscountMode === "%" ? 100 : afterLines}
                        value={invDiscount}
                        placeholder="0"
                        onChange={e => setInvDiscount(e.target.value)}
                        style={{ width: 86, padding: "6px 9px", borderRadius: 7, border: `1px solid ${invDiscountAmt > 0 ? "rgba(248,113,113,0.45)" : "var(--border)"}`, background: "var(--bg-primary)", color: invDiscountAmt > 0 ? "#f87171" : "var(--text-primary)", fontSize: 13, outline: "none", textAlign: "right", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                      />
                    </div>
                  </div>
                )}

                {/* Balance after advance */}
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 16, fontWeight: 800, fontFamily: "'Plus Jakarta Sans', sans-serif", paddingTop: 10, borderTop: "1px solid var(--border)", marginTop: 8 }}>
                  <span style={{ color: "var(--text-secondary)" }}>Balance Due</span>
                  <span style={{ color: "var(--text-primary)" }}>Rs. {netDue.toLocaleString()}</span>
                </div>
              </div>
              )}
            </div>

            {/* ── Payment ── */}
            <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 10, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={cardHead}>Payment</div>

              <div>
                <label style={labelSt}>Method</label>
                <div style={{ display: "flex", gap: 5 }}>
                  {(["Cash", "Card", "Bank Transfer"] as const).map(m => {
                    const on = payMethod === m;
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setPayMethod(m)}
                        style={{
                          flex: 1, minHeight: 34, borderRadius: 8, fontSize: 11.5, cursor: "pointer",
                          fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: on ? 700 : 500,
                          border: `1px solid ${on ? "var(--accent)" : "var(--border)"}`,
                          background: on ? "var(--accent-dim)" : "var(--bg-primary)",
                          color: on ? "var(--accent)" : "var(--text-secondary)",
                          whiteSpace: "nowrap", padding: "0 6px",
                        }}
                      >
                        {m === "Bank Transfer" ? "Transfer" : m}
                      </button>
                    );
                  })}
                </div>
              </div>

              {payMethod !== "Cash" && (
                <div>
                  <label style={labelSt}>{payMethod === "Card" ? "Card reference / last 4" : "Transfer reference"}</label>
                  <input value={cardRef} onChange={e => setCardRef(e.target.value)} placeholder="Optional" style={inputSt} />
                </div>
              )}


                {/* Money out rather than money in. Same card, same method
                    buttons — the method is how the cash physically moves, and
                    that question is the same in both directions. */}
                {refundMode ? (
                  refundJob && (
                    <>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, fontSize: 13, fontFamily: ff, marginTop: 4 }}>
                        <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>Amount Refunded Now</span>
                        <input
                          type="number" min={0} max={stillRefundable}
                          value={refundNowDisplay}
                          onChange={e => setRefundNow(e.target.value)}
                          style={{ width: 120, padding: "7px 10px", borderRadius: 7, border: "1px solid rgba(96,165,250,0.5)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 14, fontWeight: 700, outline: "none", textAlign: "right", fontFamily: ff }}
                        />
                      </div>

                      {/* A part-payment leaves a debt the shop owes the
                          customer, and it stays visible until it is cleared.
                          Nothing about handing back Rs. 6,000 of Rs. 10,000
                          settles the other Rs. 4,000. */}
                      {refundNowAmt > 0 && refundRemaining > 0 && (
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "9px 11px", borderRadius: 8, background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.35)", marginTop: 6 }}>
                          <span style={{ fontSize: 12.5, color: "var(--text-secondary)", fontFamily: ff }}>Remaining Refund Balance</span>
                          <span style={{ fontSize: 13, fontWeight: 800, color: "#fbbf24", fontFamily: ff }}>{fmtRs(refundRemaining)}</span>
                        </div>
                      )}

                      {refundNowAmt > stillRefundable && (
                        <p style={{ fontSize: 11.5, color: "#f87171", fontFamily: ff, lineHeight: 1.5, marginTop: 6 }}>
                          Only {fmtRs(stillRefundable)} is still refundable on {refundJob.id}.
                        </p>
                      )}
                      {refundError && (
                        <p style={{ fontSize: 11.5, color: "#f87171", fontFamily: ff, lineHeight: 1.5, marginTop: 6 }}>{refundError}</p>
                      )}
                      {refundDone && (
                        <p style={{ fontSize: 11.5, color: "#4ade80", fontFamily: ff, lineHeight: 1.5, marginTop: 6 }}>
                          Refund recorded · {refundDone}. The advance stays on the job as money received.
                        </p>
                      )}

                      {!mayRefundAdvance && (
                        <p style={{ fontSize: 11.5, color: "var(--text-muted)", fontFamily: ff, lineHeight: 1.55, marginTop: 6 }}>
                          Paying a refund out needs an admin cashier. An Admin can grant it under
                          Permissions → Cashiers.
                        </p>
                      )}

                      <button
                        onClick={processRefund}
                        disabled={!canRefund}
                        style={{
                          marginTop: 10, width: "100%", minHeight: 42, borderRadius: 9,
                          fontSize: 13, fontWeight: 700, fontFamily: ff,
                          border: "1px solid var(--accent)", background: "var(--accent)",
                          color: "var(--accent-fg)",
                          cursor: canRefund ? "pointer" : "not-allowed",
                          opacity: canRefund ? 1 : 0.45,
                        }}
                      >
                        {refunding ? "Recording…" : `Process Refund · ${fmtRs(refundNowAmt)}`}
                      </button>
                    </>
                  )
                ) : (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, fontSize: 13, fontFamily: "'Plus Jakarta Sans', sans-serif", marginTop: 4 }}>
                  <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>Amount Received Now</span>
                  <input
                    type="number" min={0} max={netDue}
                    value={receivedDisplay}
                    onChange={e => setAmountReceived(e.target.value)}
                    style={{ width: 120, padding: "7px 10px", borderRadius: 7, border: `1px solid ${isCredit ? "rgba(251,191,36,0.5)" : "rgba(74,222,128,0.4)"}`, background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 14, fontWeight: 700, outline: "none", textAlign: "right", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                  />
                </div>
                )}

                {/* Offered only when there is something left to forgive, and only
                    to somebody trusted to take money off a bill — it is the same
                    decision as a discount, made after billing instead of before. */}
                {!refundMode && isCredit && mayDiscount && (
                  <label style={{
                    display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer",
                    marginTop: 8, padding: "8px 10px", borderRadius: 8,
                    background: writeOffBalance ? "rgba(251,191,36,0.08)" : "var(--bg-primary)",
                    border: `1px solid ${writeOffBalance ? "rgba(251,191,36,0.4)" : "var(--border)"}`,
                  }}>
                    <input
                      type="checkbox"
                      checked={writeOffBalance}
                      onChange={e => setWriteOffBalance(e.target.checked)}
                      style={{ width: 14, height: 14, accentColor: "#fbbf24", cursor: "pointer", flexShrink: 0, marginTop: 1 }}
                    />
                    <span style={{ minWidth: 0 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif", display: "block" }}>
                        Write off Rs. {finalDue.toLocaleString()} as bad debt
                      </span>
                      <span style={{ fontSize: 11.5, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif", lineHeight: 1.5 }}>
                        Nothing goes on account and no credit record is opened. The job settles here.
                      </span>
                    </span>
                  </label>
                )}

                {!refundMode && (
                <div style={{ borderTop: "1px solid var(--border)", marginTop: 6, paddingTop: 8 }}>
                  {isCredit && writeOffBalance ? (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", borderRadius: 8, background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.35)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <Undo2 size={12} color="#fbbf24" />
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#fbbf24", letterSpacing: "0.04em" }}>WRITTEN OFF</span>
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 800, color: "#fbbf24" }}>Rs. {finalDue.toLocaleString()}</span>
                    </div>
                  ) : isCredit ? (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", borderRadius: 8, background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.3)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <CreditCard size={12} color="#fbbf24" />
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#fbbf24", letterSpacing: "0.04em" }}>CREDIT DUE</span>
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 800, color: "#fbbf24" }}>Rs. {finalDue.toLocaleString()}</span>
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 10px", borderRadius: 8, background: "rgba(74,222,128,0.07)", border: "1px solid rgba(74,222,128,0.25)" }}>
                      <CheckCircle size={12} color="#4ade80" />
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: "#4ade80" }}>FULLY SETTLED</span>
                    </div>
                  )}
                </div>
                )}

                {!refundMode && isCredit && !writeOffBalance && (
                  <p style={{ fontSize: 11.5, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif", marginTop: 8, lineHeight: 1.55 }}>
                    {isManoMobile
                      ? "Due amount will be credited to the selected customer's credit profile."
                      : "Due amount will be logged against the dealer's outstanding balance."}
                  </p>
                )}
            </div>

            {/* ── Dealer Info ── */}
            {!isManoMobile && (
            <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 10, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={cardHead}>Dealer Info</div>

              {/* Dealer identity */}
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10, paddingBottom: 12, borderBottom: "1px solid var(--border)" }}>
                <div style={{ width: 36, height: 36, borderRadius: 9, background: "var(--accent-dim)", border: "1px solid var(--accent-glow)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Building2 size={16} color="var(--accent)" />
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{selectedDealer}</p>
                  {dealerProfile && (
                    <>
                      {dealerProfile.address && (
                        <p style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif", marginTop: 2 }}>{dealerProfile.address}</p>
                      )}
                      <p style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif", marginTop: 2 }}>{dealerProfile.phone}</p>
                      <p style={{ fontSize: 10.5, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif", marginTop: 1 }}>Partner since {dealerProfile.since}</p>
                    </>
                  )}
                </div>
              </div>

              {dealerProfile && (
                <>
                  {/* Repair stats */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {[
                      { label: "Total Jobs",    value: dealerProfile.stats.total,      icon: Wrench,       color: "var(--accent)" },
                      { label: "Completed",     value: dealerProfile.stats.completed,  icon: CheckCircle,  color: "#4ade80" },
                      { label: "Pending",       value: dealerProfile.stats.pending,    icon: AlertCircle,  color: "#fbbf24" },
                      { label: "In Progress",   value: dealerProfile.stats.inProgress, icon: Clock,        color: "#60a5fa" },
                    ].map(({ label, value, icon: Icon, color }) => (
                      <div key={label} style={{ background: "var(--bg-primary)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", display: "flex", alignItems: "center", gap: 7 }}>
                        <Icon size={12} color={color} />
                        <div>
                          <p style={{ fontSize: 15, fontWeight: 700, color, fontFamily: "'Plus Jakarta Sans', sans-serif", lineHeight: 1 }}>{value}</p>
                          <p style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif", marginTop: 2 }}>{label}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Financial summary */}
                  <div style={{ paddingTop: 10, borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 7 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 5, color: "var(--text-muted)" }}>
                        <TrendingUp size={12} color="#4ade80" />Total Earned
                      </div>
                      <span style={{ fontWeight: 700, color: "#4ade80" }}>Rs. {dealerProfile.totalEarned.toLocaleString()}</span>
                    </div>
                    {dealerProfile.onAccount !== null && (
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 5, color: "var(--text-muted)" }} title="The balance on this dealer's credit account">
                          <AlertCircle size={12} color={dealerProfile.onAccount > 0 ? "#f87171" : "var(--text-muted)"} />Outstanding on account
                        </div>
                        <span style={{ fontWeight: 700, color: dealerProfile.onAccount > 0 ? "#f87171" : "var(--text-muted)" }}>
                          {dealerProfile.onAccount > 0 ? `Rs. ${dealerProfile.onAccount.toLocaleString()}` : "—"}
                        </span>
                      </div>
                    )}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 5, color: "var(--text-muted)" }} title="Finished repairs that have not been invoiced yet">
                        <Clock size={12} color={dealerProfile.unbilled > 0 ? "#fbbf24" : "var(--text-muted)"} />Finished, not yet billed
                      </div>
                      <span style={{ fontWeight: 700, color: dealerProfile.unbilled > 0 ? "#fbbf24" : "var(--text-muted)" }}>
                        {dealerProfile.unbilled > 0 ? `Rs. ${dealerProfile.unbilled.toLocaleString()}` : "—"}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>
            )}

            {/* ── Customer Info ── */}
            <div style={{ background: "var(--bg-secondary)", border: `1px solid ${useCreditPicker ? "rgba(251,191,36,0.3)" : "var(--border)"}`, borderRadius: 10, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 11 }}>
              <div style={{ ...cardHead, color: useCreditPicker ? "#fbbf24" : "var(--text-muted)" }}>
                Customer Info
                {useCreditPicker && <span style={{ marginLeft: 6, fontSize: 9, color: "#fbbf24" }}>· CREDIT REQUIRED</span>}
              </div>

              {useCreditPicker ? (
                /* Mano Mobile + due → Credit Customer Picker */
                <CreditCustomerPicker
                  selected={selectedCreditCustomer}
                  onSelect={setSelectedCreditCustomer}
                />
              ) : (
                /* Simple customer entry */
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {/* Offered only when there is a job to take them from. With
                      nothing selected it would be a tick that does nothing. */}
                  {selectedRepairs.length > 0 && (
                    <label
                      style={{
                        display: "flex", alignItems: "flex-start", gap: 9, cursor: "pointer",
                        padding: "9px 11px", borderRadius: 9,
                        background: useJobCustomer ? "rgba(99,85,255,0.07)" : "var(--bg-primary)",
                        border: `1px solid ${useJobCustomer ? "var(--accent-glow)" : "var(--border)"}`,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={useJobCustomer}
                        onChange={e => toggleJobCustomer(e.target.checked)}
                        style={{ width: 15, height: 15, accentColor: "var(--accent)", cursor: "pointer", flexShrink: 0, marginTop: 1 }}
                      />
                      <span style={{ minWidth: 0 }}>
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif", display: "block" }}>
                          Use the customer on the job
                        </span>
                        <span style={{ fontSize: 10.5, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif", lineHeight: 1.5 }}>
                          {jobCustomer.name
                            ? <>{jobCustomer.name}{jobCustomer.phone ? ` · ${jobCustomer.phone}` : ""}{jobCustomerVaries ? " — these jobs name more than one customer, so the first is used." : ""}</>
                            : "No customer name was recorded on the selected job — type one below."}
                        </span>
                      </span>
                    </label>
                  )}

                  {canBillDealer && (
                    <label
                      style={{
                        display: "flex", alignItems: "flex-start", gap: 9, cursor: "pointer",
                        padding: "9px 11px", borderRadius: 9,
                        background: billToDealer ? "rgba(99,85,255,0.07)" : "var(--bg-primary)",
                        border: `1px solid ${billToDealer ? "var(--accent-glow)" : "var(--border)"}`,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={billToDealer}
                        onChange={e => toggleBillToDealer(e.target.checked)}
                        style={{ width: 15, height: 15, accentColor: "var(--accent)", cursor: "pointer", flexShrink: 0, marginTop: 1 }}
                      />
                      <span style={{ minWidth: 0 }}>
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif", display: "block" }}>
                          Set as {dealerRecord?.name ?? selectedDealer}
                        </span>
                        <span style={{ fontSize: 10.5, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif", lineHeight: 1.5 }}>
                          Bill the dealer rather than the phone&apos;s owner — fills these fields from the dealer registry.
                        </span>
                      </span>
                    </label>
                  )}

                  <div style={{ position: "relative" }}>
                    <label style={labelSt}>Full Name *</label>
                    <input
                      value={custName}
                      // Typed over, so these are no longer what the job says.
                      onChange={e => { setCustName(e.target.value); setUseJobCustomer(false); setCustMatchOpen(true); }}
                      onFocus={() => setCustMatchOpen(true)}
                      // A blur that fires before the click on a suggestion would
                      // close the list out from under the pointer.
                      onBlur={() => setTimeout(() => setCustMatchOpen(false), 150)}
                      readOnly={billToDealer}
                      placeholder="Customer full name"
                      autoComplete="off"
                      style={{ ...inputSt, ...(billToDealer ? lockedSt : null) }}
                    />

                    {!billToDealer && custMatchOpen && custMatches.length > 0 && (
                      <div style={{
                        position: "absolute", top: "100%", left: 0, right: 0, zIndex: 20, marginTop: 4,
                        background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 9,
                        boxShadow: "0 12px 32px rgba(0,0,0,0.35)", overflow: "hidden",
                      }}>
                        {custMatches.map(c => (
                          <button
                            key={c.phone}
                            type="button"
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => {
                              setCustName(c.name);
                              setCustPhone(c.phone);
                              setCustMatchOpen(false);
                            }}
                            style={{
                              display: "flex", alignItems: "center", gap: 10, width: "100%",
                              padding: "8px 11px", background: "transparent", border: "none",
                              borderBottom: "1px solid var(--border)", cursor: "pointer", textAlign: "left",
                              fontFamily: "'Plus Jakarta Sans', sans-serif",
                            }}
                            onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-card-hover)"}
                            onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = "transparent"}
                          >
                            <BookUser size={12} style={{ color: "var(--accent)", flexShrink: 0 }} />
                            <span style={{ flex: 1, minWidth: 0 }}>
                              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", display: "block" }}>{c.name}</span>
                              <span style={{ fontSize: 10.5, color: "var(--text-muted)" }}>
                                {c.phone} · {c.jobs} {c.jobs === 1 ? "repair" : "repairs"}
                              </span>
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <label style={labelSt}>Phone</label>
                    <input
                      value={custPhone}
                      onChange={e => { setCustPhone(cleanPhone(e.target.value)); setUseJobCustomer(false); setCustMatchOpen(true); }}
                      inputMode="tel"
                      onFocus={() => setCustMatchOpen(true)}
                      onBlur={() => setTimeout(() => setCustMatchOpen(false), 150)}
                      readOnly={billToDealer}
                      placeholder={billToDealer ? "No contact number on the dealer record" : "07X XXX XXXX"}
                      style={{ ...inputSt, ...(billToDealer ? lockedSt : null) }}
                    />
                  </div>
                  {/* A dealer has no NIC, so the field goes away rather than
                      sitting there greyed out inviting a number that would be
                      wrong whatever was put in it. */}
                  {!billToDealer && (
                    <div>
                      <label style={labelSt}>NIC</label>
                      <input value={custNic} onChange={e => setCustNic(e.target.value)} placeholder="XXXXXXXXX V" style={inputSt} />
                    </div>
                  )}
                  {billToDealer && !custPhone.trim() && (
                    <p style={{ fontSize: 10.5, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif", lineHeight: 1.5 }}>
                      No contact number on this dealer&apos;s record. Add one under Admin Control → Repair Dealers.
                    </p>
                  )}
                  {!custName.trim() && (
                    <p style={{ fontSize: 10.5, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                      Name is required to generate the invoice.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {missingImei.length > 0 && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 9, padding: "10px 13px", borderRadius: 10, background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.4)" }}>
              <AlertCircle size={14} style={{ color: "#fbbf24", flexShrink: 0, marginTop: 1 }} />
              <p style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.55, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                <strong style={{ color: "var(--text-primary)" }}>
                  No IMEI on {missingImei.map(r => r.id).join(", ")}.
                </strong>{" "}
                Add it in the table above — the invoice has to say which handset it was for. If the
                device cannot be read at all, the technician records that on the job instead.
              </p>
            </div>
          )}

          {/* Generate Invoice button row */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, paddingTop: 4 }}>
            <button
              onClick={handleReset}
              style={{ padding: "9px 20px", borderRadius: 9, fontSize: 12, fontWeight: 600, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif", transition: "all 0.15s" }}
            >
              <X size={12} style={{ display: "inline", marginRight: 5, verticalAlign: "middle" }} />Cancel
            </button>
            <button
              onClick={handleMarkIssued}
              disabled={!canGenerate || invoicing}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 20px", borderRadius: 9, fontSize: 12, fontWeight: 600, border: `1px solid ${canGenerate && !invoicing ? "var(--accent-glow)" : "var(--border)"}`, background: canGenerate && !invoicing ? "var(--accent-dim)" : "transparent", color: canGenerate && !invoicing ? "var(--accent)" : "var(--text-muted)", cursor: canGenerate && !invoicing ? "pointer" : "not-allowed", opacity: canGenerate && !invoicing ? 1 : 0.5, fontFamily: "'Plus Jakarta Sans', sans-serif", transition: "all 0.15s" }}
            >
              <CheckCircle size={13} />Mark As Issued
            </button>
            <button
              onClick={handleGenerateInvoice}
              disabled={!canGenerate || invoicing}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 24px", borderRadius: 9, fontSize: 12, fontWeight: 700, border: `1px solid ${canGenerate && !invoicing ? "var(--accent)" : "var(--border)"}`, background: canGenerate && !invoicing ? "var(--accent)" : "var(--border)", color: canGenerate && !invoicing ? "var(--accent-fg)" : "var(--text-muted)", cursor: canGenerate && !invoicing ? "pointer" : "not-allowed", opacity: canGenerate && !invoicing ? 1 : 0.5, fontFamily: "'Plus Jakarta Sans', sans-serif", transition: "all 0.15s" }}
            >
              <Printer size={13} />{invoicing ? "Generating invoice…" : "Issue & Generate Invoice"}
            </button>
          </div>
        </div>
      )}

      {addingProducts && (
        <AddProductsModal
          existing={extras}
          onClose={() => setAddingProducts(false)}
          onAdd={lines => setExtras(prev => {
            // The same product picked twice is one line with a bigger
            // quantity, not two lines — that is how it prints, and how the
            // stock function wants it.
            const next = [...prev];
            for (const l of lines) {
              const i = next.findIndex(x => x.productId === l.productId);
              if (i >= 0) next[i] = { ...next[i], qty: Math.min(l.stock, next[i].qty + l.qty) };
              else next.push(l);
            }
            return next;
          })}
        />
      )}

      {/* Credit record confirmation modal */}
      {showCreditConfirm && (
        <CreditRecordConfirmModal
          dealer={selectedDealer}
          dueAmount={invoiceSnapshot?.finalDue ?? finalDue}
          busy={invoicing}
          onConfirm={async () => { setInvoicing(true); try { setShowCreditConfirm(false); await commitSale({ markCredit: true }); } finally { setInvoicing(false); } }}
          onSkip={async () => { setInvoicing(true); try { setShowCreditConfirm(false); await commitSale(); } finally { setInvoicing(false); } }}
          onCancel={() => setShowCreditConfirm(false)}
        />
      )}

      {/* The invoice behind a Mark-As-Issued sale, rendered only to be stored —
          see the `archive` state. Off-screen rather than display:none, so the
          layout that is captured is a laid-out one. Unmounted once stored. */}
      {archive && (
        <div aria-hidden style={{ position: "fixed", left: -20000, top: 0, width: 1200, height: 0, overflow: "hidden", pointerEvents: "none" }}>
          <InvoiceView
            invoiceNo={archive.invoiceNo}
            createdAt={createdAt}
            dealer={archive.dealer}
            customer={archive.customer}
            isCredit={archive.snap.finalDue > 0}
            amountReceivedNow={archive.snap.effectiveReceived}
            dueAmount={archive.snap.finalDue}
            totalAdvance={archive.snap.totalAdvance}
            invoiceDiscount={archive.snap.invoiceDiscount}
            creditRecordMade={false}
            repairs={archive.snap.repairs}
            extras={archive.snap.extras}
            onBack={() => {}}
            onArchived={no => setArchive(a => (a?.invoiceNo === no ? null : a))}
          />
        </div>
      )}

      {/* "Marked as Issued" info message */}
      {showIssuedMsg && typeof document !== "undefined" && createPortal(
        <div
          onClick={() => { setShowIssuedMsg(false); handleReset(); }}
          style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
        >
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 420, background: "var(--bg-card)", borderRadius: 16, border: "1px solid var(--border)", boxShadow: "0 32px 80px rgba(0,0,0,0.5)", padding: "26px 24px", textAlign: "center", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            <div style={{ width: 52, height: 52, borderRadius: "50%", background: "rgba(74,222,128,0.12)", border: "2px solid #4ade80", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
              <CheckCircle size={26} color="#4ade80" />
            </div>
            <p style={{ fontSize: 17, fontWeight: 800, color: "var(--text-primary)" }}>Job Marked as Issued</p>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 8, lineHeight: 1.55 }}>
              Nothing is printed now. The invoice is kept — reprint it any time from <strong style={{ color: "var(--text-primary)" }}>Sales History</strong>, or find the job in <strong style={{ color: "var(--text-primary)" }}>Repair Management</strong>.
            </p>
            <button
              onClick={() => { setShowIssuedMsg(false); handleReset(); }}
              style={{ marginTop: 18, width: "100%", padding: "10px", borderRadius: 10, border: "none", background: "var(--accent)", color: "var(--accent-fg)", fontSize: 13.5, fontWeight: 700, cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              OK
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* Cancel button when step 3 not visible yet */}
      {!showStep3 && (selectedDealer || checkedIds.size > 0) && (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button onClick={handleReset} style={{ padding: "9px 20px", borderRadius: 9, fontSize: 12, fontWeight: 600, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            Cancel
          </button>
        </div>
      )}

    </div>
  );
}
