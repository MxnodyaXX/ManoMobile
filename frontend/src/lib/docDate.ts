/**
 * The date as every printed document shows it: 04/11/2026 (day/month/year).
 *
 * One format for all of them, and the same one the template designer previews
 * with (ReceiptCanvas's SAMPLE), so a {{date}} box sized in the designer fits
 * what actually prints. The documents used to pass four different shapes —
 * "11/04/2026, 05:13 PM", "04 Nov 2026, 17:13", US month-first — and the
 * longer ones wrapped onto two lines inside a box drawn for the short one.
 */
export function docDate(value?: string | Date | null): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return typeof value === "string" ? value : "—";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
}
