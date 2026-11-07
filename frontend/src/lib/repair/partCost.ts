/**
 * What one unit of an issued part cost that job.
 *
 * The price written on the request when it was issued, so buying the same part
 * at a new price later never changes an old job. The catalogue's price is only
 * for a request with none yet: one not issued, or a database before migration
 * 20261107000095.
 */
export function requestUnitCost(
  request: { partSku: string; unitCost?: number },
  catalog: { sku: string; costPrice: number }[],
): number {
  return request.unitCost ?? catalog.find(p => p.sku === request.partSku)?.costPrice ?? 0;
}

/**
 * The cost of a part named only by typed text on an older job: its price when
 * batches began, for the same reason.
 */
export const typedPartCost = (part: { costPrice: number; legacyCost?: number }) =>
  part.legacyCost ?? part.costPrice;
