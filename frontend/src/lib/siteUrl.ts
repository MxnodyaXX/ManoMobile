/**
 * The public address of this app, for links that leave the building — the QR
 * on a job receipt, the dealer portal link on an invoice, a tracking link in
 * an SMS.
 *
 * NEXT_PUBLIC_SITE_URL (e.g. https://manomobile.vercel.app) wins. Without it
 * the link would be built from whatever address the printing browser was
 * opened at, so a till running on http://localhost:3000 printed QR codes that
 * pointed at localhost — which no customer's or dealer's phone can reach.
 *
 * The browser's own origin is only the fallback, for a deployment that has
 * not set the variable yet.
 */
export function publicOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  return typeof window === "undefined" ? "" : window.location.origin;
}
