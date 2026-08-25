# Mano Mobile — backups

One folder per run, named by the time it was taken. Each holds everything needed
to rebuild the shop on a fresh Supabase project.

```
2026-08-24-06-31-48/
  data.sql          every row, as INSERTs, in foreign-key order
  storage/          intake photos, mirroring their bucket paths
  auth-users.json   staff logins (emails and ids — never passwords)
  manifest.json     row counts and timings
```

## Taking one

```powershell
node scripts\backup.mjs                 # writes to backups\
node scripts\backup.mjs --keep 60       # keep 60 instead of the default 30
```

Nightly, via Task Scheduler — run once from an elevated PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\schedule-backup.ps1
```

Output goes to `backups\logs\backup.log`. **Read that log occasionally.** A
backup job that has been failing silently for a month is the normal way this
goes wrong.

## Restoring into a fresh Supabase project

**1. Rebuild the schema.** In the SQL Editor, run every file in
`supabase/migrations/` in filename order, oldest first. These are in git, which
is why the backup does not duplicate them.

**2. Recreate the staff logins.** Open `auth-users.json` and create each user in
Authentication → Users with the **same email address**. Supabase never exposes
password hashes, so passwords cannot be carried over — everyone sets a new one.

**3. Load the data.** Paste `data.sql` into the SQL Editor and run it. It is one
transaction, and every insert is `on conflict do nothing`, so it is safe to run
again if it is interrupted.

**4. Put the photos back.**

```powershell
node scripts\restore-storage.mjs backups\2026-08-24-06-31-48
```

**5. Point the app at the new project.** Nothing in the code names a Supabase
project — it is all environment. In `frontend\.env.local`, replace these three
with the new project's values from Project Settings → API:

```
NEXT_PUBLIC_SUPABASE_URL=https://<new-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<new anon key>
SUPABASE_SERVICE_ROLE_KEY=<new service role key>
```

Then restart the server. `NEXT_PUBLIC_` values are baked in at build time, so a
running dev server will keep using the old ones until it restarts — and a
deployed build has to be rebuilt, not just restarted.

The SMTP and Text.lk settings are unrelated to Supabase and carry over
untouched.

**6. Re-create the storage bucket if it is missing.** Migration
`20260812000001_repair_core.sql` creates the `repair-intake` bucket, so step 1
normally handles it. Check Storage in the dashboard before step 4 — uploading
into a bucket that does not exist fails file by file.

## Things to know

**Profiles are tied to auth user ids.** A restored `profiles` row points at an
auth user id that will not exist in the new project. After step 2, either update
`profiles.id` to the new ids, or delete the profiles rows and let the app
recreate them as each person signs in — the second is usually less work.

**Test a restore before you need one.** An untested backup is a guess. Create a
throwaway Supabase project, follow the four steps, and confirm the jobs list
looks right. Half an hour now, versus finding out on the day the database is
gone.

**This is a data backup, not a substitute for Supabase's own.** On a paid plan
Supabase takes point-in-time backups that include password hashes and anything
these scripts cannot see. This exists so the shop is not helpless if the project
is deleted, the free tier lapses, or a bad migration wipes a table — the cases
where Supabase's own backups are unavailable or already gone.

**The service-role key is in these files' reach, not in the files.** The backups
themselves contain customer names, phone numbers, emails and device details.
Treat the `backups\` folder as confidential, and if you copy it to a USB stick or
cloud drive, that copy is customer data leaving the shop.

## Proving a backup actually works

```powershell
cd frontend
$env:SUPABASE_DB_URL = "postgresql://postgres.xxxx:PASSWORD@aws-0-....pooler.supabase.com:5432/postgres"
node scripts\verify-restore.mjs ..\backups\2026-08-24-06-31-48
```

Get the connection string from Project Settings → Database → Connection string
(URI). It runs every statement in `data.sql` against a real Postgres inside a
transaction that is always rolled back, so nothing changes — it just proves the
SQL is valid, the column types line up, and the insert order satisfies every
foreign key.

Worth running against your live database once now, and again after any
migration that adds a table.
