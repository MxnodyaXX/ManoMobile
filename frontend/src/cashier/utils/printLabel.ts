/**
 * Prints a single DOM node at an exact physical size (millimetres), for
 * thermal label printers where the "paper" is a fixed-size label rather
 * than A4/A5. Same clone-into-`@page`-styled-node trick used for the
 * repair job intake slip (see JobsTable.tsx's IntakeSlipModal), just
 * parameterised on label dimensions instead of a page format.
 */
export function printLabelNode(node: HTMLElement, widthMm: number, heightMm: number) {
  const el = document.createElement("div");
  el.id = "__label__";
  el.innerHTML = node.outerHTML;
  document.body.appendChild(el);

  const st = document.createElement("style");
  st.id = "__label_style__";
  st.textContent = `
    @page { size: ${widthMm}mm ${heightMm}mm; margin: 0; }
    #__label__ { display: none; }
    @media print {
      body { visibility: hidden; }
      #__label__ {
        display: flex !important; visibility: visible; position: fixed; top: 0; left: 0;
        width: ${widthMm}mm; height: ${heightMm}mm;
      }
      #__label__ * { visibility: visible; }
    }
  `;
  document.head.appendChild(st);
  window.print();
  setTimeout(() => {
    document.getElementById("__label__")?.remove();
    document.getElementById("__label_style__")?.remove();
  }, 500);
}

/**
 * Prints several labels — all the same physical size — as one print job
 * instead of one dialog per label. Each label becomes its own page at the
 * exact label size (`@page` doesn't vary per page, but every label here is
 * the same size anyway), with a page break forced between them so the
 * printer advances to the next label the same way it would between two
 * separate single-label print jobs — there is no gap to add by hand; the
 * label stock's own die-cut gap is what "next page" already means on a
 * label printer.
 *
 * `htmls` are captured outerHTML strings (see BarcodeLabelModal's `onReady`),
 * not live nodes — a node captured off-screen from a modal that then
 * unmounts would already be gone by the time this ran.
 *
 * Deliberately NOT the same `position: fixed` + `visibility: hidden` trick
 * printLabelNode above uses. That works for one label because there is
 * nothing to paginate — the label is just pinned to the corner of the one
 * page. `break-after: page` is a normal-document-flow pagination
 * instruction; an element taken out of flow with `position: fixed` (or
 * nested inside one) is invisible to it, so every label rendered on one
 * page regardless of how many `break-after` rules were on them. Hiding
 * every other top-level element with `display: none` instead — which drops
 * them from layout entirely rather than merely hiding them — lets the
 * labels render as the only (in-flow) content on the page, where
 * pagination actually applies.
 */
export function printLabelsNode(htmls: string[], widthMm: number, heightMm: number) {
  if (htmls.length === 0) return;

  const container = document.createElement("div");
  container.id = "__labels__";
  container.innerHTML = htmls
    .map(h => `<div class="__one_label__">${h}</div>`)
    .join("");
  document.body.appendChild(container);

  const st = document.createElement("style");
  st.id = "__labels_style__";
  st.textContent = `
    @page { size: ${widthMm}mm ${heightMm}mm; margin: 0; }
    #__labels__ { display: none; }
    @media print {
      body > *:not(#__labels__) { display: none !important; }
      body { margin: 0; padding: 0; }
      #__labels__ { display: block !important; margin: 0; padding: 0; }
      .__one_label__ {
        width: ${widthMm}mm; height: ${heightMm}mm;
        overflow: hidden;
        break-after: page; page-break-after: always;
      }
      .__one_label__:last-child { break-after: auto; page-break-after: auto; }
    }
  `;
  document.head.appendChild(st);
  window.print();
  setTimeout(() => {
    document.getElementById("__labels__")?.remove();
    document.getElementById("__labels_style__")?.remove();
  }, 500);
}
