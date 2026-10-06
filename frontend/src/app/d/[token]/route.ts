import { NextResponse, type NextRequest } from "next/server";

/**
 * The short form of the dealer portal link, as printed in the QR on a dealer
 * invoice: /d/<portal_token>?i=<invoice no>.
 *
 * It exists only to make the QR scannable. The full /dealer?t=…&invoice=… link
 * is ~90 characters, which needs a 37×37 grid; in a 16mm box on an A5 invoice
 * its squares were too fine for a phone camera. This form is ~77 characters and
 * fits a 33×33 grid, so every square prints larger. It just forwards to the
 * real page, which does all the checking.
 *
 * A route handler (not a page) so the forward is an instant HTTP redirect: as a
 * page it streamed a "404" shell first and only moved on once JavaScript had
 * loaded — about 6 seconds on a phone.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const target = new URL("/dealer", request.url);
  target.searchParams.set("t", token);
  const invoice = request.nextUrl.searchParams.get("i");
  if (invoice) target.searchParams.set("invoice", invoice);
  return NextResponse.redirect(target, 307);
}
