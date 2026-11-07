"use client";

import { useMemo, useRef, useState } from "react";
import { Printer, Wrench } from "lucide-react";
import { useAccessories } from "@/cashier/contexts/AccessoriesContext";
import { useParts } from "@/cashier/contexts/PartsContext";
import BarcodeLabelModal from "@/cashier/components/shared/BarcodeLabelModal";
import { printLabelsNode } from "@/cashier/utils/printLabel";
import { useToast } from "@/lib/ui/toast";
import { buildLabelRows, type LabelRow } from "@/lib/purchasing/labelRows";
import { partLabelTokens } from "@/lib/repair/partLabel";
import { accessoryBarcodeOptions, partBarcodeOptions } from "@/lib/inventory/accessoryScan";
import type { InvoiceDetail } from "@/lib/purchasing/api";
import { Btn, Modal, Rs, input } from "./ui";

const MAX_COPIES = 1000;
type Kind = LabelRow["kind"];

/**
 * Every label a delivery needs, from its invoice.
 *
 * Accessories and repair parts print as separate jobs: their labels are different
 * sizes on different rolls, and one print job can only have one page size. Each
 * label is drawn off-screen once, one at a time, and repeated for its copies, so
 * time goes with how many different items there are, not how many labels.
 */
export default function InvoiceLabelsModal({ detail, onClose }: { detail: InvoiceDetail; onClose: () => void }) {
  const { products } = useAccessories();
  const { parts } = useParts();
  const toast = useToast();
  const rows = useMemo(() => buildLabelRows(detail.items, products, parts), [detail.items, products, parts]);
  const missing = detail.items.filter(i => i.productId || i.partId).length > 0 && rows.length === 0;

  const [copies, setCopies] = useState<Record<string, number>>(() => Object.fromEntries(rows.map(r => [r.key, r.qty])));
  const [off, setOff] = useState<Set<string>>(new Set());
  const [printCode, setPrintCode] = useState<Record<string, string>>({});
  const [queue, setQueue] = useState<LabelRow[] | null>(null);
  const [done, setDone] = useState(0);
  const [jobSize, setJobSize] = useState(0);
  const collected = useRef<{ html: string; w: number; h: number; n: number }[]>([]);

  // A row added by a reload after opening starts at its own quantity.
  const countOf = (r: LabelRow) => copies[r.key] ?? r.qty;
  const chosen = (kind: Kind) => rows.filter(r => r.kind === kind && !off.has(r.key) && countOf(r) > 0);
  const labelsFor = (kind: Kind) => chosen(kind).reduce((n, r) => n + countOf(r), 0);
  const accessoryLabels = labelsFor("accessory");
  const partLabels = labelsFor("part");
  const boxBarcodes = rows.filter(r => r.hasBoxBarcode).length;

  const optionsOf = (r: LabelRow) => r.kind === "accessory" ? accessoryBarcodeOptions(r.product) : partBarcodeOptions(r.part);
  const codeOf = (r: LabelRow) => printCode[r.key] ?? optionsOf(r)[0].value;
  const printing = queue !== null;
  const current = queue?.[0] ?? null;

  const start = (kind: Kind) => {
    const list = chosen(kind);
    if (list.length === 0) return;
    collected.current = [];
    setDone(0);
    setJobSize(list.length);
    setQueue(list);
  };

  // The label off-screen is always queue[0], keyed by its row, so the queue this
  // render sees is the one that label belongs to.
  const handleReady = (html: string, w: number, h: number) => {
    const q = queue ?? [];
    if (q[0]) collected.current.push({ html, w, h, n: countOf(q[0]) });
    setDone(d => d + 1);
    const rest = q.slice(1);
    if (rest.length > 0) { setQueue(rest); return; }
    const items = collected.current;
    if (items.length > 0) {
      const htmls = items.flatMap(i => Array.from({ length: i.n }, () => i.html));
      printLabelsNode(htmls, items[0].w, items[0].h);
      toast.success(`Printing ${htmls.length} label${htmls.length === 1 ? "" : "s"}`);
    }
    setQueue(null);
  };

  const toggle = (key: string) => setOff(prev => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  const rowView = (r: LabelRow) => {
    const on = !off.has(r.key);
    return (
      <div key={r.key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 8px", borderRadius: 7, background: on ? "var(--accent-dim)" : "transparent" }}>
        <input type="checkbox" checked={on} onChange={() => toggle(r.key)} aria-label={`Print labels for ${r.name}`} style={{ cursor: "pointer", flexShrink: 0 }} />
        <div onClick={() => toggle(r.key)} style={{ flex: 1, minWidth: 0, cursor: "pointer" }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)", overflowWrap: "anywhere" }}>{r.name}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", overflowWrap: "anywhere" }}>
            <span style={{ fontFamily: "monospace" }}>{r.code}</span> · {r.qty} on this invoice{r.hasBoxBarcode ? " · box has a barcode" : ""}
          </div>
        </div>
        {optionsOf(r).length > 1 && (
          <select
            value={codeOf(r)}
            disabled={!on}
            onChange={e => setPrintCode(c => ({ ...c, [r.key]: e.target.value }))}
            aria-label={`Barcode for ${r.name}`}
            style={{ ...input, width: 104, flexShrink: 0, padding: "6px 4px", fontSize: 11, opacity: on ? 1 : 0.4 }}
          >
            {optionsOf(r).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        )}
        <input
          type="number" min={0} max={MAX_COPIES}
          value={countOf(r)}
          disabled={!on}
          onChange={e => setCopies(c => ({ ...c, [r.key]: Math.min(MAX_COPIES, Math.max(0, Math.round(Number(e.target.value) || 0))) }))}
          aria-label={`Labels for ${r.name}`}
          style={{ ...input, width: 72, flexShrink: 0, padding: "6px 8px", textAlign: "center", opacity: on ? 1 : 0.4 }}
        />
      </div>
    );
  };

  const section = (kind: Kind, title: string) => {
    const list = rows.filter(r => r.kind === kind);
    if (list.length === 0) return null;
    return (
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 4px 2px" }}>{title} ({list.length})</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>{list.map(rowView)}</div>
      </div>
    );
  };

  return (
    <>
      <Modal
        title={`Print labels · ${detail.invoice.invoiceNo}`}
        subtitle="Each item starts with one label per piece. Change a number, or untick what doesn't need labels."
        onClose={onClose}
        width={640}
        busy={printing}
        footer={!printing && (
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
            <Btn onClick={onClose}>Close</Btn>
            {rows.some(r => r.kind === "part") && (
              <Btn kind={rows.some(r => r.kind === "accessory") ? "quiet" : "primary"} onClick={() => start("part")} disabled={partLabels === 0}>
                <Wrench size={13} /> Print {partLabels} part label{partLabels === 1 ? "" : "s"}
              </Btn>
            )}
            {rows.some(r => r.kind === "accessory") && (
              <Btn kind="primary" onClick={() => start("accessory")} disabled={accessoryLabels === 0}>
                <Printer size={13} /> Print {accessoryLabels} accessory label{accessoryLabels === 1 ? "" : "s"}
              </Btn>
            )}
          </div>
        )}
      >
        {printing ? (
          <div style={{ padding: 24, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, textAlign: "center" }}>
            <Printer size={22} color="var(--accent)" />
            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Preparing item {Math.min(done + 1, jobSize)} of {jobSize}…</p>
            <p style={{ fontSize: 11.5, color: "var(--text-muted)" }}>Keep this page open. They all go to the printer together as one job.</p>
          </div>
        ) : rows.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
            {missing ? "Still loading these items. Close this and try again in a moment." : "This invoice has no items to label yet."}
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {boxBarcodes > 0 && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", fontSize: 12, color: "var(--text-secondary)" }}>
                <span>{boxBarcodes} item{boxBarcodes === 1 ? " has" : "s have"} a barcode on the box, which already scans.</span>
                <Btn onClick={() => setOff(new Set(rows.filter(r => r.hasBoxBarcode).map(r => r.key)))} style={{ padding: "5px 9px", fontSize: 11.5 }}>Skip those</Btn>
              </div>
            )}
            {section("accessory", "Accessories")}
            {section("part", "Repair parts")}
            {rows.some(r => r.kind === "part") && rows.some(r => r.kind === "accessory") && (
              <p style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                Accessories and parts print separately, so you can load the right label roll for each.
              </p>
            )}
          </div>
        )}
      </Modal>
      {current?.kind === "accessory" && (
        <BarcodeLabelModal
          key={current.key}
          variant="accessory"
          code={codeOf(current)}
          title={current.product.name}
          subtitle={`${current.product.brand} · ${current.product.model}`}
          price={Rs(current.product.sellingPrice)}
          accessory={{ itemCode: current.product.code, brand: current.product.brand, model: current.product.model, category: current.product.category }}
          silent
          onReady={handleReady}
          onClose={() => {}}
        />
      )}
      {current?.kind === "part" && (
        <BarcodeLabelModal
          key={current.key}
          variant="part"
          code={codeOf(current)}
          displayCode={current.part.sku}
          title={current.part.name}
          subtitle={current.part.category}
          part={partLabelTokens(current.part)}
          silent
          onReady={handleReady}
          onClose={() => {}}
        />
      )}
    </>
  );
}
