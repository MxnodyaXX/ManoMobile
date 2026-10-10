"use client";

import { Fragment, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Plus, Edit2, Trash2, Search, AlertCircle, Tag, X, Grid3x3, EyeOff, Save, ChevronRight, ChevronDown, Layers, Printer } from "lucide-react";
import { useParts, PART_CATEGORIES, type SparePart, type PartCategory } from "@/cashier/contexts/PartsContext";
import { useToast } from "@/lib/ui/toast";
import BarcodeLabelModal from "@/cashier/components/shared/BarcodeLabelModal";
import { printLabelsNode } from "@/cashier/utils/printLabel";
import { useInventory } from "@/cashier/contexts/InventoryContext";
import { inputStyle, labelStyle, thStyle, tdStyle, btnAccent, DeleteConfirm } from "@/admin/components/shared/adminUi";
import { useAuth } from "@/lib/auth/AuthContext";
import { useMyPermissions } from "@/lib/settings/staffRules";
import {
  useRackLayout, saveRackLayout, shelfCode, bayExists, bayCode, rowLetter,
  isHidden, RACK_MAX_ROWS, RACK_MAX_COLS, type RackLayout,
} from "@/lib/settings/partsRack";

/**
 * The spare-parts catalogue.
 *
 * Lives here rather than inside AdminControl because a screen and a page both
 * show it: a repair part is reference data an admin maintains AND stock the
 * shop counts, and those are the same rows seen from two directions. Kept as
 * one component so the two can never disagree about what a part is.
 */

// ─── The rack ─────────────────────────────────────────────────────────────────

/** One bay, drawn the same way in the picker and in the layout editor so the
 *  admin is looking at the thing the counter will see. */
function Bay({ label, tone, title, onClick }: {
  label: React.ReactNode;
  tone: "chosen" | "filled" | "empty" | "gone";
  title: string;
  onClick: () => void;
}) {
  const skin = {
    // Where this part is going, where other parts already are, where there is
    // room, and where there is no drawer at all. Four states that have to be
    // tellable apart without reading anything.
    chosen: { border: "1px solid var(--accent)",             background: "var(--accent)",              color: "var(--accent-fg)" },
    filled: { border: "1px solid rgba(251,191,36,0.45)",     background: "rgba(251,191,36,0.12)",      color: "#d97706" },
    empty:  { border: "1px solid var(--border)",             background: "var(--bg-secondary)",        color: "var(--text-muted)" },
    gone:   { border: "1px dashed var(--border)",            background: "transparent",                color: "var(--text-muted)" },
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{
        height: 30, borderRadius: 6, cursor: "pointer",
        fontSize: 10.5, fontWeight: 700,
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "background 0.12s, border-color 0.12s",
        opacity: tone === "gone" ? 0.45 : 1,
        ...skin,
      }}
    >
      {label}
    </button>
  );
}

/** The grid both the picker and the editor lay their bays on. */
function RackGrid({ layout, children }: { layout: RackLayout; children: React.ReactNode }) {
  return (
    <div className="scroll-x" style={{ marginTop: 10 }}>
      {/* keep-cols: the global mobile rule folds inline multi-column grids to
          one, which is right for a form and wrong for a rack — a rack folded
          into a column is not a rack. It scrolls sideways instead. */}
      <div
        className="keep-cols"
        style={{
          display: "grid",
          gridTemplateColumns: `16px repeat(${layout.cols}, minmax(32px, 1fr))`,
          gap: 4,
          minWidth: Math.min(640, 16 + layout.cols * 36),
        }}
      >
        {children}
      </div>
    </div>
  );
}

const headSt: React.CSSProperties = {
  fontSize: 9.5, fontWeight: 700, color: "var(--text-muted)",
  display: "flex", alignItems: "center", justifyContent: "center",
  letterSpacing: "0.04em",
};

/**
 * Pick a bay by pointing at it.
 *
 * Typing "Shelf A-3" asks somebody to hold a picture of the rack in their head
 * and spell it correctly, which is how a catalogue ends up with A-3, a3 and
 * "shelf a 3" all meaning one drawer and none of them findable by the next
 * person.
 *
 * It is also a map. Each bay says how many parts are already in it, so putting
 * a part away is a glance at where there is room rather than a walk to the
 * rack — and a drawer holding fourteen things is visible as a problem before
 * somebody adds a fifteenth.
 */
function RackPicker({ layout, value, occupied, onPick }: {
  layout: RackLayout;
  value: string | null;
  occupied: Map<string, number>;
  onPick: (code: string) => void;
}) {
  const cols = Array.from({ length: layout.cols }, (_, i) => i + 1);

  return (
    <RackGrid layout={layout}>
      <span />
      {cols.map(c => <span key={c} style={headSt}>{c}</span>)}

      {Array.from({ length: layout.rows }, (_, r) => (
        <Fragment key={r}>
          <span style={headSt}>{rowLetter(r)}</span>
          {cols.map(c => {
            const code = bayCode(r, c);
            // A bay the shop says is not there is left as a hole, not drawn as
            // a drawer nobody can use. The gap is the point: it is what makes
            // the picture on screen match the wall.
            if (isHidden(layout, code)) return <span key={code} />;
            const here = occupied.get(code) ?? 0;
            const on   = value === code;
            return (
              <Bay
                key={code}
                tone={on ? "chosen" : here > 0 ? "filled" : "empty"}
                label={on ? code : here > 0 ? here : ""}
                title={`Shelf ${code}${here > 0 ? ` — ${here} part${here === 1 ? "" : "s"} already here` : " — empty"}`}
                onClick={() => onPick(code)}
              />
            );
          })}
        </Fragment>
      ))}
    </RackGrid>
  );
}

