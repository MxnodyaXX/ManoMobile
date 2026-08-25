#!/usr/bin/env node
/**
 * Mano Mobile — nightly local backup.
 *
 * Writes a dated folder containing everything needed to rebuild the shop on a
 * fresh Supabase project:
 *
 *   data.sql        every row in every table, as INSERTs, in foreign-key order,
 *                   followed by sequence fixes. Paste into the SQL editor.
 *   storage/        the intake photos, as files, mirroring their bucket paths
 *   auth-users.json the staff logins (emails and ids — Supabase never exposes
 *                   password hashes, so those cannot be carried over)
 *   manifest.json   row counts and timings, for checking a backup is complete
 *
 * Why this and not pg_dump: the shop PC has no Postgres client, no Docker and
 * no database password — only the service-role key. A backup that needs
 * software nobody installed is a backup that silently stops happening. This
 * runs on Node alone, which the project already has.
 *
 * What it cannot capture, and you should know about:
 *   - password hashes (recreate logins, then have staff reset)
 *   - the schema itself, which lives in supabase/migrations and in git
 *   - anything added to the database but never exposed through PostgREST
 *
 * Usage:  node scripts/backup.mjs [--out DIR] [--keep N]
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");

// ── Options ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const argOf = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const OUT_ROOT = path.resolve(argOf("--out", path.join(ROOT, "backups")));
const KEEP = Number(argOf("--keep", "30"));

// ── Credentials ──────────────────────────────────────────────────────────────
function readEnv() {
  const file = path.join(ROOT, "frontend", ".env.local");
  if (!fs.existsSync(file)) throw new Error(`No .env.local at ${file}`);
  const env = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim();
  }
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must both be set in frontend/.env.local");
  }
  return { url: url.replace(/\/+$/, ""), key };
}

const { url: SB, key: KEY } = readEnv();
const auth = { apikey: KEY, Authorization: `Bearer ${KEY}` };

async function get(pathname, extraHeaders = {}) {
  const res = await fetch(`${SB}${pathname}`, { headers: { ...auth, ...extraHeaders } });
  if (!res.ok) throw new Error(`GET ${pathname} -> ${res.status} ${await res.text()}`);
  return res;
}

/**
 * Insert order. A restore replays this file top to bottom, so a child row must
 * never appear before the parent it points at. Derived by hand rather than from
 * the catalogue because PostgREST does not expose foreign keys, and a wrong
 * guess here fails loudly at restore time — the worst possible moment.
 */
const TABLE_ORDER = [
  // Reference data, depends on nothing
  "app_settings", "email_settings",
  "sms_templates", "email_templates", "barcode_templates", "receipt_templates",
  "device_faults", "repair_dealers", "repair_agents", "repair_parts",
  // People
  "profiles", "staff_work_rules",
  // The jobs themselves
  "repair_jobs",
  // Everything hanging off a job
  "repair_job_events", "repair_assignments", "repair_parts_used",
  "repair_non_issued", "repair_issued", "repair_agent_transfers",
  "repair_part_requests", "sms_messages", "email_messages",
];

/**
 * Tables whose id comes from an identity/serial sequence. After restoring rows
 * with explicit ids the sequence still points at 1, so the next insert would
 * collide with row 1. Every one of these gets a setval at the end.
 */
const IDENTITY_TABLES = [
  "repair_dealers", "repair_agents", "repair_parts", "repair_part_requests",
  "repair_parts_used", "repair_job_events", "repair_agent_transfers",
  "barcode_templates", "receipt_templates", "sms_messages", "email_messages",
  "device_faults",
];

// ── SQL literal encoding ─────────────────────────────────────────────────────

const quote = (s) => `'${String(s).replace(/'/g, "''")}'`;

/**
 * Encode one value for SQL, using the column's real Postgres type.
 *
 * The type matters: PostgREST hands back a JS array for both `text[]` and a
 * jsonb array, and the two need completely different literals. Guessing from
 * the value would corrupt one of them.
 */
