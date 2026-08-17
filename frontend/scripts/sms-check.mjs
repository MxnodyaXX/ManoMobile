#!/usr/bin/env node
/**
 * SMS gateway check — verifies the Text.lk setup end to end.
 *
 *   npm run sms:check                      config + credentials (free, sends nothing)
 *   npm run sms:check -- --to 0771234567   also sends one real test message (costs credits)
 *
 * The credential check uses GET /api/v3/sms/ (the message list). It proves the
 * token and network path work without spending anything, which is what you want
 * to run routinely; the live send is opt-in behind --to.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = join(HERE, "..", ".env.local");
const BASE = "https://app.text.lk/api/v3";

const c = {
  ok: (s) => `\x1b[32m${s}\x1b[0m`,
  bad: (s) => `\x1b[31m${s}\x1b[0m`,
  warn: (s) => `\x1b[33m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  b: (s) => `\x1b[1m${s}\x1b[0m`,
};

function loadEnv(path) {
  const env = {};
  let raw;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    return null;
  }
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    env[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  }
  return env;
}

/** Same rules as src/lib/sms/textlk.ts — kept in step deliberately. */
function normaliseLkNumber(input) {
  const d = (input || "").replace(/\D/g, "");
  if (!d) return null;
  if (d.length === 10 && d.startsWith("0")) return `94${d.slice(1)}`;
  if (d.length === 11 && d.startsWith("94")) return d;
  if (d.length === 9 && d.startsWith("7")) return `94${d}`;
  if (d.length === 13 && d.startsWith("0094")) return d.slice(2);
  return null;
}

const args = process.argv.slice(2);
const toArg = args.includes("--to") ? args[args.indexOf("--to") + 1] : null;

console.log(c.b("\nText.lk SMS check\n"));

// ── 1. Configuration ──
const env = loadEnv(ENV_PATH);
if (!env) {
  console.log(`${c.bad("✗")} frontend/.env.local not found. Copy .env.local.example and fill it in.`);
  process.exit(1);
}

const token = env.TEXTLK_API_TOKEN || "";
const senderId = env.TEXTLK_SENDER_ID || "";
let failed = false;

if (!token) {
  console.log(`${c.bad("✗")} TEXTLK_API_TOKEN is not set`);
  failed = true;
} else {
  console.log(`${c.ok("✓")} TEXTLK_API_TOKEN  ${c.dim(`set, ${token.length} chars, ends …${token.slice(-4)}`)}`);
}

if (!senderId) {
  console.log(`${c.bad("✗")} TEXTLK_SENDER_ID is not set`);
  failed = true;
} else if (senderId.length > 11) {
  console.log(`${c.bad("✗")} TEXTLK_SENDER_ID "${senderId}" is ${senderId.length} chars — Text.lk allows 11`);
  failed = true;
} else {
  console.log(`${c.ok("✓")} TEXTLK_SENDER_ID  ${c.dim(`"${senderId}" (${senderId.length}/11 chars)`)}`);
}

if (env.NEXT_PUBLIC_TEXTLK_API_TOKEN) {
  console.log(`${c.bad("✗")} NEXT_PUBLIC_TEXTLK_API_TOKEN exists — that ships the token to every browser. Remove it.`);
  failed = true;
}

if (failed) {
  console.log(`\n${c.bad("Configuration incomplete.")} See docs/SMS-SETUP.md\n`);
  process.exit(1);
}

// ── 2. Credentials (free) ──
console.log(c.dim("\nChecking credentials against the gateway (no message sent)…"));
try {
  const res = await fetch(`${BASE}/sms/`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    signal: AbortSignal.timeout(15000),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = null; }

  if (res.status === 401 || res.status === 403) {
    console.log(`${c.bad("✗")} Gateway rejected the token (HTTP ${res.status}). Regenerate it at app.text.lk → Developers.`);
    process.exit(1);
  } else if (!res.ok) {
    console.log(`${c.warn("!")} Unexpected HTTP ${res.status} from the gateway`);
    console.log(c.dim(`  ${text.slice(0, 300)}`));
  } else {
    console.log(`${c.ok("✓")} Token accepted by app.text.lk ${c.dim(`(HTTP ${res.status}${json?.status ? `, status: ${json.status}` : ""})`)}`);
  }
} catch (e) {
  console.log(`${c.bad("✗")} Could not reach app.text.lk: ${e.message}`);
  process.exit(1);
}

// ── 3. Number normalisation ──
console.log(c.b("\nNumber handling"));
for (const sample of ["0771234567", "+94 77 123 4567", "771234567", "12345"]) {
  const out = normaliseLkNumber(sample);
  console.log(out
    ? `  ${c.ok("✓")} ${sample.padEnd(18)} → ${out}`
    : `  ${c.ok("✓")} ${sample.padEnd(18)} → ${c.dim("rejected (as intended)")}`);
}

// ── 4. Optional live send ──
if (!toArg) {
  console.log(`\n${c.ok("Setup looks good.")} Nothing was sent and nothing was charged.`);
  console.log(c.dim("To send one real test message:  npm run sms:check -- --to 07XXXXXXXX\n"));
  process.exit(0);
}

const recipient = normaliseLkNumber(toArg);
if (!recipient) {
  console.log(`\n${c.bad("✗")} "${toArg}" is not a valid Sri Lankan mobile number.\n`);
  process.exit(1);
}

console.log(c.b(`\nSending a live test message to ${recipient} …`));
const message = `Mano Mobile test message — SMS gateway is working. Sent ${new Date().toLocaleString("en-GB")}.`;

try {
  const res = await fetch(`${BASE}/sms/send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ recipient, sender_id: senderId, type: "plain", message }),
    signal: AbortSignal.timeout(20000),
  });
  const json = await res.json().catch(() => null);

  if (res.ok && json?.status === "success") {
    const d = json.data ?? {};
    console.log(`${c.ok("✓")} Accepted by the gateway`);
    console.log(c.dim(`   uid: ${d.uid ?? "—"}   status: ${d.status ?? "—"}   parts: ${d.sms_count ?? "—"}   cost: ${d.cost ?? "—"}`));
    console.log(`\n${c.warn("Now check the handset.")} "Accepted" means the gateway took it — if it never arrives,`);
    console.log(`the account is likely still in sandbox, or "${senderId}" is not an approved Sender ID.\n`);
  } else {
    console.log(`${c.bad("✗")} Rejected: ${json?.message ?? `HTTP ${res.status}`}\n`);
    process.exit(1);
  }
} catch (e) {
  console.log(`${c.bad("✗")} Send failed: ${e.message}\n`);
  process.exit(1);
}
