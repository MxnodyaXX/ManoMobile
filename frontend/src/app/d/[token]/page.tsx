import { redirect } from "next/navigation";

/**
 * The short form of the dealer portal link, as printed in the QR on a dealer
 * invoice: /d/<portal_token>?i=<invoice no>.
 *
 * It exists only to make the QR scannable. The full /dealer?t=…&invoice=… link
 * is ~90 characters, which needs a 37×37 grid; in a 16mm box on an A5 invoice
 * its squares were too fine for a phone camera. This form is ~77 characters and
 * fits a 33×33 grid, so every square prints larger. It just forwards to the
 * real page, which does all the checking.
 */
export default async function DealerShortLink({
  params, searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ i?: string | string[] }>;
}) {
  const { token } = await params;
  const { i } = await searchParams;
  const q = new URLSearchParams({ t: token });
  const invoice = Array.isArray(i) ? i[0] : i;
  if (invoice) q.set("invoice", invoice);
  redirect(`/dealer?${q.toString()}`);
}
