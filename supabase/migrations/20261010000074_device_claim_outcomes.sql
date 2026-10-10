-- ============================================================================
-- Mano Mobile — six ways to settle a phone warranty claim
--
-- The four of 20261006000069 did not say what happened to the faulty phone.
-- The counter actually settles a claim in one of six ways:
--
--   repair_shop       repaired here, free — a warranty repair job is opened
--   company_replace   the faulty phone goes to the company AND the customer
--                     gets another unit from stock now
--   company_refund    the faulty phone goes to the company AND the price is
--                     refunded
--   repair_company    the faulty phone goes to the company and the customer
--                     waits for it to come back (unchanged)
--   replace           swapped for another unit; the faulty phone goes back
--                     into stock, onto the rack
--   refund            full cash refund; the phone goes back into stock
--
-- Only the allowed values change — the replace and refund mechanics
-- (replace_mobile_device, refund_mobile_device) already take where the phone
-- goes, and the counter now passes the one each kind of claim implies.
-- ============================================================================

alter table public.device_warranty_claims
  drop constraint if exists device_warranty_claims_resolution_check;

alter table public.device_warranty_claims
  add constraint device_warranty_claims_resolution_check
  check (resolution in ('repair_shop', 'company_replace', 'company_refund', 'repair_company', 'replace', 'refund'));

comment on table public.device_warranty_claims is
  'Warranty claims on phones sold by the shop: repaired here; returned to the company with a replacement, a refund, or for repair; replaced from stock with the phone back on the rack; or refunded in cash. Repair-warranty claims are warranty_claims.';
