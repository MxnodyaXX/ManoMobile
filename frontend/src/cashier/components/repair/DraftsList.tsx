"use client";

import { FileClock, Trash2, Camera } from "lucide-react";
import { useIsMobile } from "@/cashier/hooks/useIsMobile";
import { useRepairDrafts, draftTitle, draftSubtitle, fmtSaved, type RepairDraft } from "@/cashier/hooks/useRepairDrafts";
import { useToast } from "@/lib/ui/toast";

const ff = "'Plus Jakarta Sans', sans-serif";
const TOTAL_STEPS = 5;

/**
 * Every unfinished intake, newest first. The wizard autosaves into the same
 * store, so anything abandoned mid-job — including by a browser refresh — shows
 * up here and can be reopened at the exact step it was left on.
 */
export default function DraftsList({ onResume }: { onResume: (d: RepairDraft) => void }) {
  const { drafts, removeDraft } = useRepairDrafts();
  const toast = useToast();
  const isMobile = useIsMobile();

  if (drafts.length === 0) {
    return (
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: 10, padding: "56px 24px", borderRadius: 14,
        background: "var(--bg-card)", border: "1px solid var(--border)", fontFamily: ff,
      }}>
        <div style={{
          width: 46, height: 46, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center",
          background: "var(--accent-dim)", border: "1px solid var(--accent-glow)", color: "var(--accent)",
        }}>
          <FileClock size={20} strokeWidth={1.8} />
        </div>
        <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>No unfinished repairs</p>
        <p style={{ fontSize: 12.5, color: "var(--text-secondary)", textAlign: "center", maxWidth: 380, lineHeight: 1.55 }}>
          Start a job under <strong style={{ color: "var(--text-primary)" }}>New Repair</strong> and it is saved
          here automatically as you type — so a refresh or a switch to another tab never loses the intake.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {drafts.map((d) => {
        const pct = Math.round((d.step / TOTAL_STEPS) * 100);
        return (
          <div
            key={d.id}
            style={{
              display: "flex", flexDirection: isMobile ? "column" : "row",
              alignItems: isMobile ? "stretch" : "center", gap: isMobile ? 12 : 16,
              padding: isMobile ? "14px 16px" : "16px 20px",
              background: "var(--bg-card)", border: "1px solid var(--border)",
              borderRadius: 14, fontFamily: ff, transition: "border-color 0.15s",
            }}
          >
            {/* Who / what */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{
                  fontSize: 14.5, fontWeight: 700, color: "var(--text-primary)",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {draftTitle(d.form)}
                </span>
                <span style={{
                  flexShrink: 0, padding: "2px 8px", borderRadius: 20, fontSize: 10.5, fontWeight: 700,
                  background: "var(--accent-dim)", color: "var(--accent)", border: "1px solid var(--accent-glow)",
                }}>
                  Step {d.step} of {TOTAL_STEPS}
                </span>
              </div>
              <div style={{
                fontSize: 12.5, color: "var(--text-secondary)",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {draftSubtitle(d.form)}
              </div>
              <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 10, marginTop: 6 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--text-muted)" }}>
                  <FileClock size={11} /> Saved {fmtSaved(d.updatedAt)}
                </span>
                {d.photoCount > 0 && (
                  <span
                    title="Photos are too large to keep in a draft — add them again after resuming"
                    style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--warning)" }}
                  >
                    <Camera size={11} /> {d.photoCount} photo{d.photoCount > 1 ? "s" : ""} need re-adding
                  </span>
                )}
              </div>

              {/* Progress bar */}
              <div style={{ marginTop: 9, height: 4, borderRadius: 2, background: "var(--border)", overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, height: "100%", background: "var(--accent)", transition: "width 0.3s" }} />
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => onResume(d)}
                style={{
                  flex: isMobile ? 1 : undefined,
                  padding: "9px 20px", borderRadius: 8, border: "none",
                  background: "var(--accent)", color: "var(--accent-fg)", cursor: "pointer",
                  fontSize: 13, fontWeight: 700, fontFamily: ff, transition: "opacity 0.15s",
                }}
              >
                Resume
              </button>
              <button
                type="button"
                onClick={() => { removeDraft(d.id); toast.dialog("success", "Draft discarded", draftTitle(d.form)); }}
                aria-label={`Discard draft for ${draftTitle(d.form)}`}
                title="Discard this draft"
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                  border: "1px solid var(--border)", background: "transparent",
                  color: "var(--text-muted)", cursor: "pointer", transition: "all 0.15s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.border = "1px solid var(--danger)"; e.currentTarget.style.color = "var(--danger)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.border = "1px solid var(--border)"; e.currentTarget.style.color = "var(--text-muted)"; }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