// ─── Rack Layout Editor ───────────────────────────────────────────────────────

/**
 * Describing the rack that is actually against the wall.
 *
 * The picker shipped as a fixed 8 × 5, which is a guess. A real rack is two
 * units side by side with a gap between them, one column three drawers tall
 * and the next four. Forty identical bays where thirty-one exist is worse than
 * no picker at all: it invites somebody to file a screen in B-7, and B-7 is a
 * wall.
 *
 * So: set the size, then click off the bays that are not there. Hiding a bay
 * never renames its neighbour — the code comes from the position — so nothing
 * already filed moves.
 */
function RackLayoutModal({ layout, occupied, onSaved, onClose }: {
  layout: RackLayout;
  occupied: Map<string, number>;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<RackLayout>(layout);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const toast = useToast();

  const cols = Array.from({ length: draft.cols }, (_, i) => i + 1);

  const toggle = (code: string) =>
    setDraft(d => ({
      ...d,
      hidden: d.hidden.includes(code) ? d.hidden.filter(x => x !== code) : [...d.hidden, code],
    }));

  const resize = (k: "rows" | "cols", raw: number) => {
    const max = k === "rows" ? RACK_MAX_ROWS : RACK_MAX_COLS;
    setDraft(d => ({ ...d, [k]: Math.min(max, Math.max(1, Math.round(raw) || 1)) }));
  };

  /**
   * Parts about to be left off the rack — either in a bay being hidden, or
   * outside the new size.
   *
   * Not a reason to refuse: a shop reorganising its rack knows the drawers are
   * moving, and the parts move with them. It is a reason to say so, because
   * the alternative is finding out weeks later that four screens are filed
   * somewhere the picker no longer draws.
   */
  const stranded = useMemo(() => {
    let n = 0;
    for (const [code, count] of occupied) {
      if (!bayExists(draft, code)) n += count;
    }
    return n;
  }, [draft, occupied]);

  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      await saveRackLayout(draft);
      toast.success("Rack layout saved.");
      onSaved();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1001, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, width: "100%", maxWidth: 640, maxHeight: "90vh", overflowY: "auto", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>Rack Layout</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>Set the size, then click off the bays that are not there</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}><X size={18} /></button>
        </div>

        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <label style={labelStyle}>Rows (down)</label>
              <input type="number" min={1} max={RACK_MAX_ROWS} value={draft.rows} onChange={e => resize("rows", Number(e.target.value))} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Columns (across)</label>
              <input type="number" min={1} max={RACK_MAX_COLS} value={draft.cols} onChange={e => resize("cols", Number(e.target.value))} style={inputStyle} />
            </div>
          </div>

          <div style={{ fontSize: 11.5, color: "var(--text-secondary)", lineHeight: 1.55 }}>
            Click a bay to take it off the rack, and again to put it back. Two
            units side by side are one grid with the middle column hidden; a
            column that is three drawers tall is a column with its bottom bays
            hidden.
          </div>

          <RackGrid layout={draft}>
            <span />
            {cols.map(c => <span key={c} style={headSt}>{c}</span>)}
            {Array.from({ length: draft.rows }, (_, r) => (
              <Fragment key={r}>
                <span style={headSt}>{rowLetter(r)}</span>
                {cols.map(c => {
                  const code = bayCode(r, c);
                  const off  = isHidden(draft, code);
                  const here = occupied.get(code) ?? 0;
                  return (
                    <Bay
                      key={code}
                      tone={off ? "gone" : here > 0 ? "filled" : "empty"}
                      label={off ? <EyeOff size={11} /> : here > 0 ? here : code.replace("-", "")}
                      title={off
                        ? `${code} — not on the rack. Click to put it back.`
                        : `${code}${here > 0 ? ` — holds ${here} part${here === 1 ? "" : "s"}` : ""}. Click to take it off.`}
                      onClick={() => toggle(code)}
                    />
                  );
                })}
              </Fragment>
            ))}
          </RackGrid>

          {stranded > 0 && (
            <div style={{ display: "flex", gap: 9, padding: "11px 13px", borderRadius: 10, background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.35)" }}>
              <AlertCircle size={15} color="#fbbf24" style={{ flexShrink: 0, marginTop: 1 }} />
              <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.55 }}>
                <strong style={{ color: "var(--text-primary)" }}>{stranded} part{stranded === 1 ? " is" : "s are"} filed in a bay this layout does not have.</strong>{" "}
                Their location is kept exactly as it is — nothing is moved or cleared — but the picker will not draw it. Worth re-filing them once the drawers have actually moved.
              </p>
            </div>
          )}

          {err && (
            <div style={{ display: "flex", gap: 9, padding: "11px 13px", borderRadius: 10, background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.35)" }}>
              <AlertCircle size={15} color="#f87171" style={{ flexShrink: 0, marginTop: 1 }} />
              <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.55 }}>{err}</p>
            </div>
          )}
        </div>

        <div style={{ padding: "16px 24px 20px", borderTop: "1px solid var(--border)", display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "9px 20px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer", fontSize: 13, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Cancel</button>
          <button onClick={save} disabled={busy} style={{ ...btnAccent, padding: "9px 20px", opacity: busy ? 0.5 : 1 }}>
            <Save size={13} /> {busy ? "Saving…" : "Save Layout"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Part name picker ─────────────────────────────────────────────────────────

/**
 * A text box that is also a list of the parts already in the catalogue.
 *
 * Typing filters the list (by name or SKU). Picking a part makes this a new
 * type of it; typing a name that is not there makes a new part. Built by hand
 * rather than as a <datalist>, which every browser draws differently and none
 * of them can show a part's types, stock or category in.
 */
function PartNameCombo({ value, onChange, groups, invalid }: {
  value: string;
  onChange: (name: string) => void;
  groups: SparePart[][];
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const q = value.trim().toUpperCase();
  const shown = q
    ? groups.filter(g => g[0].name.toUpperCase().includes(q) || g.some(p => p.sku.toUpperCase().includes(q)))
    : groups;
  const exact = groups.some(g => g[0].name.trim().toUpperCase() === q);
  const list = shown.slice(0, 50);
  const active = Math.min(hi, Math.max(0, list.length - 1));

  const choose = (name: string) => { onChange(name); setOpen(false); };

  const mark = (text: string) => {
    if (!q) return text;
    const i = text.toUpperCase().indexOf(q);
    if (i < 0) return text;
    return <>{text.slice(0, i)}<span style={{ background: "rgba(251,191,36,0.3)", borderRadius: 3 }}>{text.slice(i, i + q.length)}</span>{text.slice(i + q.length)}</>;
  };

  return (
    <div style={{ position: "relative" }}>
      <div style={{ position: "relative" }}>
        <Search size={13} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={e => { onChange(e.target.value); setOpen(true); setHi(0); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={e => {
            if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setHi(h => Math.min(h + 1, list.length - 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setHi(h => Math.max(h - 1, 0)); }
            else if (e.key === "Enter" && open && list[active]) { e.preventDefault(); choose(list[active][0].name); }
            else if (e.key === "Escape") setOpen(false);
          }}
          placeholder="Search parts, or type a new name"
          autoComplete="off"
          style={{ ...inputStyle, paddingLeft: 32, paddingRight: 36, borderColor: invalid ? "#dc2626" : open ? "var(--accent)" : "var(--border)" }}
        />
        <button
          type="button"
          tabIndex={-1}
          onMouseDown={e => { e.preventDefault(); setOpen(o => !o); inputRef.current?.focus(); }}
          style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", width: 26, height: 26, borderRadius: 6, border: "none", background: "transparent", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <ChevronDown size={15} style={{ transition: "transform 0.15s", transform: open ? "rotate(180deg)" : undefined }} />
        </button>
      </div>

      {open && (list.length > 0 || (q && !exact)) && (
        <div
          onMouseDown={e => e.preventDefault()}
          style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 20, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, boxShadow: "0 16px 40px rgba(0,0,0,0.28)", overflow: "hidden" }}
        >
          {list.length > 0 && (
            <div style={{ padding: "8px 12px 4px", fontSize: 9.5, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)" }}>
              Existing parts · pick one to add another type
            </div>
          )}
          <div style={{ maxHeight: 264, overflowY: "auto", padding: "2px 6px 6px" }}>
            {list.map((g, i) => {
              const head = g[0];
              const stock = g.reduce((n, p) => n + p.stock, 0);
              const on = i === active;
              return (
                <div
                  key={head.id}
                  onMouseEnter={() => setHi(i)}
                  onClick={() => choose(head.name)}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, cursor: "pointer", background: on ? "var(--accent-dim, rgba(96,165,250,0.12))" : "transparent" }}
                >
                  <div style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-secondary)", border: "1px solid var(--border)", color: g.length > 1 ? "var(--accent)" : "var(--text-muted)" }}>
                    <Layers size={14} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{mark(head.name)}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap", marginTop: 3 }}>
                      {g.map(p => (
                        <span key={p.id} style={{ fontFamily: "monospace", fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 5, border: "1px solid var(--border)", background: "var(--bg-secondary)", color: "var(--text-secondary)" }}>{mark(p.sku)}</span>
                      ))}
                      <span style={{ fontSize: 10.5, color: "var(--text-muted)", marginLeft: 2 }}>{head.category}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: stock === 0 ? "#dc2626" : "var(--text-primary)" }}>{stock}</div>
                    <div style={{ fontSize: 9.5, color: "var(--text-muted)" }}>in stock</div>
                  </div>
                </div>
              );
            })}
          </div>
          {q && !exact && (
            <div
              onClick={() => setOpen(false)}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderTop: "1px solid var(--border)", background: "var(--bg-secondary)", cursor: "pointer", fontSize: 12, color: "var(--text-secondary)" }}
            >
              <Plus size={13} color="var(--accent)" />
              New part <strong style={{ color: "var(--text-primary)" }}>&ldquo;{value.trim()}&rdquo;</strong>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Repair Part Modal ────────────────────────────────────────────────────────

function PartModal({ part, preset, onSave, onClose }: {
  part: SparePart | null;
  /** A new type of an existing part: same name, category and devices, its own
   *  SKU, stock and cost. */
  preset?: SparePart | null;
  onSave: (p: SparePart) => void;
  onClose: () => void;
}) {
  const blank: SparePart = { id: "", sku: "", name: "", category: "Screen", compatibleWith: [], stock: 0, reorderLevel: 5, costPrice: 0, location: "" };
  const [form, setForm] = useState<SparePart>(part ?? (preset
    ? { ...blank, name: preset.name, category: preset.category, compatibleWith: preset.compatibleWith, reorderLevel: preset.reorderLevel, location: preset.location }
    : blank));
  const [compatText, setCompatText] = useState((part?.compatibleWith ?? preset?.compatibleWith ?? []).join(", "));

  /**
   * How full each bay is, for the rack below.
   *
   * The part being edited is left out of its own count — otherwise moving a
   * part from A-3 to B-2 shows A-3 still holding it, which is the one thing
   * the map is there to answer.
   */
  const { parts } = useParts();
  const { layout } = useRackLayout();
  const occupied = useMemo(() => {
    const m = new Map<string, number>();
    for (const other of parts) {
      if (part && other.id === part.id) continue;
      const code = shelfCode(other.location);
      if (code) m.set(code, (m.get(code) ?? 0) + 1);
    }
    return m;
  }, [parts, part]);
  const [errors, setErrors] = useState<Partial<Record<"name" | "sku", string>>>({});

  const set = <K extends keyof SparePart>(k: K, v: SparePart[K]) => setForm(f => ({ ...f, [k]: v }));

  /**
   * The names already in the catalogue, for the Part Name dropdown. Picking
   * one makes this a new type of that part, listed under it, so it starts
   * from that part's category, devices and shelf rather than a blank form.
   */
  const partNames = useMemo(() => {
    const m = new Map<string, SparePart[]>();
    for (const x of parts) {
      if (part && x.id === part.id) continue;
      const k = x.name.trim().toUpperCase();
      const l = m.get(k);
      if (l) l.push(x); else m.set(k, [x]);
    }
    return m;
  }, [parts, part]);
  const sameName = partNames.get(form.name.trim().toUpperCase()) ?? [];

  const pickName = (name: string) => {
    set("name", name);
    setErrors(p => ({ ...p, name: undefined }));
    const match = partNames.get(name.trim().toUpperCase());
    // Only for a new part, and only into what has not been filled in yet.
    // Editing an existing part, or overwriting what was just typed, would be
    // a surprise.
    if (part || !match) return;
    const src = match[0];
    setForm(f => ({
      ...f,
      name,
      category: src.category,
      reorderLevel: f.reorderLevel === blank.reorderLevel ? src.reorderLevel : f.reorderLevel,
      location: f.location || src.location,
    }));
    if (!compatText.trim()) setCompatText(src.compatibleWith.join(", "));
  };

  // The shop's supplier list (Inventory → Suppliers), the same one devices and
  // accessories pick from. A supplier since switched off still shows on a part
  // that already names it, so editing that part does not blank it.
  const { suppliers } = useInventory();
  const supplierNames = useMemo(() => {
    const names = suppliers.filter(x => x.active).map(x => x.name);
    const cur = (form.supplier ?? "").trim();
    if (cur && !names.some(n => n.toUpperCase() === cur.toUpperCase())) names.unshift(cur);
    return names;
  }, [suppliers, form.supplier]);

  function validate() {
    const e: typeof errors = {};
    if (!form.name.trim()) e.name = "Name is required";
    if (!form.sku.trim()) e.sku = "SKU is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSave() {
    if (!validate()) return;
    const compatibleWith = compatText.split(",").map(s => s.trim()).filter(Boolean);
    onSave({ ...form, compatibleWith });
  }

  return createPortal(
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: "var(--bg-card)", zIndex: 1 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>{part ? "Edit Part" : preset ? `Add a type of ${preset.name}` : "Add Repair Part"}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
              {preset && !part
                ? "Same name, so it is listed under the same part. Give it its own SKU — the quality or supplier, e.g. HD+ or CROWN."
                : "Spare-part stock consumed on repairs — separate from retail accessories. Parts with the same name are grouped as types of one part."}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}><X size={18} /></button>
        </div>
        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={labelStyle}>Part Name</label>
            {/* Type a new name, or open the list and pick an existing part to
                add another type of it (a different supplier or quality). */}
            <PartNameCombo value={form.name} onChange={pickName} groups={[...partNames.values()]} invalid={!!errors.name} />
            {errors.name && <div style={{ fontSize: 11, color: "#dc2626", marginTop: 3 }}>{errors.name}</div>}
            {!errors.name && sameName.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", fontSize: 11, color: "var(--text-muted)", marginTop: 5 }}>
                <Layers size={11} />
                {part ? "Grouped with" : "Will be listed as another type of this part, beside"}
                {sameName.map(x => (
                  <span key={x.id} style={{ fontFamily: "monospace", fontSize: 10.5, padding: "1px 6px", borderRadius: 5, border: "1px solid var(--border)", color: "var(--text-secondary)" }}>{x.sku}</span>
                ))}
              </div>
            )}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <label style={labelStyle}>SKU</label>
              <input type="text" value={form.sku} onChange={e => { set("sku", e.target.value); setErrors(p => ({ ...p, sku: undefined })); }} placeholder="e.g. SCR-IP13-001" style={{ ...inputStyle, borderColor: errors.sku ? "#dc2626" : "var(--border)" }} />
              {errors.sku && <div style={{ fontSize: 11, color: "#dc2626", marginTop: 3 }}>{errors.sku}</div>}
            </div>
            <div>
              <label style={labelStyle}>Category</label>
              <select value={form.category} onChange={e => set("category", e.target.value as PartCategory)} style={{ ...inputStyle, cursor: "pointer" }}>
                {PART_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={labelStyle}>Compatible Devices</label>
            <input type="text" value={compatText} onChange={e => setCompatText(e.target.value)} placeholder="e.g. iPhone 13, iPhone 13 Pro" style={inputStyle} />
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>Comma-separated — shown to technicians when they search for a part</div>
          </div>
          <div>
            <label style={labelStyle}>Supplier</label>
            <select value={form.supplier ?? ""} onChange={e => set("supplier", e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
              <option value="">— Not recorded —</option>
              {supplierNames.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            {supplierNames.length === 0 && (
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>No suppliers yet — add them where device and accessory suppliers are kept.</div>
            )}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
            <div>
              <label style={labelStyle}>Stock</label>
              <input type="number" min={0} value={form.stock} onChange={e => set("stock", Math.max(0, Number(e.target.value) || 0))} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Reorder Level</label>
              <input type="number" min={0} value={form.reorderLevel} onChange={e => set("reorderLevel", Math.max(0, Number(e.target.value) || 0))} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Cost Price (Rs.)</label>
              <input type="number" min={0} value={form.costPrice} onChange={e => set("costPrice", Math.max(0, Number(e.target.value) || 0))} style={inputStyle} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Storage Location</label>
            {/* Still free text. A part that lives in a drawer or a supplier's
                box has a location the rack cannot express, and refusing to
                record it would be worse than an unmapped one. */}
            <input type="text" value={form.location} onChange={e => set("location", e.target.value)} placeholder="e.g. Shelf A-3" style={inputStyle} />
            <RackPicker
              layout={layout}
              value={shelfCode(form.location)}
              occupied={occupied}
              // Clicking the shelf it is already on takes it off, so a
              // mis-click is undone the same way it was made.
              onPick={code => set("location", shelfCode(form.location) === code ? "" : `Shelf ${code}`)}
            />
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.5 }}>
              Tap a bay to fill the box above. Amber bays already hold parts — the number is how many. Gaps are bays the rack does not have.
            </div>
          </div>
        </div>
        <div style={{ padding: "16px 24px 20px", borderTop: "1px solid var(--border)", display: "flex", gap: 10, justifyContent: "flex-end", position: "sticky", bottom: 0, background: "var(--bg-card)" }}>
          <button onClick={onClose} style={{ padding: "9px 20px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer", fontSize: 13, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Cancel</button>
          <button onClick={handleSave} style={{ ...btnAccent, padding: "9px 20px" }}>{part ? "Save Changes" : "Add Part"}</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Bulk part labels ─────────────────────────────────────────────────────────

/**
 * Labels for many parts, or many of one part, in a single print job.
 *
 * A delivery of twenty displays wants twenty bin labels, and a new rack wants
 * one for every drawer. Same mechanism as the device bulk print: each chosen
 * part's label is rendered off-screen once, silently, its markup collected,
 * repeated for the number of copies asked for, and the whole lot sent to the
 * printer together, one label per page. One at a time rather than all at
 * once, because simultaneous template lookups and auto-fit measurements step
 * on each other.
 */
function BulkPartLabelsModal({ parts, onClose }: { parts: SparePart[]; onClose: () => void }) {
  const toast = useToast();
  const [copies, setCopies] = useState<Record<string, number>>(
    () => Object.fromEntries(parts.map(p => [p.id, 1])),
  );
  const [selected, setSelected] = useState<Set<string>>(() => new Set(parts.map(p => p.id)));
  const [queue, setQueue] = useState<SparePart[] | null>(null);
  const collected = useRef<{ html: string; w: number; h: number; n: number }[]>([]);
  const [done, setDone] = useState(0);

  const chosen = parts.filter(p => selected.has(p.id) && (copies[p.id] ?? 0) > 0);
  const totalLabels = chosen.reduce((n, p) => n + (copies[p.id] ?? 0), 0);
  const printing = queue !== null;
  const current = queue && queue.length > 0 ? queue[0] : null;

  const toggle = (id: string) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const setAll = (f: (p: SparePart) => number) =>
    setCopies(Object.fromEntries(parts.map(p => [p.id, f(p)])));

  const start = () => {
    if (chosen.length === 0) return;
    collected.current = [];
    setDone(0);
    setQueue(chosen);
  };

  // The label on screen is always queue[0] — it is keyed by that part — so the
  // queue this render sees is the one that label belongs to.
  const handleReady = (html: string, w: number, h: number) => {
    const q = queue ?? [];
    if (q[0]) collected.current.push({ html, w, h, n: copies[q[0].id] ?? 1 });
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
    onClose();
  };

  const chip: React.CSSProperties = { padding: "6px 12px", borderRadius: 8, fontSize: 11.5, fontWeight: 600, border: "1px solid var(--border)", background: "var(--bg-secondary)", color: "var(--text-secondary)", cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" };

  return (
    <>
      {createPortal(
        <div
          onClick={e => { if (e.target === e.currentTarget && !printing) onClose(); }}
          style={{ position: "fixed", inset: 0, zIndex: 1100, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
        >
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, width: "min(560px, calc(100vw - 24px))", maxHeight: "calc(100vh - 40px)", display: "flex", flexDirection: "column", overflow: "hidden", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderBottom: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>Bulk Print Part Labels</p>
                <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>Tick the parts and set how many labels each one needs</p>
              </div>
              {!printing && (
                <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={14} /></button>
              )}
            </div>

            {printing ? (
              <div style={{ padding: 28, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                <Printer size={22} color="var(--accent)" />
                <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Preparing part {Math.min(done + 1, chosen.length)} of {chosen.length}…</p>
                <p style={{ fontSize: 11.5, color: "var(--text-muted)", textAlign: "center" }}>All {totalLabels} labels print together as one job.</p>
              </div>
            ) : (
              <>
                <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 12, overflowY: "auto" }}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button style={chip} onClick={() => setSelected(new Set(parts.map(p => p.id)))}>All ({parts.length})</button>
                    <button style={chip} onClick={() => setSelected(new Set())}>None</button>
                    <button style={chip} onClick={() => setAll(() => 1)} title="One label per part, e.g. for the bins">1 each</button>
                    <button style={chip} onClick={() => setAll(p => Math.max(1, p.stock))} title="One label for every piece in stock">One per piece in stock</button>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 340, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 10, padding: 6 }}>
                    {parts.map(p => {
                      const on = selected.has(p.id);
                      return (
                        <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 8px", borderRadius: 7, background: on ? "var(--accent-dim)" : "transparent" }}>
                          <input type="checkbox" checked={on} onChange={() => toggle(p.id)} style={{ cursor: "pointer" }} />
                          <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => toggle(p.id)}>
                            <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                              <span style={{ fontFamily: "monospace" }}>{p.sku}</span>{p.supplier ? ` · ${p.supplier}` : ""} · {p.stock} in stock
                            </div>
                          </div>
                          <input
                            type="number" min={0} max={500}
                            value={copies[p.id] ?? 0}
                            disabled={!on}
                            onChange={e => setCopies(c => ({ ...c, [p.id]: Math.min(500, Math.max(0, Math.round(Number(e.target.value) || 0))) }))}
                            title="Labels to print"
                            style={{ ...inputStyle, width: 64, padding: "6px 8px", textAlign: "center", opacity: on ? 1 : 0.4 }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "12px 18px", borderTop: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
                  <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{chosen.length} part{chosen.length === 1 ? "" : "s"} · {totalLabels} label{totalLabels === 1 ? "" : "s"}</span>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={onClose} style={{ padding: "8px 18px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer" }}>Cancel</button>
                    <button onClick={start} disabled={totalLabels === 0} style={{ ...btnAccent, padding: "8px 18px", opacity: totalLabels === 0 ? 0.45 : 1, cursor: totalLabels === 0 ? "not-allowed" : "pointer" }}>
                      <Printer size={13} /> Print {totalLabels || ""} Label{totalLabels === 1 ? "" : "s"}
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
          variant="part"
          code={current.sku}
          title={current.name}
          subtitle={current.category}
          silent
          onReady={handleReady}
          onClose={() => {}}
        />
      )}
    </>
  );
}

// ─── Repair Parts Manager ─────────────────────────────────────────────────────

function PartsManager() {
  const { parts, savePart, deletePart, loading, error, configured } = useParts();
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<PartCategory | "All">("All");
  const [modal, setModal] = useState<SparePart | null | "new">(null);
  const [deleteTarget, setDeleteTarget] = useState<SparePart | null>(null);
  const [labelPart, setLabelPart] = useState<SparePart | null>(null);
  const [rackOpen, setRackOpen] = useState(false);

  /**
   * Whoever may maintain the catalogue may describe the rack it lives on —
   * an Admin, or an Admin Cashier. Deliberately the same rule as adding a
   * part, and the same rule set_parts_rack enforces in the database, so the
   * button is never offered to somebody the save would then refuse.
   *
   * Hidden rather than disabled for everyone else: an ordinary cashier filing
   * a part has no use for a button that tells them off.
   */
  const { can } = useAuth();
  const { isAdminCashier } = useMyPermissions();
  const mayEditRack = can("Admin") || isAdminCashier;
  const { layout, reload: reloadRack } = useRackLayout();

  const occupiedBays = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of parts) {
      const code = shelfCode(p.location);
      if (code) m.set(code, (m.get(code) ?? 0) + 1);
    }
    return m;
  }, [parts]);

  const filtered = parts.filter(p => {
    if (catFilter !== "All" && p.category !== catFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!p.name.toLowerCase().includes(q) && !p.sku.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  /**
   * One part, several types of it.
   *
   * "M02 Display" from two suppliers is two rows in the catalogue — different
   * SKU, different cost, different quality (HD+, CROWN), counted separately —
   * but it is one part to whoever is looking for it. So rows that share a name
   * are drawn as a single part with its types underneath. The name is the
   * grouping, so no type is ever orphaned by a missing link.
   */
  const groups = useMemo(() => {
    const m = new Map<string, SparePart[]>();
    for (const p of filtered) {
      const key = p.name.trim().toUpperCase();
      const list = m.get(key);
      if (list) list.push(p); else m.set(key, [p]);
    }
    return [...m.entries()].map(([key, items]) => ({
      key,
      items: items.slice().sort((a, b) => a.sku.localeCompare(b.sku)),
    }));
  }, [filtered]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggleGroup = (key: string) =>
    setCollapsed(c => {
      const n = new Set(c);
      if (n.has(key)) n.delete(key); else n.add(key);
      return n;
    });
  const [addTypeOf, setAddTypeOf] = useState<SparePart | null>(null);
  const [bulkParts, setBulkParts] = useState<SparePart[] | null>(null);

  const stockCell = (stock: number, reorder: number) => {
    const low = stock > 0 && stock <= reorder;
    return (
      <>
        <span style={{ fontWeight: 700, color: stock === 0 ? "#dc2626" : low ? "#b45309" : "#16a34a" }}>{stock}</span>
        {low && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: "#fef3c7", color: "#b45309" }}>LOW</span>}
        {stock === 0 && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: "#fee2e2", color: "#dc2626" }}>OUT</span>}
      </>
    );
  };

  const iconBtn: React.CSSProperties = { background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 };

  const partRow = (p: SparePart, asType: boolean) => (
    <tr key={p.id} style={asType ? { background: "var(--bg-secondary)" } : undefined}>
      <td style={tdStyle}>
        {asType ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, paddingLeft: 22 }}>
            <span style={{ width: 8, height: 8, borderLeft: "1.5px solid var(--border)", borderBottom: "1.5px solid var(--border)", marginTop: -6 }} />
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.03em", padding: "3px 8px", borderRadius: 6, background: "var(--accent-dim, rgba(96,165,250,0.12))", color: "var(--accent)", border: "1px solid var(--border)" }}>{p.sku}</span>
          </span>
        ) : (
          <span style={{ fontWeight: 600 }}>{p.name}</span>
        )}
      </td>
      <td style={tdStyle}>
        <div style={{ fontFamily: "monospace", fontSize: 12 }}>{p.sku}</div>
        {p.supplier && <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 2 }}>{p.supplier}</div>}
      </td>
      <td style={{ ...tdStyle, fontSize: 12, color: "var(--text-secondary)" }}>{p.category}</td>
      <td style={{ ...tdStyle, fontSize: 12, color: "var(--text-secondary)", maxWidth: 220 }}>{p.compatibleWith.length ? p.compatibleWith.join(", ") : "—"}</td>
      <td style={tdStyle}>{stockCell(p.stock, p.reorderLevel)}</td>
      <td style={tdStyle}>Rs. {p.costPrice.toLocaleString()}</td>
      <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 12, color: "var(--text-secondary)" }}>{p.location || "—"}</td>
      <td style={tdStyle}>
        <div style={{ display: "flex", gap: 4 }}>
          {!asType && <button onClick={() => setAddTypeOf(p)} title="Add another type of this part (a different supplier or quality)" style={iconBtn}><Layers size={14} /></button>}
          <button onClick={() => setLabelPart(p)} title="Print part label" style={iconBtn}><Tag size={14} /></button>
          <button onClick={() => setModal(p)} title="Edit" style={iconBtn}><Edit2 size={14} /></button>
          <button onClick={() => setDeleteTarget(p)} title="Delete" style={{ ...iconBtn, color: "#dc2626" }}><Trash2 size={14} /></button>
        </div>
      </td>
    </tr>
  );

  const groupRows = (g: { key: string; items: SparePart[] }) => {
    const head = g.items[0];
    const open = !collapsed.has(g.key);
    const total = g.items.reduce((n, p) => n + p.stock, 0);
    const reorder = Math.max(...g.items.map(p => p.reorderLevel));
    const costs = g.items.map(p => p.costPrice);
    const lo = Math.min(...costs), hi = Math.max(...costs);
    const cats = [...new Set(g.items.map(p => p.category))];
    const compat = [...new Set(g.items.flatMap(p => p.compatibleWith))];
    const locs = [...new Set(g.items.map(p => p.location).filter(Boolean))];
    return (
      <Fragment key={g.key}>
        <tr onClick={() => toggleGroup(g.key)} style={{ cursor: "pointer" }}>
          <td style={tdStyle}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              {open ? <ChevronDown size={14} color="var(--text-muted)" /> : <ChevronRight size={14} color="var(--text-muted)" />}
              <span style={{ fontWeight: 700 }}>{head.name}</span>
              <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 10, background: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>{g.items.length} types</span>
            </span>
          </td>
          <td style={tdStyle}>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {g.items.map(p => (
                <span key={p.id} style={{ fontFamily: "monospace", fontSize: 11, padding: "2px 6px", borderRadius: 5, border: "1px solid var(--border)", color: "var(--text-secondary)" }}>{p.sku}</span>
              ))}
            </div>
          </td>
          <td style={{ ...tdStyle, fontSize: 12, color: "var(--text-secondary)" }}>{cats.join(", ")}</td>
          <td style={{ ...tdStyle, fontSize: 12, color: "var(--text-secondary)", maxWidth: 220 }}>{compat.length ? compat.join(", ") : "—"}</td>
          <td style={tdStyle} title="All types together">{stockCell(total, reorder)}</td>
          <td style={tdStyle}>{lo === hi ? `Rs. ${lo.toLocaleString()}` : `Rs. ${lo.toLocaleString()} – ${hi.toLocaleString()}`}</td>
          <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 12, color: "var(--text-secondary)" }}>{locs.length ? locs.join(", ") : "—"}</td>
          <td style={tdStyle}>
            <div style={{ display: "flex", gap: 4 }}>
              <button onClick={e => { e.stopPropagation(); setAddTypeOf(head); }} title="Add another type of this part" style={iconBtn}><Layers size={14} /></button>
              <button onClick={e => { e.stopPropagation(); setBulkParts(g.items); }} title="Print labels for these types" style={iconBtn}><Printer size={14} /></button>
            </div>
          </td>
        </tr>
        {open && g.items.map(p => partRow(p, true))}
      </Fragment>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 220, maxWidth: 380 }}>
          <Search size={13} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or SKU…" style={{ ...inputStyle, paddingLeft: 34, fontSize: 12 }} />
        </div>
        <select value={catFilter} onChange={e => setCatFilter(e.target.value as PartCategory | "All")} style={{ ...inputStyle, width: "auto", cursor: "pointer", fontSize: 12 }}>
          <option value="All">All Categories</option>
          {PART_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {mayEditRack && (
          <button
            onClick={() => setRackOpen(true)}
            title="Describe the rack: its size, and which bays are not there"
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 15px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer", fontSize: 12.5, fontFamily: "'Plus Jakarta Sans', sans-serif", whiteSpace: "nowrap" }}
          >
            <Grid3x3 size={13} /> Rack Layout
          </button>
        )}
        <button
          onClick={() => filtered.length > 0 && setBulkParts(filtered)}
          disabled={filtered.length === 0}
          title="Print barcode labels for the parts shown — tick which ones and how many of each"
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 15px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", cursor: filtered.length ? "pointer" : "not-allowed", opacity: filtered.length ? 1 : 0.5, fontSize: 12.5, fontFamily: "'Plus Jakarta Sans', sans-serif", whiteSpace: "nowrap" }}
        >
          <Printer size={13} /> Print Labels
        </button>
        <button onClick={() => setModal("new")} style={btnAccent}><Plus size={13} /> Add Part</button>
      </div>

      {rackOpen && (
        <RackLayoutModal
          layout={layout}
          occupied={occupiedBays}
          onSaved={reloadRack}
          onClose={() => setRackOpen(false)}
        />
      )}
      {(!configured || error) && (
        <div style={{ display: "flex", gap: 9, padding: "11px 14px", borderRadius: 10, background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.4)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          <AlertCircle size={15} color="#fbbf24" style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.55 }}>
            {!configured
              ? "Connect Supabase to store the parts catalog — nothing added here will be saved."
              : `${error} — run migration 20260819000010_repair_parts_catalog.sql.`}
          </p>
        </div>
      )}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          <thead><tr>
            <th style={thStyle}>Part</th><th style={thStyle}>SKU</th><th style={thStyle}>Category</th>
            <th style={thStyle}>Compatible With</th><th style={thStyle}>Stock</th><th style={thStyle}>Cost</th>
            <th style={thStyle}>Location</th><th style={{ ...thStyle, width: 104 }}></th>
          </tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ ...tdStyle, textAlign: "center", padding: 36, color: "var(--text-muted)" }}>Loading parts…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} style={{ ...tdStyle, textAlign: "center", padding: 36, color: "var(--text-muted)" }}>{search || catFilter !== "All" ? "No parts match" : "No repair parts added yet — click “Add Part” to start the catalog"}</td></tr>
            ) : groups.map(g => g.items.length === 1 ? partRow(g.items[0], false) : groupRows(g))}
          </tbody>
        </table>
        </div>
        <div style={{ padding: "10px 16px", borderTop: "1px solid var(--border)", fontSize: 12, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{groups.length} part{groups.length === 1 ? "" : "s"} · {filtered.length} of {parts.length} stock lines</div>
      </div>
      {modal !== null && (
        <PartModal
          part={modal === "new" ? null : modal}
          onSave={async p => {
            try {
              await savePart(p);
              toast.dialog("success", modal === "new" ? "Part added" : "Part updated", `${p.name} (${p.sku})`);
              setModal(null);
            } catch (e) {
              // Modal stays open with the values still in it — a save that
              // failed must not look like one that worked.
              toast.dialog("error", "Could not save part", e instanceof Error ? e.message : String(e));
            }
          }}
          onClose={() => setModal(null)}
        />
      )}
      {bulkParts && <BulkPartLabelsModal parts={bulkParts} onClose={() => setBulkParts(null)} />}
      {addTypeOf && (
        <PartModal
          part={null}
          preset={addTypeOf}
          onSave={async p => {
            try {
              await savePart(p);
              toast.dialog("success", "Type added", `${p.name} (${p.sku})`);
              setAddTypeOf(null);
            } catch (e) {
              toast.dialog("error", "Could not save part", e instanceof Error ? e.message : String(e));
            }
          }}
          onClose={() => setAddTypeOf(null)}
        />
      )}
      {deleteTarget && (
        <DeleteConfirm
          name={deleteTarget.name}
          onConfirm={async () => {
            try {
              await deletePart(deleteTarget.id);
              toast.dialog("success", "Part removed", `${deleteTarget.name} has been removed from the catalog.`);
            } catch (e) {
              toast.dialog("error", "Could not remove part", e instanceof Error ? e.message : String(e));
            }
            setDeleteTarget(null);
          }}
          onClose={() => setDeleteTarget(null)}
        />
      )}
      {labelPart && (
        <BarcodeLabelModal
          variant="part"
          code={labelPart.sku}
          title={labelPart.name}
          subtitle={labelPart.category}
          onClose={() => setLabelPart(null)}
        />
      )}
    </div>
  );
}

export default PartsManager;
