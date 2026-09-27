"use client";

import { forwardRef, useLayoutEffect, useRef, useState } from "react";
import ReceiptRender from "@/cashier/components/shared/ReceiptRender";
import { InvoiceTableBody } from "@/cashier/components/shared/ReceiptRender";
import type { ReceiptElement, ReceiptData, ReceiptInvoiceTableElement } from "@/lib/repair/receiptElements";

/**
 * Turns one canvas design into as many physical pages as a dealer invoice's
 * job list actually needs.
 *
 * A receipt or an issue invoice is always exactly one page — ReceiptRender on
 * its own is all either of those ever needed. A dealer invoice can carry
 * twenty jobs, and repeatScope (see receiptElements.ts) says which elements
 * belong on every page, only the first, or only the last. This is the piece
 * that reads those tags, works out how many rows fit where, and slices the
 * job list into per-page chunks — ReceiptRender still just draws one page at
 * a time, exactly as it always has.
 *
 * How much room a row needs used to be a number typed into the editor
 * (rowHeight, mm). That number had no connection to the actual table: two
 * different templates, fonts, or column widths need two different answers,
 * a cell that wraps to two lines needs more than one that doesn't, and
 * nothing ever checked the guess against reality. Getting it wrong didn't
 * look wrong — it looked like jobs quietly missing off the bottom of a page,
 * because the box clips at its real height regardless of what the page-split
 * math believed would fit. So this measures instead of guessing: it renders
 * the header and every row off-screen, in the exact same markup that prints,
 * and reads back how tall they actually came out before deciding where the
 * pages break.
 *
 * The other half is how much room the table GETS. Its designed box (x/y/w/h
 * on the canvas) is drawn for the common case — a page with only the
 * repeating page-scoped elements around it. The first page additionally
 * carries the firstOnly block, so its top is pushed down by however far that
 * block reaches into the table's designed position, and the same happens in
 * reverse at the bottom for the lastOnly block on the last page. Every page
 * that ISN'T first or last has the opposite problem: the space the firstOnly
 * or lastOnly block would have used is simply empty, because the table's box
 * still stops where it was drawn — so those pages also stretch the table to
 * meet whatever page-scoped element sits above (a header band) or below (a
 * footer band) it, reclaiming that space instead of leaving it blank.
 */

export interface ReceiptPagedRenderProps {
  elements: ReceiptElement[];
  /** Fields shared by the whole invoice — dealer name, invoice number, date,
   *  totals. Every element except the invoiceTable's own rows reads from this. */
  headerData: ReceiptData;
  /** One entry per job. Empty prints a single page with an empty table. */
  rows: ReceiptData[];
  widthMm: number;
  heightMm: number;
}

const PX_PER_MM = 96 / 25.4;

function isInvoiceTable(el: ReceiptElement): el is ReceiptInvoiceTableElement {
  return el.type === "invoiceTable";
}

const maxBottom = (list: ReceiptElement[]) => list.reduce((m, el) => Math.max(m, el.y + el.h), 0);
const minTop = (list: ReceiptElement[]) => (list.length === 0 ? Infinity : Math.min(...list.map(el => el.y)));

/**
 * Packs rows into pages by their actual measured height against the real
 * budget for each page kind, then shrinks whichever page ends up last to fit
 * the smaller budget a last page gets — spilling the overflow onto one more
 * page, exactly like a row that landed short would.
 */
function packRows(
  rowsMm: number[],
  budgets: { firstFull: number; firstLast: number; otherFull: number; otherLast: number },
): number[][] {
  if (rowsMm.length === 0) return [[]];
  const pages: number[][] = [];
  let i = 0;
  while (i < rowsMm.length) {
    const budget = Math.max(rowsMm[i], pages.length === 0 ? budgets.firstFull : budgets.otherFull);
    const page: number[] = [i];
    let used = rowsMm[i];
    i++;
    while (i < rowsMm.length && used + rowsMm[i] <= budget) {
      page.push(i);
      used += rowsMm[i];
      i++;
    }
    pages.push(page);
  }
  for (;;) {
    const last = pages[pages.length - 1];
    const lastBudget = Math.max(rowsMm[last[0]], pages.length === 1 ? budgets.firstLast : budgets.otherLast);
    const used = last.reduce((s, idx) => s + rowsMm[idx], 0);
    if (used <= lastBudget || last.length <= 1) break;
    pages.push([last.pop() as number]);
  }
  return pages;
}

/** Measures the invoiceTable's header and every row off-screen, in the exact
 *  markup that will print, so pagination is driven by reality rather than a
 *  guess. Null until the first measuring pass has committed. */
