"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Smartphone, Package, AlertTriangle, XCircle,
  Plus, Search, Edit2, Trash2, X, Check,
  BarChart3, ArrowUpCircle, ArrowDownCircle, Sliders,
  ChevronDown, ChevronRight, ShieldAlert, Truck, Tag, CornerDownRight, Wrench, Layers, Printer,
} from "lucide-react";
import StockReceiving from "./StockReceiving";
import { useInventory, type Category, type Subcategory } from "@/cashier/contexts/InventoryContext";
import { useAuth } from "@/lib/auth/AuthContext";
import { useAccessories, type AccessoryProduct } from "@/cashier/contexts/AccessoriesContext";
import { useDevices, type DeviceRecord } from "@/cashier/contexts/DevicesContext";
import { useIsMobile } from "@/cashier/hooks/useIsMobile";
import BarcodeLabelModal from "@/cashier/components/shared/BarcodeLabelModal";
import { printLabelsNode } from "@/cashier/utils/printLabel";
import { useToast } from "@/lib/ui/toast";
import { useTableSort, SortHeader } from "@/lib/ui/useTableSort";
import RepairPartsManager from "@/admin/components/inventory/RepairPartsManager";

// ─── Types ────────────────────────────────────────────────────────────────────

type DeviceItem = DeviceRecord;

interface ApprovalRequest {
  entityType: "category" | "subcategory" | "brand" | "supplier";
  newName: string;
  /** The subcategory/brand's parent category name, when entityType needs one. */
  presetCategoryName?: string;
  presetBrandName?: string;
  suggestedBrandType?: "device" | "accessory";
}

type InventoryTab = "Overview" | "Mobile Devices" | "Accessories" | "Repair Parts" | "Stock Receiving";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const Rs = (n: number) => `Rs.${n.toLocaleString()}`;
const marginPct = (buy: number, sell: number) => (buy > 0 ? Math.round(((sell - buy) / buy) * 100) : 0);

// ─── Mobile Devices grouping helpers ───────────────────────────────────────────
// Several physical units (each its own IMEI) can be the same phone model,
// bought in one Bulk Add batch or restocked later. These fields are what
// makes two units "the same model" for display — price/supplier are
// deliberately excluded so a later restock at a different cost doesn't
// splinter the group.
function deviceGroupKey(d: DeviceRecord): string {
  return [d.brand, d.modelNumber, d.name, d.storage, d.ram, d.color]
    .map(s => (s ?? "").trim().toLowerCase())
    .join("|||");
}

/** Min/max across a group's units for a numeric field — `uniform` is true when every unit agrees. */
function numRange(units: DeviceRecord[], get: (d: DeviceRecord) => number) {
  const vals = units.map(get);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  return { uniform: min === max, value: vals[0], min, max };
}

/** Distinct values across a group's units for a text field — `uniform` is true when every unit agrees. */
function strUniform(units: DeviceRecord[], get: (d: DeviceRecord) => string) {
  const distinct = Array.from(new Set(units.map(u => get(u).trim())));
  return { uniform: distinct.length <= 1, value: distinct[0] ?? "", distinct };
}

const inputStyle: React.CSSProperties = {
  background: "var(--bg-surface)", border: "1px solid var(--border)",
  borderRadius: 8, padding: "9px 12px", color: "var(--text-primary)",
  fontSize: 13, width: "100%", outline: "none",
  fontFamily: "'Plus Jakarta Sans', sans-serif", boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: "var(--text-muted)",
  textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 5, display: "block",
};

const thStyle: React.CSSProperties = {
  padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700,
  color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em",
  whiteSpace: "nowrap", background: "var(--bg-surface)", borderBottom: "1px solid var(--border)",
};

const tdBase: React.CSSProperties = {
  padding: "11px 14px", fontSize: 12.5, color: "var(--text-primary)",
  borderBottom: "1px solid var(--border)", fontFamily: "'Plus Jakarta Sans', sans-serif",
};

const selectStyle: React.CSSProperties = {
  background: "var(--bg-surface)", border: "1px solid var(--border)",
  borderRadius: 8, padding: "8px 12px", color: "var(--text-primary)",
  fontSize: 13, cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif", outline: "none",
};

function getCategoryAbbr(cat: string): string {
  return cat.split(/[\s/\-–]+/).filter(w => w.length > 0).map(w => w[0].toUpperCase()).join("");
}

