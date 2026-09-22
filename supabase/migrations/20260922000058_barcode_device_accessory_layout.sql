-- ============================================================================
-- Mano Mobile — split the shared "simple" barcode layout into its own
-- Mobile Devices and Accessories designs
--
-- Admin -> Barcode has had one "simple" layout used for both a phone label
-- (wants IMEI + brand/model + storage/color) and an accessory label (wants
-- product code + name + price) — no way to design them differently. This adds
-- the two layouts BarcodeLabelModal's `variant` and Admin -> Barcode's new
-- "Mobile Devices"/"Accessories" tabs point at.
--
-- Only the enum values live here, same as 20260916000053 (POS Cashier role):
-- Postgres refuses ALTER TYPE ... ADD VALUE inside the same transaction that
-- added it, and a migration is one transaction, so nothing else in this file
-- can reference 'device' or 'accessory' yet.
--
-- Existing 'simple'-layout templates (including the seeded 'Standard' row)
-- are untouched — 'simple' stays a valid value and keeps printing exactly as
-- it does today.
-- ============================================================================

alter type barcode_layout add value if not exists 'device';
alter type barcode_layout add value if not exists 'accessory';
