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
  tagline: "Since 2005",
  phone: "0777 53 73 83",
  email: "info@manomobile.lk",
  website: "www.manomobile.lk",
  address: "255, Horana Rd, Kurusa Junction",
  /** Served from /public — printable without a network round trip. */
  logo: "/ManoMobileBlack.png",
  /** Printed on the receipt's "Bank Transfer" box — the shop's own account,
   *  not the customer's. Hard-coded for the same reason as the rest of this
   *  file: nowhere in Admin persists settings like this yet. */
  bankName: "Peoples Bank",
  bankAccountNumber: "321 100 100000 716",
  bankAccountHolder: "B Wijaya Kumar",
};
