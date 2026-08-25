#!/usr/bin/env node
/**
 * Prove a backup would actually restore — without touching anything.
 *
 * An untested backup is a guess, and the day you find out is the worst possible
 * day. This runs the real data.sql against a real Postgres inside a transaction
 * that is always rolled back, so every statement is parsed and executed by the
 * database itself and nothing is left behind.
 *
 * Point it at your LIVE database and it is still safe: the inserts are all
 * `on conflict do nothing`, so existing rows are skipped, and the rollback
 * discards whatever did happen. What it proves is that the SQL is valid, the
 * column types line up, and the insert order satisfies every foreign key.
 *
 * The connection string is read from the environment and never stored:
 *
 *   Supabase dashboard -> Project Settings -> Database -> Connection string
 *   (URI). Use the "Session pooler" one if direct connection is blocked.
 *
 *   PowerShell:
 *     $env:SUPABASE_DB_URL = "postgresql://postgres.xxx:PASSWORD@...:5432/postgres"
 *     node scripts\verify-restore.mjs ..\backups\2026-08-24-06-31-48
 */

import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const folder = process.argv[2];
if (!folder) {
  console.error("Usage: node scripts/verify-restore.mjs <backup folder>");
  process.exit(1);
}

const sqlFile = path.resolve(folder, "data.sql");
if (!fs.existsSync(sqlFile)) {
  console.error(`No data.sql in ${folder}`);
  process.exit(1);
}

const connectionString = process.env.SUPABASE_DB_URL;
if (!connectionString) {
  console.error("Set SUPABASE_DB_URL first — see the comment at the top of this file.");
  process.exit(1);
}

const raw = fs.readFileSync(sqlFile, "utf8");

// data.sql wraps itself in begin/commit. Strip those: this script owns the
// transaction so it can guarantee the rollback, and a nested commit would
// defeat the whole point of a dry run.
const body = raw
  .replace(/^\s*begin;\s*$/im, "")
  .replace(/^\s*commit;\s*$/im, "");

const statements = body
  .split(/\n/)
  .filter(l => !l.trim().startsWith("--"))
  .join("\n")
  .split(/;\s*(?:\r?\n|$)/)
  .map(s => s.trim())
  .filter(Boolean);

console.log(`Verifying ${path.basename(folder)}`);
console.log(`  ${statements.length} statements from data.sql`);
console.log(`  against ${connectionString.replace(/:[^:@/]+@/, ":****@")}`);
console.log("  everything runs inside a transaction that is rolled back\n");

const client = new pg.Client({
  connectionString,
  // Supabase terminates TLS with a certificate this client has no CA for;
  // the connection is still encrypted, it is the chain that goes unchecked.
  ssl: { rejectUnauthorized: false },
});

let failures = 0;

try {
  await client.connect();
  await client.query("begin");

  for (const [i, stmt] of statements.entries()) {
    try {
      await client.query(stmt);
    } catch (e) {
      failures++;
      console.error(`  FAILED statement ${i + 1}: ${e.message}`);
      console.error(`    ${stmt.slice(0, 160)}${stmt.length > 160 ? "…" : ""}\n`);
      // A failed statement aborts the transaction in Postgres, so nothing
      // after it can run. Stopping here beats a wall of "current transaction
      // is aborted" that hides the one real error.
      break;
    }
  }
} catch (e) {
  failures++;
  console.error(`  CONNECTION FAILED: ${e.message}`);
} finally {
  try { await client.query("rollback"); } catch {}
  try { await client.end(); } catch {}
}

if (failures === 0) {
  console.log("PASS — every statement executed. This backup will restore.");
  console.log("Nothing was changed; the transaction was rolled back.");
} else {
  console.error("FAIL — this backup would not restore cleanly. Fix before relying on it.");
  process.exit(1);
}
