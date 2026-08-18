/**
 * Shop identity printed on labels and receipts.
 *
 * Hard-coded for now because Admin → Settings keeps its values in memory only,
 * so nothing typed there survives a reload. When that screen is backed by the
 * database these should be read from it — a shop that moves premises should not
 * need a deploy to change the address on its labels.
 */
export const SHOP_DETAILS = {
  name: "Mano Mobile",
  phone: "0777 53 73 83",
  address: "255, Horana Rd, Kurusa Junction",
  /** Served from /public — printable without a network round trip. */
  logo: "/ManoMobileBlack.png",
};
