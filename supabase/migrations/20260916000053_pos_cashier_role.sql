-- ============================================================================
-- Mano Mobile — the POS Cashier role
--
-- A person who only rings up accessories at the point-of-sale screen. Not the
-- Cashier: that role runs the whole counter — repairs, inventory, customers,
-- the cash register. The POS Cashier gets one screen and the tables it needs.
--
-- Only the enum value lives here. Postgres refuses to use a value added by
-- ALTER TYPE ... ADD VALUE inside the same transaction that added it, and a
-- migration is one transaction — so seeding this role's module access, and
-- the functions that name it, follow in 20260916000054.
-- ============================================================================

alter type public.staff_role add value if not exists 'POS Cashier';
