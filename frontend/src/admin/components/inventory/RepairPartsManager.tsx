"use client";

import { Fragment, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Plus, Edit2, Trash2, Search, AlertCircle, Tag, X, Grid3x3, EyeOff, Save } from "lucide-react";
import { useParts, PART_CATEGORIES, type SparePart, type PartCategory } from "@/cashier/contexts/PartsContext";
import { useToast } from "@/lib/ui/toast";
import BarcodeLabelModal from "@/cashier/components/shared/BarcodeLabelModal";
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

// ─── Repair Part Modal ────────────────────────────────────────────────────────

function PartModal({ part, onSave, onClose }: { part: SparePart | null; onSave: (p: SparePart) => void; onClose: () => void }) {
  const blank: SparePart = { id: "", sku: "", name: "", category: "Screen", compatibleWith: [], stock: 0, reorderLevel: 5, costPrice: 0, location: "" };
  const [form, setForm] = useState<SparePart>(part ?? blank);
  const [compatText, setCompatText] = useState((part?.compatibleWith ?? []).join(", "));

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
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>{part ? "Edit Part" : "Add Repair Part"}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>Spare-part stock consumed on repairs — separate from retail accessories</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}><X size={18} /></button>
        </div>
        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={labelStyle}>Part Name</label>
            <input type="text" value={form.name} onChange={e => { set("name", e.target.value); setErrors(p => ({ ...p, name: undefined })); }} placeholder="e.g. iPhone 13 OLED Screen" style={{ ...inputStyle, borderColor: errors.name ? "#dc2626" : "var(--border)" }} />
            {errors.name && <div style={{ fontSize: 11, color: "#dc2626", marginTop: 3 }}>{errors.name}</div>}
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
            ) : filtered.map(p => {
              const low = p.stock > 0 && p.stock <= p.reorderLevel;
              return (
                <tr key={p.id}>
                  <td style={tdStyle}><span style={{ fontWeight: 600 }}>{p.name}</span></td>
                  <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 12 }}>{p.sku}</td>
                  <td style={{ ...tdStyle, fontSize: 12, color: "var(--text-secondary)" }}>{p.category}</td>
                  <td style={{ ...tdStyle, fontSize: 12, color: "var(--text-secondary)", maxWidth: 220 }}>{p.compatibleWith.length ? p.compatibleWith.join(", ") : "—"}</td>
                  <td style={tdStyle}>
                    <span style={{ fontWeight: 700, color: p.stock === 0 ? "#dc2626" : low ? "#b45309" : "#16a34a" }}>{p.stock}</span>
                    {low && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: "#fef3c7", color: "#b45309" }}>LOW</span>}
                    {p.stock === 0 && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: "#fee2e2", color: "#dc2626" }}>OUT</span>}
                  </td>
                  <td style={tdStyle}>Rs. {p.costPrice.toLocaleString()}</td>
                  <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 12, color: "var(--text-secondary)" }}>{p.location || "—"}</td>
                  <td style={tdStyle}>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button onClick={() => setLabelPart(p)} title="Print part label" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}><Tag size={14} /></button>
                      <button onClick={() => setModal(p)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}><Edit2 size={14} /></button>
                      <button onClick={() => setDeleteTarget(p)} style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", padding: 4 }}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
        <div style={{ padding: "10px 16px", borderTop: "1px solid var(--border)", fontSize: 12, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{filtered.length} of {parts.length} parts</div>
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
