// Export utilities — all functions are async and use dynamic imports to avoid SSR issues.

export interface ExportSection {
  title: string;
  headers: string[];
  rows: (string | number)[][];
}

// Multi-section PDF — each section gets its own titled table, stacked vertically.
export async function exportMultiSectionToPdf(
  docTitle: string,
  sections: ExportSection[],
  filename: string,
  orientation: "landscape" | "portrait" = "portrait"
) {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const doc = new jsPDF({ orientation, unit: "mm" });
  const today = new Date().toLocaleString("en-GB");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(docTitle, 14, 16);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(130, 130, 145);
  doc.text(`Mano Mobile  |  ${today}`, 14, 23);
  doc.setTextColor(0, 0, 0);

  let currentY = 30;

  for (const section of sections) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(80, 70, 200);
    doc.text(section.title, 14, currentY);
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");
    currentY += 3;

    autoTable(doc, {
      head: [section.headers],
      body: section.rows.map(r => r.map(c => String(c))),
      startY: currentY,
      styles: { font: "helvetica", fontSize: 9, cellPadding: 3.5 },
      headStyles: { fillColor: [99, 91, 255], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [247, 247, 250] },
      margin: { left: 14, right: 14 },
    });

    currentY = (doc as any).lastAutoTable.finalY + 10;
  }

  doc.save(`${filename}.pdf`);
}

// Multi-section Excel — each section becomes a separate sheet.
export async function exportMultiSectionToExcel(
  filename: string,
  sections: ExportSection[]
) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();

  for (const section of sections) {
    const ws = XLSX.utils.aoa_to_sheet([section.headers, ...section.rows]);
    ws["!cols"] = section.headers.map((h, i) => ({
      wch: Math.max(h.length, ...section.rows.map(r => String(r[i] ?? "").length)) + 2,
    }));
    // Excel sheet names are max 31 chars
    XLSX.utils.book_append_sheet(wb, ws, section.title.slice(0, 31));
  }

  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export async function exportToPdf(
  title: string,
  headers: string[],
  rows: (string | number)[][],
  filename: string,
  orientation: "landscape" | "portrait" = "landscape"
) {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const doc = new jsPDF({ orientation, unit: "mm" });
  const today = new Date().toLocaleString("en-GB");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(title, 14, 16);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(130, 130, 145);
  doc.text(`Mano Mobile  |  ${today}`, 14, 23);
  doc.setTextColor(0, 0, 0);

  autoTable(doc, {
    head: [headers],
    body: rows.map(r => r.map(c => String(c))),
    startY: 28,
    styles: { font: "helvetica", fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: [99, 91, 255], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [247, 247, 250] },
    margin: { left: 14, right: 14 },
  });

  doc.save(`${filename}.pdf`);
}

export async function exportToExcel(
  filename: string,
  sheetName: string,
  headers: string[],
  rows: (string | number)[][]
) {
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws["!cols"] = headers.map((h, i) => ({
    wch: Math.max(h.length, ...rows.map(r => String(r[i] ?? "").length)) + 2,
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

// Structured report PDF — renders table sections via jspdf-autotable, then captures each
// chart element individually with html2canvas and embeds them as images after the tables.
// Charts are discovered via data-pdf-chart attributes set on chart card divs.
export async function exportReportToPdf(
  docTitle: string,
  sections: ExportSection[],
  charts: { title: string; element: HTMLElement }[],
  filename: string,
  orientation: "landscape" | "portrait" = "portrait"
) {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const { default: html2canvas } = await import("html2canvas");

  const doc = new jsPDF({ orientation, unit: "mm" });
  const today = new Date().toLocaleString("en-GB");
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentW = pageW - margin * 2;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(docTitle, margin, 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(130, 130, 145);
  doc.text(`Mano Mobile  |  ${today}`, margin, 23);
  doc.setTextColor(0, 0, 0);

  let currentY = 30;

  for (const section of sections) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(80, 70, 200);
    doc.text(section.title, margin, currentY);
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");
    currentY += 3;

    autoTable(doc, {
      head: [section.headers],
      body: section.rows.map(r => r.map(c => String(c))),
      startY: currentY,
      styles: { font: "helvetica", fontSize: 9, cellPadding: 3.5 },
      headStyles: { fillColor: [99, 91, 255], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [247, 247, 250] },
      margin: { left: margin, right: margin },
    });

    currentY = (doc as any).lastAutoTable.finalY + 12;
    if (currentY > pageH - 40) { doc.addPage(); currentY = margin; }
  }

  if (charts.length > 0) {
    doc.addPage();
    currentY = margin;

    const bg = getComputedStyle(document.documentElement)
      .getPropertyValue("--bg-primary").trim() || "#0d1117";

    for (const chart of charts) {
      const canvas = await html2canvas(chart.element, {
        scale: 2,
        backgroundColor: bg || "#0d1117",
        useCORS: true,
        logging: false,
      });

      const imgH = (canvas.height / canvas.width) * contentW;
      const labelH = 7;

      if (currentY + labelH + imgH > pageH - margin) {
        doc.addPage();
        currentY = margin;
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(80, 70, 200);
      doc.text(chart.title, margin, currentY);
      doc.setTextColor(0, 0, 0);
      currentY += labelH;

      doc.addImage(canvas.toDataURL("image/png"), "PNG", margin, currentY, contentW, imgH);
      currentY += imgH + 14;
    }
  }

  doc.save(`${filename}.pdf`);
}

// Full-container PDF — captures the entire DOM element (charts + tables) using html2canvas,
// splits across multiple pages if taller than one page, and prepends a title header.
export async function exportContainerToPdf(
  docTitle: string,
  element: HTMLElement,
  filename: string,
  orientation: "landscape" | "portrait" = "portrait"
) {
  const { default: jsPDF } = await import("jspdf");
  const { default: html2canvas } = await import("html2canvas");

  const bg =
    getComputedStyle(document.documentElement).getPropertyValue("--bg-primary").trim() ||
    "#0d1117";

  const canvas = await html2canvas(element, {
    scale: 2,
    backgroundColor: bg || "#0d1117",
    useCORS: true,
    logging: false,
  });

  const doc = new jsPDF({ orientation, unit: "mm" });
  const today = new Date().toLocaleString("en-GB");
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 10;
  const headerH = 30;
  const contentW = pageW - margin * 2;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(docTitle, margin, 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(130, 130, 145);
  doc.text(`Mano Mobile  |  ${today}`, margin, 23);
  doc.setTextColor(0, 0, 0);

  const imgData = canvas.toDataURL("image/png");
  const imgH = (canvas.height / canvas.width) * contentW;

  // Place image starting below the header; jsPDF clips overflow to page bounds.
  doc.addImage(imgData, "PNG", margin, headerH, contentW, imgH);

  let heightLeft = imgH - (pageH - headerH);
  while (heightLeft > 0) {
    doc.addPage();
    const yPos = -(imgH - heightLeft);
    doc.addImage(imgData, "PNG", margin, yPos, contentW, imgH);
    heightLeft -= pageH;
  }

  doc.save(`${filename}.pdf`);
}

export async function exportToPng(element: HTMLElement, filename: string) {
  const { default: html2canvas } = await import("html2canvas");
  const bg =
    getComputedStyle(document.documentElement).getPropertyValue("--bg-primary").trim() ||
    "#0d1117";
  const canvas = await html2canvas(element, {
    scale: 2,
    backgroundColor: bg || "#0d1117",
    useCORS: true,
    logging: false,
  });
  const link = document.createElement("a");
  link.download = `${filename}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}
