export function getDateLabel(filter: string): string {
  const now = new Date();

  const fmt = (d: Date) =>
    d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

  const fmtShort = (d: Date) =>
    d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });

  switch (filter) {
    case "Daily": {
      return fmt(now); // e.g. "23 Apr 2025"
    }
    case "Weekly": {
      const start = new Date(now);
      start.setDate(now.getDate() - 6);
      return `${fmtShort(start)} – ${fmtShort(now)}`; // e.g. "17 Apr – 23 Apr"
    }
    case "Monthly": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return `${fmtShort(start)} – ${fmtShort(now)}`; // e.g. "01 Apr – 23 Apr"
    }
    case "Yearly": {
      const start = new Date(now.getFullYear(), 0, 1);
      return `${fmtShort(start)} – ${fmtShort(now)}`; // e.g. "01 Jan – 23 Apr"
    }
    case "All":
    default:
      return "All Time";
  }
}