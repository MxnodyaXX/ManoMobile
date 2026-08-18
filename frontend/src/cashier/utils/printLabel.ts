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