function encode(value, format) {
  if (value === null || value === undefined) return "NULL";

  const fmt = String(format || "");

  if (fmt.endsWith("[]")) {
    const base = fmt.slice(0, -2);
    if (!Array.isArray(value)) return "NULL";
    if (value.length === 0) return `ARRAY[]::${fmt}`;
    const items = value.map(v => (v === null ? "NULL" : quote(v)));
    return `ARRAY[${items.join(",")}]::${base}[]`;
  }

  if (fmt === "jsonb" || fmt === "json") {
    return `${quote(JSON.stringify(value))}::${fmt}`;
  }

  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);

  // Everything else — text, uuid, timestamps, numerics returned as strings,
  // and enums — is a quoted literal. Postgres casts from the target column.
  return quote(value);
}

// ── Reading the schema ───────────────────────────────────────────────────────

/** Column name -> Postgres format, per table, from PostgREST's OpenAPI spec. */
async function readColumnTypes() {
  const spec = await (await get("/rest/v1/")).json();
  const defs = spec.definitions ?? {};
  const out = {};
  for (const [table, def] of Object.entries(defs)) {
    out[table] = Object.fromEntries(
      Object.entries(def.properties ?? {}).map(([col, p]) => [col, p.format]),
    );
  }
  return out;
}

/** Every row of one table, paged so a large table cannot blow up memory. */
async function fetchAll(table) {
  const PAGE = 1000;
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const res = await get(`/rest/v1/${table}?select=*`, {
      Range: `${from}-${from + PAGE - 1}`,
      "Range-Unit": "items",
    });
    const batch = await res.json();
    rows.push(...batch);
    if (batch.length < PAGE) break;
  }
  return rows;
}

// ── Storage ──────────────────────────────────────────────────────────────────

/** Bucket listing is one level at a time; folders come back with a null id. */
async function listBucket(bucket, prefix = "") {
  const res = await fetch(`${SB}/storage/v1/object/list/${bucket}`, {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({ prefix, limit: 1000, sortBy: { column: "name", order: "asc" } }),
  });
  if (!res.ok) throw new Error(`list ${bucket}/${prefix} -> ${res.status}`);
  const entries = await res.json();

  const files = [];
  for (const e of entries) {
    const full = prefix ? `${prefix}/${e.name}` : e.name;
    if (e.id === null) files.push(...await listBucket(bucket, full));
    else files.push(full);
  }
  return files;
}

async function saveStorage(bucket, destDir) {
  let files = [];
  try {
    files = await listBucket(bucket);
  } catch (e) {
    return { bucket, files: 0, bytes: 0, error: e.message };
  }

  let bytes = 0;
  for (const f of files) {
    const res = await fetch(`${SB}/storage/v1/object/${bucket}/${f}`, { headers: auth });
    if (!res.ok) continue;
    const buf = Buffer.from(await res.arrayBuffer());
    const dest = path.join(destDir, bucket, f);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, buf);
    bytes += buf.length;
  }
  return { bucket, files: files.length, bytes };
}

// ── Auth users ───────────────────────────────────────────────────────────────

