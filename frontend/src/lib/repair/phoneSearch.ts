/**
 * Does a search box's text match a customer's phone number?
 *
 * Compared as digits only, so "077 123 4567", "0771234567" and
 * "+94 77 123 4567" all find the same job. Four digits or more counts as a
 * phone search — fewer would match half the shop. Once nine or more are typed
 * it also matches from the end, so a leading 0 or +94 never gets in the way.
 *
 * One rule for every job search, so a number that finds a job on one screen
 * finds it on all of them.
 */
export function phoneMatches(query: string, phone: string | null | undefined): boolean {
  const q = query.replace(/\D/g, "");
  if (q.length < 4) return false;
  const p = (phone ?? "").replace(/\D/g, "");
  if (!p) return false;
  return p.includes(q) || (q.length >= 9 && p.endsWith(q.slice(-9)));
}
