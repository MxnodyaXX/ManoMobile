import { SHOP_DETAILS } from "@/lib/shop";
import { toGsmSafe } from "@/lib/sms/templates";

/**
 * Credit reminder SMS — scheduling and wording.
 *
 * Shared by the manual "Notify" button (CreditCustomers.tsx, AllCustomers.tsx,
 * both calling this from the browser) and the daily cron
 * (app/api/cron/credit-reminders, calling it from the server) so the two
 * never drift on what "due" means or what the message says.
 *
 * ── Why the due date is computed here, not read from a column ───────────────
 * credit_entries.due_on exists per-charge but is not what the rest of the app
 * calls "Overdue" — that status (see v_credit_accounts,
 * 20260906000029_restore_credit_status.sql) is worked out from the account as
 * a whole:
 *
 *   first_charge_on = the earliest Charge ever posted to the account
 *   Overdue once      first_charge_on < current_date - terms_days
 *
 * So "due date" here is first_charge_on + terms_days, for consistency with
 * the status every screen in the app already shows. This inherits a known
 * quirk of that view: first_charge_on is a MIN over every charge ever made,
 * so it does not move when a new charge lands on an old account. That is
 * existing behaviour, not something this file changes.
 *
 * Reminder timing follows from the same due date: 7, 2 and 1 day before it,
 * on the day itself, and every day it remains overdue after that — which
 * lines up with "Overdue" starting the day after the due date (current_date
 * - terms_days is exclusive of the due date itself, so daysUntilDue === 0 is
 * still "Active" in v_credit_accounts, and the first reminder that fires
 * while the view calls the account "Overdue" is daysUntilDue === -1).
 *
 * Rendered output is forced to plain ASCII, same discipline as templates.ts:
 * a curly quote, an em dash or an ellipsis pushes the message off the GSM-7
 * alphabet onto UCS-2, where a part is 70 characters instead of 160 — one
 * stray character roughly quadruples the cost of every message that uses it.
 * No em dashes, no curly quotes, no ellipsis character below.
 */

/** What every sms_messages row for one of these carries, so the cron's dedupe
 *  query and the manual send both agree on what to look for. */
export const CREDIT_REMINDER_PURPOSE = "credit-reminder";

export interface CreditReminderAccount {
  id: string;
  name: string;
  phone: string | null;
  balance: number;
  firstChargeOn: string | null;
  termsDays: number;
}

/**
 * first_charge_on + terms_days, at day granularity.
 *
 * first_charge_on arrives as a date-only string ("2026-09-10", no time —
 * it's a Postgres `date`). Parsed and stepped in UTC so the answer does not
 * depend on the server's local timezone offset, and so it agrees with
 * Postgres's own `current_date` arithmetic, which is date-only too.
 *
 * Returns null when there is nothing to compute from — no charge has ever
 * been posted to this account, so there is no balance to be overdue on it,
 * and the caller's balance > 0 check should already have ruled this out.
 */
export function creditReminderDueDate(firstChargeOn: string | null, termsDays: number): Date | null {
  if (!firstChargeOn) return null;
  const isoDay = firstChargeOn.slice(0, 10);
  const base = new Date(`${isoDay}T00:00:00Z`);
  if (isNaN(base.getTime())) return null;
  base.setUTCDate(base.getUTCDate() + Math.trunc(termsDays));
  return base;
}

/**
 * Whole days from `today` to `dueDate` — positive before the due date,
 * zero on it, negative once it has passed (overdue).
 *
 * Both sides are truncated to their UTC calendar date first, so this counts
 * calendar days rather than 24-hour periods — a reminder sent at 4am and one
 * sent at 11pm the same day both see the same number.
 */
export function daysUntilDue(dueDate: Date, today: Date = new Date()): number {
  const dueUtc = Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth(), dueDate.getUTCDate());
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.round((dueUtc - todayUtc) / 86_400_000);
}

/**
 * Convenience wrapper combining the two above — what most callers actually
 * want. Null when there is no due date to compare against (see
 * creditReminderDueDate).
 */
export function daysUntilCreditDue(firstChargeOn: string | null, termsDays: number, today: Date = new Date()): number | null {
  const due = creditReminderDueDate(firstChargeOn, termsDays);
  return due ? daysUntilDue(due, today) : null;
}

/**
 * The schedule, exactly as asked for: 7, 2 and 1 day before the due date, on
 * the due date itself, and then every single day for as long as the account
 * stays overdue — no cap. That last part is deliberate and was asked for
 * explicitly; it is also the part worth knowing has an ongoing SMS cost for
 * every day a balance stays unpaid past its due date, with no upper bound on
 * how long that runs (see this feature's final report for the cost note).
 */
export function isCreditReminderDueToday(daysUntilDue: number | null): boolean {
  if (daysUntilDue == null) return false;
  return daysUntilDue === 7 || daysUntilDue === 2 || daysUntilDue === 1 || daysUntilDue <= 0;
}