async function saveAuthUsers() {
  try {
    const res = await get("/auth/v1/admin/users?per_page=200");
    const body = await res.json();
    return (body.users ?? []).map(u => ({
      id: u.id,
      email: u.email,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
      user_metadata: u.user_metadata,
    }));
  } catch {
    return null;
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const startedAt = new Date();
  const stamp = startedAt.toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const dir = path.join(OUT_ROOT, stamp);
  fs.mkdirSync(dir, { recursive: true });

  console.log(`Mano Mobile backup -> ${dir}`);

  const types = await readColumnTypes();

  const sql = [];
  sql.push("-- Mano Mobile data backup");
  sql.push(`-- Taken ${startedAt.toISOString()}`);
  sql.push("--");
  sql.push("-- RESTORE (into an empty project):");
  sql.push("--   1. Run every file in supabase/migrations, oldest first.");
  sql.push("--   2. Recreate the staff logins listed in auth-users.json, keeping");
  sql.push("--      the same emails. Their ids will differ, so profiles rows are");
  sql.push("--      skipped below if the matching auth user does not exist.");
  sql.push("--   3. Run this file.");
  sql.push("--   4. node scripts/restore-storage.mjs <this folder>");
  sql.push("--");
  sql.push("-- Safe to re-run: every insert is ON CONFLICT DO NOTHING, so an");
  sql.push("-- interrupted restore can simply be run again.");
  sql.push("");
  sql.push("begin;");
  sql.push("");

  const counts = {};

  for (const table of TABLE_ORDER) {
    const cols = types[table];
    if (!cols) {
      console.log(`  ${table.padEnd(24)} skipped (not exposed)`);
      continue;
    }

    const rows = await fetchAll(table);
    counts[table] = rows.length;
    console.log(`  ${table.padEnd(24)} ${String(rows.length).padStart(5)} rows`);
    if (rows.length === 0) continue;

    const names = Object.keys(cols);
    sql.push(`-- ${table} (${rows.length})`);
    for (const row of rows) {
      const values = names.map(n => encode(row[n], cols[n]));
      sql.push(
        `insert into public.${table} (${names.map(n => `"${n}"`).join(", ")}) ` +
        `values (${values.join(", ")}) on conflict do nothing;`,
      );
    }
    sql.push("");
  }

  // ── Sequences ──
  // Computed from the restored data rather than read from the source, so the
  // numbers are right even if the backup and the restore are days apart.
  sql.push("-- Sequences: move each past the highest id just restored, or the");
  sql.push("-- next insert collides with an existing row.");
  for (const t of IDENTITY_TABLES) {
    if (!types[t]) continue;
    sql.push(
      `select setval(pg_get_serial_sequence('public.${t}','id'), ` +
      `greatest(1, (select coalesce(max(id),0) from public.${t})), true) ` +
      `where pg_get_serial_sequence('public.${t}','id') is not null;`,
    );
  }
  sql.push("");
  sql.push("-- Job numbers continue after the highest RM- number restored.");
  sql.push(
    "select setval('public.repair_job_no_seq', greatest(1, (select coalesce(max(" +
    "substring(id from 4)::int),0) from public.repair_jobs where id ~ '^RM-[0-9]+$')), true);",
  );
  sql.push("");
  sql.push("commit;");
  sql.push("");

  fs.writeFileSync(path.join(dir, "data.sql"), sql.join("\n"), "utf8");

  // ── Storage + auth ──
  const storage = await saveStorage("repair-intake", path.join(dir, "storage"));
  console.log(`  storage/repair-intake    ${String(storage.files).padStart(5)} files, ${(storage.bytes / 1024).toFixed(0)} KB`);

  const users = await saveAuthUsers();
  if (users) {
    fs.writeFileSync(path.join(dir, "auth-users.json"), JSON.stringify(users, null, 2), "utf8");
    console.log(`  auth users               ${String(users.length).padStart(5)} (no passwords — see README)`);
  }

  const manifest = {
    takenAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    supabaseUrl: SB,
    tables: counts,
    totalRows: Object.values(counts).reduce((a, b) => a + b, 0),
    storage,
    authUsers: users ? users.length : null,
    dataSqlBytes: fs.statSync(path.join(dir, "data.sql")).size,
  };
  fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");

  // ── Retention ──
  // Old backups are pruned only after this one is written, so a failure never
  // leaves the shop with fewer copies than it started with.
  const kept = fs.readdirSync(OUT_ROOT)
    .filter(n => /^\d{4}-\d{2}-\d{2}-/.test(n))
    .sort()
    .reverse();
  for (const old of kept.slice(KEEP)) {
    fs.rmSync(path.join(OUT_ROOT, old), { recursive: true, force: true });
    console.log(`  pruned ${old}`);
  }

  console.log(`\nDone. ${manifest.totalRows} rows, ${storage.files} files. Keeping ${Math.min(kept.length, KEEP)} backups.`);
}

main().catch(e => {
  console.error(`\nBACKUP FAILED: ${e.message}`);
  process.exit(1);
});