function generateCode(cat: string, existing: AccessoryProduct[]): string {
  const abbr = getCategoryAbbr(cat);
  if (!abbr) return "";
  const re = new RegExp(`^${abbr}-(\\d+)$`);
  let max = 0;
  for (const p of existing) {
    const m = p.code.match(re);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${abbr}-${String(max + 1).padStart(3, "0")}`;
}

// ─── ComboField ───────────────────────────────────────────────────────────────

interface ComboFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  entityType: "category" | "subcategory" | "brand" | "supplier";
  onNewRequest: (typed: string) => void;
  onPromptChange?: (active: boolean) => void;
  error?: string;
  disabled?: boolean;
  placeholder?: string;
}

function ComboField({ label, value, onChange, options, entityType, onNewRequest, onPromptChange, error, disabled, placeholder }: ComboFieldProps) {
  const [open, setOpen] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  const justSelected = useRef(false);
  const promptRef = useRef(onPromptChange);
  promptRef.current = onPromptChange;

  const entityLabel = entityType === "category" ? "Category" : entityType === "subcategory" ? "Subcategory" : entityType === "brand" ? "Brand" : "Supplier";

  const setPrompt = useCallback((v: boolean) => {
    setShowPrompt(v);
    promptRef.current?.(v);
  }, []);

  const filtered = useMemo(() => {
    if (!value.trim()) return options;
    const q = value.toLowerCase();
    return options.filter(o => o.toLowerCase().includes(q));
  }, [value, options]);

  useEffect(() => {
    if (!value) { setPrompt(false); setOpen(false); }
    else if (options.includes(value)) setPrompt(false);
  }, [value, options, setPrompt]);

  // When the field is blocked by another field's mismatch (disabled=true externally)
  // but this field owns the prompt, keep it interactive by ignoring the disabled prop.
  const isActuallyDisabled = disabled && !showPrompt;

  function openDrop() {
    const rect = inputRef.current?.getBoundingClientRect();
    if (rect) setDropPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    setOpen(true);
    setPrompt(false);
  }

  function handleBlur() {
    setTimeout(() => {
      if (justSelected.current) { justSelected.current = false; return; }
      setOpen(false);
      const cur = inputRef.current?.value ?? "";
      if (cur.trim() && !options.includes(cur)) setPrompt(true);
    }, 150);
  }

  function selectOption(opt: string) {
    justSelected.current = true;
    onChange(opt);
    setOpen(false);
    setPrompt(false);
  }

  const disabledPlaceholder = entityType === "brand" || entityType === "subcategory" ? "Select category first" : "Select brand first";

  return (
    <div style={{ position: "relative" }}>
      <label style={labelStyle}>{label}</label>
      <div style={{ position: "relative" }}>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={e => { onChange(e.target.value); setPrompt(false); }}
          onFocus={openDrop}
          onBlur={handleBlur}
          disabled={isActuallyDisabled}
          placeholder={isActuallyDisabled ? disabledPlaceholder : (placeholder ?? `Type or select ${entityLabel}…`)}
          style={{
            ...inputStyle, paddingRight: 32,
            borderColor: error ? "#dc2626" : showPrompt ? "#f59e0b" : "var(--border)",
            opacity: isActuallyDisabled ? 0.5 : 1,
            cursor: isActuallyDisabled ? "not-allowed" : "text",
          }}
        />
        <ChevronDown size={14} style={{
          position: "absolute", right: 10, top: "50%",
          transform: `translateY(-50%) rotate(${open ? 180 : 0}deg)`,
          color: "var(--text-muted)", pointerEvents: "none", transition: "transform 0.15s",
        }} />
      </div>

      {open && filtered.length > 0 && createPortal(
        <div style={{
          position: "fixed", top: dropPos.top, left: dropPos.left, width: dropPos.width,
          zIndex: 1200,
          background: "var(--bg-card)", border: "1px solid var(--border)",
          borderRadius: 8, maxHeight: 160, overflowY: "auto",
          boxShadow: "0 4px 24px rgba(0,0,0,0.25)",
          fontFamily: "'Plus Jakarta Sans', sans-serif",
        }}>
          {filtered.map(opt => (
            <div
              key={opt}
              onMouseDown={e => e.preventDefault()}
              onClick={() => selectOption(opt)}
              style={{
                padding: "9px 14px", fontSize: 13, cursor: "pointer",
                color: opt === value ? "var(--accent)" : "var(--text-primary)",
                background: opt === value ? "var(--accent-dim)" : "transparent",
              }}
              onMouseEnter={e => { if (opt !== value) (e.currentTarget as HTMLDivElement).style.background = "var(--bg-surface)"; }}
              onMouseLeave={e => { if (opt !== value) (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
            >
              {opt}
            </div>
          ))}
        </div>,
        document.body
      )}

      {showPrompt && (
        <div style={{
          marginTop: 4, padding: "7px 12px", borderRadius: 8,
          background: "#fffbeb", border: "1px solid #fcd34d",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
        }}>
          <span style={{ fontSize: 12, color: "#92400e", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            No {entityLabel} found. Is &quot;{value}&quot; new?
          </span>
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => { setPrompt(false); onNewRequest(value); }}
              style={{ padding: "3px 10px", borderRadius: 6, border: "none", background: "#d97706", color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              Yes
            </button>
            <button
              type="button"
              onClick={() => { onChange(""); setPrompt(false); }}
              style={{ padding: "3px 10px", borderRadius: 6, border: "1px solid #fcd34d", background: "transparent", color: "#92400e", fontSize: 11, cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              No
            </button>
          </div>
        </div>
      )}

      {error && <div style={{ fontSize: 11, color: "#dc2626", marginTop: 3 }}>{error}</div>}
      {!error && !isActuallyDisabled && options.length === 0 && (
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>No {entityLabel.toLowerCase()}s — type a name to add one</div>
      )}
    </div>
  );
}

// ─── Model Number autofill ──────────────────────────────────────────────────

/** The fields a model number carries besides the three per-unit identifiers
 *  (IMEI, IMEI 2, serial number) — those stay per-unit and are never part of
 *  this lookup or auto-filled from it. */
interface ModelSpecs {
  brand: string;
  name: string;
  storage: string;
  ram: string;
  color: string;
  buyingPrice: number;
  suggestedPrice: number;
  minSellingPrice: number;
  supplier: string;
}

/** True when `a` was added more recently than `b` — by addedDate, tie-broken
 *  by the higher numeric id as a proxy for insertion order when two devices
 *  share a date. */
function isMoreRecentDevice(a: DeviceItem, b: DeviceItem): boolean {
  if (a.addedDate !== b.addedDate) return a.addedDate > b.addedDate;
  return a.id > b.id;
}

/**
 * Model numbers aren't a reference table like brand/category/supplier — they
 * are whatever has already been typed into existing devices. This derives a
 * lookup from model number (trimmed, case-insensitive) to the shared specs of
 * the most recently added device carrying that model number, so re-stocking
 * a model you've entered before can fill in brand/name/storage/etc. from
 * what was saved last time instead of retyping it.
 *
 * Devices with a blank model number contribute nothing to the lookup.
 */
function useModelSpecs(devices: DeviceItem[]): { options: string[]; specsByKey: Map<string, ModelSpecs> } {
  return useMemo(() => {
    const bestByKey = new Map<string, DeviceItem>();
    for (const d of devices) {
      const raw = d.modelNumber.trim();
      if (!raw) continue;
      const key = raw.toLowerCase();
      const existing = bestByKey.get(key);
      if (!existing || isMoreRecentDevice(d, existing)) bestByKey.set(key, d);
    }

    const specsByKey = new Map<string, ModelSpecs>();
    const options: string[] = [];
    for (const [key, d] of bestByKey) {
      options.push(d.modelNumber.trim());
      specsByKey.set(key, {
        brand: d.brand, name: d.name, storage: d.storage, ram: d.ram, color: d.color,
        buyingPrice: d.buyingPrice, suggestedPrice: d.suggestedPrice, minSellingPrice: d.minSellingPrice,
        supplier: d.supplier,
      });
    }
    options.sort((a, b) => a.localeCompare(b));

    return { options, specsByKey };
  }, [devices]);
}

interface ModelNumberFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  specsByKey: Map<string, ModelSpecs>;
  /** Called with the matched model's stored specs when the user picks a
   *  suggestion, or blurs the field with a value that exactly (case-
   *  insensitively) matches a known model number. Omit to disable auto-fill
   *  entirely (e.g. while editing an existing device, where overwriting its
   *  already-saved fields would be a destructive surprise). */
  onAutoFill?: (specs: ModelSpecs) => void;
  disabled?: boolean;
  error?: string;
}

/**
 * A plain-text input with a filtered suggestion dropdown of model numbers
 * already seen on existing devices — same visual language and portal
 * positioning as ComboField's dropdown, but without its "is this new?"
 * approval prompt: a brand-new model number is always valid as typed, so
 * there is nothing here to gate.
 */
function ModelNumberField({ label, value, onChange, options, specsByKey, onAutoFill, disabled, error }: ModelNumberFieldProps) {
  const [open, setOpen] = useState(false);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  const justSelected = useRef(false);

  const filtered = useMemo(() => {
    if (!value.trim()) return options;
    const q = value.toLowerCase();
    return options.filter(o => o.toLowerCase().includes(q));
  }, [value, options]);

  function openDrop() {
    const rect = inputRef.current?.getBoundingClientRect();
    if (rect) setDropPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    setOpen(true);
  }

  function tryAutoFill(typed: string) {
    const specs = specsByKey.get(typed.trim().toLowerCase());
    if (specs) onAutoFill?.(specs);
  }

  function handleBlur() {
    setTimeout(() => {
      if (justSelected.current) { justSelected.current = false; return; }
      setOpen(false);
      tryAutoFill(inputRef.current?.value ?? "");
    }, 150);
  }

  function selectOption(opt: string) {
    justSelected.current = true;
    onChange(opt);
    setOpen(false);
    tryAutoFill(opt);
  }

  return (
    <div style={{ position: "relative" }}>
      <label style={labelStyle}>{label}</label>
      <div style={{ position: "relative" }}>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={openDrop}
          onBlur={handleBlur}
          disabled={disabled}
          style={{
            ...inputStyle, paddingRight: 32,
            borderColor: error ? "#dc2626" : "var(--border)",
            opacity: disabled ? 0.45 : 1,
            cursor: disabled ? "not-allowed" : "text",
          }}
        />
        <ChevronDown size={14} style={{
          position: "absolute", right: 10, top: "50%",
          transform: `translateY(-50%) rotate(${open ? 180 : 0}deg)`,
          color: "var(--text-muted)", pointerEvents: "none", transition: "transform 0.15s",
        }} />
      </div>

      {open && filtered.length > 0 && createPortal(
        <div style={{
          position: "fixed", top: dropPos.top, left: dropPos.left, width: dropPos.width,
          zIndex: 1200,
          background: "var(--bg-card)", border: "1px solid var(--border)",
          borderRadius: 8, maxHeight: 160, overflowY: "auto",
          boxShadow: "0 4px 24px rgba(0,0,0,0.25)",
          fontFamily: "'Plus Jakarta Sans', sans-serif",
        }}>
          {filtered.map(opt => (
            <div
              key={opt}
              onMouseDown={e => e.preventDefault()}
              onClick={() => selectOption(opt)}
              style={{
                padding: "9px 14px", fontSize: 13, cursor: "pointer",
                color: opt === value ? "var(--accent)" : "var(--text-primary)",
                background: opt === value ? "var(--accent-dim)" : "transparent",
              }}
              onMouseEnter={e => { if (opt !== value) (e.currentTarget as HTMLDivElement).style.background = "var(--bg-surface)"; }}
              onMouseLeave={e => { if (opt !== value) (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
            >
              {opt}
            </div>
          ))}
        </div>,
        document.body
      )}

      {error && <div style={{ fontSize: 11, color: "#dc2626", marginTop: 3 }}>{error}</div>}
    </div>
  );
}

// ─── CategoryComboField ───────────────────────────────────────────────────────

/**
 * Category and subcategory in a single dropdown.
 *
 * They used to be two ComboFields side by side, and the second one spent most
 * of its life greyed out reading "Select category first" — a field whose main
 * job was telling you it was not usable yet. It is really one decision, so it
 * is now one control: the list shows the main categories, and a category opens
 * to reveal the subcategories filed under it.
 *
 * Clicking a main category selects it and opens it, leaving the dropdown up —
 * you have narrowed the choice, not finished it. Clicking a subcategory
 * finishes and closes. A category with nothing under it has nothing left to
 * offer, so that one closes too.
 */
function CategoryComboField({
  categories, subcategories, category, subcategory, onPick,
  error, disabled, onPromptChange, onNewCategory, onNewSubcategory,
}: {
  categories: Category[];
  subcategories: Subcategory[];
  category: string;
  subcategory: string;
  onPick: (category: string, subcategory: string) => void;
  error?: string;
  disabled?: boolean;
  onPromptChange?: (active: boolean) => void;
  onNewCategory: (typed: string) => void;
  onNewSubcategory: (typed: string, parentCategory: string) => void;
}) {
  const [open, setOpen] = useState(false);
  // null means "showing the current selection"; a string means the user is
  // typing, and the input is a search box until they leave it.
  const [query, setQuery] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [prompt, setPromptText] = useState<string | null>(null);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  const justSelected = useRef(false);

  // The form greys out its other fields while an unknown name is pending, so
  // the parent hears about the prompt at the same moment it is raised.
  const setPrompt = (v: string | null) => {
    setPromptText(v);
    onPromptChange?.(v !== null);
  };

  const live = useMemo(() => categories.filter(c => c.active), [categories]);
  const label = category ? (subcategory ? `${category} \u2192 ${subcategory}` : category) : "";

  /**
   * The list as drawn: every category that matches, or that holds a matching
   * subcategory. A search hit inside a fold opens the fold — otherwise the
   * only visible result of typing a subcategory's name would be its parent,
   * still shut.
   */
  const tree = useMemo(() => {
    const q = (query ?? "").trim().toLowerCase();
    return live.map(c => {
      const subs = subcategories.filter(s => s.active && s.categoryId === c.id);
      const catHit = !q || c.name.toLowerCase().includes(q);
      const subHits = q ? subs.filter(s => s.name.toLowerCase().includes(q)) : subs;
      return {
        cat: c,
        subs: catHit ? subs : subHits,
        forceOpen: !!q && subHits.length > 0,
        show: catHit || subHits.length > 0,
      };
    }).filter(n => n.show);
  }, [live, subcategories, query]);

  const isActuallyDisabled = disabled && prompt === null;

  // Reopening lands on whatever is already chosen, so the current pick is on
  // screen rather than somewhere down a list the user has to find again.
  function openDrop() {
    const rect = inputRef.current?.getBoundingClientRect();
    if (rect) setDropPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    setExpandedId(live.find(c => c.name === category)?.id ?? null);
    setQuery("");
    setOpen(true);
    setPrompt(null);
  }

  function handleBlur() {
    setTimeout(() => {
      if (justSelected.current) { justSelected.current = false; return; }
      setOpen(false);
      const typed = (query ?? "").trim();
      setQuery(null);
      // Nothing anywhere in the tree matches what they typed, so it is either
      // a typo or something that does not exist yet. Offer to add it.
      const known = live.some(c => c.name.toLowerCase() === typed.toLowerCase())
        || subcategories.some(s => s.name.toLowerCase() === typed.toLowerCase());
      setPrompt(typed && !known ? typed : null);
    }, 150);
  }

  function pickCategory(c: Category, hasSubs: boolean) {
    onPick(c.name, "");
    setExpandedId(c.id);
    setPrompt(null);
    if (hasSubs) {
      // Still mid-decision — the list stays up. The guard is deliberately NOT
      // armed here: the row suppresses mousedown so focus never left, meaning
      // there is no pending blur to swallow, and an armed guard would instead
      // eat the real blur later and leave the dropdown stuck open.
      justSelected.current = false;
      setQuery("");
    } else {
      justSelected.current = true;
      setQuery(null);
      setOpen(false);
    }
  }

  function pickSubcategory(c: Category, sub: Subcategory) {
    justSelected.current = true;
    onPick(c.name, sub.name);
    setQuery(null);
    setOpen(false);
    setPrompt(null);
  }

  const rowBase: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 8, width: "100%",
    padding: "9px 12px", fontSize: 13, cursor: "pointer", textAlign: "left",
    background: "transparent", border: "none",
    fontFamily: "'Plus Jakarta Sans', sans-serif",
  };

  return (
    <div style={{ position: "relative" }}>
      <label style={labelStyle}>Item Category &amp; Subcategory</label>
      <div style={{ position: "relative" }}>
        <input
          ref={inputRef}
          type="text"
          value={query ?? label}
          onChange={e => { setQuery(e.target.value); setPrompt(null); }}
          onFocus={openDrop}
          onBlur={handleBlur}
          disabled={isActuallyDisabled}
          placeholder={isActuallyDisabled ? "Unavailable" : "Search or pick a category\u2026"}
          style={{
            ...inputStyle, paddingRight: 32,
            borderColor: error ? "#dc2626" : prompt !== null ? "#f59e0b" : "var(--border)",
            opacity: isActuallyDisabled ? 0.5 : 1,
            cursor: isActuallyDisabled ? "not-allowed" : "text",
          }}
        />
        <ChevronDown size={14} style={{
          position: "absolute", right: 10, top: "50%",
          transform: `translateY(-50%) rotate(${open ? 180 : 0}deg)`,
          color: "var(--text-muted)", pointerEvents: "none", transition: "transform 0.15s",
        }} />
      </div>

      {open && createPortal(
        <div style={{
          position: "fixed", top: dropPos.top, left: dropPos.left, width: dropPos.width,
          zIndex: 1200,
          background: "var(--bg-card)", border: "1px solid var(--border)",
          borderRadius: 8, maxHeight: 260, overflowY: "auto",
          boxShadow: "0 4px 24px rgba(0,0,0,0.25)",
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          padding: "4px 0",
        }}>
          {tree.length === 0 && (
            <div style={{ padding: "10px 14px", fontSize: 12, color: "var(--text-muted)" }}>
              No match. Leave the field to add it as something new.
            </div>
          )}

          {tree.map(({ cat, subs, forceOpen }) => {
            const isOpen = forceOpen || expandedId === cat.id;
            const isPicked = cat.name === category;
            return (
              <div key={cat.id}>
                <div
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => pickCategory(cat, subs.length > 0)}
                  style={{
                    ...rowBase,
                    fontWeight: 600,
                    color: isPicked ? "var(--accent)" : "var(--text-primary)",
                    background: isPicked ? "var(--accent-dim)" : "transparent",
                  }}
                  onMouseEnter={e => { if (!isPicked) (e.currentTarget as HTMLDivElement).style.background = "var(--bg-surface)"; }}
                  onMouseLeave={e => { if (!isPicked) (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
                >
                  {subs.length > 0
                    ? (isOpen ? <ChevronDown size={13} style={{ flexShrink: 0, opacity: 0.7 }} />
                              : <ChevronRight size={13} style={{ flexShrink: 0, opacity: 0.7 }} />)
                    : <span style={{ width: 13, flexShrink: 0 }} />}
                  <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cat.name}</span>
                  {/* A category with none is a dead end worth flagging here —
                      the form still asks for a subcategory. */}
                  <span style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0 }}>
                    {subs.length > 0 ? subs.length : "none"}
                  </span>
                </div>

                {isOpen && subs.map(sub => {
                  const subPicked = isPicked && sub.name === subcategory;
                  return (
                    <div
                      key={sub.id}
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => pickSubcategory(cat, sub)}
                      style={{
                        ...rowBase,
                        paddingLeft: 26, fontSize: 12.5,
                        color: subPicked ? "var(--accent)" : "var(--text-secondary)",
                        background: subPicked ? "var(--accent-dim)" : "transparent",
                      }}
                      onMouseEnter={e => { if (!subPicked) (e.currentTarget as HTMLDivElement).style.background = "var(--bg-surface)"; }}
                      onMouseLeave={e => { if (!subPicked) (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
                    >
                      <CornerDownRight size={12} style={{ flexShrink: 0, opacity: 0.55 }} />
                      <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub.name}</span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>,
        document.body
      )}

      {/* One dropdown means the typed name could be either level, so both are
          offered — but only where each makes sense. Nothing is under a
          category that has not been chosen yet. */}
      {prompt !== null && (
        <div style={{
          marginTop: 4, padding: "7px 12px", borderRadius: 8,
          background: "#fffbeb", border: "1px solid #fcd34d",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap",
        }}>
          <span style={{ fontSize: 12, color: "#92400e", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            No match for &quot;{prompt}&quot;. Add it as…
          </span>
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => { const t = prompt; setPrompt(null); onNewCategory(t); }}
              style={{ padding: "3px 10px", borderRadius: 6, border: "none", background: "#d97706", color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              Category
            </button>
            {category && (
              <button
                type="button"
                onClick={() => { const t = prompt; setPrompt(null); onNewSubcategory(t, category); }}
                style={{ padding: "3px 10px", borderRadius: 6, border: "none", background: "#d97706", color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                Under {category}
              </button>
            )}
            <button
              type="button"
              onClick={() => setPrompt(null)}
              style={{ padding: "3px 10px", borderRadius: 6, border: "1px solid #fcd34d", background: "transparent", color: "#92400e", fontSize: 11, cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && <div style={{ fontSize: 11, color: "#dc2626", marginTop: 3 }}>{error}</div>}
      {!error && live.length === 0 && (
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>No categories — type a name to add one</div>
      )}
    </div>
  );
}

// ─── Local Chip Group (used inside AdminApprovalModal) ────────────────────────

function LocalChipGroup({ options, selected, onChange }: {
  options: { id: number; name: string }[];
  selected: number[];
  onChange: (ids: number[]) => void;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {options.map(opt => {
        const on = selected.includes(opt.id);
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(on ? selected.filter(id => id !== opt.id) : [...selected, opt.id])}
            style={{
              padding: "4px 12px", borderRadius: 20, fontSize: 12, cursor: "pointer",
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              border: on ? "1px solid var(--accent-glow)" : "1px solid var(--border)",
              background: on ? "var(--accent-dim)" : "transparent",
              color: on ? "var(--accent)" : "var(--text-secondary)",
              fontWeight: on ? 600 : 400,
            }}
          >
            {opt.name}
          </button>
        );
      })}
    </div>
  );
}

// ─── Admin Approval Modal ─────────────────────────────────────────────────────

function AdminApprovalModal({ request, onEntityAdded, onClose }: {
  request: ApprovalRequest;
  onEntityAdded: (entityType: ApprovalRequest["entityType"], name: string) => void;
  onClose: () => void;
}) {
  const { adminCredentials, brands, categories, addCategory, addSubcategory, addBrand, addSupplier } = useInventory();
  // Admin and Cashier are both trusted to add a new brand/category/supplier
  // on their own login — asking them to re-type a second, separate admin
  // password here is friction with no security benefit. Only roles that
  // don't manage inventory (Technician, Accounts, POS Cashier) still hand
  // this off to someone who can.
  const { can } = useAuth();
  const canSkipApproval = can("Admin", "Cashier");

  const [step, setStep] = useState<"auth" | "add">(canSkipApproval ? "add" : "auth");
  const [authUser, setAuthUser] = useState("");
  const [authPass, setAuthPass] = useState("");
  const [authError, setAuthError] = useState("");
  const [saving, setSaving] = useState(false);

  // Category form
  const [catName, setCatName] = useState(request.newName);

  // Subcategory form
  const [subName, setSubName] = useState(request.newName);
  const presetCategory = useMemo(
    () => categories.find(c => c.name === request.presetCategoryName),
    [categories, request.presetCategoryName],
  );

  // Brand form
  const [brandName, setBrandName] = useState(request.newName);
  const [brandType, setBrandTypeState] = useState<"device" | "accessory" | "both">(request.suggestedBrandType ?? "accessory");
  const [brandCatIds, setBrandCatIds] = useState<number[]>(() => {
    if (request.presetCategoryName) {
      const c = categories.find(x => x.name === request.presetCategoryName);
      return c ? [c.id] : [];
    }
    return [];
  });

  // Supplier form
  const [suppName, setSuppName] = useState(request.newName);
  const [suppPhone, setSuppPhone] = useState("");
  const [suppEmail, setSuppEmail] = useState("");
  const [suppBrandIds, setSuppBrandIds] = useState<number[]>(() => {
    if (request.presetBrandName) {
      const b = brands.find(x => x.name === request.presetBrandName);
      return b ? [b.id] : [];
    }
    return [];
  });

  const [addErrors, setAddErrors] = useState<Record<string, string>>({});

  const entityLabel = request.entityType === "category" ? "Category" : request.entityType === "subcategory" ? "Subcategory" : request.entityType === "brand" ? "Brand" : "Supplier";

  function handleAuth() {
    if (authUser === adminCredentials.username && authPass === adminCredentials.password) {
      setStep("add");
      setAuthError("");
    } else {
      setAuthError("Invalid username or password");
    }
  }

  async function handleSave() {
    const errs: Record<string, string> = {};
    setSaving(true);
    try {
      if (request.entityType === "category") {
        if (!catName.trim()) { errs.name = "Name is required"; setAddErrors(errs); return; }
        const created = await addCategory(catName.trim());
        onEntityAdded("category", created.name);
      } else if (request.entityType === "subcategory") {
        if (!subName.trim()) { errs.name = "Name is required"; setAddErrors(errs); return; }
        if (!presetCategory) { errs.name = "No category selected"; setAddErrors(errs); return; }
        const created = await addSubcategory({ name: subName.trim(), categoryId: presetCategory.id });
        onEntityAdded("subcategory", created.name);
      } else if (request.entityType === "brand") {
        if (!brandName.trim()) { errs.name = "Name is required"; setAddErrors(errs); return; }
        const created = await addBrand({ name: brandName.trim(), type: brandType, categoryIds: brandType === "device" ? [] : brandCatIds });
        onEntityAdded("brand", created.name);
      } else {
        if (!suppName.trim()) { errs.name = "Name is required"; setAddErrors(errs); return; }
        const created = await addSupplier({ name: suppName.trim(), phone: suppPhone.trim(), email: suppEmail.trim(), brandIds: suppBrandIds });
        onEntityAdded("supplier", created.name);
      }
      onClose();
    } catch (e) {
      setAddErrors({ name: e instanceof Error ? e.message : String(e) });
    } finally {
      setSaving(false);
    }
  }

  const iStyle: React.CSSProperties = { ...inputStyle, borderColor: "var(--border)" };

  return createPortal(
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, width: "100%", maxWidth: 460, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

        {/* Header */}
        <div style={{ padding: "18px 22px 14px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: "#fef3c7", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ShieldAlert size={16} color="#d97706" />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>
                {step === "auth" ? "Admin Approval Required" : `Add New ${entityLabel}`}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>
                {step === "auth" ? "Verify credentials to continue" : "Fill in the details below"}
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}><X size={16} /></button>
        </div>

        <div style={{ padding: "18px 22px", display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Info strip */}
          <div style={{ padding: "10px 14px", borderRadius: 9, background: "var(--bg-surface)", border: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
            <Plus size={13} color="var(--accent)" />
            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
              Adding new <strong style={{ color: "var(--text-primary)" }}>{entityLabel}</strong>: &quot;{request.newName}&quot;
            </span>
          </div>

          {/* ── Step 1: Auth ── */}
          {step === "auth" && (
            <>
              <div>
                <label style={labelStyle}>Admin Username</label>
                <input type="text" value={authUser} onChange={e => setAuthUser(e.target.value)} placeholder="Enter admin username" style={iStyle} autoFocus />
              </div>
              <div>
                <label style={labelStyle}>Admin Password</label>
                <input type="password" value={authPass} onChange={e => setAuthPass(e.target.value)} placeholder="Enter admin password"
                  onKeyDown={e => { if (e.key === "Enter") handleAuth(); }}
                  style={{ ...iStyle, borderColor: authError ? "#dc2626" : "var(--border)" }} />
                {authError && <div style={{ fontSize: 11, color: "#dc2626", marginTop: 3 }}>{authError}</div>}
              </div>
            </>
          )}

          {/* ── Step 2: Add form ── */}
          {step === "add" && request.entityType === "category" && (
            <div>
              <label style={labelStyle}>Category Name</label>
              <input type="text" value={catName} onChange={e => setCatName(e.target.value)} placeholder="e.g. Memory Card"
                style={{ ...iStyle, borderColor: addErrors.name ? "#dc2626" : "var(--border)" }} autoFocus />
              {addErrors.name && <div style={{ fontSize: 11, color: "#dc2626", marginTop: 3 }}>{addErrors.name}</div>}
            </div>
          )}

          {step === "add" && request.entityType === "subcategory" && (
            <div>
              <label style={labelStyle}>Under Category</label>
              <div style={{ padding: "9px 12px", borderRadius: 8, background: "var(--bg-surface)", border: "1px solid var(--border)", fontSize: 13, color: "var(--text-primary)", fontWeight: 600, marginBottom: 12 }}>
                {request.presetCategoryName || "—"}
              </div>
              <label style={labelStyle}>Subcategory Name</label>
              <input type="text" value={subName} onChange={e => setSubName(e.target.value)} placeholder="e.g. Type-C"
                style={{ ...iStyle, borderColor: addErrors.name ? "#dc2626" : "var(--border)" }} autoFocus />
              {addErrors.name && <div style={{ fontSize: 11, color: "#dc2626", marginTop: 3 }}>{addErrors.name}</div>}
            </div>
          )}

          {step === "add" && request.entityType === "brand" && (
            <>
              <div>
                <label style={labelStyle}>Brand Name</label>
                <input type="text" value={brandName} onChange={e => setBrandName(e.target.value)} placeholder="e.g. Belkin"
                  style={{ ...iStyle, borderColor: addErrors.name ? "#dc2626" : "var(--border)" }} autoFocus />
                {addErrors.name && <div style={{ fontSize: 11, color: "#dc2626", marginTop: 3 }}>{addErrors.name}</div>}
              </div>
              <div>
                <label style={labelStyle}>Brand Type</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {(["device", "accessory", "both"] as const).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => { setBrandTypeState(t); if (t === "device") setBrandCatIds([]); }}
                      style={{
                        flex: 1, padding: "8px 6px", borderRadius: 8, fontSize: 12, cursor: "pointer",
                        fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: brandType === t ? 700 : 400,
                        border: brandType === t ? "1px solid var(--accent-glow)" : "1px solid var(--border)",
                        background: brandType === t ? "var(--accent-dim)" : "transparent",
                        color: brandType === t ? "var(--accent)" : "var(--text-secondary)",
                        textTransform: "capitalize",
                      }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              {(brandType === "accessory" || brandType === "both") && (
                <div>
                  <label style={labelStyle}>Accessory Categories</label>
                  {categories.length === 0
                    ? <p style={{ fontSize: 12, color: "var(--text-muted)" }}>No categories yet</p>
                    : <LocalChipGroup options={categories} selected={brandCatIds} onChange={setBrandCatIds} />
                  }
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 5 }}>Leave empty = appears in all categories</div>
                </div>
              )}
            </>
          )}

          {step === "add" && request.entityType === "supplier" && (
            <>
              <div>
                <label style={labelStyle}>Supplier Name</label>
                <input type="text" value={suppName} onChange={e => setSuppName(e.target.value)} placeholder="e.g. ElectroHub PVT"
                  style={{ ...iStyle, borderColor: addErrors.name ? "#dc2626" : "var(--border)" }} autoFocus />
                {addErrors.name && <div style={{ fontSize: 11, color: "#dc2626", marginTop: 3 }}>{addErrors.name}</div>}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Phone (optional)</label>
                  <input type="text" value={suppPhone} onChange={e => setSuppPhone(e.target.value)} placeholder="+94 77 000 0000" style={iStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Email (optional)</label>
                  <input type="text" value={suppEmail} onChange={e => setSuppEmail(e.target.value)} placeholder="orders@supplier.lk" style={iStyle} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Brands Supplied</label>
                {brands.length === 0
                  ? <p style={{ fontSize: 12, color: "var(--text-muted)" }}>No brands yet</p>
                  : <LocalChipGroup options={brands} selected={suppBrandIds} onChange={setSuppBrandIds} />
                }
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 5 }}>Leave empty = supplies all brands</div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "14px 22px 18px", borderTop: "1px solid var(--border)", display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "8px 18px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer", fontSize: 13, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Cancel</button>
          {step === "auth"
            ? <button onClick={handleAuth} style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "var(--accent)", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Verify →</button>
            : <button onClick={() => { if (!saving) void handleSave(); }} disabled={saving} style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "var(--accent)", color: "#fff", cursor: saving ? "wait" : "pointer", fontSize: 13, fontWeight: 600, fontFamily: "'Plus Jakarta Sans', sans-serif", opacity: saving ? 0.7 : 1 }}>{saving ? "Saving…" : `Save ${entityLabel}`}</button>
          }
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────

function DeleteConfirmModal({ name, onConfirm, onClose }: {
  name: string; onConfirm: () => void; onClose: () => void;
}) {
  return createPortal(
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: 28, width: 380, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: "#fee2e2", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Trash2 size={16} color="#dc2626" />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>Delete Item</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>This action cannot be undone</div>
          </div>
        </div>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 20, lineHeight: 1.5 }}>
          Are you sure you want to remove <strong style={{ color: "var(--text-primary)" }}>{name}</strong> from inventory?
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "8px 18px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer", fontSize: 13, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Cancel</button>
          <button onClick={onConfirm} style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "#dc2626", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Delete</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Add / Edit Device Modal ──────────────────────────────────────────────────

function AddEditDeviceModal({ device, devices, onSave, onClose }: {
  device: DeviceItem | null; devices: DeviceItem[]; onSave: (d: DeviceItem) => Promise<unknown>; onClose: () => void;
}) {
  const { brands, suppliers } = useInventory();
  const blank: DeviceItem = {
    id: 0, imei: "", imei2: "", serialNumber: "", name: "", modelNumber: "", brand: "",
    storage: "", ram: "", color: "", buyingPrice: 0, minSellingPrice: 0, suggestedPrice: 0,
    supplier: "", addedDate: new Date().toISOString().slice(0, 10), status: "available", notes: "",
  };
  const [form, setForm] = useState<DeviceItem>(device ?? blank);
  const [errors, setErrors] = useState<Partial<Record<keyof DeviceItem, string>>>({});
  const [approvalReq, setApprovalReq] = useState<ApprovalRequest | null>(null);
  const [anyMismatch, setAnyMismatch] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const set = (k: keyof DeviceItem, v: string | number) => setForm(f => ({ ...f, [k]: v }));

  const deviceBrands = useMemo(
    () => brands.filter(b => b.type === "device" || b.type === "both").map(b => b.name).sort(),
    [brands]
  );
  const selectedBrandObj = useMemo(() => brands.find(b => b.name === form.brand), [brands, form.brand]);
  const deviceSuppliers = useMemo(
    () => suppliers
      .filter(s => !selectedBrandObj || s.brandIds.length === 0 || s.brandIds.includes(selectedBrandObj.id))
      .map(s => s.name).sort(),
    [suppliers, selectedBrandObj]
  );

  function handleBrandChange(v: string) { setForm(f => ({ ...f, brand: v, supplier: "" })); }

  function handleEntityAdded(entityType: ApprovalRequest["entityType"], name: string) {
    if (entityType === "brand") setForm(f => ({ ...f, brand: name, supplier: "" }));
    else if (entityType === "supplier") setForm(f => ({ ...f, supplier: name }));
  }

  // Re-stocking a model that already exists: pick its model number once and
  // pull the rest of its spec sheet from the most recently added device that
  // carries it. IMEI / IMEI 2 / serial number are per-unit and never touched
  // here. Editing an existing device never auto-fills — a model number that
  // happens to match another device is not license to overwrite fields this
  // device already has saved.
  const modelSpecs = useModelSpecs(devices);
  function applyModelAutoFill(specs: ModelSpecs) {
    setForm(f => ({
      ...f,
      brand: specs.brand,
      name: specs.name,
      storage: specs.storage,
      ram: specs.ram,
      color: specs.color,
      buyingPrice: specs.buyingPrice,
      suggestedPrice: specs.suggestedPrice,
      minSellingPrice: specs.minSellingPrice,
      supplier: specs.supplier,
    }));
  }

  function validate() {
    const e: typeof errors = {};
    if (!form.imei.trim()) e.imei = "IMEI is required";
    else if (!/^\d{15}$/.test(form.imei.trim())) e.imei = "Must be exactly 15 digits";
    if (!form.name.trim()) e.name = "Device name is required";
    if (!form.brand.trim()) e.brand = "Brand is required";
    if (!form.supplier.trim()) e.supplier = "Supplier is required";
    if (form.buyingPrice <= 0) e.buyingPrice = "Must be greater than 0";
    if (form.minSellingPrice < form.buyingPrice) e.minSellingPrice = "Must be ≥ buying price";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  const field = (label: string, key: keyof DeviceItem, type = "text", placeholder = "") => (
    <div>
      <label style={labelStyle}>{label}</label>
      <input
        type={type}
        value={form[key] as string | number}
        onChange={e => set(key, type === "number" ? Number(e.target.value) : e.target.value)}
        placeholder={placeholder}
        disabled={anyMismatch}
        style={{ ...inputStyle, borderColor: errors[key] ? "#dc2626" : "var(--border)", opacity: anyMismatch ? 0.45 : 1, cursor: anyMismatch ? "not-allowed" : undefined }}
      />
      {errors[key] && <div style={{ fontSize: 11, color: "#dc2626", marginTop: 3 }}>{errors[key]}</div>}
    </div>
  );

  return createPortal(
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: "var(--bg-card)", zIndex: 1 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>{device ? "Edit Device" : "Add New Device"}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>Fill in the device details below</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}><X size={18} /></button>
        </div>
        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {field("IMEI Number", "imei")}
            {field("IMEI 2 (optional)", "imei2")}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {field("Device Name / Model", "name")}
            <ComboField
              label="Brand"
              value={form.brand}
              onChange={handleBrandChange}
              options={deviceBrands}
              entityType="brand"
              error={errors.brand}
              disabled={anyMismatch}
              onPromptChange={setAnyMismatch}
              onNewRequest={v => setApprovalReq({ entityType: "brand", newName: v, suggestedBrandType: "device" })}
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {field("Serial Number (optional)", "serialNumber")}
            <ModelNumberField
              label="Model Number (optional)"
              value={form.modelNumber}
              onChange={v => set("modelNumber", v)}
              options={modelSpecs.options}
              specsByKey={modelSpecs.specsByKey}
              disabled={anyMismatch}
              error={errors.modelNumber}
              onAutoFill={device === null ? applyModelAutoFill : undefined}
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {field("Storage", "storage")}
            {field("RAM (optional)", "ram")}
          </div>
          {field("Color", "color")}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
            {field("Buying Price (Rs.)", "buyingPrice", "number")}
            {field("Min Selling Price (Rs.)", "minSellingPrice", "number")}
            {field("Suggested Price (Rs.)", "suggestedPrice", "number")}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <ComboField
              label="Supplier"
              value={form.supplier}
              onChange={v => set("supplier", v)}
              options={deviceSuppliers}
              entityType="supplier"
              error={errors.supplier}
              disabled={anyMismatch || !form.brand}
              onPromptChange={setAnyMismatch}
              onNewRequest={v => setApprovalReq({ entityType: "supplier", newName: v, presetBrandName: form.brand })}
            />
            {field("Date Added", "addedDate", "date")}
          </div>
          <div>
            <label style={labelStyle}>Status</label>
            <select value={form.status} onChange={e => set("status", e.target.value)} disabled={anyMismatch} style={{ ...inputStyle, opacity: anyMismatch ? 0.45 : 1, cursor: anyMismatch ? "not-allowed" : undefined }}>
              <option value="available">Available</option>
              <option value="reserved">Reserved</option>
              <option value="sold">Sold</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Notes (optional)</label>
            <textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2} disabled={anyMismatch} style={{ ...inputStyle, resize: "vertical", opacity: anyMismatch ? 0.45 : 1 }} />
          </div>
        </div>
        <div style={{ padding: "16px 24px 20px", borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 10, position: "sticky", bottom: 0, background: "var(--bg-card)" }}>
          {saveError && <div style={{ fontSize: 12, color: "#dc2626" }}>{saveError}</div>}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button onClick={onClose} style={{ padding: "9px 20px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer", fontSize: 13, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Cancel</button>
            <button
              onClick={async () => {
                if (anyMismatch || saving || !validate()) return;
                setSaving(true);
                setSaveError(null);
                try {
                  await onSave({ ...form, id: form.id || 0 });
                  onClose();
                } catch (e) {
                  setSaveError(e instanceof Error ? e.message : String(e));
                } finally {
                  setSaving(false);
                }
              }}
              disabled={anyMismatch || saving}
              style={{ padding: "9px 20px", borderRadius: 8, border: "none", background: "var(--accent)", color: "#fff", cursor: anyMismatch || saving ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 600, fontFamily: "'Plus Jakarta Sans', sans-serif", opacity: anyMismatch || saving ? 0.5 : 1 }}
            >
              {saving ? "Saving…" : device ? "Save Changes" : "Add Device"}
            </button>
          </div>
        </div>
      </div>
      {approvalReq && (
        <AdminApprovalModal
          request={approvalReq}
          onEntityAdded={handleEntityAdded}
          onClose={() => setApprovalReq(null)}
        />
      )}
    </div>,
    document.body
  );
}

// ─── Bulk Add Devices Modal ───────────────────────────────────────────────────

/** Every AddEditDeviceModal field except the three per-unit identifiers. */
type BulkSharedSpecs = Omit<DeviceItem, "id" | "imei" | "imei2" | "serialNumber">;

interface BulkRow {
  /** Stable identity for React keys and for matching save results back to a
   *  row — independent of array position, which shifts as rows are added,
   *  removed, or dropped after a successful save. */
  key: number;
  imei: string;
  imei2: string;
  serialNumber: string;
  error?: string;
}

const BULK_INITIAL_ROWS = 3;

function makeBulkRow(key: number): BulkRow {
  return { key, imei: "", imei2: "", serialNumber: "" };
}

function BulkAddDevicesModal({ devices, saveDevice, onClose }: {
  devices: DeviceItem[];
  saveDevice: (d: DeviceItem) => Promise<DeviceItem>;
  onClose: () => void;
}) {
  const { brands, suppliers } = useInventory();

  const blankShared: BulkSharedSpecs = {
    name: "", modelNumber: "", brand: "", storage: "", ram: "", color: "",
    buyingPrice: 0, minSellingPrice: 0, suggestedPrice: 0,
    supplier: "", addedDate: new Date().toISOString().slice(0, 10), status: "available", notes: "",
  };
  const [shared, setShared] = useState<BulkSharedSpecs>(blankShared);
  const [sharedErrors, setSharedErrors] = useState<Partial<Record<keyof BulkSharedSpecs, string>>>({});
  const [approvalReq, setApprovalReq] = useState<ApprovalRequest | null>(null);
  const [anyMismatch, setAnyMismatch] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSummary, setSaveSummary] = useState<string | null>(null);

  const nextKeyRef = useRef(BULK_INITIAL_ROWS);
  const [rows, setRows] = useState<BulkRow[]>(() => Array.from({ length: BULK_INITIAL_ROWS }, (_, i) => makeBulkRow(i)));

  const setSharedField = (k: keyof BulkSharedSpecs, v: string | number) => setShared(s => ({ ...s, [k]: v }));

  const deviceBrands = useMemo(
    () => brands.filter(b => b.type === "device" || b.type === "both").map(b => b.name).sort(),
    [brands]
  );
  const selectedBrandObj = useMemo(() => brands.find(b => b.name === shared.brand), [brands, shared.brand]);
  const deviceSuppliers = useMemo(
    () => suppliers
      .filter(s => !selectedBrandObj || s.brandIds.length === 0 || s.brandIds.includes(selectedBrandObj.id))
      .map(s => s.name).sort(),
    [suppliers, selectedBrandObj]
  );

  function handleBrandChange(v: string) { setShared(s => ({ ...s, brand: v, supplier: "" })); }

  function handleEntityAdded(entityType: ApprovalRequest["entityType"], name: string) {
    if (entityType === "brand") setShared(s => ({ ...s, brand: name, supplier: "" }));
    else if (entityType === "supplier") setShared(s => ({ ...s, supplier: name }));
  }

  // The primary use case for this form: re-stocking a model already entered
  // before. Picking its model number once pulls the rest of the shared specs
  // from the most recently added device carrying it, feeding every row in
  // this batch. Per-unit IMEI / IMEI 2 / serial number are untouched.
  const modelSpecs = useModelSpecs(devices);
  function applyModelAutoFill(specs: ModelSpecs) {
    setShared(s => ({
      ...s,
      brand: specs.brand,
      name: specs.name,
      storage: specs.storage,
      ram: specs.ram,
      color: specs.color,
      buyingPrice: specs.buyingPrice,
      suggestedPrice: specs.suggestedPrice,
      minSellingPrice: specs.minSellingPrice,
      supplier: specs.supplier,
    }));
  }

  function validateShared() {
    const e: typeof sharedErrors = {};
    if (!shared.name.trim()) e.name = "Device name is required";
    if (!shared.brand.trim()) e.brand = "Brand is required";
    if (!shared.supplier.trim()) e.supplier = "Supplier is required";
    if (shared.buyingPrice <= 0) e.buyingPrice = "Must be greater than 0";
    if (shared.minSellingPrice < shared.buyingPrice) e.minSellingPrice = "Must be ≥ buying price";
    setSharedErrors(e);
    return Object.keys(e).length === 0;
  }

  const sharedField = (label: string, key: keyof BulkSharedSpecs, type = "text") => (
    <div>
      <label style={labelStyle}>{label}</label>
      <input
        type={type}
        value={shared[key] as string | number}
        onChange={e => setSharedField(key, type === "number" ? Number(e.target.value) : e.target.value)}
        disabled={anyMismatch}
        style={{ ...inputStyle, borderColor: sharedErrors[key] ? "#dc2626" : "var(--border)", opacity: anyMismatch ? 0.45 : 1, cursor: anyMismatch ? "not-allowed" : undefined }}
      />
      {sharedErrors[key] && <div style={{ fontSize: 11, color: "#dc2626", marginTop: 3 }}>{sharedErrors[key]}</div>}
    </div>
  );

  function updateRow(key: number, patch: Partial<Pick<BulkRow, "imei" | "imei2" | "serialNumber">>) {
    setRows(prev => prev.map(r => (r.key === key ? { ...r, ...patch, error: undefined } : r)));
  }

  function removeRow(key: number) {
    setRows(prev => prev.filter(r => r.key !== key));
  }

  function addRow() {
    setRows(prev => [...prev, makeBulkRow(nextKeyRef.current++)]);
  }

  /**
   * Pasting a multi-line IMEI list (copied from a spreadsheet or a supplier's
   * packing slip) into any IMEI field spreads one value per row — starting at
   * the row pasted into and spilling into new rows as needed — instead of
   * dumping the whole block into a single input. A single-line paste is left
   * to the browser's normal paste behaviour.
   */
  function handleImeiPaste(e: React.ClipboardEvent<HTMLInputElement>, rowKey: number) {
    const text = e.clipboardData.getData("text");
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length <= 1) return;
    e.preventDefault();
    setRows(prev => {
      const next = [...prev];
      const startIdx = next.findIndex(r => r.key === rowKey);
      const base = startIdx === -1 ? next.length : startIdx;
      for (let i = 0; i < lines.length; i++) {
        const idx = base + i;
        if (idx < next.length) next[idx] = { ...next[idx], imei: lines[i], error: undefined };
        else next.push({ ...makeBulkRow(nextKeyRef.current++), imei: lines[i] });
      }
      return next;
    });
  }

  /**
   * Per-row validation plus within-batch duplicate detection (on IMEI, IMEI 2,
   * and serial number). Fully-empty trailing rows are skipped rather than
   * flagged. Returns the row list with `error` populated and the subset that
   * is ready to save.
   */
  function validateAndPrepareRows(current: BulkRow[]) {
    const imeiSeen = new Map<string, number>();
    const imei2Seen = new Map<string, number>();
    const serialSeen = new Map<string, number>();
    const attempted: number[] = [];

    current.forEach((r, i) => {
      if (!r.imei.trim() && !r.imei2.trim() && !r.serialNumber.trim()) return;
      attempted.push(i);
      const imei = r.imei.trim();
      if (imei) imeiSeen.set(imei, (imeiSeen.get(imei) ?? 0) + 1);
      const imei2 = r.imei2.trim();
      if (imei2) imei2Seen.set(imei2, (imei2Seen.get(imei2) ?? 0) + 1);
      const serial = r.serialNumber.trim();
      if (serial) serialSeen.set(serial, (serialSeen.get(serial) ?? 0) + 1);
    });

    const attemptedSet = new Set(attempted);
    const updated = current.map((r, i) => {
      if (!attemptedSet.has(i)) return r.error ? { ...r, error: undefined } : r;
      const imei = r.imei.trim();
      let error: string | undefined;
      if (!imei) error = "IMEI is required";
      else if (!/^\d{15}$/.test(imei)) error = "IMEI must be exactly 15 digits";
      else if ((imeiSeen.get(imei) ?? 0) > 1) error = "Duplicate IMEI within this batch";
      if (!error && r.imei2.trim() && (imei2Seen.get(r.imei2.trim()) ?? 0) > 1) error = "Duplicate IMEI 2 within this batch";
      if (!error && r.serialNumber.trim() && (serialSeen.get(r.serialNumber.trim()) ?? 0) > 1) error = "Duplicate serial number within this batch";
      return { ...r, error };
    });

    const toSave = attempted
      .map(i => ({ row: updated[i], index: i }))
      .filter(({ row }) => !row.error);

    return { updated, toSave, attempted };
  }

  async function handleSave() {
    if (saving || anyMismatch) return;
    setSaveSummary(null);
    const sharedOk = validateShared();
    const { updated, toSave, attempted } = validateAndPrepareRows(rows);
    setRows(updated);
    if (!sharedOk) return;
    if (toSave.length === 0) {
      if (attempted.length === 0) setSaveSummary("Add at least one row with an IMEI before saving.");
      return;
    }

    setSaving(true);
    const results = await Promise.allSettled(
      toSave.map(({ row }) =>
        saveDevice({
          ...shared,
          id: 0,
          imei: row.imei.trim(),
          imei2: row.imei2.trim(),
          serialNumber: row.serialNumber.trim(),
        })
      )
    );
    setSaving(false);

    const attemptedSet = new Set(toSave.map(t => t.index));
    const failedMessages = new Map<number, string>();
    let savedCount = 0;
    results.forEach((res, i) => {
      const { index } = toSave[i];
      if (res.status === "fulfilled") savedCount++;
      else failedMessages.set(index, res.reason instanceof Error ? res.reason.message : String(res.reason));
    });

    // Every row saved — nothing left to fix, so the batch is done.
    if (failedMessages.size === 0) {
      onClose();
      return;
    }

    // Drop the rows that saved; keep the failed ones (with their error) and
    // any untouched blank rows, so the user can fix and retry just the batch
    // that didn't go through.
    setRows(prev => prev
      .map((r, i) => (failedMessages.has(i) ? { ...r, error: failedMessages.get(i) } : r))
      .filter((r, i) => !attemptedSet.has(i) || failedMessages.has(i)));

    setSaveSummary(
      savedCount > 0
        ? `${savedCount} device${savedCount === 1 ? "" : "s"} saved. ${failedMessages.size} row${failedMessages.size === 1 ? "" : "s"} failed — fix the highlighted row${failedMessages.size === 1 ? "" : "s"} below and try again.`
        : `All ${failedMessages.size} row${failedMessages.size === 1 ? "" : "s"} failed — see the errors below.`
    );
  }

  const pendingCount = rows.filter(r => r.imei.trim() || r.imei2.trim() || r.serialNumber.trim()).length;

  return createPortal(
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, width: "100%", maxWidth: 680, maxHeight: "90vh", overflowY: "auto", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: "var(--bg-card)", zIndex: 1 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>Bulk Add Devices</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>Fill in the shared specs once, then list each unit&apos;s IMEI</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}><X size={18} /></button>
        </div>

        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Shared specs</div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <ComboField
              label="Brand"
              value={shared.brand}
              onChange={handleBrandChange}
              options={deviceBrands}
              entityType="brand"
              error={sharedErrors.brand}
              disabled={anyMismatch}
              onPromptChange={setAnyMismatch}
              onNewRequest={v => setApprovalReq({ entityType: "brand", newName: v, suggestedBrandType: "device" })}
            />
            {sharedField("Device Name / Model", "name")}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <ModelNumberField
              label="Model Number (optional)"
              value={shared.modelNumber}
              onChange={v => setSharedField("modelNumber", v)}
              options={modelSpecs.options}
              specsByKey={modelSpecs.specsByKey}
              disabled={anyMismatch}
              error={sharedErrors.modelNumber}
              onAutoFill={applyModelAutoFill}
            />
            {sharedField("Storage", "storage")}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {sharedField("RAM (optional)", "ram")}
            {sharedField("Color", "color")}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
            {sharedField("Buying Price (Rs.)", "buyingPrice", "number")}
            {sharedField("Min Selling Price (Rs.)", "minSellingPrice", "number")}
            {sharedField("Suggested Price (Rs.)", "suggestedPrice", "number")}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <ComboField
              label="Supplier"
              value={shared.supplier}
              onChange={v => setSharedField("supplier", v)}
              options={deviceSuppliers}
              entityType="supplier"
              error={sharedErrors.supplier}
              disabled={anyMismatch || !shared.brand}
              onPromptChange={setAnyMismatch}
              onNewRequest={v => setApprovalReq({ entityType: "supplier", newName: v, presetBrandName: shared.brand })}
            />
            {sharedField("Date Added", "addedDate", "date")}
          </div>
          <div>
            <label style={labelStyle}>Status</label>
            <select value={shared.status} onChange={e => setSharedField("status", e.target.value)} disabled={anyMismatch} style={{ ...inputStyle, opacity: anyMismatch ? 0.45 : 1, cursor: anyMismatch ? "not-allowed" : undefined }}>
              <option value="available">Available</option>
              <option value="reserved">Reserved</option>
              <option value="sold">Sold</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Notes (optional, applied to every device in this batch)</label>
            <textarea value={shared.notes} onChange={e => setSharedField("notes", e.target.value)} rows={2} disabled={anyMismatch} style={{ ...inputStyle, resize: "vertical", opacity: anyMismatch ? 0.45 : 1 }} />
          </div>

          <div style={{ borderTop: "1px solid var(--border)", marginTop: 4, paddingTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Per-unit identifiers</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Tip: paste a multi-line IMEI list into any IMEI field to fill several rows at once</div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 30px", gap: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>IMEI</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>IMEI 2</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Serial Number</span>
              <span />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {rows.map(row => (
                <div key={row.key}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 30px", gap: 8, alignItems: "center" }}>
                    <input
                      type="text"
                      value={row.imei}
                      onChange={e => updateRow(row.key, { imei: e.target.value })}
                      onPaste={e => handleImeiPaste(e, row.key)}
                      disabled={saving}
                      style={{ ...inputStyle, borderColor: row.error ? "#dc2626" : "var(--border)" }}
                    />
                    <input
                      type="text"
                      value={row.imei2}
                      onChange={e => updateRow(row.key, { imei2: e.target.value })}
                      disabled={saving}
                      style={inputStyle}
                    />
                    <input
                      type="text"
                      value={row.serialNumber}
                      onChange={e => updateRow(row.key, { serialNumber: e.target.value })}
                      disabled={saving}
                      style={inputStyle}
                    />
                    <button
                      type="button"
                      onClick={() => removeRow(row.key)}
                      disabled={saving}
                      title="Remove row"
                      style={{ background: "none", border: "none", cursor: saving ? "not-allowed" : "pointer", color: "#dc2626", padding: 6, opacity: saving ? 0.4 : 1 }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  {row.error && <div style={{ fontSize: 11, color: "#dc2626", marginTop: 3 }}>{row.error}</div>}
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addRow}
              disabled={saving}
              style={{
                display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 8,
                border: "1px dashed var(--border)", background: "transparent", color: "var(--accent)",
                cursor: saving ? "not-allowed" : "pointer", fontSize: 12.5, fontWeight: 600,
                fontFamily: "'Plus Jakarta Sans', sans-serif", alignSelf: "flex-start",
              }}
            >
              <Plus size={13} /> Add row
            </button>
          </div>
        </div>

        <div style={{ padding: "16px 24px 20px", borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 10, position: "sticky", bottom: 0, background: "var(--bg-card)" }}>
          {saveSummary && <div style={{ fontSize: 12, color: "#dc2626", background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.25)", borderRadius: 8, padding: "8px 12px" }}>{saveSummary}</div>}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button onClick={onClose} style={{ padding: "9px 20px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer", fontSize: 13, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Cancel</button>
            <button
              onClick={() => { if (!saving) void handleSave(); }}
              disabled={anyMismatch || saving}
              style={{ padding: "9px 20px", borderRadius: 8, border: "none", background: "var(--accent)", color: "#fff", cursor: anyMismatch || saving ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 600, fontFamily: "'Plus Jakarta Sans', sans-serif", opacity: anyMismatch || saving ? 0.5 : 1 }}
            >
              {saving ? "Saving…" : `Add ${pendingCount} Device${pendingCount === 1 ? "" : "s"}`}
            </button>
          </div>
        </div>
      </div>
      {approvalReq && (
        <AdminApprovalModal
          request={approvalReq}
          onEntityAdded={handleEntityAdded}
          onClose={() => setApprovalReq(null)}
        />
      )}
    </div>,
    document.body
  );
}

// ─── Add / Edit Product Modal ─────────────────────────────────────────────────

function AddEditProductModal({ product, existingProducts, onSave, onClose }: {
  product: AccessoryProduct | null; existingProducts: AccessoryProduct[]; onSave: (p: AccessoryProduct) => Promise<unknown>; onClose: () => void;
}) {
  const { brands, categories, subcategories, suppliers } = useInventory();
  const blank: AccessoryProduct = { id: 0, code: "", name: "", brand: "", category: "", subcategory: "", model: "", buyingPrice: 0, sellingPrice: 0, stock: 0, minStock: 5, supplier: "", addedDate: new Date().toISOString().slice(0, 10), insight: "" };
  const [form, setForm] = useState<AccessoryProduct>(product ?? blank);
  const [errors, setErrors] = useState<Partial<Record<keyof AccessoryProduct, string>>>({});
  const [approvalReq, setApprovalReq] = useState<ApprovalRequest | null>(null);
  const [anyMismatch, setAnyMismatch] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const set = (k: keyof AccessoryProduct, v: string | number) => setForm(f => ({ ...f, [k]: v }));

  // Cascade: category → brand → supplier
  const selectedCatObj = useMemo(() => categories.find(c => c.name === form.category), [categories, form.category]);

  /**
   * Whether this product still owes a subcategory.
   *
   * Only categories that actually have subcategories filed under them. Asking
   * for one where none exists is a demand nobody can meet — the form was
   * rejecting "Camera Lens Protectors" for a missing value the dropdown had
   * nothing to offer for. A category with subcategories defined still requires
   * one, since leaving it blank there means the shop skipped a distinction it
   * had deliberately set up.
   */
  const requiresSubcategory = useMemo(
    () => !!selectedCatObj && subcategories.some(s => s.active && s.categoryId === selectedCatObj.id),
    [subcategories, selectedCatObj],
  );
  const selectedBrandObj = useMemo(() => brands.find(b => b.name === form.brand), [brands, form.brand]);

  // Deactivated entries stay picked if a product already has one (the value
  // just won't appear for a *new* pick) — filtered here, not in the fetch,
  // so an existing product's saved label never silently blanks out.
  const brandOptions = useMemo(
    () => brands
      .filter(b =>
        b.active &&
        (b.type === "accessory" || b.type === "both") &&
        (!selectedCatObj || b.categoryIds.length === 0 || b.categoryIds.includes(selectedCatObj.id))
      )
      .map(b => b.name).sort(),
    [brands, selectedCatObj]
  );

  const supplierOptions = useMemo(
    () => suppliers
      .filter(s => s.active && (!selectedBrandObj || s.brandIds.length === 0 || s.brandIds.includes(selectedBrandObj.id)))
      .map(s => s.name).sort(),
    [suppliers, selectedBrandObj]
  );

  /**
   * Both levels arrive together now. The item code is derived from the main
   * category, and brand/supplier still hang off it, so changing the category
   * clears them exactly as before — picking a subcategory within the category
   * already chosen leaves them alone, since nothing they depend on moved.
   */
  function handleCategoryPick(cat: string, subcat: string) {
    setForm(f => {
      if (f.category === cat) return { ...f, subcategory: subcat };
      const newCode = cat ? generateCode(cat, existingProducts.filter(p => p.id !== f.id)) : "";
      return { ...f, category: cat, subcategory: subcat, brand: "", supplier: "", code: newCode };
    });
  }
  function handleBrandChange(v: string)    { setForm(f => ({ ...f, brand: v, supplier: "" })); }

  function handleEntityAdded(entityType: ApprovalRequest["entityType"], name: string) {
    if (entityType === "category") setForm(f => ({ ...f, category: name, subcategory: "", brand: "", supplier: "" }));
    else if (entityType === "subcategory") setForm(f => ({ ...f, subcategory: name }));
    else if (entityType === "brand") setForm(f => ({ ...f, brand: name, supplier: "" }));
    else setForm(f => ({ ...f, supplier: name }));
  }

  function validate() {
    const e: typeof errors = {};
    if (!form.code.trim()) e.code = "Code is required";
    if (!form.name.trim()) e.name = "Name is required";
    if (!form.brand.trim()) e.brand = "Brand is required";
    if (!form.category.trim()) e.category = "Category is required";
    if (requiresSubcategory && !form.subcategory.trim()) e.subcategory = `Pick a subcategory under ${form.category}`;
    if (!form.supplier.trim()) e.supplier = "Supplier is required";
    if (form.buyingPrice <= 0) e.buyingPrice = "Must be greater than 0";
    if (form.sellingPrice <= 0) e.sellingPrice = "Must be greater than 0";
    if (form.stock < 0) e.stock = "Cannot be negative";
    if (form.minStock < 0) e.minStock = "Cannot be negative";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  const field = (label: string, key: keyof AccessoryProduct, type = "text", placeholder = "") => (
    <div>
      <label style={labelStyle}>{label}</label>
      <input
        type={type}
        value={form[key] as string | number}
        onChange={e => set(key, type === "number" ? Number(e.target.value) : e.target.value)}
        placeholder={placeholder}
        disabled={anyMismatch}
        style={{ ...inputStyle, borderColor: errors[key] ? "#dc2626" : "var(--border)", opacity: anyMismatch ? 0.45 : 1, cursor: anyMismatch ? "not-allowed" : undefined }}
      />
      {errors[key] && <div style={{ fontSize: 11, color: "#dc2626", marginTop: 3 }}>{errors[key]}</div>}
    </div>
  );

  return createPortal(
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: "var(--bg-card)", zIndex: 1 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>{product ? "Edit Product" : "Add New Product"}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>Fill in the product details below</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}><X size={18} /></button>
        </div>
        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Row 1: category and subcategory, one accordion dropdown */}
          <CategoryComboField
            categories={categories}
            subcategories={subcategories}
            category={form.category}
            subcategory={form.subcategory}
            onPick={handleCategoryPick}
            error={errors.category || errors.subcategory}
            disabled={anyMismatch}
            onPromptChange={setAnyMismatch}
            onNewCategory={v => setApprovalReq({ entityType: "category", newName: v })}
            onNewSubcategory={(v, parent) => setApprovalReq({ entityType: "subcategory", newName: v, presetCategoryName: parent })}
          />
          {/* Row 2: Item Brand + Item Supplier (cascade) */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <ComboField
              label="Item Brand"
              value={form.brand}
              onChange={handleBrandChange}
              options={brandOptions}
              entityType="brand"
              error={errors.brand}
              disabled={anyMismatch || !form.category}
              onPromptChange={setAnyMismatch}
              onNewRequest={v => setApprovalReq({ entityType: "brand", newName: v, presetCategoryName: form.category, suggestedBrandType: "accessory" })}
            />
            <ComboField
              label="Item Supplier"
              value={form.supplier}
              onChange={v => set("supplier", v)}
              options={supplierOptions}
              entityType="supplier"
              error={errors.supplier}
              disabled={anyMismatch || !form.brand}
              onPromptChange={setAnyMismatch}
              onNewRequest={v => setApprovalReq({ entityType: "supplier", newName: v, presetBrandName: form.brand })}
            />
          </div>
          {/* Row 3: Item Name + Auto-generated Item Code */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {field("Item Name", "name", "text", "e.g. Tempered Glass")}
            <div>
              <label style={{ ...labelStyle, display: "flex", alignItems: "center", gap: 6 }}>
                Item Code
                <span style={{ fontSize: 10, fontWeight: 700, background: "var(--accent-dim)", color: "var(--accent)", borderRadius: 4, padding: "1px 6px", letterSpacing: "0.04em" }}>AUTO</span>
              </label>
              <input
                type="text"
                value={form.code}
                onChange={e => set("code", e.target.value)}
                placeholder={form.category ? `${getCategoryAbbr(form.category)}-001` : "Select category first"}
                disabled={anyMismatch}
                style={{ ...inputStyle, borderColor: errors.code ? "#dc2626" : "var(--border)", opacity: anyMismatch ? 0.45 : 1, cursor: anyMismatch ? "not-allowed" : "text" }}
              />
              {errors.code && <div style={{ fontSize: 11, color: "#dc2626", marginTop: 3 }}>{errors.code}</div>}
              {!errors.code && form.category && (
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>
                  Generated from &quot;{form.category}&quot; — editable
                </div>
              )}
            </div>
          </div>
          {/* Row 4: Compatible Model */}
          {field("Compatible Model", "model", "text", "e.g. iPhone 15 / Universal")}
          {/* Row 5: Pricing */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {field("Buying Price (Rs.)", "buyingPrice", "number")}
            {field("Selling Price (Rs.)", "sellingPrice", "number")}
          </div>
          {/* Row 6: Stock + Date */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, alignItems: "end" }}>
            {field("Current Stock", "stock", "number")}
            {field("Min Stock (Reorder At)", "minStock", "number")}
            {field("Date Added", "addedDate", "date")}
          </div>
          {/* Row 7: Insight (optional) */}
          {field("Insight (optional tip shown to cashiers)", "insight", "text", "e.g. Popular add-on")}
        </div>
        <div style={{ padding: "16px 24px 20px", borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 10, position: "sticky", bottom: 0, background: "var(--bg-card)" }}>
          {saveError && <div style={{ fontSize: 12, color: "#dc2626" }}>{saveError}</div>}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button onClick={onClose} style={{ padding: "9px 20px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer", fontSize: 13, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Cancel</button>
            <button
              onClick={async () => {
                if (anyMismatch || saving || !validate()) return;
                setSaving(true);
                setSaveError(null);
                try {
                  await onSave({ ...form, id: form.id || 0 });
                  onClose();
                } catch (e) {
                  setSaveError(e instanceof Error ? e.message : String(e));
                } finally {
                  setSaving(false);
                }
              }}
              disabled={anyMismatch || saving}
              style={{ padding: "9px 20px", borderRadius: 8, border: "none", background: "var(--accent)", color: "#fff", cursor: anyMismatch || saving ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 600, fontFamily: "'Plus Jakarta Sans', sans-serif", opacity: anyMismatch || saving ? 0.5 : 1 }}
            >
              {saving ? "Saving…" : product ? "Save Changes" : "Add Product"}
            </button>
          </div>
        </div>
      </div>
      {approvalReq && (
        <AdminApprovalModal
          request={approvalReq}
          onEntityAdded={handleEntityAdded}
          onClose={() => setApprovalReq(null)}
        />
      )}
    </div>,
    document.body
  );
}

// ─── Stock Adjust Modal ───────────────────────────────────────────────────────

function StockAdjustModal({ product, onSave, onClose }: {
  product: AccessoryProduct; onSave: (newStock: number) => void; onClose: () => void;
}) {
  const [adjType, setAdjType] = useState<"add" | "remove" | "set">("add");
  const [qty, setQty] = useState(0);
  const [reason, setReason] = useState("Received");
  const [error, setError] = useState("");

  const newStock = useMemo(() => {
    if (adjType === "add") return product.stock + qty;
    if (adjType === "remove") return Math.max(0, product.stock - qty);
    return qty;
  }, [adjType, qty, product.stock]);

  function handleSave() {
    if (qty < 0) { setError("Quantity cannot be negative"); return; }
    setError("");
    onSave(newStock);
  }

  const typeBtn = (t: "add" | "remove" | "set", label: string, icon: React.ReactNode) => (
    <button
      onClick={() => { setAdjType(t); setQty(0); setError(""); }}
      style={{
        flex: 1, padding: "8px 10px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
        fontFamily: "'Plus Jakarta Sans', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        border: adjType === t ? "1px solid var(--accent-glow)" : "1px solid var(--border)",
        background: adjType === t ? "var(--accent-dim)" : "transparent",
        color: adjType === t ? "var(--accent)" : "var(--text-secondary)",
      }}
    >
      {icon}{label}
    </button>
  );

  const isWarn = newStock < product.minStock && newStock > 0;
  const isOut = newStock === 0;

  return createPortal(
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, width: "100%", maxWidth: 420, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>Adjust Stock</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{product.name} · {product.code}</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}><X size={18} /></button>
        </div>
        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ background: "var(--bg-surface)", borderRadius: 10, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Current Stock</span>
            <span style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)" }}>{product.stock} units</span>
          </div>
          <div>
            <label style={labelStyle}>Adjustment Type</label>
            <div style={{ display: "flex", gap: 8 }}>
              {typeBtn("add", "Add Stock", <ArrowUpCircle size={14} />)}
              {typeBtn("remove", "Remove Stock", <ArrowDownCircle size={14} />)}
              {typeBtn("set", "Set Exact", <Sliders size={14} />)}
            </div>
          </div>
          <div>
            <label style={labelStyle}>{adjType === "set" ? "New Stock Count" : "Quantity"}</label>
            <input
              type="number" min={0}
              value={qty}
              onChange={e => { setQty(Number(e.target.value)); setError(""); }}
              style={{ ...inputStyle, borderColor: error ? "#dc2626" : "var(--border)" }}
            />
            {error && <div style={{ fontSize: 11, color: "#dc2626", marginTop: 3 }}>{error}</div>}
          </div>
          <div>
            <label style={labelStyle}>Reason</label>
            <select value={reason} onChange={e => setReason(e.target.value)} style={{ ...inputStyle }}>
              <option>Received</option>
              <option>Returned by Customer</option>
              <option>Damaged / Written Off</option>
              <option>Sold (Manual)</option>
              <option>Stock Count Correction</option>
              <option>Other</option>
            </select>
          </div>
          <div style={{
            background: isOut ? "#fee2e2" : isWarn ? "#fef3c7" : "var(--accent-dim)",
            border: `1px solid ${isOut ? "#fca5a5" : isWarn ? "#fcd34d" : "var(--accent-glow)"}`,
            borderRadius: 10, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>Stock After Adjustment</span>
            <span style={{ fontSize: 22, fontWeight: 800, color: isOut ? "#dc2626" : isWarn ? "#b45309" : "var(--accent)" }}>
              {newStock} units
            </span>
          </div>
        </div>
        <div style={{ padding: "16px 24px 20px", borderTop: "1px solid var(--border)", display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "9px 20px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer", fontSize: 13, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Cancel</button>
          <button onClick={handleSave} style={{ padding: "9px 20px", borderRadius: 8, border: "none", background: "var(--accent)", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            Confirm Adjustment
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({ devices, accessories }: { devices: DeviceItem[]; accessories: AccessoryProduct[] }) {
  const isMobile = useIsMobile();
  const availableDevices = devices.filter(d => d.status === "available");
  const soldDevices = devices.filter(d => d.status === "sold");
  const mobileStockValue = availableDevices.reduce((s, d) => s + d.buyingPrice, 0);
  const accessoryStockValue = accessories.reduce((s, p) => s + p.buyingPrice * p.stock, 0);
  const lowStockItems = accessories.filter(p => p.stock > 0 && p.stock < p.minStock);
  const outOfStockItems = accessories.filter(p => p.stock === 0);

  const statusColors = {
    available: { bg: "#dcfce7", color: "#16a34a", label: "Available" },
    sold:      { bg: "var(--bg-surface)", color: "var(--text-muted)", label: "Sold" },
    reserved:  { bg: "#fef3c7", color: "#b45309", label: "Reserved" },
  } as const;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap: isMobile ? 10 : 16 }}>
        {([
          { icon: <Smartphone size={18} />, iconBg: "var(--accent-dim)", iconColor: "var(--accent)", title: "Mobile Devices", main: `${availableDevices.length} available`, sub: `${soldDevices.length} sold · Stock ${Rs(mobileStockValue)}` },
          { icon: <Package size={18} />,    iconBg: "#dbeafe",           iconColor: "#1d4ed8",       title: "Accessories",    main: `${accessories.length} SKUs`,           sub: `Total stock value ${Rs(accessoryStockValue)}` },
          { icon: <AlertTriangle size={18} />, iconBg: "#fef3c7",        iconColor: "#b45309",       title: "Low Stock",      main: `${lowStockItems.length} items`,         sub: "Below reorder point" },
          { icon: <XCircle size={18} />,    iconBg: "#fee2e2",           iconColor: "#dc2626",       title: "Out of Stock",   main: `${outOfStockItems.length} items`,       sub: "Need restocking immediately" },
        ] as const).map(({ icon, iconBg, iconColor, title, main, sub }, idx) => (
          <div key={title} className={`fade-up fade-up-${idx + 1}`} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: 20, display: "flex", gap: 14, alignItems: "flex-start" }}>
            <div style={{ width: 42, height: 42, borderRadius: 11, background: iconBg, display: "flex", alignItems: "center", justifyContent: "center", color: iconColor, flexShrink: 0 }}>
              {icon}
            </div>
            <div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{title}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)", lineHeight: 1.1, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{main}</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 3, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{sub}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16 }}>
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
            <AlertTriangle size={15} color="#b45309" />
            <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Low Stock Alerts</span>
            {lowStockItems.length > 0 && (
              <span style={{ marginLeft: "auto", background: "#fef3c7", color: "#b45309", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20 }}>{lowStockItems.length}</span>
            )}
          </div>
          {lowStockItems.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 13, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              <Check size={28} style={{ marginBottom: 8, display: "block", margin: "0 auto 8px", opacity: 0.4 }} />
              All stock levels are healthy
            </div>
          ) : lowStockItems.map(p => (
            <div key={p.id} style={{ padding: "11px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border)" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{p.name}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{p.code} · {p.brand}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#b45309" }}>{p.stock}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>min: {p.minStock}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
            <XCircle size={15} color="#dc2626" />
            <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Out of Stock</span>
            {outOfStockItems.length > 0 && (
              <span style={{ marginLeft: "auto", background: "#fee2e2", color: "#dc2626", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20 }}>{outOfStockItems.length}</span>
            )}
          </div>
          {outOfStockItems.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 13, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              <Check size={28} style={{ marginBottom: 8, display: "block", margin: "0 auto 8px", opacity: 0.4 }} />
              All products are in stock
            </div>
          ) : outOfStockItems.map(p => (
            <div key={p.id} style={{ padding: "11px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border)" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{p.name}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{p.code} · {p.brand}</div>
              </div>
              <span style={{ background: "#fee2e2", color: "#dc2626", fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20 }}>OUT OF STOCK</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)" }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Mobile Device Status Summary</span>
        </div>
        {devices.slice().sort((a, b) => a.name.localeCompare(b.name)).map(d => {
          const sc = statusColors[d.status];
          const m = d.suggestedPrice - d.buyingPrice;
          const mp = marginPct(d.buyingPrice, d.suggestedPrice);
          return (
            <div key={d.id} style={{ padding: "11px 16px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid var(--border)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{d.name}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>{isMobile ? `${d.storage} · ${d.color}` : `${d.imei} · ${d.storage} · ${d.color}`}</div>
                {isMobile && <div style={{ fontSize: 11, color: "#16a34a", fontWeight: 600, marginTop: 2 }}>+{Rs(m)} ({mp}%)</div>}
              </div>
              {!isMobile && <div style={{ fontSize: 12, color: "var(--text-secondary)", minWidth: 120 }}>{d.supplier}</div>}
              {!isMobile && <div style={{ fontSize: 12, color: "var(--text-secondary)", minWidth: 120, textAlign: "right" }}>Cost: {Rs(d.buyingPrice)}</div>}
              {!isMobile && <div style={{ fontSize: 12, color: "#16a34a", fontWeight: 600, minWidth: 100, textAlign: "right" }}>+{Rs(m)} ({mp}%)</div>}
              <span style={{ background: sc.bg, color: sc.color, fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, minWidth: 72, textAlign: "center", flexShrink: 0 }}>{sc.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Bulk Print Labels Modal ──────────────────────────────────────────────────
//
// One model can be a dozen identical phones on the shelf, and the single
// "print label" button on each row means a dozen separate print dialogs for
// a shipment that just arrived. This prints a whole group — or whichever
// slice of it is actually still on the shelf — in one pass, using the same
// BarcodeLabelModal every single-device print already goes through: one
// unit's label is rendered off-screen and silently printed, then the next,
// until the list picked here is done.

function BulkPrintLabelsModal({ group, units, onClose }: {
  group: { name: string; brand: string; modelNumber: string };
  units: DeviceItem[];
  onClose: () => void;
}) {
  const toast = useToast();
  const statusColors = {
    available: { bg: "#dcfce7", color: "#16a34a" },
    sold:      { bg: "var(--bg-surface)", color: "var(--text-muted)" },
    reserved:  { bg: "#fef3c7", color: "#b45309" },
  } as const;
  // Default to what actually needs a shelf label — a sold or reserved unit
  // isn't sitting out waiting to be tagged.
  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(units.filter(d => d.status === "available").map(d => d.id)),
  );
  const [rangeFrom, setRangeFrom] = useState("1");
  const [rangeTo, setRangeTo] = useState(String(units.length));
  // Selected labels render off-screen one at a time — same as a single
  // print — but instead of each one printing itself, it reports its finished
  // markup back through onReady and the next one starts. Once the last one
  // reports in, every collected label goes to printLabelsNode() together:
  // one print job, one dialog, not N. One at a time rather than all six at
  // once so six simultaneous template lookups and auto-fit measurements
  // can't step on each other — a real failure mode the first version of
  // this hit, where only one of six ever actually reported back.
  const [queue, setQueue] = useState<DeviceItem[] | null>(null);
  const collectedRef = useRef<{ html: string; w: number; h: number }[]>([]);
  const [processedCount, setProcessedCount] = useState(0);

  const toggle = (id: number) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const applyRange = () => {
    const from = Math.max(1, parseInt(rangeFrom, 10) || 1);
    const to = Math.min(units.length, parseInt(rangeTo, 10) || units.length);
    if (from > to) return;
    // Replaces the selection with exactly this range — a second range applied
    // after the first should narrow to the new one, not accumulate.
    setSelected(new Set(units.slice(from - 1, to).map(d => d.id)));
  };

  const selectedUnits = units.filter(d => selected.has(d.id));
  const printing = queue !== null;
  const current = queue && queue.length > 0 ? queue[0] : null;

  const startPrint = () => {
    if (selectedUnits.length === 0) return;
    collectedRef.current = [];
    setProcessedCount(0);
    setQueue(selectedUnits);
  };

  // Fires once the current off-screen label has finished measuring/auto-
  // fitting itself. Collect its markup, move to the next one in the queue —
  // or, if that was the last one, print everything collected as one job.
  const handleReady = (html: string, w: number, h: number) => {
    collectedRef.current.push({ html, w, h });
    setProcessedCount(c => c + 1);
    setQueue(prev => {
      const rest = (prev ?? []).slice(1);
      if (rest.length > 0) return rest;

      const items = collectedRef.current;
      if (items.length > 0) {
        // Every label here came from the same group, so they share one
        // physical size — the first one's is as good as any to print at.
        printLabelsNode(items.map(i => i.html), items[0].w, items[0].h);
        toast.success(`Printing ${items.length} label${items.length === 1 ? "" : "s"}`);
      }
      onClose();
      return null;
    });
  };

  return (
    <>
      {createPortal(
        <div
          style={{ position: "fixed", inset: 0, zIndex: 1100, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={(e) => { if (e.target === e.currentTarget && !printing) onClose(); }}
        >
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, width: "min(480px, calc(100vw - 24px))", maxHeight: "calc(100vh - 40px)", display: "flex", flexDirection: "column", overflow: "hidden", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderBottom: "1px solid var(--border)", background: "var(--bg-secondary)", flexShrink: 0 }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>Bulk Print Labels</p>
                <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>
                  {group.brand} {group.name}{group.modelNumber ? ` · ${group.modelNumber}` : ""}
                </p>
              </div>
              {!printing && (
                <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <X size={14} />
                </button>
              )}
            </div>

            {printing ? (
              <div style={{ padding: 28, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                <Printer size={22} color="var(--accent)" />
                <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                  Preparing label {processedCount + 1} of {selectedUnits.length}…
                </p>
                <p style={{ fontSize: 11.5, color: "var(--text-muted)", textAlign: "center", lineHeight: 1.5 }}>
                  All {selectedUnits.length} labels print together as one job, one page per label, once the last one is ready.
                </p>
              </div>
            ) : (
              <>
                <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 12, overflowY: "auto" }}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <button
                      onClick={() => setSelected(new Set(units.map(d => d.id)))}
                      style={{ padding: "6px 12px", borderRadius: 8, fontSize: 11.5, fontWeight: 600, border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-secondary)", cursor: "pointer" }}
                    >
                      All in group ({units.length})
                    </button>
                    <button
                      onClick={() => setSelected(new Set())}
                      style={{ padding: "6px 12px", borderRadius: 8, fontSize: 11.5, fontWeight: 600, border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-secondary)", cursor: "pointer" }}
                    >
                      Select none
                    </button>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11.5, color: "var(--text-muted)", fontWeight: 600 }}>Range</span>
                    <input type="number" min={1} max={units.length} value={rangeFrom} onChange={e => setRangeFrom(e.target.value)}
                      style={{ ...inputStyle, width: 60, padding: "6px 8px" }} />
                    <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>to</span>
                    <input type="number" min={1} max={units.length} value={rangeTo} onChange={e => setRangeTo(e.target.value)}
                      style={{ ...inputStyle, width: 60, padding: "6px 8px" }} />
                    <button
                      onClick={applyRange}
                      style={{ padding: "6px 12px", borderRadius: 8, fontSize: 11.5, fontWeight: 600, border: "1px solid var(--accent)", background: "var(--accent-dim)", color: "var(--accent)", cursor: "pointer" }}
                    >
                      Apply range
                    </button>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 260, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 10, padding: 6 }}>
                    {units.map((d, i) => {
                      const sc = statusColors[d.status];
                      const on = selected.has(d.id);
                      return (
                        <label
                          key={d.id}
                          style={{
                            display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 7,
                            cursor: "pointer", background: on ? "var(--accent-dim)" : "transparent",
                          }}
                        >
                          <input type="checkbox" checked={on} onChange={() => toggle(d.id)} style={{ cursor: "pointer" }} />
                          <span style={{ fontSize: 10.5, color: "var(--text-muted)", width: 20, flexShrink: 0 }}>{i + 1}</span>
                          <span style={{ fontSize: 11.5, fontFamily: "monospace", color: "var(--text-primary)", flex: 1 }}>{d.imei}</span>
                          <span style={{ background: sc.bg, color: sc.color, fontSize: 9.5, fontWeight: 700, padding: "2px 7px", borderRadius: 20, textTransform: "capitalize", flexShrink: 0 }}>
                            {d.status}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "12px 18px", borderTop: "1px solid var(--border)", background: "var(--bg-secondary)", flexShrink: 0 }}>
                  <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{selectedUnits.length} selected</span>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={onClose} style={{ padding: "8px 18px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer" }}>Cancel</button>
                    <button
                      onClick={startPrint}
                      disabled={selectedUnits.length === 0}
                      style={{
                        display: "flex", alignItems: "center", gap: 6, padding: "8px 18px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                        border: "1px solid var(--accent)", background: "var(--accent)", color: "var(--accent-fg)",
                        cursor: selectedUnits.length === 0 ? "not-allowed" : "pointer", opacity: selectedUnits.length === 0 ? 0.45 : 1,
                      }}
                    >
                      <Printer size={13} /> Print {selectedUnits.length || ""} Label{selectedUnits.length === 1 ? "" : "s"}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>,
        document.body,
      )}

      {current && (
        <BarcodeLabelModal
          key={current.id}
          code={current.imei}
          title={`${current.brand} ${current.name}`.trim()}
          subtitle={`${current.storage} · ${current.color}`}
          variant="device"
          imei={current.imei}
          price={Rs(current.suggestedPrice)}
          deviceName={current.name}
          modelNumber={current.modelNumber}
          silent
          onReady={handleReady}
          onClose={() => {}}
        />
      )}
    </>
  );
}

// ─── Mobile Devices Tab ───────────────────────────────────────────────────────

function MobileDevicesTab({ devices, loading, configured, saveDevice, deleteDevice }: {
  devices: DeviceItem[];
  loading: boolean;
  configured: boolean;
  saveDevice: (d: DeviceItem) => Promise<DeviceItem>;
  deleteDevice: (id: number) => Promise<void>;
}) {
  const isMobile = useIsMobile();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [brandFilter, setBrandFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [editDevice, setEditDevice] = useState<DeviceItem | null | "new">(null);
  const [bulkAddOpen, setBulkAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeviceItem | null>(null);
  const [labelDevice, setLabelDevice] = useState<DeviceItem | null>(null);
  const [bulkPrintGroup, setBulkPrintGroup] = useState<{ name: string; brand: string; modelNumber: string; units: DeviceItem[] } | null>(null);

  const { brands: brandList } = useInventory();
  const brands = useMemo(
    () => ["All", ...brandList.filter(b => b.type === "device" || b.type === "both").map(b => b.name).sort()],
    [brandList]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return devices.filter(d => {
      if (brandFilter !== "All" && d.brand !== brandFilter) return false;
      if (statusFilter !== "All" && d.status !== statusFilter.toLowerCase()) return false;
      if (q && !d.imei.includes(q) && !d.name.toLowerCase().includes(q) && !d.brand.toLowerCase().includes(q) && !d.supplier.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [devices, search, brandFilter, statusFilter]);

  // How many units of each model exist in total (ignoring the active
  // search/filter) — compared against a group's filtered unit count below to
  // decide whether that group has units hidden by the current filter, and so
  // needs to auto-expand rather than bury a match inside a collapsed group.
  const totalCountsByKey = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of devices) {
      const k = deviceGroupKey(d);
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  }, [devices]);

  // Grouped from the *filtered* list, so a group's unit count always reflects
  // only what currently matches search/filters, and a model with zero
  // matching units simply doesn't appear.
  const groups = useMemo(() => {
    const map = new Map<string, DeviceItem[]>();
    for (const d of filtered) {
      const k = deviceGroupKey(d);
      const arr = map.get(k);
      if (arr) arr.push(d); else map.set(k, [d]);
    }
    return Array.from(map.entries()).map(([key, units]) => {
      const first = units[0];
      return {
        key,
        units,
        name: first.name,
        modelNumber: first.modelNumber,
        brand: first.brand,
        storage: first.storage,
        ram: first.ram,
        color: first.color,
        totalCount: totalCountsByKey.get(key) ?? units.length,
      };
    });
  }, [filtered, totalCountsByKey]);

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  function toggleGroup(key: string) {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }
  // A group is open if the user opened it manually, or if the active filter
  // has hidden at least one of its units — a search/filter match must never
  // be left buried inside a collapsed group.
  function isGroupOpen(g: { key: string; units: DeviceItem[]; totalCount: number }) {
    return expandedGroups.has(g.key) || g.units.length < g.totalCount;
  }
  const allOpen = groups.length > 0 && groups.every(isGroupOpen);
  function toggleAllGroups() {
    setExpandedGroups(allOpen ? new Set() : new Set(groups.map(g => g.key)));
  }

  const available = devices.filter(d => d.status === "available").length;
  const sold = devices.filter(d => d.status === "sold").length;
  const reserved = devices.filter(d => d.status === "reserved").length;
  const stockVal = devices.filter(d => d.status === "available").reduce((s, d) => s + d.buyingPrice, 0);

  async function handleDelete() {
    if (!deleteTarget || busy) return;
    setBusy(true);
    try {
      await deleteDevice(deleteTarget.id);
      setDeleteTarget(null);
    } catch (e) {
      toast.dialog("error", "Could not remove device", e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const statusColors = {
    available: { bg: "#dcfce7", color: "#16a34a" },
    sold:      { bg: "var(--bg-surface)", color: "var(--text-muted)" },
    reserved:  { bg: "#fef3c7", color: "#b45309" },
  } as const;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap: 10 }}>
        {([
          { label: "Available", value: available, color: "#16a34a", bg: "#dcfce7" },
          { label: "Sold", value: sold, color: "var(--text-muted)", bg: "var(--bg-surface)" },
          { label: "Reserved", value: reserved, color: "#b45309", bg: "#fef3c7" },
          { label: "Stock Value", value: Rs(stockVal), color: "var(--accent)", bg: "var(--accent-dim)" },
        ] as const).map(({ label, value, color, bg }) => (
          <div key={label} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{label}</span>
            <span style={{ fontSize: 15, fontWeight: 800, color, background: bg, padding: "2px 10px", borderRadius: 8 }}>{value}</span>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 10, alignItems: isMobile ? "stretch" : "center" }}>
        <div style={{ position: "relative", flex: 1 }}>
          <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by IMEI, name, brand, supplier…" style={{ ...inputStyle, paddingLeft: 36, width: "100%", boxSizing: "border-box" as const }} />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <select value={brandFilter} onChange={e => setBrandFilter(e.target.value)} style={{ ...selectStyle, flex: isMobile ? 1 : undefined }}>
            {brands.map(b => <option key={b}>{b}</option>)}
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ ...selectStyle, flex: isMobile ? 1 : undefined }}>
            {["All", "Available", "Reserved", "Sold"].map(s => <option key={s}>{s}</option>)}
          </select>
          {groups.length > 0 && (
            <button onClick={toggleAllGroups} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer", fontSize: 12.5, fontWeight: 600, fontFamily: "'Plus Jakarta Sans', sans-serif", whiteSpace: "nowrap" }}>
              {allOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}{isMobile ? (allOpen ? "Collapse" : "Expand") : (allOpen ? "Collapse all" : "Expand all")}
            </button>
          )}
          <button onClick={() => setBulkAddOpen(true)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "'Plus Jakarta Sans', sans-serif", whiteSpace: "nowrap" }}>
            <Layers size={14} />{isMobile ? "Bulk" : "Bulk Add"}
          </button>
          <button onClick={() => setEditDevice("new")} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 8, border: "none", background: "var(--accent)", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "'Plus Jakarta Sans', sans-serif", whiteSpace: "nowrap" }}>
            <Plus size={14} />{isMobile ? "Add" : "Add Device"}
          </button>
        </div>
      </div>

      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            <thead>
              <tr>
                {[
                  "#", "Units", "Device", "Model Number", "Brand",
                  "Storage", "RAM", "Color", "Buying Price", "Min Selling", "Suggested", "Margin",
                  "Supplier", "Date Added", "Status", "",
                ].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.length === 0 ? (
                <tr><td colSpan={16} style={{ ...tdBase, textAlign: "center", padding: 40, color: "var(--text-muted)" }}>No devices match your filters</td></tr>
              ) : groups.flatMap(g => {
                const open = isGroupOpen(g);
                const counts = { available: 0, sold: 0, reserved: 0 };
                for (const u of g.units) counts[u.status]++;
                const buy = numRange(g.units, u => u.buyingPrice);
                const minSell = numRange(g.units, u => u.minSellingPrice);
                const suggested = numRange(g.units, u => u.suggestedPrice);
                const marginRs = numRange(g.units, u => u.suggestedPrice - u.buyingPrice);
                const marginPctR = numRange(g.units, u => marginPct(u.buyingPrice, u.suggestedPrice));
                const marginUniform = marginRs.uniform && marginPctR.uniform;
                const supplier = strUniform(g.units, u => u.supplier);
                const stockValue = g.units.filter(u => u.status === "available").reduce((s, u) => s + u.buyingPrice, 0);

                const groupRow = (
                  <tr
                    key={`g-${g.key}`}
                    onClick={() => toggleGroup(g.key)}
                    style={{
                      background: open ? "var(--accent-dim)" : "var(--bg-surface)",
                      boxShadow: open ? "inset 3px 0 0 var(--accent)" : undefined,
                      cursor: "pointer",
                    }}
                  >
                    <td style={{ ...tdBase, color: "var(--text-muted)" }}>
                      {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </td>
                    <td style={tdBase}>
                      <div style={{ fontWeight: 700, fontSize: 12.5 }}>{g.units.length} unit{g.units.length === 1 ? "" : "s"}</div>
                      {g.units.length < g.totalCount && (
                        <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 1 }}>of {g.totalCount} total</div>
                      )}
                    </td>
                    <td style={{ ...tdBase, fontWeight: 600, whiteSpace: "nowrap" }}>{g.name}</td>
                    <td style={{ ...tdBase, color: "var(--text-secondary)", fontSize: 12 }}>{g.modelNumber || "—"}</td>
                    <td style={tdBase}>{g.brand}</td>
                    <td style={tdBase}>{g.storage}</td>
                    <td style={{ ...tdBase, color: "var(--text-secondary)" }}>{g.ram || "—"}</td>
                    <td style={tdBase}>{g.color}</td>
                    <td style={tdBase}>{buy.uniform ? Rs(buy.value) : `${Rs(buy.min)} – ${Rs(buy.max)}`}</td>
                    <td style={tdBase}>{minSell.uniform ? Rs(minSell.value) : `${Rs(minSell.min)} – ${Rs(minSell.max)}`}</td>
                    <td style={{ ...tdBase, fontWeight: 600 }}>{suggested.uniform ? Rs(suggested.value) : `${Rs(suggested.min)} – ${Rs(suggested.max)}`}</td>
                    <td style={{ ...tdBase, whiteSpace: "nowrap" }}>
                      {marginUniform ? (
                        <span style={{ color: "#16a34a", fontWeight: 700 }}>
                          +{Rs(marginRs.value)} <span style={{ fontWeight: 400, fontSize: 11, color: "var(--text-muted)" }}>({marginPctR.value}%)</span>
                        </span>
                      ) : (
                        <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>{marginPctR.min}% – {marginPctR.max}%</span>
                      )}
                    </td>
                    <td style={{ ...tdBase, color: "var(--text-secondary)" }} title={supplier.uniform ? undefined : `Suppliers: ${supplier.distinct.join(", ")}`}>
                      {supplier.uniform ? (supplier.value || "—") : "Multiple"}
                    </td>
                    <td style={{ ...tdBase, color: "var(--text-muted)", fontSize: 12 }}>—</td>
                    <td style={tdBase}>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {(["available", "sold", "reserved"] as const).filter(s => counts[s] > 0).map(s => (
                          <span key={s} style={{ background: statusColors[s].bg, color: statusColors[s].color, fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 20, whiteSpace: "nowrap" }}>
                            {counts[s]} {s}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td style={{ ...tdBase, textAlign: "right" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10 }}>
                        <button
                          onClick={e => { e.stopPropagation(); setBulkPrintGroup({ name: g.name, brand: g.brand, modelNumber: g.modelNumber, units: g.units }); }}
                          title="Print labels for this model"
                          style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-secondary)", cursor: "pointer", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", flexShrink: 0 }}
                        >
                          <Printer size={12} /> Bulk Print
                        </button>
                        <div>
                          <div style={{ fontSize: 9.5, color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>Stock Value</div>
                          <div style={{ fontSize: 12.5, fontWeight: 800, color: "var(--accent)" }}>{Rs(stockValue)}</div>
                        </div>
                      </div>
                    </td>
                  </tr>
                );

                if (!open) return [groupRow];

                // One card per physical unit, not a full 18-column row repeating
                // fields the group header above already states — device, brand,
                // storage, RAM and color are the same for every card here (they're
                // part of what makes this one group), so each card restates just
                // enough of them to stand on its own when read in isolation,
                // alongside what actually varies per unit: IMEI, IMEI 2, serial.
                const cardsRow = (
                  <tr key={`g-${g.key}-units`}>
                    <td colSpan={16} style={{ padding: "12px 16px 16px 44px", background: "var(--bg-primary)" }}>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                        {g.units.map((d, i) => {
                          const sc = statusColors[d.status];
                          return (
                            <div
                              key={d.id}
                              style={{
                                width: 230, flexShrink: 0, borderRadius: 10,
                                border: "1px solid var(--border)", background: "var(--bg-card)",
                                padding: "10px 12px", opacity: d.status === "sold" ? 0.65 : 1,
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 7 }}>
                                <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                                  Device {i + 1}
                                </span>
                                <span style={{ background: sc.bg, color: sc.color, fontSize: 9.5, fontWeight: 700, padding: "2px 7px", borderRadius: 20, textTransform: "capitalize" }}>
                                  {d.status}
                                </span>
                              </div>

                              <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 8 }}>
                                {([
                                  ["IMEI", d.imei],
                                  ["IMEI 2", d.imei2 || "—"],
                                  ["Serial", d.serialNumber || "—"],
                                ] as const).map(([label, val]) => (
                                  <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                                    <span style={{ fontSize: 10.5, color: "var(--text-muted)" }}>{label}</span>
                                    <span style={{ fontSize: 11.5, fontFamily: "monospace", color: "var(--text-primary)", textAlign: "right" }}>
                                      {val}
                                    </span>
                                  </div>
                                ))}
                              </div>

                              <div style={{ display: "flex", gap: 4, borderTop: "1px solid var(--border)", paddingTop: 7, justifyContent: "flex-end" }}>
                                <button onClick={() => setLabelDevice(d)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }} title="Print barcode label"><Tag size={13} /></button>
                                <button onClick={() => setEditDevice(d)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }} title="Edit"><Edit2 size={13} /></button>
                                <button onClick={() => setDeleteTarget(d)} style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", padding: 4 }} title="Delete"><Trash2 size={13} /></button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                );

                return [groupRow, cardsRow];
              })}
            </tbody>
          </table>
        </div>
        <div style={{ padding: "10px 16px", borderTop: "1px solid var(--border)", fontSize: 12, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          {filtered.length} of {devices.length} devices · {groups.length} model{groups.length === 1 ? "" : "s"}{loading ? " · loading…" : ""}
        </div>
      </div>

      {!configured && (
        <div style={{ display: "flex", gap: 9, padding: "11px 14px", borderRadius: 10, background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.4)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          <AlertTriangle size={15} color="#fbbf24" style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.55 }}>Connect Supabase to manage devices — nothing here is saved right now.</p>
        </div>
      )}

      {editDevice !== null && (
        <AddEditDeviceModal device={editDevice === "new" ? null : editDevice} devices={devices} onSave={saveDevice} onClose={() => setEditDevice(null)} />
      )}
      {bulkAddOpen && (
        <BulkAddDevicesModal devices={devices} saveDevice={saveDevice} onClose={() => setBulkAddOpen(false)} />
      )}
      {deleteTarget && (
        <DeleteConfirmModal
          name={`${deleteTarget.name} (${deleteTarget.imei})`}
          onConfirm={() => { if (!busy) void handleDelete(); }}
          onClose={() => setDeleteTarget(null)}
        />
      )}
      {labelDevice && (
        <BarcodeLabelModal
          code={labelDevice.imei}
          title={`${labelDevice.brand} ${labelDevice.name}`.trim()}
          subtitle={`${labelDevice.storage} · ${labelDevice.color}`}
          variant="device"
          imei={labelDevice.imei}
          price={Rs(labelDevice.suggestedPrice)}
          deviceName={labelDevice.name}
          modelNumber={labelDevice.modelNumber}
          onClose={() => setLabelDevice(null)}
        />
      )}
      {bulkPrintGroup && (
        <BulkPrintLabelsModal
          group={bulkPrintGroup}
          units={bulkPrintGroup.units}
          onClose={() => setBulkPrintGroup(null)}
        />
      )}
    </div>
  );
}

// ─── Accessories Tab ──────────────────────────────────────────────────────────

function AccessoriesTab({ accessories, loading, configured, saveProduct, deleteProduct }: {
  accessories: AccessoryProduct[];
  loading: boolean;
  configured: boolean;
  saveProduct: (p: AccessoryProduct) => Promise<AccessoryProduct>;
  deleteProduct: (id: number) => Promise<void>;
}) {
  const isMobile = useIsMobile();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [subcategoryFilter, setSubcategoryFilter] = useState("All");
  const [stockFilter, setStockFilter] = useState("All");
  const [editProduct, setEditProduct] = useState<AccessoryProduct | null | "new">(null);
  const [adjustProduct, setAdjustProduct] = useState<AccessoryProduct | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AccessoryProduct | null>(null);
  const [labelProduct, setLabelProduct] = useState<AccessoryProduct | null>(null);

  const { categories: categoryList, subcategories: subcategoryList } = useInventory();
  const categories = useMemo(() => ["All", ...categoryList.map(c => c.name).sort()], [categoryList]);
  // Narrowed to whichever main category is picked, same as the product form —
  // filtering by subcategory only makes sense once a category is chosen.
  const subcategoryOptionsForFilter = useMemo(() => {
    const cat = categoryList.find(c => c.name === categoryFilter);
    const pool = cat ? subcategoryList.filter(s => s.categoryId === cat.id) : subcategoryList;
    return ["All", ...new Set(pool.map(s => s.name))].sort((a, b) => a === "All" ? -1 : b === "All" ? 1 : a.localeCompare(b));
  }, [subcategoryList, categoryList, categoryFilter]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return accessories.filter(p => {
      if (categoryFilter !== "All" && p.category !== categoryFilter) return false;
      if (subcategoryFilter !== "All" && p.subcategory !== subcategoryFilter) return false;
      if (stockFilter === "In Stock" && p.stock === 0) return false;
      if (stockFilter === "Low Stock" && (p.stock === 0 || p.stock >= p.minStock)) return false;
      if (stockFilter === "Out of Stock" && p.stock > 0) return false;
      if (q && !p.code.toLowerCase().includes(q) && !p.name.toLowerCase().includes(q) && !p.brand.toLowerCase().includes(q) && !p.supplier.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [accessories, search, categoryFilter, subcategoryFilter, stockFilter]);

  const { sorted: rows, sort, toggle: toggleSort } = useTableSort(filtered, {
    code:        p => p.code,
    product:     p => p.name,
    brand:       p => p.brand,
    category:    p => p.category,
    subcategory: p => p.subcategory,
    compatible:  p => p.model,
    stock:       p => p.stock,
    min:         p => p.minStock,
    buying:      p => p.buyingPrice,
    selling:     p => p.sellingPrice,
    // The number behind the badge, not the badge — a margin sorted as text
    // would put 9% after 10%.
    margin:      p => (p.sellingPrice > 0 ? (p.sellingPrice - p.buyingPrice) / p.sellingPrice : 0),
    supplier:    p => p.supplier,
  });

  const inStock = accessories.filter(p => p.stock > 0).length;
  const lowStock = accessories.filter(p => p.stock > 0 && p.stock < p.minStock).length;
  const outOfStock = accessories.filter(p => p.stock === 0).length;
  const totalValue = accessories.reduce((s, p) => s + p.buyingPrice * p.stock, 0);

  async function handleAdjustStock(newStock: number) {
    if (!adjustProduct || busy) return;
    setBusy(true);
    try {
      await saveProduct({ ...adjustProduct, stock: newStock });
      setAdjustProduct(null);
    } catch (e) {
      toast.dialog("error", "Could not adjust stock", e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget || busy) return;
    setBusy(true);
    try {
      await deleteProduct(deleteTarget.id);
      setDeleteTarget(null);
    } catch (e) {
      toast.dialog("error", "Could not remove product", e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap: 10 }}>
        {([
          { label: "Total Products", value: accessories.length, color: "var(--text-primary)", bg: "var(--bg-surface)" },
          { label: "In Stock", value: inStock, color: "#16a34a", bg: "#dcfce7" },
          { label: "Low Stock", value: lowStock, color: "#b45309", bg: "#fef3c7" },
          { label: "Out of Stock", value: outOfStock, color: "#dc2626", bg: "#fee2e2" },
        ] as const).map(({ label, value, color, bg }) => (
          <div key={label} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{label}</span>
            <span style={{ fontSize: 15, fontWeight: 800, color, background: bg, padding: "2px 10px", borderRadius: 8 }}>{value}</span>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 10, alignItems: isMobile ? "stretch" : "center" }}>
        <div style={{ position: "relative", flex: 1 }}>
          <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by code, name, brand, supplier…" style={{ ...inputStyle, paddingLeft: 36, width: "100%", boxSizing: "border-box" as const }} />
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <select value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); setSubcategoryFilter("All"); }} style={{ ...selectStyle, flex: 1 }}>
            {categories.map(c => <option key={c}>{c}</option>)}
          </select>
          <select value={subcategoryFilter} onChange={e => setSubcategoryFilter(e.target.value)} style={{ ...selectStyle, flex: 1 }}>
            {subcategoryOptionsForFilter.map(s => <option key={s}>{s}</option>)}
          </select>
          <select value={stockFilter} onChange={e => setStockFilter(e.target.value)} style={{ ...selectStyle, flex: 1 }}>
            {["All", "In Stock", "Low Stock", "Out of Stock"].map(s => <option key={s}>{s}</option>)}
          </select>
          <div style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif", whiteSpace: "nowrap" }}>
            Value: <strong style={{ color: "var(--text-primary)" }}>{Rs(totalValue)}</strong>
          </div>
          <button onClick={() => setEditProduct("new")} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 8, border: "none", background: "var(--accent)", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "'Plus Jakarta Sans', sans-serif", whiteSpace: "nowrap" }}>
            <Plus size={14} /> {isMobile ? "Add" : "Add Product"}
          </button>
        </div>
      </div>

      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            <thead>
              <tr>
                {([
                  ["code", "Code"], ["product", "Product"], ["brand", "Brand"],
                  ["category", "Category"], ["subcategory", "Subcategory"],
                  ["compatible", "Compatible"], ["stock", "Stock"], ["min", "Min"],
                  ["buying", "Buying"], ["selling", "Selling"], ["margin", "Margin"],
                  ["supplier", "Supplier"], ["", ""],
                ] as const).map(([key, h]) => (
                  <SortHeader
                    key={h || "actions"} label={h} sortKey={key}
                    sort={sort} onSort={toggleSort} sortable={key !== ""}
                    style={thStyle}
                  />
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={13} style={{ ...tdBase, textAlign: "center", padding: 40, color: "var(--text-muted)" }}>No products match your filters</td></tr>
              ) : rows.map(p => {
                const isOut = p.stock === 0;
                const isLow = !isOut && p.stock < p.minStock;
                const m = p.sellingPrice - p.buyingPrice;
                const mp = marginPct(p.buyingPrice, p.sellingPrice);
                return (
                  <tr key={p.id} style={{ background: isOut ? "rgba(220,38,38,0.04)" : isLow ? "rgba(180,83,9,0.04)" : "transparent" }}>
                    <td style={{ ...tdBase, fontFamily: "monospace", fontWeight: 700, fontSize: 12 }}>{p.code}</td>
                    <td style={{ ...tdBase, fontWeight: 600, whiteSpace: "nowrap" }}>{p.name}</td>
                    <td style={tdBase}>{p.brand}</td>
                    <td style={tdBase}>
                      <span style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", fontSize: 11, padding: "2px 8px", borderRadius: 6 }}>{p.category}</span>
                    </td>
                    <td style={{ ...tdBase, color: "var(--text-secondary)", fontSize: 12 }}>{p.subcategory || "—"}</td>
                    <td style={{ ...tdBase, color: "var(--text-secondary)", fontSize: 12 }}>{p.model}</td>
                    <td style={{ ...tdBase, fontWeight: 700, color: isOut ? "#dc2626" : isLow ? "#b45309" : "#16a34a" }}>
                      {p.stock}
                      {isOut && <span style={{ marginLeft: 6, background: "#fee2e2", color: "#dc2626", fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4 }}>OUT</span>}
                      {isLow && <span style={{ marginLeft: 6, background: "#fef3c7", color: "#b45309", fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4 }}>LOW</span>}
                    </td>
                    <td style={{ ...tdBase, color: "var(--text-secondary)" }}>{p.minStock}</td>
                    <td style={tdBase}>{Rs(p.buyingPrice)}</td>
                    <td style={{ ...tdBase, fontWeight: 600 }}>{Rs(p.sellingPrice)}</td>
                    <td style={{ ...tdBase, color: "#16a34a", fontWeight: 700, whiteSpace: "nowrap" }}>
                      +{Rs(m)} <span style={{ fontWeight: 400, fontSize: 11, color: "var(--text-muted)" }}>({mp}%)</span>
                    </td>
                    <td style={{ ...tdBase, color: "var(--text-secondary)", fontSize: 12 }}>{p.supplier}</td>
                    <td style={{ ...tdBase, width: 120 }}>
                      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                        <button
                          onClick={() => setAdjustProduct(p)}
                          style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 6, cursor: "pointer", color: "var(--accent)", padding: "4px 8px", fontSize: 11, fontWeight: 600, fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                        >
                          Stock
                        </button>
                        <button onClick={() => setLabelProduct(p)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }} title="Print barcode label"><Tag size={14} /></button>
                        <button onClick={() => setEditProduct(p)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }} title="Edit"><Edit2 size={14} /></button>
                        <button onClick={() => setDeleteTarget(p)} style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", padding: 4 }} title="Delete"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ padding: "10px 16px", borderTop: "1px solid var(--border)", fontSize: 12, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          {filtered.length} of {accessories.length} products{loading ? " · loading…" : ""}
        </div>
      </div>

      {!configured && (
        <div style={{ display: "flex", gap: 9, padding: "11px 14px", borderRadius: 10, background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.4)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          <AlertTriangle size={15} color="#fbbf24" style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.55 }}>Connect Supabase to manage and sell accessories — nothing here is saved right now.</p>
        </div>
      )}

      {editProduct !== null && (
        <AddEditProductModal product={editProduct === "new" ? null : editProduct} existingProducts={accessories} onSave={saveProduct} onClose={() => setEditProduct(null)} />
      )}
      {adjustProduct && (
        <StockAdjustModal
          product={adjustProduct}
          onSave={newStock => { if (!busy) void handleAdjustStock(newStock); }}
          onClose={() => setAdjustProduct(null)}
        />
      )}
      {deleteTarget && (
        <DeleteConfirmModal
          name={`${deleteTarget.name} (${deleteTarget.code})`}
          onConfirm={() => { if (!busy) void handleDelete(); }}
          onClose={() => setDeleteTarget(null)}
        />
      )}
      {labelProduct && (
        <BarcodeLabelModal
          code={labelProduct.code}
          title={labelProduct.name}
          subtitle={`${labelProduct.brand} · ${labelProduct.model}`}
          variant="accessory"
          onClose={() => setLabelProduct(null)}
        />
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function InventoryManagement() {
  const [tab, setTab] = useState<InventoryTab>("Overview");
  const { devices, loading: devLoading, configured: devConfigured, saveDevice, deleteDevice } = useDevices();
  const { products: accessories, loading: accLoading, configured: accConfigured, saveProduct, deleteProduct } = useAccessories();
  const isMobile = useIsMobile();

  const lowStockCount = accessories.filter(p => p.stock >= 0 && p.stock < p.minStock).length;

  const tabs: { id: InventoryTab; icon: React.ComponentType<{ size?: number; strokeWidth?: number }>; label: string }[] = [
    { id: "Overview",        icon: BarChart3,  label: "Overview" },
    { id: "Mobile Devices",  icon: Smartphone, label: "Mobile Devices" },
    { id: "Accessories",     icon: Package,    label: "Accessories" },
    // A spare part is stock the shop counts, orders and runs out of, so it
    // belongs with the other things it counts rather than filed away with the
    // reference data an admin edits once a month.
    { id: "Repair Parts",    icon: Wrench,     label: "Repair Parts" },
    { id: "Stock Receiving", icon: Truck,      label: "Stock Receiving" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, flex: 1, minHeight: 0 }}>
      <div className="fade-up" style={{
        display: "flex", flexDirection: isMobile ? "column" : "row",
        alignItems: isMobile ? "stretch" : "center",
        justifyContent: "space-between", gap: isMobile ? 12 : 16,
      }}>
        <div>
          <h1 className="heading-xl" style={{ fontSize: 24, color: "var(--text-primary)" }}>Inventory Management</h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 5 }}>
            Track devices, accessories, stock levels, and margins.
          </p>
        </div>
        <div className={isMobile ? "tabs-scroll" : undefined}>
        <div style={{ display: "flex", gap: 6, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 6, width: "fit-content" }}>
          {tabs.map(({ id, icon: Icon, label }) => {
            const isActive = tab === id;
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 8, fontSize: 13, border: isActive ? "1px solid var(--accent-glow)" : "1px solid transparent", background: isActive ? "var(--accent-dim)" : "transparent", color: isActive ? "var(--accent)" : "var(--text-secondary)", fontWeight: isActive ? 600 : 400, cursor: "pointer", transition: "all 0.18s", fontFamily: "'Plus Jakarta Sans', sans-serif", whiteSpace: "nowrap", position: "relative" }}
                onMouseEnter={e => { if (!isActive) { (e.currentTarget as HTMLButtonElement).style.background = "var(--border)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)"; } }}
                onMouseLeave={e => { if (!isActive) { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)"; } }}
              >
                <Icon size={14} strokeWidth={isActive ? 2.5 : 1.8} />
                {label}
                {id === "Accessories" && lowStockCount > 0 && (
                  <span style={{ background: "#fef3c7", color: "#b45309", fontSize: 10, fontWeight: 800, padding: "1px 6px", borderRadius: 10, marginLeft: 2 }}>
                    {lowStockCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        </div>
      </div>

      {/* Low Stock Alert Banner */}
      {lowStockCount > 0 && (
        <div className="fade-up fade-up-2" style={{
          display: "flex", alignItems: "center", gap: 12,
          background: "rgba(251,191,36,0.07)", border: "1px solid rgba(251,191,36,0.25)",
          borderRadius: 10, padding: "11px 16px", marginTop: -8,
        }}>
          <AlertTriangle size={15} color="#fbbf24" style={{ flexShrink: 0 }} />
          <p style={{ fontSize: 13, color: "var(--text-primary)", flex: 1 }}>
            <strong style={{ color: "#fbbf24" }}>{lowStockCount} accessory item{lowStockCount > 1 ? "s" : ""}</strong> below reorder level — restock required.
          </p>
          <button
            onClick={() => setTab("Accessories")}
            style={{
              fontSize: 12, fontWeight: 600, color: "#fbbf24",
              background: "none", border: "1px solid rgba(251,191,36,0.3)", borderRadius: 7,
              cursor: "pointer", padding: "5px 12px",
              fontFamily: "'Plus Jakarta Sans', sans-serif",
            }}
          >
            View Items
          </button>
        </div>
      )}

      <div className="fade-up fade-up-2" style={{ borderTop: "1px solid var(--border)", marginTop: -8 }} />

      <div className="fade-up fade-up-3" style={{ flex: 1, overflowY: "auto", paddingBottom: 32 }}>
        {tab === "Overview"        && <OverviewTab devices={devices} accessories={accessories} />}
        {tab === "Mobile Devices"  && (
          <MobileDevicesTab
            devices={devices}
            loading={devLoading}
            configured={devConfigured}
            saveDevice={saveDevice}
            deleteDevice={deleteDevice}
          />
        )}
        {tab === "Accessories"     && <AccessoriesTab accessories={accessories} loading={accLoading} configured={accConfigured} saveProduct={saveProduct} deleteProduct={deleteProduct} />}
        {tab === "Repair Parts"    && <RepairPartsManager />}
        {tab === "Stock Receiving" && <StockReceiving />}
      </div>
    </div>
  );
}
