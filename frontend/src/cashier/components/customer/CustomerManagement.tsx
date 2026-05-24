"use client";

import { useState } from "react";
import { Users, CreditCard } from "lucide-react";
import { useIsMobile } from "@/cashier/hooks/useIsMobile";
import AllCustomers from "./AllCustomers";
import CreditCustomers from "./CreditCustomers";

type CustomerSection = "All Customers" | "Credit Customers";

const sections: { id: CustomerSection; icon: any; label: string }[] = [
  { id: "All Customers",    icon: Users,      label: "All Customers" },
  { id: "Credit Customers", icon: CreditCard, label: "Credit Customers" },
];

const sectionDescriptions: Record<CustomerSection, string> = {
  "All Customers":    "View and manage all registered customers",
  "Credit Customers": "Track outstanding credit balances and record payments",
};

export default function CustomerManagement() {
  const [active, setActive] = useState<CustomerSection>("All Customers");
  const isMobile = useIsMobile();

  const activeSection = sections.find((s) => s.id === active)!;
  const ActiveIcon = activeSection.icon;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, flex: 1, minHeight: 0 }}>

      {/* Page header + Sub-nav tabs */}
      <div className="fade-up" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <h1 className="heading-xl" style={{ fontSize: 24, color: "var(--text-primary)" }}>
            Customer Management
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 5 }}>
            Manage customer records, credit accounts, and payment history.
          </p>
        </div>

        <div className={isMobile ? "tabs-scroll" : undefined}>
        <div style={{
          display: "flex", gap: 6,
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: 12, padding: 6,
          width: "fit-content",
        }}>
          {sections.map(({ id, icon: Icon, label }) => {
            const isActive = active === id;
            return (
              <button
                key={id}
                onClick={() => setActive(id)}
                style={{
                  display: "flex", alignItems: "center", gap: 7,
                  padding: "9px 16px", borderRadius: 8, fontSize: 13,
                  border: isActive ? "1px solid var(--accent-glow)" : "1px solid transparent",
                  background: isActive ? "var(--accent-dim)" : "transparent",
                  color: isActive ? "var(--accent)" : "var(--text-secondary)",
                  fontWeight: isActive ? 600 : 400,
                  cursor: "pointer", transition: "all 0.18s",
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  whiteSpace: "nowrap",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLButtonElement).style.background = "var(--border)";
                    (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                    (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)";
                  }
                }}
              >
                <Icon size={14} strokeWidth={isActive ? 2.5 : 1.8} />
                {label}
              </button>
            );
          })}
        </div>
        </div>
      </div>

      {/* Section header */}
      <div className="fade-up fade-up-2" style={{
        display: "flex", alignItems: "center", gap: 10,
        paddingBottom: 16,
        borderBottom: "1px solid var(--border)",
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: 9,
          background: "var(--accent-dim)",
          border: "1px solid var(--accent-glow)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "var(--accent)",
        }}>
          <ActiveIcon size={15} strokeWidth={2.2} />
        </div>
        <div>
          <h2 className="heading" style={{ fontSize: 15, color: "var(--text-primary)" }}>
            {active}
          </h2>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 1 }}>
            {sectionDescriptions[active]}
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="fade-up fade-up-3" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, overflowY: "auto" }}>
        {active === "All Customers" && <AllCustomers />}
        {active === "Credit Customers" && <CreditCustomers />}
      </div>
    </div>
  );
}
