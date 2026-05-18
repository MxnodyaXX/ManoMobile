"use client";

import { useState } from "react";
import { ShoppingBag, Smartphone, MoreHorizontal, Wrench } from "lucide-react";
import AccessorySales from "./AccessorySales";
import MobileSales from "./MobileSales";
import OtherSales from "./OtherSales";
import RepairSales from "./RepairSales";

type SalesSection = "Accessories Sales" | "Mobile Sales" | "Others" | "Repair Sales";

const sections: { id: SalesSection; icon: any; label: string }[] = [
  { id: "Accessories Sales", icon: ShoppingBag,    label: "Accessories Sales" },
  { id: "Mobile Sales",      icon: Smartphone,     label: "Mobile Sales" },
  { id: "Repair Sales",      icon: Wrench,         label: "Repair Sales" },
  { id: "Others",            icon: MoreHorizontal, label: "Others" },
];

const sectionDescriptions: Record<SalesSection, string> = {
  "Accessories Sales": "Sell phone cases, chargers, screen protectors and more",
  "Mobile Sales":      "Process handset and device sales transactions",
  "Repair Sales":      "Generate invoices for completed repair jobs",
  "Others":            "Add miscellaneous items like photocopies, stationery, and small goods",
};

export default function SalesManagement() {
  const [active, setActive] = useState<SalesSection>("Accessories Sales");

  const activeSection = sections.find((s) => s.id === active)!;
  const ActiveIcon = activeSection.icon;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, flex: 1, minHeight: 0 }}>

      {/* Page header + Sub-nav tabs */}
      <div className="fade-up" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <div>
          <h1 className="heading-xl" style={{ fontSize: 24, color: "var(--text-primary)" }}>
            Sales Management
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 5 }}>
            Process sales, manage transactions, and generate receipts.
          </p>
        </div>

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
      <div className="fade-up fade-up-3" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
        {active === "Accessories Sales" && <AccessorySales />}

        {active === "Mobile Sales" && <MobileSales />}

        {active === "Repair Sales" && <RepairSales />}

        {active === "Others" && <OtherSales />}
      </div>
    </div>
  );
}