// ─── Wording ─────────────────────────────────────────────────────────────────

const money = (n: number) => `Rs. ${Math.max(0, Math.round(n)).toLocaleString("en-LK")}`;

const firstNameOf = (full: string) => (full || "").trim().split(/\s+/)[0] || "there";

function niceDate(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

const SHOP = SHOP_DETAILS.name;
const SHOP_CONTACT = SHOP_DETAILS.phone.replace(/\D/g, "");

/**
 * The line that changes with the phase — everything else in the message is
 * fixed. Three phases: still ahead of the due date, due today, or overdue.
 */
function phaseLine(balance: string, dueDate: Date, days: number): string {
  if (days > 0) {
    const unit = days === 1 ? "day" : "days";
    return `your payment of ${balance} is due in ${days} ${unit} (on ${niceDate(dueDate)}).`;
  }
  if (days === 0) {
    return `your payment of ${balance} is due today (${niceDate(dueDate)}).`;
  }
  const overdueDays = -days;
  const unit = overdueDays === 1 ? "day" : "days";
  return `your payment of ${balance} was due on ${niceDate(dueDate)} and is now ${overdueDays} ${unit} overdue.`;
}

/**
 * Render the SMS body for one account, for a given `daysUntilDue` (see
 * daysUntilCreditDue). The caller is expected to have already checked
 * isCreditReminderDueToday — this renders whatever phase it's given, it
 * doesn't decide whether today is the day to send it.
 */
export function creditReminderMessage(account: { name: string; balance: number }, dueDate: Date, days: number): string {
  const body = `Hi ${firstNameOf(account.name)},
${phaseLine(money(account.balance), dueDate, days)}

Balance Due - ${money(account.balance)}

Please settle this at your earliest convenience. Thank you for choosing ${SHOP}.

For any other information contact ${SHOP_CONTACT}.`;
  return toGsmSafe(body).trim();
}

/**
 * The one-call version most callers want: works out the due date and phase
 * from the account itself and renders the message in one step. Returns null
 * when there is no due date to render against (see creditReminderDueDate) —
 * the caller should not be offering to send in that case anyway.
 */
export function renderCreditReminder(account: CreditReminderAccount, today: Date = new Date()): string | null {
  const dueDate = creditReminderDueDate(account.firstChargeOn, account.termsDays);
  if (!dueDate) return null;
  const days = daysUntilDue(dueDate, today);
  return creditReminderMessage(account, dueDate, days);
}

// ─── The other three moments a credit customer should hear from the shop ──────
//
// The reminder above is the only SMS this feature sent at first — it fires
// later, once a due date is approaching or past. Nothing told the customer
// anything at the moment their account was opened, a charge landed on it, or
// their payment was taken, even though those are the three events a person
// actually notices in the moment. These three cover that: same plain-ASCII
// discipline, same shop/contact line, sent once, right when each happens.

export const CREDIT_OPENED_PURPOSE = "credit-account-opened";
export const CREDIT_CHARGE_PURPOSE = "credit-charge-recorded";
export const CREDIT_PAYMENT_PURPOSE = "credit-payment-recorded";

/** Sent once, when a credit account is opened for someone. */
export function renderCreditAccountOpened(account: { name: string; creditLimit: number }): string {
  const limitLine = account.creditLimit > 0
    ? `Your credit limit is ${money(account.creditLimit)}.`
    : `No credit limit has been set on the account.`;
  const body = `Hi ${firstNameOf(account.name)},
a credit account has been opened for you at ${SHOP}. ${limitLine}

We will let you know whenever a charge or a payment is recorded against it. For any other information contact ${SHOP_CONTACT}.`;
  return toGsmSafe(body).trim();
}

/** Sent once, right after a charge is posted to an account (manually, from
 *  the Record Credit form). Does not cover charges a repair or POS sale posts
 *  automatically through the database — those don't go through this code
 *  path today. */
export function renderCreditChargeRecorded(account: { name: string }, amount: number, newBalance: number, note?: string): string {
  const noteLine = note?.trim() ? ` (${note.trim()})` : "";
  const body = `Hi ${firstNameOf(account.name)},
${money(amount)} has been added to your account at ${SHOP}${noteLine}.

New Balance - ${money(newBalance)}

Please settle this at your earliest convenience. For any other information contact ${SHOP_CONTACT}.`;
  return toGsmSafe(body).trim();
}

/** Sent once, right after a payment is recorded against an account. */
export function renderCreditPaymentRecorded(account: { name: string }, amount: number, newBalance: number): string {
  const settledLine = newBalance <= 0.005
    ? "Your account is now fully settled. Thank you!"
    : `Remaining Balance - ${money(newBalance)}`;
  const body = `Hi ${firstNameOf(account.name)},
we received your payment of ${money(amount)} at ${SHOP}.

${settledLine}

Thank you for choosing ${SHOP}. For any other information contact ${SHOP_CONTACT}.`;
  return toGsmSafe(body).trim();
}
