"use client";

import { useMemo } from "react";
import { useAnalytics } from "@/lib/analytics/data";
import { supplierRows, purchaseKpis, purchaseTrend, purchasesByItem, priceChanges } from "@/lib/analytics/inventory";
import { Ranked, GroupedBars } from "./charts";
import { Stat, Grid, Panel, Th, Td, Empty, tableSt, rs, rsK, type TabProps } from "./Analytics";

/**
 * Sections 14 and 15: the partners the stock comes from, and what was bought.
 * Delivery times and returns to supplier are not recorded by the system, so
 * they are not shown — the columns would be guesses.
 */

const pct = (p: number) => `${p >= 0 ? "+" : "−"}${Math.abs(p * 100).toFixed(0)}%`;

export default function SuppliersTab({ window: w }: TabProps) {
  const d = useAnalytics();
  const v = useMemo(() => ({
    rows: supplierRows(d, w),
    k: purchaseKpis(d, w),
    trend: purchaseTrend(d, w),
    items: purchasesByItem(d, w),
    prices: priceChanges(d),
  }), [d, w]);
  const { k } = v;

  return (
    <>
      <Grid>
        <Stat label="Purchases" value={rsK(k.total)} sub={`${k.orders} order${k.orders === 1 ? "" : "s"} · ${w.label.toLowerCase()}`} />
        <Stat label="Average order" value={k.avgOrder === null ? "—" : rsK(k.avgOrder)} sub="per purchase order" />
        <Stat label="Items ordered" value={String(k.items)} sub={`${k.received} received`} />
        <Stat label="Orders open" value={String(k.pending)} sub="approved, sent or partly received" />
        <Stat label="Owed to suppliers" value={rsK(k.outstanding)} sub="payables today" />
        <Stat label="Suppliers" value={String(k.suppliers)} sub={`${k.activeSuppliers} active`} />
      </Grid>

      <div className="fade-up resp-grid-2">
        <Ranked title="Purchase Value by Supplier" subtitle={`Orders placed · ${w.label.toLowerCase()}`} data={v.rows.filter(r => r.purchases > 0).map(r => ({ name: r.name, value: r.purchases, sub: `${r.orders} orders` }))} color="var(--viz-2)" />
        <GroupedBars title="Purchases vs Accessory Sales" subtitle={`Bought against sold · ${w.label.toLowerCase()}`} data={v.trend} money
          series={[{ key: "purchases", label: "Purchases", color: "var(--viz-2)" }, { key: "sales", label: "Accessory sales", color: "var(--viz-1)" }]} />
      </div>

      <Panel title="Suppliers" hint="Purchases in the window; stock, sales and profit from stock are for the products that name this supplier.">
        <table style={tableSt}>
          <thead><tr><Th>Supplier</Th><Th>Supplies</Th><Th num>Purchases</Th><Th num>Orders</Th><Th num>Items</Th><Th num>Received</Th><Th num>Avg order</Th><Th num>Avg item cost</Th><Th num>Owed</Th><Th num>Order every</Th><Th>Last order</Th><Th num>Products in stock</Th><Th num>Stock at cost</Th><Th num>Sales from stock</Th><Th num>Profit from stock</Th></tr></thead>
          <tbody>
            {v.rows.length === 0 && <Empty cols={15} text="No suppliers yet." />}
            {v.rows.map(r => (
              <tr key={r.id}>
                <Td strong>{r.name}{r.status === "Inactive" ? <span style={{ color: "var(--text-muted)", fontWeight: 400 }}> · inactive</span> : null}</Td>
                <Td>{r.category || "—"}</Td>
                <Td num strong>{r.purchases ? rs(r.purchases) : "—"}</Td>
                <Td num>{r.orders || "—"}</Td>
                <Td num>{r.items || "—"}</Td>
                <Td num>{r.items ? `${r.received} / ${r.items}` : "—"}</Td>
                <Td num>{r.orders ? rs(r.avgOrder) : "—"}</Td>
                <Td num>{r.avgItemCost === null ? "—" : rs(r.avgItemCost)}</Td>
                <Td num tone={r.outstanding > 0 ? "#fbbf24" : undefined}>{r.outstanding > 0 ? rs(r.outstanding) : "—"}</Td>
                <Td num>{r.frequencyDays === null ? "—" : `${r.frequencyDays.toFixed(0)} d`}</Td>
                <Td>{r.lastOrder ? r.lastOrder.slice(0, 10) : "—"}</Td>
                <Td num>{r.stockProducts || "—"}</Td>
                <Td num>{r.stockValue ? rs(r.stockValue) : "—"}</Td>
                <Td num>{r.salesFromStock ? rs(r.salesFromStock) : "—"}</Td>
                <Td num tone={r.profitFromStock < 0 ? "#f87171" : undefined}>{r.salesFromStock ? rs(r.profitFromStock) : "—"}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <div className="fade-up resp-grid-2">
        <Panel title="Most purchased items" hint={`By value · ${w.label.toLowerCase()}`}>
          <table style={tableSt}>
            <thead><tr><Th>Item</Th><Th num>Qty</Th><Th num>Orders</Th><Th num>Value</Th></tr></thead>
            <tbody>
              {v.items.length === 0 && <Empty cols={4} text="No purchase orders in this window." />}
              {v.items.map(i => <tr key={i.name}><Td strong>{i.name}</Td><Td num>{i.qty}</Td><Td num>{i.orders}</Td><Td num strong>{rs(i.value)}</Td></tr>)}
            </tbody>
          </table>
        </Panel>
        <Panel title="Cost changes" hint="Items whose unit cost moved between their first and latest order, all time.">
          <table style={tableSt}>
            <thead><tr><Th>Item</Th><Th>Supplier</Th><Th num>First cost</Th><Th num>Latest cost</Th><Th num>Change</Th></tr></thead>
            <tbody>
              {v.prices.length === 0 && <Empty cols={5} text="No item has been bought at two different prices." />}
              {v.prices.map(p => <tr key={p.name}><Td strong>{p.name}</Td><Td>{p.supplier}</Td><Td num>{rs(p.first)}</Td><Td num>{rs(p.last)}</Td><Td num tone={p.change > 0 ? "#f87171" : "#34d399"}>{pct(p.change)}</Td></tr>)}
            </tbody>
          </table>
        </Panel>
      </div>
    </>
  );
}
