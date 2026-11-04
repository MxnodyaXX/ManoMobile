/**
 * Read every row of a query, past the database's per-request cap.
 *
 * Supabase (PostgREST) returns at most 1,000 rows per request — and asking for
 * more with .limit(5000) is silently capped too. Every "load all jobs / all
 * sales" read stopped at 1,000 the day the shop passed RM-1000, which is how
 * Analytics came to show exactly 1,000 jobs.
 *
 * Pass a function that builds the query for one page using .range(from, to);
 * it is called page after page until a short page says there are no more.
 * The query MUST have a stable order ending in a unique column (usually id),
 * or rows can repeat or go missing between pages.
 *
 *   const rows = await fetchAllRows((from, to) =>
 *     sb.from("repair_jobs").select("*").order("created_at").order("id").range(from, to));
 *
 * `limit` caps the total (e.g. "the latest 5,000"); omit it for everything.
 */
const PAGE = 1000;

export async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string; code?: string } | null }>,
  { limit = Infinity }: { limit?: number } = {},
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; from < limit; from += PAGE) {
    const to = Math.min(from + PAGE, limit) - 1;
    const { data, error } = await page(from, to);
    if (error) throw Object.assign(new Error(error.message), { code: error.code });
    const got = data ?? [];
    rows.push(...got);
    if (got.length < to - from + 1) break; // short page: that was the last
  }
  return rows;
}
