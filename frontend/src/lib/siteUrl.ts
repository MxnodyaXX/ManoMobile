/**
 * The public address of this app, for links that leave the building — the QR
 * on a job receipt, the dealer portal link on an invoice, a tracking link in
 * an SMS.
 *
 * In a browser opened at a public address (the live site), that address is
 * used: it is, by definition, one that works. NEXT_PUBLIC_SITE_URL is only
 * used where the browser's address can't be reached from outside — a till on
 * http://localhost:3000 or a LAN IP — and on the server. (It used to win
 * everywhere, so a typo in it — manomobile.vercel.app instead of
 * mano-mobile.vercel.app — put a dead link in every printed QR.)
 */
export function publicOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "") ?? "";
  if (typeof window === "undefined") return configured;
  const here = window.location;
  return isPrivateHost(here.hostname) ? configured || here.origin : here.origin;
}

/** localhost, *.local, and private-network IPs — addresses no customer's phone can open */
function isPrivateHost(host: string): boolean {
  return host === "localhost"
    || host.endsWith(".local")
    || host === "[::1]"
    || /^127\./.test(host)
    || /^10\./.test(host)
    || /^192\.168\./.test(host)
    || /^172\.(1[6-9]|2\d|3[01])\./.test(host);
}
