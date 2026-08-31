"use client";

import { useState } from "react";
import { useIsMobile } from "@/cashier/hooks/useIsMobile";
import { ShoppingBag, Smartphone, MoreHorizontal, Wrench, History, BarChart2, PauseCircle, FileText } from "lucide-react";
import AccessorySales from "./AccessorySales";
import MobileSales from "./MobileSales";
import OtherSales from "./OtherSales";
import RepairSales from "./RepairSales";
import SalesHistory from "./SalesHistory";
import DailySummary from "./DailySummary";
import QuotationEstimate from "./QuotationEstimate";
import HeldSalesDrawer from "@/cashier/components/shared/HeldSalesDrawer";
import { useHeldSales, type HeldSale } from "@/cashier/contexts/HeldSalesContext";

type SalesSection = "Accessories Sales" | "Mobile Sales" | "Repair Sales" | "Others" | "Sales History" | "Daily Summary" | "Quotation";

const sections: { id: SalesSection; icon: any; label: string }[] = [
  { id: "Accessories Sales", icon: ShoppingBag,    label: "Accessories" },
  { id: "Mobile Sales",      icon: Smartphone,     label: "Mobile" },
  { id: "Repair Sales",      icon: Wrench,         label: "Repair" },
  { id: "Others",            icon: MoreHorizontal, label: "Others" },
  { id: "Sales History",     icon: History,        label: "History" },
  { id: "Daily Summary",     icon: BarChart2,      label: "Daily Summary" },
  { id: "Quotation",         icon: FileText,       label: "Quotation" },
];

const sectionDescriptions: Record<SalesSection, string> = {
  "Accessories Sales": "Sell phone cases, chargers, screen protectors and more",
  "Mobile Sales":      "Process handset and device sales transactions",
  "Repair Sales":      "Generate invoices for completed repair jobs",
  "Others":            "Add miscellaneous items like photocopies, stationery, and small goods",
  "Sales History":     "Browse, search, void or reprint past sales transactions",
  "Daily Summary":     "Today's sales snapshot — revenue breakdown by category",
  "Quotation":         "Create price estimates and quotations for customers before a confirmed sale",
};

export default function SalesManagement() {
  const [active,      setActive]      = useState<SalesSection>("Accessories Sales");
  const [showHeld,    setShowHeld]    = useState(false);
  const { heldSales } = useHeldSales();
  const isMobile = useIsMobile();

  const activeSection = sections.find((s) => s.id === active)!;
  const ActiveIcon = activeSection.icon;

  const handleResume = (sale: HeldSale) => {
    // Navigate to the correct section when resuming
    const sectionMap: Record<string, SalesSection> = {
      "Accessories": "Accessories Sales",
      "Mobile":      "Mobile Sales",
      "Others":      "Others",
    };
    const target = sectionMap[sale.category] ?? "Accessories Sales";
    setActive(target);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, flex: 1, minHeight: 0 }}>

      {/*
        One header row instead of three stacked blocks.

        This used to be a page title, a subtitle, and then a separate card
        naming the section — roughly 150px of chrome above every till screen,
        saying things the sidebar and the navbar breadcrumb already say. The
        section card carries the identity; the tabs carry the navigation; the
        page title was the part nobody needed.
      */}
      <div className="fade-up" style={{
        display: "flex", flexDirection: isMobile ? "column" : "row",
        alignItems: isMobile ? "stretch" : "center",
        justifyContent: "space-between", gap: isMobile ? 10 : 16,
      }}>

        {/* Which till you are at */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "10px 14px",
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          width: isMobile ? "auto" : "fit-content",
          flexShrink: 0,
        }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8,
            background: "var(--accent-dim)",
            border: "1px solid var(--accent-glow)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "var(--accent)", flexShrink: 0,
          }}>
            <ActiveIcon size={14} strokeWidth={2.2} />
          </div>
          <div style={{ minWidth: 0 }}>
            <h2 className="heading" style={{ fontSize: 14, color: "var(--text-primary)" }}>
              {active}
            </h2>
            {/* The description is the first thing to go when the row is tight:
                it is orientation, and the title already gives that. */}
            <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {sectionDescriptions[active]}
            </p>
          </div>
        </div>

        {/* Section tabs + held sales button, grouped on the right */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: isMobile ? "wrap" : "nowrap", minWidth: 0 }}>
          <div className={isMobile ? "tabs-scroll" : undefined} style={{ minWidth: 0 }}>
            <div style={{
              display: "flex", gap: 4,
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: 11, padding: 5,
              width: "fit-content",
            }}>
              {sections.map(({ id, icon: Icon, label }) => {
                const isActive = active === id;
                return (
                  <button
                    key={id}
                    onClick={() => setActive(id)}
                    style={{
                      display: "flex", alignItems: "center", gap: 6,
                      padding: "7px 11px", borderRadius: 8, fontSize: 12.5,
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
                    <Icon size={13} strokeWidth={isActive ? 2.5 : 1.8} />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Hold button */}
          <button
            onClick={() => setShowHeld(true)}
            style={{
              display: "flex", alignItems: "center", gap: 7,
              padding: "8px 13px", borderRadius: 9,
              border: heldSales.length > 0 ? "1px solid rgba(251,191,36,0.35)" : "1px solid var(--border)",
              background: heldSales.length > 0 ? "rgba(251,191,36,0.08)" : "transparent",
              color: heldSales.length > 0 ? "#fbbf24" : "var(--text-secondary)",
              cursor: "pointer", fontSize: 12.5, fontWeight: 600,
              fontFamily: "'Plus Jakarta Sans', sans-serif", position: "relative", flexShrink: 0,
            }}
          >
            <PauseCircle size={14} />
            {!isMobile && "Held Sales"}
            {heldSales.length > 0 && (
              <span style={{
                background: "#fbbf24", color: "#000", fontSize: 10, fontWeight: 800,
                borderRadius: "50%", width: 18, height: 18,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {heldSales.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="fade-up fade-up-2" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, overflowY: "auto" }}>
        {active === "Accessories Sales" && <AccessorySales />}
        {active === "Mobile Sales"      && <MobileSales />}
        {active === "Repair Sales"      && <RepairSales />}
        {active === "Others"            && <OtherSales />}
        {active === "Sales History"     && <SalesHistory />}
        {active === "Daily Summary"     && <DailySummary />}
        {active === "Quotation"         && <QuotationEstimate />}
      </div>

      {showHeld && (
        <HeldSalesDrawer
          onClose={() => setShowHeld(false)}
          onResume={handleResume}
        />
      )}
    </div>
  );
}
