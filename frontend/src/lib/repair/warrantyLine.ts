import type { CompletionType } from "@/cashier/contexts/RepairContext";

/**
 * The warranty line as it prints on the invoice: "3 MONTHS WARRANTY [NORMAL]".
 *
 * The bracketed word is the outcome of the repair, and it used to be a fixed
 * "[NORMAL]" baked into a dropdown of seven strings — so a device sent back
 * unrepaired, or fixed free of charge, went out with an invoice that called it
 * a normal repair. The outcome is a fact the job already knows; the invoice
 * should read it, not have the cashier pick it again from a list where the
 * wrong answer was the default.
 *
 * Two halves, composed here and nowhere else:
 *   period   from the warranty record the technician issued, or "NO WARRANTY"
 *   outcome  from job.completionType
 */

export const WARRANTY_PERIODS = [
  "NO WARRANTY",
  "7 DAYS WARRANTY",
  "1 MONTH WARRANTY",
  "3 MONTHS WARRANTY",
  "6 MONTHS WARRANTY",
  "1 YEAR WARRANTY",
] as const;

export type WarrantyPeriod = (typeof WARRANTY_PERIODS)[number];

/** The bracketed outcome, from what actually happened to the repair. */
export function outcomeTag(type: CompletionType | undefined | null): string {
  switch (type) {
    case "Return":      return "RETURN";
    case "Cash Return": return "CASH RETURN";
    case "FOC":         return "FOC";
    default:            return "NORMAL";
  }
}

/** The period word for a warranty record's length, matching the printed vocabulary. */
export function periodFromDays(days: number | undefined | null): WarrantyPeriod {
  if (!days || days <= 0) return "NO WARRANTY";
  if (days <= 7)   return "7 DAYS WARRANTY";
  if (days <= 31)  return "1 MONTH WARRANTY";
  if (days <= 92)  return "3 MONTHS WARRANTY";
  if (days <= 183) return "6 MONTHS WARRANTY";
  return "1 YEAR WARRANTY";
}

/** "3 MONTHS WARRANTY [NORMAL]" — the two halves joined the one way they print. */
export function warrantyLine(period: string, type: CompletionType | undefined | null): string {
  return `${period} [${outcomeTag(type)}]`;
}

/**
 * The period half of a line that already carries a tag, so a line stored on
 * an older job can be re-tagged rather than kept with the wrong outcome.
 */
export function periodOf(line: string | undefined | null): WarrantyPeriod {
  const bare = (line ?? "").replace(/\s*\[.*\]\s*$/, "").trim().toUpperCase();
  return (WARRANTY_PERIODS as readonly string[]).includes(bare) ? (bare as WarrantyPeriod) : "NO WARRANTY";
}
