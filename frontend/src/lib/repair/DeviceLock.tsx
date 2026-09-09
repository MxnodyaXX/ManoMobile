"use client";

import { Lock, LockOpen, AlertTriangle } from "lucide-react";

const ff = "'Plus Jakarta Sans', sans-serif";

/**
 * The points of an unlock pattern, in the order they were drawn.
 *
 * Stored as free text, because intake is a text box and the counter types
 * whatever it types: "1-2-3-6-9", "12369", "1, 4, 7". All three are the same
 * gesture, so all three are read the same way — every digit 1 to 9, in the
 * order it appears, and nothing else kept.
 *
 * Nothing is rejected. A pattern with a repeated point cannot be drawn on a
 * phone, but it can certainly be written on a form, and showing what somebody
 * actually recorded beats refusing to show anything.
 */
function patternPoints(code: string): number[] {
  return code.split("").filter(ch => ch >= "1" && ch <= "9").map(Number);
}

/**
 * The pattern as the gesture it is.
 *
 * "2-5-8-9" is a set of instructions a technician has to compile in their head
 * while holding the phone: which corner is 2, does the line go down or across.
 * The drawing is the thing itself — read at a glance, and checked against the
 * screen without translating anything.
 *
 * The numbers stay next to it. They are what was recorded, they are what gets
 * read out over the phone to a customer, and a picture with no caption cannot
 * be quoted back.
 */
function PatternGrid({ points, size, tint }: { points: number[]; size: number; tint: string }) {
  // 3 x 3, on a 100-square canvas: dots at 20, 50 and 80 leave room for the
  // start ring without it clipping at the edge.
  const at = (n: number) => ({ x: 20 + ((n - 1) % 3) * 30, y: 20 + Math.floor((n - 1) / 3) * 30 });
  const drawn = points.map(at);
  const visited = new Set(points);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-label={`Unlock pattern ${points.join("-")}`}
      style={{ flexShrink: 0, display: "block" }}
    >
      {/* Every dot, so the shape reads against the full grid rather than
          floating on its own — a line from corner to corner means nothing
          without the corners it skipped. */}
      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => {
        const { x, y } = at(n);
        return (
          <circle
            key={n}
            cx={x} cy={y} r={visited.has(n) ? 6 : 4}
            fill={visited.has(n) ? tint : "var(--border)"}
          />
        );
      })}

      {drawn.length > 1 && (
        <polyline
          points={drawn.map(p => `${p.x},${p.y}`).join(" ")}
          fill="none"
          stroke={tint}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.85}
        />
      )}

      {/* Where the finger starts, because the same shape drawn backwards is a
          different pattern and the line alone cannot say which end is which. */}
      {drawn.length > 0 && (
        <circle cx={drawn[0].x} cy={drawn[0].y} r={11} fill="none" stroke={tint} strokeWidth={2} opacity={0.55} />
      )}
    </svg>
  );
}

/**
 * The screen lock, for whoever has the phone in their hand.
 *
 * Intake has always asked for it — passcode type and code are on the form the
 * customer signs — and until now nothing displayed it. A technician got a
 * locked handset and a job card that did not mention the lock, so the phone
 * went back to the counter to ask, or sat on the bench until somebody phoned
 * the owner. The data was there the whole time.
 *
 * Four states, and they need telling apart, because three of them mean "carry
 * on" and one means "stop and ask":
 *
 *   no lock                nothing to do
 *   a code that was taken  use it
 *   given in person        the customer holds it; the counter has to ask
 *   a lock and no code     recorded as locked with nothing recorded to open
 *                          it, which is an intake mistake worth seeing
 *
 * The code is shown plainly rather than behind a reveal. This is a bench
 * screen with the device already on it, and a tap-to-reveal on something a
 * technician needs twenty times a day is friction bought for no security —
 * anyone reading it over their shoulder is standing next to the phone.
 */
export function DeviceLock({ type, code, compact = false }: {
  type?: string | null;
  code?: string | null;
  /** Row-shaped for a list of fields, rather than a panel of its own. */
  compact?: boolean;
}) {
  const kind = (type ?? "").trim();
  const secret = (code ?? "").trim();

  // Nothing was ever asked. Saying "no lock" would be a claim the record does
  // not support, so it says nothing at all.
  if (!kind && !secret) return null;

  const none      = kind === "None";
  const separate  = kind === "Provided Separately";
  const missing   = !none && !separate && !secret;

  const tint = none ? "#4ade80" : missing || separate ? "#fbbf24" : "#60a5fa";
  const Icon = none ? LockOpen : missing || separate ? AlertTriangle : Lock;

  const detail =
    none      ? "No lock on this device"
    : separate ? "The customer gives it in person — ask the counter"
    : missing  ? `Recorded as ${kind}, but no code was taken`
    : secret;

  // Only for patterns, and only when the text actually reads as one. A PIN is
  // its own best representation; a pattern is not.
  const points = kind === "Pattern" && !missing ? patternPoints(secret) : [];

  if (compact) {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "flex-end", gap: 8, minWidth: 0 }}>
        <Icon size={12} style={{ color: tint, flexShrink: 0 }} />
        <span style={{ fontFamily: none || separate || missing ? ff : "monospace", fontWeight: 700, color: "var(--text-primary)", wordBreak: "break-word" }}>
          {detail}
        </span>
        {!none && !separate && !missing && (
          <span style={{ fontSize: 10.5, color: "var(--text-muted)", fontWeight: 500, flexShrink: 0 }}>{kind}</span>
        )}
        {points.length > 0 && <PatternGrid points={points} size={44} tint={tint} />}
      </span>
    );
  }

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 11,
      padding: "11px 13px", borderRadius: 10,
      background: `${tint}14`, border: `1px solid ${tint}59`,
      fontFamily: ff,
    }}>
      <span style={{
        width: 28, height: 28, borderRadius: 8, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: `${tint}26`, color: tint,
      }}>
        <Icon size={14} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--text-muted)" }}>
          Screen lock{!none && !separate && kind ? ` · ${kind}` : ""}
        </p>
        <p style={{
          fontSize: none || separate || missing ? 12.5 : 16,
          fontWeight: none || separate || missing ? 500 : 800,
          letterSpacing: none || separate || missing ? undefined : "0.08em",
          fontFamily: none || separate || missing ? ff : "monospace",
          color: "var(--text-primary)", marginTop: 2, wordBreak: "break-word",
        }}>
          {detail}
        </p>
      </div>

      {points.length > 0 && <PatternGrid points={points} size={64} tint={tint} />}
    </div>
  );
}
