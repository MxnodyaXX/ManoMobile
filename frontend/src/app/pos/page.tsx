"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ShoppingBasket } from "lucide-react";
import { AccessoriesProvider } from "@/cashier/contexts/AccessoriesContext";
import { DevicesProvider } from "@/cashier/contexts/DevicesContext";
import { SalesProvider } from "@/cashier/contexts/SalesContext";
import { CashRegisterProvider } from "@/cashier/contexts/CashRegisterContext";
import PosScreen from "@/pos/PosScreen";
import TabTitle from "@/lib/ui/TabTitle";
import { useAuth } from "@/lib/auth/AuthContext";
import { isSupabaseConfigured } from "@/lib/supabase/client";

const ff = "'Plus Jakarta Sans', sans-serif";

/**
 * Who may stand at the till.
 *
 * The POS Cashier, whose only screen this is; the Cashier, who already has
 * Sales / POS in full and may prefer this layout for a queue of accessory
 * sales; and an Admin, who may open any section. A Technician or Accounts
 * login has no business ringing up sales, and RLS would refuse the insert
 * anyway — this just says so before they fill a cart.
 */
const MAY_SELL = new Set(["POS Cashier", "Cashier", "Admin"]);

function NotYourTill({ role }: { role: string }) {
  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--bg-primary)", fontFamily: ff, padding: "40px 20px",
    }}>
      <div style={{ maxWidth: 440, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <ShoppingBasket size={22} color="#f87171" />
        </div>
        <p style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>This is the point of sale</p>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
          You are signed in as <strong>{role}</strong>. The till is for a POS Cashier, a Cashier or an Admin.
        </p>
        <Link href="/" style={{ fontSize: 13, fontWeight: 600, color: "var(--accent)", marginTop: 6 }}>Back to the login screen</Link>
      </div>
    </div>
  );
}

export default function PosPage() {
  const { profile, signOut, loading } = useAuth();

  // While the till is up, printing the page prints the receipt and nothing
  // else — see the @media print rules in globals.css.
  useEffect(() => {
    document.body.classList.add("pos-print");
    return () => document.body.classList.remove("pos-print");
  }, []);

  // Without a backend there is nobody to be signed in as and nothing to sell;
  // the screen still opens so the layout can be looked at.
  const configured = isSupabaseConfigured();
  // RequireSignIn has already sent a signed-out tab to the login screen.
  if (configured && (loading || !profile)) return null;
  if (profile && !MAY_SELL.has(profile.role)) return <NotYourTill role={profile.role} />;

  return (
    <CashRegisterProvider>
    <SalesProvider>
    <AccessoriesProvider>
    <DevicesProvider>
      <TabTitle role="POS" />
      <PosScreen
        cashierName={(profile?.fullName || profile?.email || "Cashier").trim()}
        onLogout={() => { void signOut().then(() => window.location.assign("/")); }}
      />
    </DevicesProvider>
    </AccessoriesProvider>
    </SalesProvider>
    </CashRegisterProvider>
  );
}
