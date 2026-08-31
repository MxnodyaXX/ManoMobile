"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Palette as PaletteIcon, Check, AlertCircle, Sun, Moon, Eye } from "lucide-react";
import {
  PALETTES, COMFORT_LEVELS, applyPalette, fetchAppearance, saveAppearance,
  paletteById, comfortById, DEFAULT_APPEARANCE, type Appearance,
} from "@/lib/settings/appearance";
import { useToast } from "@/lib/ui/toast";

const AA = "#a78bfa";
const ff = "'Plus Jakarta Sans', sans-serif";

/**
 * Appearance — how the whole shop's screens look.
 *
 * Built as its own page rather than a tab under Settings because the palette is
 * the first of these, not the last: density, font size and a default light/dark
 * preference all belong here when they are asked for.
 *
 * Choosing a palette previews it immediately across the app; it is only stored
 * when saved. Picking a colour scheme from swatches alone does not work — the
 * only useful preview is the real interface wearing it.
 */
export default function Appearance() {
  const toast = useToast();
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const [saved, setSaved] = useState<Appearance>(DEFAULT_APPEARANCE);
  const [draft, setDraft] = useState<Appearance>(DEFAULT_APPEARANCE);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchAppearance()
      .then(a => { if (!active) return; setSaved(a); setDraft(a); })
      .catch(e => { if (active) setError(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  // Preview live. Leaving the page without saving puts the stored one back.
  useEffect(() => {
    applyPalette(draft.palette, isDark, draft.comfort);
    return () => { applyPalette(saved.palette, isDark, saved.comfort); };
  }, [draft, saved, isDark]);

  const dirty = draft.palette !== saved.palette || draft.comfort !== saved.comfort;

  const save = async () => {
    setBusy(true);
    try {
      await saveAppearance(draft.palette, draft.comfort);
      setSaved(draft);
      // Tell every other screen in this tab, so the sidebar and any open
      // cashier view repaint without a reload.
      window.dispatchEvent(new CustomEvent("mano:palette", { detail: draft }));
      toast.dialog(
        "success", "Appearance saved",
        `Everyone in the shop now sees ${paletteById(draft.palette).name} at ${comfortById(draft.comfort).name.toLowerCase()} brightness.`,
      );
    } catch (e) {
      toast.dialog("error", "Could not save", e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22, fontFamily: ff }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em", marginBottom: 4 }}>
          Appearance
        </h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
          How every screen in the shop looks — the counter, the bench and this panel.
        </p>
      </div>

      {error && (
        <div style={{ display: "flex", gap: 9, padding: "11px 14px", borderRadius: 10, background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.4)" }}>
          <AlertCircle size={15} color="#fbbf24" style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.55 }}>
            {error} — run migration 20260830000005_appearance_settings.sql.
          </p>
        </div>
      )}

      {/* ── Screen comfort — the setting that answers the actual complaint ── */}
      <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div style={{ width: 30, height: 30, borderRadius: 9, background: `${AA}14`, border: `1px solid ${AA}35`, display: "flex", alignItems: "center", justifyContent: "center", color: AA }}>
            <Eye size={14} />
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>Screen Comfort</h2>
            <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
              How bright the surfaces are. Text is never dimmed, so contrast <em>rises</em> as the surface darkens.
            </p>
          </div>
        </div>

        <div style={{
          display: "grid", gap: 10,
          gridTemplateColumns: "repeat(auto-fill, minmax(max(180px, 24%), 1fr))",
        }}>
          {COMFORT_LEVELS.map(c => {
            const active = draft.comfort === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setDraft(d => ({ ...d, comfort: c.id }))}
                disabled={isDark}
                style={{
                  display: "flex", flexDirection: "column", gap: 7, textAlign: "left",
                  padding: "13px 14px", borderRadius: 12, fontFamily: ff,
                  background: "var(--bg-card)",
                  border: `1px solid ${active ? AA : "var(--border)"}`,
                  boxShadow: active ? `0 0 0 3px ${AA}22` : undefined,
                  cursor: isDark ? "not-allowed" : "pointer",
                  opacity: isDark ? 0.5 : 1,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text-primary)" }}>{c.name}</span>
                  {c.id === saved.comfort && (
                    <span style={{ fontSize: 9.5, fontWeight: 800, padding: "1px 7px", borderRadius: 20, background: `${AA}18`, color: AA, border: `1px solid ${AA}35` }}>
                      IN USE
                    </span>
                  )}
                </div>
                <p style={{ fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.5 }}>{c.blurb}</p>
                {/* Measured, not adjectives — the whole point is that this is
                    a real reduction rather than a slightly different white. */}
                <p style={{ fontSize: 10.5, color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>
                  Card {c.cardLum} brightness · text {c.contrast}
                </p>
              </button>
            );
          })}
        </div>

        {isDark && (
          <p style={{ fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.55 }}>
            Dark mode is already low-luminance, so comfort levels do not apply to it. Switch to Light above to set them.
          </p>
        )}

        <div style={{
          padding: "13px 15px", borderRadius: 11,
          background: "var(--bg-card)", border: "1px solid var(--border)",
        }}>
          <p style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>
            This helps, but it is not the whole answer
          </p>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6 }}>
            Long screen hours cause real eye strain — dryness, ache, headaches — and dimming the
            interface genuinely reduces it. What it does <strong>not</strong> do is undo the two bigger
            factors: the monitor&apos;s own brightness, which should roughly match the light in the room
            rather than fight it, and unbroken focus at one distance. The 20-20-20 habit — every 20
            minutes, look at something 20 feet away for 20 seconds — does more for a ten-hour shift
            than any colour scheme. Worth pairing this setting with turning the monitors down.
          </p>
        </div>
      </section>

      {/* ── Palette ── */}
      <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
          <div style={{ width: 30, height: 30, borderRadius: 9, background: `${AA}14`, border: `1px solid ${AA}35`, display: "flex", alignItems: "center", justifyContent: "center", color: AA }}>
            <PaletteIcon size={14} />
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>Colour Palette</h2>
            <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
              Applies to everyone. Picking one previews it here and now; it is only stored when you save.
            </p>
          </div>

          {/* Each palette carries its own light and dark values, so previewing
              one without being able to see both halves is half a decision. */}
          <div style={{ display: "flex", gap: 4, padding: 4, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10 }}>
            {[{ id: "light", icon: Sun, label: "Light" }, { id: "dark", icon: Moon, label: "Dark" }].map(m => {
              const active = (m.id === "dark") === isDark;
              const Icon = m.icon;
              return (
                <button
                  key={m.id}
                  onClick={() => setTheme(m.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 6, minHeight: 32, padding: "0 12px",
                    borderRadius: 7, fontSize: 12, cursor: "pointer", fontFamily: ff,
                    fontWeight: active ? 700 : 500,
                    background: active ? "var(--bg-secondary)" : "transparent",
                    border: active ? "1px solid var(--border-active)" : "1px solid transparent",
                    color: active ? "var(--text-primary)" : "var(--text-secondary)",
                  }}
                >
                  <Icon size={13} /> {m.label}
                </button>
              );
            })}
          </div>
        </div>

        {loading ? (
          <p style={{ fontSize: 12.5, color: "var(--text-muted)", padding: "8px 2px" }}>Loading appearance…</p>
        ) : (
          <div style={{
            display: "grid", gap: 12, alignItems: "stretch",
            gridTemplateColumns: "repeat(auto-fill, minmax(max(230px, 32%), 1fr))",
          }}>
            {PALETTES.map(p => {
              const active = draft.palette === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setDraft(d => ({ ...d, palette: p.id }))}
                  style={{
                    display: "flex", flexDirection: "column", gap: 10, textAlign: "left", cursor: "pointer",
                    padding: 14, borderRadius: 13, fontFamily: ff,
                    background: "var(--bg-card)",
                    border: `1px solid ${active ? AA : "var(--border)"}`,
                    boxShadow: active ? `0 0 0 3px ${AA}22` : undefined,
                  }}
                >
                  {/* A miniature of the thing itself: page, card, ink */}
                  <div style={{
                    height: 62, borderRadius: 9, padding: 9, display: "flex", alignItems: "center", gap: 8,
                    background: p.swatch[0], border: "1px solid rgba(0,0,0,0.10)",
                  }}>
                    <div style={{ flex: 1, height: "100%", borderRadius: 6, background: p.swatch[1], border: "1px solid rgba(0,0,0,0.07)", display: "flex", flexDirection: "column", justifyContent: "center", gap: 5, padding: "0 8px" }}>
                      <span style={{ display: "block", height: 5, width: "62%", borderRadius: 3, background: p.swatch[2], opacity: 0.85 }} />
                      <span style={{ display: "block", height: 4, width: "40%", borderRadius: 3, background: p.swatch[2], opacity: 0.4 }} />
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text-primary)" }}>{p.name}</span>
                    {p.id === saved.palette && (
                      <span style={{ fontSize: 9.5, fontWeight: 800, padding: "1px 7px", borderRadius: 20, background: `${AA}18`, color: AA, border: `1px solid ${AA}35` }}>
                        IN USE
                      </span>
                    )}
                    {active && p.id !== saved.palette && (
                      <span style={{ fontSize: 9.5, fontWeight: 800, padding: "1px 7px", borderRadius: 20, background: "var(--bg-secondary)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
                        PREVIEW
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.5 }}>{p.blurb}</p>
                </button>
              );
            })}
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <button
            onClick={save}
            disabled={busy || !dirty}
            style={{
              display: "flex", alignItems: "center", gap: 7, minHeight: 40, padding: "0 18px",
              borderRadius: 10, fontSize: 13, fontWeight: 700, fontFamily: ff,
              background: dirty ? AA : "var(--bg-secondary)",
              border: dirty ? "none" : "1px solid var(--border)",
              color: dirty ? "#fff" : "var(--text-muted)",
              cursor: busy || !dirty ? "not-allowed" : "pointer",
            }}
          >
            <Check size={14} /> {busy ? "Saving…" : "Apply for everyone"}
          </button>
          {dirty && (
            <button
              onClick={() => setDraft(saved)}
              style={{
                minHeight: 40, padding: "0 14px", borderRadius: 10, fontSize: 12.5, cursor: "pointer",
                fontFamily: ff, background: "none", border: "1px solid var(--border)", color: "var(--text-secondary)",
              }}
            >
              Cancel
            </button>
          )}
          <p style={{ fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.5, flex: 1, minWidth: 220 }}>
            {dirty
              ? "You are previewing. Nothing changes for anyone else until you apply it."
              : "Light and dark stay each person's own choice — a palette sets the colours for both."}
          </p>
        </div>
      </section>
    </div>
  );
}
