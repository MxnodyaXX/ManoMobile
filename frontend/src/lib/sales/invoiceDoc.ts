"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

/**
 * The invoice as it was actually printed.
 *
 * Every sale screen prints by copying a rendered element's outerHTML into a
 * print container. This captures that same HTML and stores it, so Invoice
 * History can show the document the customer was given rather than a summary
 * rebuilt from figures that may since have moved.
 *
 * Storing markup rather than re-rendering is the whole point. An invoice is a
 * record of a moment; prices are revised, jobs are edited, dealers renamed and
 * templates redesigned, and every one of those would silently change a
 * "reprint" that was actually a re-render.
 */

export interface InvoiceDocument {
  invoiceNo: string;
  html: string;
  pageCss: string | null;
  createdAt: string;
}

export async function fetchInvoiceDocument(invoiceNo: string): Promise<InvoiceDocument | null> {
  if (!isSupabaseConfigured()) return null;
  const { data, error } = await getSupabaseBrowserClient()
    .from("invoice_documents")
    .select("invoice_no, html, page_css, created_at")
    .eq("invoice_no", invoiceNo)
    .maybeSingle();

  if (error || !data) return null;
  const r = data as Record<string, unknown>;
  return {
    invoiceNo: r.invoice_no as string,
    html: r.html as string,
    pageCss: (r.page_css as string | null) ?? null,
    createdAt: r.created_at as string,
  };
}

/**
 * Store the document. Never throws.
 *
 * The sale is complete and the paper is in the customer's hand by the time this
 * runs; failing loudly here would interrupt a counter over bookkeeping that can
 * be caught up. A missing document degrades Invoice History to the summary it
 * showed before, which is a smaller loss than a blocked till.
 */
export async function saveInvoiceDocument(invoiceNo: string, html: string, pageCss?: string): Promise<void> {
  if (!isSupabaseConfigured() || !invoiceNo || !html) return;
  try {
    const sb = getSupabaseBrowserClient();
    const { data: { user } } = await sb.auth.getUser();
    const { error } = await sb.from("invoice_documents").insert({
      invoice_no: invoiceNo,
      html,
      page_css: pageCss ?? null,
      created_by: user?.id ?? null,
    });
    // Not thrown — see above — but not silent either. A history with a gap in
    // it and no trace of why is what made this take a day to find. A duplicate
    // (23505) is the one expected refusal: the document was already stored.
    if (error && error.code !== "23505") console.warn(`Invoice ${invoiceNo} was not stored for history:`, error.message);
  } catch (e) {
    console.warn(`Invoice ${invoiceNo} was not stored for history:`, e);
  }
}

/**
 * Capture a printable once it has rendered, and store it.
 *
 * Fires on the first frame the element exists with a non-empty invoice number,
 * and never again for that number — the document is written once, and the
 * table has no update policy precisely so a second write cannot rewrite
 * history. A duplicate insert is rejected by the primary key and swallowed.
 */
export function usePersistInvoiceDocument(
  invoiceNo: string | null | undefined,
  ref: RefObject<HTMLElement | null>,
  pageCss?: string,
  /** Called once the write has settled — for a caller that mounted the
   *  invoice only to have it stored, and can let go of it afterwards. */
  onSettled?: (invoiceNo: string) => void,
) {
  const saved = useRef<string | null>(null);
  // The callback is read inside the effect, where a ref may be written; the
  // effect below re-runs every render, so the latest one is always in place.
  const settle = useRef(onSettled);

  /**
   * After every render, not only when the number changes.
   *
   * This ran on [invoiceNo, ref, pageCss], and the Repair Sales screen sets
   * the number one render before it shows the invoice — the panel is gated on
   * a view switch that happens after the sale commits. So the effect ran once,
   * found no element, returned, and had no reason ever to run again. Every
   * repair invoice issued from that screen was lost to history while the
   * Issue Job dialog, which renders both in the same pass, kept its.
   *
   * Running each render costs one ref read and one string compare once saved.
   * The element may also say it is not ready yet — the printable renders a
   * plain layout while its designed template loads, and capturing that would
   * store the wrong invoice for good, since the table has no update policy.
   */
  useEffect(() => {
    settle.current = onSettled;
    if (!invoiceNo || saved.current === invoiceNo) return;
    const el = ref.current;
    if (!el || el.dataset.templatePending) return;

    saved.current = invoiceNo;
    // outerHTML, matching exactly what every print handler in this app copies —
    // so what is stored is what comes out of the printer, not a near-miss.
    // Settled either way: a refusal is logged inside saveInvoiceDocument, and
    // holding a hidden invoice mounted forever would not change the outcome.
    void saveInvoiceDocument(invoiceNo, el.outerHTML, pageCss)
      .catch(() => {})
      .then(() => settle.current?.(invoiceNo));
  });
}

/**
 * The stored document for one invoice.
 *
 * State is stamped with the invoice it belongs to and "loading" is derived from
 * whether that stamp matches what was asked for. Setting state in the effect
 * body instead would cost an extra render on every open and, worse, would show
 * the previous invoice's document for a frame under the new invoice's number.
 */
export function useInvoiceDocument(invoiceNo: string | null) {
  const [loaded, setLoaded] = useState<{ forNo: string | null; doc: InvoiceDocument | null }>(
    { forNo: null, doc: null },
  );

  useEffect(() => {
    if (!invoiceNo) return;
    let active = true;
    fetchInvoiceDocument(invoiceNo)
      .then(d => { if (active) setLoaded({ forNo: invoiceNo, doc: d }); })
      .catch(() => { if (active) setLoaded({ forNo: invoiceNo, doc: null }); });
    return () => { active = false; };
  }, [invoiceNo]);

  const ready = loaded.forNo === invoiceNo;
  return { doc: ready ? loaded.doc : null, loading: !!invoiceNo && !ready };
}

/**
 * Print a stored document.
 *
 * Same mechanism the sale screens use — the markup goes into a hidden container
 * on this page and everything else is hidden for the print — because it is the
 * same markup they produced. An iframe would be cleaner in principle but cannot
 * carry the app's own stylesheet, and these invoices are laid out with inline
 * styles plus that sheet.
 */
export function printInvoiceDocument(doc: InvoiceDocument) {
  const holderId = "__stored_invoice__";
  const styleId = "__stored_invoice_style__";
  document.getElementById(holderId)?.remove();
  document.getElementById(styleId)?.remove();

  const holder = document.createElement("div");
  holder.id = holderId;
  holder.innerHTML = doc.html;
  document.body.appendChild(holder);

  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = `
    ${doc.pageCss ?? "@page { size: A4; margin: 12mm; }"}
    #${holderId} { display: none; }
    @media print {
      body { visibility: hidden; }
      #${holderId} { display: block !important; visibility: visible; position: fixed; top: 0; left: 0; width: 100%; }
      #${holderId} * { visibility: visible; }
    }
  `;
  document.head.appendChild(style);

  window.print();
  setTimeout(() => {
    document.getElementById(holderId)?.remove();
    document.getElementById(styleId)?.remove();
  }, 500);
}
