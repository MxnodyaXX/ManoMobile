"use client";

import { useMemo, useState } from "react";
import { useAnalytics } from "@/lib/analytics/data";
import { stockKpis, stockBy, reorderRows, movement } from "@/lib/analytics/inventory";
import { Seg } from "@/cashier/components/dashboard/charts/viz";
import { Ranked } from "./charts";
import { Stat, Grid, Panel, Th, Td, Empty, tableSt, rs, rsK, type TabProps } from "./Analytics";

/**
 * Sections 11, 12 and 13: what is on the shelf, what it is worth, how fast it
 * moves, and what to order. Movement figures are estimates from sales pace —
 * the system logs stock levels, not goods received or adjusted.
 */

const pct = (p: number | null) => (p === null ? "—" : `${(p * 100).toFixed(0)}%`);
const URGENCY = { now: { label: "Order now", color: "#f87171" }, soon: { label: "Soon", color: "#fbbf24" }, watch: { label: "Watch", color: "#60a5fa" } } as const;

export default function InventoryTab({ window: w }: TabProps) {
  const d = useAnalytics();
  const [groupBy, setGroupBy] = useState<"category" | "subcategory" | "brand" | "supplier">("category");

  const v = useMemo(() => ({
    k: stockKpis(d, w),
    byCategory: stockBy(d, w, p => p.category), bySub: stockBy(d, w, p => p.subcategory), byBrand: stockBy(d, w, p => p.brand), bySupplier: stockBy(d, w, p => p.supplier),
    reorder: reorderRows(d),
    move: movement(d, w),
    lowParts: d.parts.filter(p => p.stock <= p.reorderLevel).sort((a, b) => a.stock - b.stock).slice(0, 12),
  }), [d, w]);
  const { k } = v;
  const groups = groupBy === "category" ? v.byCategory : groupBy === "subcategory" ? v.bySub : groupBy === "brand" ? v.byBrand : v.bySupplier;

  return (
    <>
      <Grid>
        <Stat label="Products" value={String(k.products)} sub={`${k.units} units on the shelf`} />
        <Stat label="Inventory at cost" value={rsK(k.costValue)} sub="buying prices × stock" />
        <Stat label="Inventory at retail" value={rsK(k.retailValue)} sub="selling prices × stock" />
        <Stat label="Potential profit" value={rsK(k.potentialProfit)} sub="if every unit sells at price" />
        <Stat label="Out of stock" value={String(k.out)} sub="nothing on the shelf" />
        <Stat label="Low stock" value={String(k.low)} sub="at or below minimum" />
      </Grid>
      <Grid>
        <Stat label="Overstocked" value={String(k.over)} sub="more than 5× minimum" />
        <Stat label="Dead stock" value={String(k.dead)} sub="in stock, nothing sold in 90 days" />
        <Stat label="Turnover (est.)" value={k.turnover === null ? "—" : `${k.turnover.toFixed(1)}×`} sub="per year, from this window's pace" />
        <Stat label="Days of inventory (est.)" value={k.daysOutstanding === null ? "—" : k.daysOutstanding.toFixed(0)} sub="at this pace" />
        <Stat label="Sell-through" value={pct(k.sellThrough)} sub="sold ÷ (sold + on hand)" />
        <Stat label="Stock-to-sales" value={k.stockToSales === null ? "—" : `${k.stockToSales.toFixed(1)}×`} sub="units on hand per unit sold" />
      </Grid>

      <div className="fade-up" style={{ padding: "10px 14px", borderRadius: 10, background: "var(--bg-card)", border: "1px dashed var(--border)", fontSize: 12, color: "var(--text-muted)", lineHeight: 1.55 }}>
        Movement figures come from sales against stock on hand. Goods received, adjustments, damaged and lost stock are not logged by the system yet, so stock age, true turnover and shrinkage cannot be shown — when a stock-movement log is added, these become exact.
      </div>

      <div className="fade-up resp-grid-2">
        <Ranked title="Stock Value by Category" subtitle="At cost" data={v.byCategory.slice(0, 8).map(g => ({ name: g.name, value: g.costValue, sub: `${g.units} units` }))} color="var(--viz-2)" />
        <Panel title={`Stock by ${groupBy}`} hint="Units, value and what sold in the window." right={<Seg value={groupBy} onChange={setGroupBy} options={[{ id: "category", label: "Category" }, { id: "subcategory", label: "Sub" }, { id: "brand", label: "Brand" }, { id: "supplier", label: "Supplier" }]} />}>
          <table style={tableSt}>
            <thead><tr><Th>{groupBy[0].toUpperCase() + groupBy.slice(1)}</Th><Th num>Products</Th><Th num>Units</Th><Th num>At cost</Th><Th num>At retail</Th><Th num>Sold</Th></tr></thead>
            <tbody>
              {groups.length === 0 && <Empty cols={6} text="No products." />}
              {groups.map(g => <tr key={g.name}><Td strong>{g.name}</Td><Td num>{g.products}</Td><Td num>{g.units}</Td><Td num strong>{rs(g.costValue)}</Td><Td num>{rs(g.retailValue)}</Td><Td num>{g.soldUnits || "—"}</Td></tr>)}
            </tbody>
          </table>
        </Panel>
      </div>

      <Panel title="Reorder" hint="Products at or below their minimum, or running out at the last 30 days' pace. Suggested quantity covers 30 days, less what is on hand.">
        <table style={tableSt}>
          <thead><tr><Th>Urgency</Th><Th>Product</Th><Th>Category</Th><Th>Supplier</Th><Th num>Stock</Th><Th num>Minimum</Th><Th num>Sold / day</Th><Th num>Days left</Th><Th num>Suggested order</Th><Th>Last sold</Th></tr></thead>
          <tbody>
            {v.reorder.length === 0 && <Empty cols={10} text="Nothing needs ordering." />}
            {v.reorder.map(r => {
              const u = URGENCY[r.urgency];
              return (
                <tr key={r.id}>
                  <Td><span style={{ fontSize: 11, fontWeight: 700, color: u.color, background: `${u.color}14`, border: `1px solid ${u.color}30`, borderRadius: 999, padding: "2px 9px" }}>{u.label}</span></Td>
                  <Td strong>{r.name}{r.stockouts ? <span style={{ color: "#f87171", fontWeight: 400 }}> · sold out while selling</span> : null}</Td>
                  <Td>{r.category}</Td><Td>{r.supplier || "—"}</Td>
                  <Td num tone={r.stock <= 0 ? "#f87171" : undefined}>{r.stock}</Td><Td num>{r.minStock}</Td>
                  <Td num>{r.dailyPace ? r.dailyPace.toFixed(2) : "—"}</Td>
                  <Td num tone={r.daysLeft !== null && r.daysLeft < 7 ? "#f87171" : undefined}>{r.daysLeft === null ? "—" : r.daysLeft.toFixed(0)}</Td>
                  <Td num strong>{r.suggested || "—"}</Td>
                  <Td>{r.lastSold ?? "never"}</Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Panel>

      <div className="fade-up resp-grid-2">
        <MoveList title="Fast-moving" hint={`Most units sold · ${w.label.toLowerCase()}`} rows={v.move.fast} col="Sold" val={r => String(r.soldUnits)} />
        <MoveList title="Slow-moving" hint="Over twelve weeks of stock at the current pace" rows={v.move.slow} col="Weeks of stock" val={r => (r.weeksOfStock ?? 0).toFixed(0)} />
      </div>
      <div className="fade-up resp-grid-2">
        <MoveList title="Dead stock" hint="In stock, nothing sold in 90 days — by value tied up" rows={v.move.dead} col="Tied up" val={r => rs(r.value)} />
        <Panel title="Repair parts" hint={`${k.partsCount} parts · ${k.partsUnits} units · ${rs(k.partsValue)} at cost. Parts at or below their reorder level:`}>
          <table style={tableSt}>
            <thead><tr><Th>Part</Th><Th>Category</Th><Th num>Stock</Th><Th num>Reorder at</Th><Th num>Cost</Th></tr></thead>
            <tbody>
              {v.lowParts.length === 0 && <Empty cols={5} text="Every part is above its reorder level." />}
              {v.lowParts.map(p => <tr key={p.id}><Td strong>{p.name}</Td><Td>{p.category}</Td><Td num tone={p.stock <= 0 ? "#f87171" : "#fbbf24"}>{p.stock}</Td><Td num>{p.reorderLevel}</Td><Td num>{rs(p.costPrice)}</Td></tr>)}
            </tbody>
          </table>
        </Panel>
      </div>
    </>
  );
}

function MoveList<T extends { id: number; name: string; stock: number; lastSold: string | null }>({ title, hint, rows, col, val }: { title: string; hint: string; rows: T[]; col: string; val: (r: T) => string }) {
  return (
    <Panel title={title} hint={hint}>
      <table style={tableSt}>
        <thead><tr><Th>Product</Th><Th num>Stock</Th><Th num>{col}</Th><Th>Last sold</Th></tr></thead>
        <tbody>
          {rows.length === 0 && <Empty cols={4} text="Nothing here." />}
          {rows.map(r => <tr key={r.id}><Td strong>{r.name}</Td><Td num>{r.stock}</Td><Td num strong>{val(r)}</Td><Td>{r.lastSold ?? "never"}</Td></tr>)}
        </tbody>
      </table>
    </Panel>
  );
}