function useMeasuredInvoiceTable(tableEl: ReceiptInvoiceTableElement | undefined, rows: ReceiptData[]) {
  const [measured, setMeasured] = useState<{ headerMm: number; rowMm: number[] } | null>(null);
  const headerNode = useRef<HTMLTableRowElement | null>(null);
  const rowNodes = useRef<(HTMLTableRowElement | null)[]>([]);

  useLayoutEffect(() => {
    if (!tableEl) { setMeasured(null); return; }
    const headerMm = (headerNode.current?.getBoundingClientRect().height ?? 0) / PX_PER_MM;
    const rowMm = rowNodes.current.map(node => (node?.getBoundingClientRect().height ?? 0) / PX_PER_MM);
    setMeasured({ headerMm, rowMm });
    // Re-measure whenever the row count, the table's width/font, or the
    // column layout changes — content wrapping depends on all of them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableEl?.w, tableEl?.fontSize, tableEl?.columns, rows.length]);

  const probe = tableEl ? (
    <div style={{ position: "fixed", top: 0, left: "-9999px", width: `${tableEl.w}mm`, visibility: "hidden", pointerEvents: "none" }} aria-hidden>
      <InvoiceTableBody
        el={tableEl}
        rows={rows}
        headerRef={node => { headerNode.current = node; }}
        rowRef={i => node => { rowNodes.current[i] = node; }}
      />
    </div>
  ) : null;

  return { measured, probe };
}

const ReceiptPagedRender = forwardRef<HTMLDivElement, ReceiptPagedRenderProps>(function ReceiptPagedRender(
  { elements, headerData, rows, widthMm, heightMm }, ref,
) {
  const tableEl = elements.find(isInvoiceTable);
  const { measured, probe } = useMeasuredInvoiceTable(tableEl, rows);

  // Nothing to paginate on — draw the one page a receipt/issue template (or
  // a dealer template with no table placed yet) always was.
  if (!tableEl) {
    return (
      <div ref={ref}>
        <ReceiptRender elements={elements} data={headerData} widthMm={widthMm} heightMm={heightMm} />
      </div>
    );
  }

  // Still waiting on the first measuring pass — render nothing rather than a
  // page built from a stale guess, which is exactly the failure mode this
  // whole file exists to remove.
  if (!measured) {
    return <div ref={ref}>{probe}</div>;
  }

  const others = elements.filter(el => el !== tableEl);
  const pageScope = others.filter(el => (el.repeatScope ?? "page") === "page");
  const firstOnly = others.filter(el => el.repeatScope === "firstOnly");
  const lastOnly = others.filter(el => el.repeatScope === "lastOnly");

  // How far the firstOnly block reaches down into the table's designed top,
  // and how far the lastOnly block reaches up into its designed bottom.
  const firstOnlyExtra = Math.max(0, maxBottom(firstOnly) - tableEl.y);
  const lastOnlyExtraRaw = (tableEl.y + tableEl.h) - minTop(lastOnly);
  const lastOnlyExtra = Number.isFinite(lastOnlyExtraRaw) ? Math.max(0, lastOnlyExtraRaw) : 0;

  // How far the table could stretch on a page that has neither block: up to
  // whatever page-scoped element sits cleanly above or below its designed
  // box (a header or footer band), or back to the designed edge if nothing's
  // there to stretch toward. A small gap is left against that neighbour —
  // without it the table lands flush against the band above or below it,
  // which reads as a layout mistake even though every row is accounted for.
  const GAP_MM = 3;
  const above = pageScope.filter(el => el.y + el.h <= tableEl.y);
  const below = pageScope.filter(el => el.y >= tableEl.y + tableEl.h);
  const topFloor = above.length > 0 ? Math.max(...above.map(el => el.y + el.h)) + GAP_MM : tableEl.y;
  const bottomCeil = below.length > 0 ? Math.min(...below.map(el => el.y)) - GAP_MM : tableEl.y + tableEl.h;

  const topFirst = tableEl.y + firstOnlyExtra;
  const topOther = Math.min(tableEl.y, topFloor);
  const bottomLast = (tableEl.y + tableEl.h) - lastOnlyExtra;
  const bottomOther = Math.max(tableEl.y + tableEl.h, bottomCeil);

  const roomFor = (top: number, bottom: number) => Math.max(0, (bottom - top) - measured.headerMm);
  const budgets = {
    firstFull: roomFor(topFirst, bottomOther),
    firstLast: roomFor(topFirst, bottomLast),
    otherFull: roomFor(topOther, bottomOther),
    otherLast: roomFor(topOther, bottomLast),
  };

  const pages = packRows(measured.rowMm, budgets);

  return (
    <div ref={ref}>
      {probe}
      {pages.map((rowIndices, i) => {
        const isFirst = i === 0;
        const isLast = i === pages.length - 1;
        const top = isFirst ? topFirst : topOther;
        const bottom = isLast ? bottomLast : bottomOther;
        const h = Math.max(measured.headerMm + 1, bottom - top);

        const pageElements: ReceiptElement[] = [
          ...pageScope,
          ...(isFirst ? firstOnly : []),
          ...(isLast ? lastOnly : []),
          { ...tableEl, y: top, h },
        ];
        const pageRows = rowIndices.map(idx => rows[idx]);
        // packRows hands out original, contiguous indices into `rows`, so the
        // first one on this page is exactly how many rows came before it.
        const tableRowStart = rowIndices[0] ?? 0;

        return (
          <div key={i} style={{ pageBreakAfter: isLast ? "auto" : "always" }}>
            <ReceiptRender
              elements={pageElements}
              data={headerData}
              tableRows={pageRows}
              tableRowStart={tableRowStart}
              widthMm={widthMm}
              heightMm={heightMm}
            />
          </div>
        );
      })}
    </div>
  );
});

export default ReceiptPagedRender;
