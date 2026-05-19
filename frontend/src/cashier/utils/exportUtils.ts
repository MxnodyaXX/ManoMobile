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
