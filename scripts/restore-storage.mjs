#!/usr/bin/env node
/**
 * Mano Mobile — put the intake photos back.
 *
 * data.sql restores the rows; the photo files themselves live in Supabase
 * Storage and have to be uploaded separately. Job rows hold bucket paths, so
 * without this step every intake gallery in a restored system is a set of
 * broken links.
 *
 * Usage:  node scripts/restore-storage.mjs backups/2026-08-24-06-31-48
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");

const folder = process.argv[2];
if (!folder) {
  console.error("Usage: node scripts/restore-storage.mjs <backup folder>");
  process.exit(1);
}
const STORAGE = path.resolve(folder, "storage");
if (!fs.existsSync(STORAGE)) {
  console.error(`No storage/ folder inside ${folder} — nothing to upload.`);
  process.exit(1);
}

function readEnv() {
  const file = path.join(ROOT, "frontend", ".env.local");
  const env = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim();
  }
  return env;
}

const env = readEnv();
const SB = (env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!SB || !KEY) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in frontend/.env.local");
  process.exit(1);
}
const auth = { apikey: KEY, Authorization: `Bearer ${KEY}` };

const MIME = {
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
  ".webp": "image/webp", ".heic": "image/heic",
};

/** Every file under dir, as paths relative to dir, with forward slashes. */
function walk(dir, base = dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, base));
    else out.push(path.relative(base, full).split(path.sep).join("/"));
  }
  return out;
}

async function main() {
  // The first level under storage/ is the bucket name, mirroring how the
  // backup wrote it, so a second bucket added later needs no code change.
  const buckets = fs.readdirSync(STORAGE, { withFileTypes: true })
    .filter(e => e.isDirectory())
    .map(e => e.name);

  if (buckets.length === 0) {
    console.log("No buckets in this backup — nothing to do.");
    return;
  }

  for (const bucket of buckets) {
    const dir = path.join(STORAGE, bucket);
    const files = walk(dir);
    console.log(`${bucket}: ${files.length} files`);

    let ok = 0, failed = 0;
    for (const rel of files) {
      const body = fs.readFileSync(path.join(dir, rel));
      const type = MIME[path.extname(rel).toLowerCase()] ?? "application/octet-stream";

      const res = await fetch(`${SB}/storage/v1/object/${bucket}/${rel}`, {
        method: "POST",
        headers: {
          ...auth,
          "Content-Type": type,
          // Overwrite rather than fail, so an interrupted restore can be
          // re-run without hand-deleting what already made it across.
          "x-upsert": "true",
        },
        body,
      });

      if (res.ok) ok++;
      else {
        failed++;
        console.error(`  ${rel} -> ${res.status} ${(await res.text()).slice(0, 120)}`);
      }
    }
    console.log(`  uploaded ${ok}, failed ${failed}`);
    if (failed) process.exitCode = 1;
  }
}

main().catch(e => {
  console.error(`RESTORE FAILED: ${e.message}`);
  process.exit(1);
});
