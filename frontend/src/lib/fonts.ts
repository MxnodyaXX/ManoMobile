/**
 * Fonts offered in the label/receipt canvas's text properties panel.
 *
 * "Plus Jakarta Sans", "JetBrains Mono" and "Montserrat" are loaded app-wide
 * already (see globals.css's Google Fonts @import), so they render correctly
 * both in the editor and when the same page prints. Everything else here is a
 * standard Windows-installed font — no network font load needed, which
 * matters for printing: a label printer rendering headlessly, or a shop with
 * no internet that day, still gets the exact font it designed with.
 */
export const FONT_OPTIONS: { value: string; label: string }[] = [
  { value: "'Plus Jakarta Sans', Arial, sans-serif", label: "Plus Jakarta Sans" },
  { value: "'Montserrat', Arial, sans-serif",         label: "Montserrat" },
  { value: "Arial, Helvetica, sans-serif",           label: "Arial" },
  { value: "Verdana, Geneva, sans-serif",             label: "Verdana" },
  { value: "Tahoma, Geneva, sans-serif",              label: "Tahoma" },
  { value: "'Trebuchet MS', sans-serif",              label: "Trebuchet MS" },
  { value: "Georgia, 'Times New Roman', serif",       label: "Georgia" },
  { value: "'Times New Roman', Times, serif",         label: "Times New Roman" },
  { value: "'Courier New', Courier, monospace",       label: "Courier New" },
  { value: "'JetBrains Mono', monospace",             label: "JetBrains Mono" },
];

export const DEFAULT_FONT_FAMILY = FONT_OPTIONS[0].value;
