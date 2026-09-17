"use client";

import { useMemo, useState } from "react";
import { useAnalytics } from "@/lib/analytics/data";
import { productRows, groupProducts, boughtTogether, crossSell, type ProductRow } from "@/lib/analytics/sales";
import { live } from "@/lib/analytics/overview";
import { Seg } from "@/cashier/components/dashboard/charts/viz";
import { ShareDonut, Ranked } from "./charts";
import { Stat, Grid, Panel, Th, Td, Empty, tableSt, rs, rsK, type TabProps } from "./Analytics";

/**
 * Sections 3, 31, 32, 33 and 39 of the brief: accessories as products,
 * categories and brands, and what sells alongside what.
 *
 * Everything here reads the invoice lines (sale_items), so it covers sales
 * since lines were stored. Older accessory sales carried only a summary
 * string and cannot be split by product.
 */

const pct = (p: number | null) => (p === null ? "—" : `${(p * 100).toFixed(0)}%`);
const trendStr = (t: number | null) => (t === null ? "new" : t === 0 ? "—" : `${t > 0 ? "+" : "−"}${Math.abs(t * 100).toFixed(0)}%`);
const SLOTS = ["var(--viz-1)", "var(--viz-4)", "var(--viz-5)", "var(--viz-3)"];

export default function ProductsTab({ window: w, previous }: TabProps) {
  const d = useAnalytics();
  const [groupBy, setGroupBy] = useState<"category" | "subcategory" | "brand">("category");
  const [sortBy, setSortBy] = useState<"revenue" | "qty" | "profit" | "margin">("revenue");

  const v = useMemo(() => {
    const rows = productRows(d, w, previous);
    const sold = rows.filter(r => r.qty > 0);
    return {
      rows, sold,
      revenue: sold.reduce((t, r) => t + r.revenue, 0),
      units: sold.reduce((t, r) => t + r.qty, 0),
      profit: sold.every(r => r.profit === null) ? null : sold.reduce((t, r) => t + (r.profit ?? 0), 0),
      byCategory: groupProducts(sold, r => r.category),
      bySub: groupProducts(sold, r => r.subcategory),
      byBrand: groupProducts(sold, r => r.brand),
      together: boughtTogether(d, w),
      avgAccessoryBill: (() => { const xs = live(d.sales, w).filter(s => s.category === "Accessories"); return xs.length ? xs.reduce((t, s) => t + s.total, 0) / xs.length : null; })(),
      cross: crossSell(d, w),
      rising: rows.filter(r => r.trend !== null && r.trend > 0.2 && r.qty >= 3).sort((a, b) => (b.trend ?? 0) - (a.trend ?? 0)).slice(0, 6),
      falling: rows.filter(r => r.trend !== null && r.trend < -0.2 && r.prevQty >= 3).sort((a, b) => (a.trend ?? 0) - (b.trend ?? 0)).slice(0, 6),
      slow: rows.filter(r => r.weeksOfStock !== null && r.weeksOfStock > 12).sort((a, b) => (b.weeksOfStock ?? 0) - (a.weeksOfStock ?? 0)).slice(0, 6),
      fast: rows.filter(r => r.weeksOfStock !== null && r.weeksOfStock < 2 && r.qty >= 2).sort((a, b) => (a.weeksOfStock ?? 0) - (b.weeksOfStock ?? 0)).slice(0, 6),
    };
  }, [d, w, previous]);

  const groups = groupBy === "category" ? v.byCategory : groupBy === "subcategory" ? v.bySub : v.byBrand;
  const sorted = [...v.sold].sort((a, b) =>
    sortBy === "qty" ? b.qty - a.qty : sortBy === "profit" ? (b.profit ?? -Infinity) - (a.profit ?? -Infinity) : sortBy === "margin" ? (b.margin ?? -Infinity) - (a.margin ?? -Infinity) : b.revenue - a.revenue);
  const top = v.sold.slice(0, 8).map(r => ({ name: r.name, value: r.revenue, sub: `${r.qty} sold` }));
  const bottom = [...v.sold].sort((a, b) => a.revenue - b.revenue).slice(0, 6);
  const catSlices = v.byCategory.slice(0, 3).map((g, i) => ({ key: g.name, label: g.name, value: g.revenue, color: SLOTS[i] }));
  const rest = v.byCategory.slice(3).reduce((t, g) => t + g.revenue, 0);
  if (rest > 0) catSlices.push({ key: "__rest", label: "Other categories", value: rest, color: SLOTS[3] });

  return (
    <>
      <Grid>
        <Stat label="Accessory revenue" value={rsK(v.revenue)} sub={`${w.label.toLowerCase()} · from invoice lines`} />
        <Stat label="Units sold" value={String(v.units)} sub={`${v.sold.length} different products`} />
        <Stat label="Product profit (est.)" value={v.profit === null ? "—" : rsK(v.profit)} sub={v.revenue && v.profit !== null ? `${pct(v.profit / v.revenue)} margin` : "needs buying prices"} />
        <Stat label="Avg accessory bill" value={v.avgAccessoryBill === null ? "—" : rsK(v.avgAccessoryBill)} sub="accessory-only invoices" />
        <Stat label="Top seller" value={v.sold[0]?.name ?? "—"} sub={v.sold[0] ? `${rs(v.sold[0].revenue)} · ${v.sold[0].qty} sold` : ""} />
        <Stat label="Sold with repairs" value={pct(v.cross.rate)} sub={`${v.cross.withProducts} of ${v.cross.repairInvoices} repair invoices`} />
      </Grid>

      <div className="fade-up resp-grid-2">
        <Ranked title="Top-selling Products" subtitle={`By value · ${w.label.toLowerCase()}`} data={top} color="var(--viz-accessories)" />
        <ShareDonut title="Revenue by Category" subtitle={`Top three, and the rest · ${w.label.toLowerCase()}`} slices={catSlices} />
      </div>

      <Panel title="Products" hint="Every product sold in the window. Trend compares units with the previous stretch; weeks of stock is what is on the shelf against the pace it sold at."
        right={<Seg value={sortBy} onChange={setSortBy} options={[{ id: "revenue", label: "Revenue" }, { id: "qty", label: "Units" }, { id: "profit", label: "Profit" }, { id: "margin", label: "Margin" }]} />}>
        <table style={tableSt}>
          <thead><tr><Th>Product</Th><Th>Category</Th><Th>Brand</Th><Th num>Units</Th><Th num>Revenue</Th><Th num>Avg price</Th><Th num>Profit</Th><Th num>Margin</Th><Th num>Discount</Th><Th num>Trend</Th><Th num>Stock</Th><Th num>Weeks of stock</Th><Th num>With repairs</Th></tr></thead>
          <tbody>
            {sorted.length === 0 && <Empty cols={13} text="No product lines in this window." />}
            {sorted.map(r => <ProductTr key={r.key} r={r} />)}
          </tbody>
        </table>
      </Panel>

      <div className="fade-up resp-grid-2">
        <Panel title={`By ${groupBy}`} hint="Revenue share of each group." right={<Seg value={groupBy} onChange={setGroupBy} options={[{ id: "category", label: "Category" }, { id: "subcategory", label: "Subcategory" }, { id: "brand", label: "Brand" }]} />}>
          <table style={tableSt}>
            <thead><tr><Th>{groupBy[0].toUpperCase() + groupBy.slice(1)}</Th><Th num>Units</Th><Th num>Revenue</Th><Th num>Profit</Th><Th num>Share</Th></tr></thead>
            <tbody>
              {groups.length === 0 && <Empty cols={5} text="Nothing to group." />}
              {groups.map(g => <tr key={g.name}><Td strong>{g.name}</Td><Td num>{g.qty}</Td><Td num strong>{rs(g.revenue)}</Td><Td num>{g.profit === null ? "—" : rs(g.profit)}</Td><Td num>{pct(g.share)}</Td></tr>)}
            </tbody>
          </table>
        </Panel>
        <Panel title="Bought together" hint={`Pairs on the same invoice · ${w.label.toLowerCase()}`}>
          <table style={tableSt}>
            <thead><tr><Th>Product</Th><Th>With</Th><Th num>Times</Th></tr></thead>
            <tbody>
              {v.together.length === 0 && <Empty cols={3} text="No invoice carried two different products." />}
              {v.together.map(p => <tr key={`${p.a}|${p.b}`}><Td strong>{p.a}</Td><Td>{p.b}</Td><Td num strong>{p.times}</Td></tr>)}
            </tbody>
          </table>
        </Panel>
      </div>

      <Panel title="Cross-selling with repairs" hint="What repair customers added to their bill, and how much it was worth.">
        <div style={{ padding: "4px 18px 16px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
          {[
            ["Repair invoices", String(v.cross.repairInvoices)],
            ["…with a product on them", `${v.cross.withProducts} · ${pct(v.cross.rate)}`],
            ["Extra sale per repair", v.cross.extraPerRepair === null ? "—" : rs(v.cross.extraPerRepair)],
            ["Revenue from cross-selling", rs(v.cross.extraValue)],
          ].map(([l, val]) => (
            <div key={l} style={{ background: "var(--bg-secondary)", borderRadius: 10, padding: "10px 12px" }}>
              <p style={{ fontSize: 10.5, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{l}</p>
              <p style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)" }}>{val}</p>
            </div>
          ))}
        </div>
        <table style={tableSt}>
          <thead><tr><Th>Category added to a repair</Th><Th num>Lines</Th></tr></thead>
          <tbody>
            {v.cross.byCategory.length === 0 && <Empty cols={2} text="No products were sold on a repair invoice in this window." />}
            {v.cross.byCategory.map(c => <tr key={c.name}><Td strong>{c.name}</Td><Td num>{c.value}</Td></tr>)}
          </tbody>
        </table>
      </Panel>

      <div className="fade-up resp-grid-2">
        <ListPanel title="Rising" hint="Units up more than 20% on the previous stretch" rows={v.rising} render={r => trendStr(r.trend)} tone="#34d399" />
        <ListPanel title="Declining" hint="Units down more than 20% on the previous stretch" rows={v.falling} render={r => trendStr(r.trend)} tone="#f87171" />
      </div>
      <div className="fade-up resp-grid-2">
        <ListPanel title="Fast-moving" hint="Less than two weeks of stock at the current pace" rows={v.fast} render={r => `${r.weeksOfStock!.toFixed(1)} wk · ${r.stock} left`} tone="#fbbf24" />
        <ListPanel title="Slow-moving" hint="More than twelve weeks of stock at the current pace" rows={v.slow} render={r => `${r.weeksOfStock!.toFixed(0)} wk · ${r.stock} left`} tone="var(--text-muted)" />
      </div>
      {bottom.length > 0 && (
        <Panel title="Lowest sellers" hint="Products that did sell, but least.">
          <table style={tableSt}>
            <thead><tr><Th>Product</Th><Th num>Units</Th><Th num>Revenue</Th><Th num>Stock</Th></tr></thead>
            <tbody>{bottom.map(r => <tr key={r.key}><Td strong>{r.name}</Td><Td num>{r.qty}</Td><Td num>{rs(r.revenue)}</Td><Td num>{r.stock ?? "—"}</Td></tr>)}</tbody>
          </table>
        </Panel>
      )}
    </>
  );
}

function ProductTr({ r }: { r: ProductRow }) {
  return (
    <tr>
      <Td strong>{r.name}</Td>
      <Td>{r.category}{r.subcategory !== "—" ? <span style={{ color: "var(--text-muted)" }}> · {r.subcategory}</span> : null}</Td>
      <Td>{r.brand}</Td>
      <Td num strong>{r.qty}</Td>
      <Td num strong>{rs(r.revenue)}</Td>
      <Td num>{rs(r.avgPrice)}</Td>
      <Td num tone={r.profit !== null && r.profit < 0 ? "#f87171" : undefined}>{r.profit === null ? "—" : rs(r.profit)}</Td>
      <Td num tone={r.margin !== null && r.margin < 0.1 ? "#fbbf24" : undefined}>{pct(r.margin)}</Td>
      <Td num>{r.discount > 0 ? pct(r.discount) : "—"}</Td>
      <Td num tone={r.trend === null ? "var(--text-muted)" : r.trend > 0 ? "#34d399" : r.trend < 0 ? "#f87171" : undefined}>{trendStr(r.trend)}</Td>
      <Td num tone={r.stock !== null && r.stock <= 0 ? "#f87171" : undefined}>{r.stock ?? "—"}</Td>
      <Td num tone={r.weeksOfStock !== null && r.weeksOfStock < 2 ? "#fbbf24" : undefined}>{r.weeksOfStock === null ? "—" : r.weeksOfStock.toFixed(1)}</Td>
      <Td num>{r.onRepairInvoices || "—"}</Td>
    </tr>
  );
}

function ListPanel({ title, hint, rows, render, tone }: { title: string; hint: string; rows: ProductRow[]; render: (r: ProductRow) => string; tone: string }) {
  return (
    <Panel title={title} hint={hint}>
      <table style={tableSt}>
        <tbody>
          {rows.length === 0 && <Empty cols={2} text="Nothing here." />}
          {rows.map(r => <tr key={r.key}><Td strong>{r.name}<span style={{ color: "var(--text-muted)", fontWeight: 400 }}> · {r.qty} sold</span></Td><Td num tone={tone}>{render(r)}</Td></tr>)}
        </tbody>
      </table>
    </Panel>
  );
}
