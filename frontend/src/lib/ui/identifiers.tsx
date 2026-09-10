"use client";

/**
 * The two numbers this shop types most, and the shape each of them has.
 *
 * An IMEI and a phone number were free text everywhere: one screen stripped
 * letters, the next did not, one capped at 15 characters, another at 17. So the
 * same handset could be filed under "35777483573754" and "357774835737544" and
 * never match itself, and a number could be saved with a space in the middle
 * that the SMS gateway would later refuse.
 *
 * Both rules live here, once, and every field that takes one uses them.
 */

const ff = "'Plus Jakarta Sans', sans-serif";

/* ── IMEI ─────────────────────────────────────────────────────────────────── */

/** Digits, and never more than fifteen of them. */
export function cleanImei(raw: string): string {
  return (raw ?? "").replace(/\D/g, "").slice(0, 15);
}

/**
 * What is wrong with it, if anything.
 *
 * Empty is not wrong — an IMEI is optional on most of these forms, and a dead
 * handset has none to read. A partial one is: fourteen digits is not a shorter
 * IMEI, it is a mistyped one, and it will not match the same phone next time.
 */
export function imeiIssue(value: string): string | null {
  const digits = cleanImei(value);
  if (digits.length === 0) return null;
  if (digits.length === 15) return null;
  return `An IMEI is 15 digits — this has ${digits.length}. Dial *#06# on the handset.`;
}

/* ── Phone numbers ────────────────────────────────────────────────────────── */

/**
 * A leading +, then digits.
 *
 * Length is only capped for the two shapes we know the length of. A landline,
 * a foreign number or a dealer's switchboard can be any length at all, and a
 * field that refuses them is a field somebody works around by leaving it
 * empty.
 */
export function cleanPhone(raw: string): string {
  const s = (raw ?? "").trim();
  const plus = s.startsWith("+");
  const digits = s.replace(/\D/g, "");

  if (plus && digits.startsWith("94")) return `+${digits.slice(0, 11)}`;   // +94 + 9
  if (!plus && digits.startsWith("07")) return digits.slice(0, 10);        // 07 + 8
  return plus ? `+${digits}` : digits;
}

/**
 * Sri Lankan mobiles have a known length; nothing else here does.
 *
 * 07XXXXXXXX and +947XXXXXXXX are the same number written two ways, and both
 * are ten significant digits. Anything else — 011, 038, a number from abroad —
 * is left alone: the shop knows what it is dialling better than a rule does.
 */
export function phoneIssue(value: string): string | null {
  const s = cleanPhone(value);
  if (!s) return null;

  if (s.startsWith("+94")) {
    const n = s.slice(3).length;
    return n === 9 ? null : `A +94 number has 9 digits after the code — this has ${n}.`;
  }
  if (s.startsWith("07")) {
    return s.length === 10 ? null : `A mobile number is 10 digits — this has ${s.length}.`;
  }
  return null;
}

/* ── The warning ──────────────────────────────────────────────────────────── */

/**
 * Said under the field, in amber, and never in the way.
 *
 * A warning rather than a block: half-typed is the normal state of a field
 * somebody is still typing into, and a form that refuses to hold an
 * in-progress value is a form that loses what was typed. The save paths that
 * genuinely need a complete number check it themselves.
 */
export function FieldWarning({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <p style={{ fontSize: 11, color: "#d97706", marginTop: 4, lineHeight: 1.5, fontFamily: ff }}>
      {text}
    </p>
  );
}
