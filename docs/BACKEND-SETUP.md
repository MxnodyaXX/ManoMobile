# Repair Backend — Supabase Setup

The repair side (jobs, dealers, status history, intake photos) is backed by
Supabase: Postgres for data, Auth for staff sign-in, Storage for intake photos,
and Row Level Security for access control. The rest of the app — warranties,
sales, inventory — still runs on `localStorage` and is untouched by this.

---

## 1. Create the project

1. Create a project at [supabase.com/dashboard](https://supabase.com/dashboard).
2. **Project Settings → API**, copy the **Project URL** and the **anon public** key.
3. In `frontend/`, copy the template and paste them in:

   ```bash
   cp .env.local.example .env.local
   ```

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-ref.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
   ```

4. Restart `npm run dev`. `NEXT_PUBLIC_*` values are inlined at build time, so a
   running dev server keeps serving the old ones.

> Never put the **service_role** key in a `NEXT_PUBLIC_` variable. It bypasses
> RLS and would be shipped to every visitor in the JS bundle.

## 2. Apply the schema

Either way works — the SQL is written to be re-runnable.

**With the CLI** (from the repo root):

```bash
supabase link --project-ref <your-ref>
supabase db push          # applies supabase/migrations/
psql "$DATABASE_URL" -f supabase/seed.sql     # optional demo data
```

**Or from the dashboard:** SQL Editor → paste
`supabase/migrations/20260812000001_repair_core.sql` → Run. Then paste
`supabase/seed.sql` and run that too if you want demo rows.

The migration creates:

| Object | Purpose |
| --- | --- |
| `profiles` | Staff directory; `role` drives every RLS policy |
| `repair_dealers` | Dealer registry, incl. the single in-house dealer |
| `repair_jobs` | Jobs; `id` is the printed `RM-0xx` number |
| `repair_job_events` | Append-only status history, written by trigger |
| `repair-intake` bucket | Private storage for intake photos |

## 3. Create staff logins

There is no self-service sign-up — an Admin creates accounts.

1. **Authentication → Users → Add user**, set an email and password, and tick
   *Auto Confirm User* (otherwise they must click a confirmation email first).
2. A `profiles` row is created automatically by the `on_auth_user_created`
   trigger, defaulting to the **Cashier** role.
3. Set the real role — for the first admin you must do this in SQL, because
   only an Admin can change roles:

   ```sql
   update public.profiles
      set role = 'Admin', full_name = 'Pradeep Silva', staff_id = 'ST-001'
    where email = 'pradeep@manomobile.lk';
   ```

You can also set the role at invite time via user metadata:
`{ "role": "Technician", "full_name": "Kamal Rajapaksa" }`.

## 4. Sign in

Visit any app route; `proxy.ts` redirects to `/login` and returns you afterwards.

---

## Access model

RLS is the real enforcement — the UI only hides what a role cannot do.

| | Jobs read | Jobs create | Jobs update | Jobs delete | Dealers |
| --- | --- | --- | --- | --- | --- |
| **Admin** | ✅ | ✅ | ✅ | ✅ | full |
| **Cashier** | ✅ | ✅ | ✅ | — | read |
| **Technician** | ✅ | — | ✅ | — | read |
| **Accounts** | ✅ | — | — | — | read |

Inactive staff (`status <> 'Active'`) fail `is_staff()` and so read nothing,
even with a valid session.

**Known limitation:** technicians can update *any* column, not just the work
fields. Restricting that properly needs column-level grants or a set of
`security definer` RPCs, which is worth doing before this goes near real money.

## How the app talks to it

```
components → useRepair()            RepairContext.tsx   (unchanged public API)
                ↓
           lib/repair/api.ts         queries + row↔domain mappers
                ↓
        lib/supabase/client.ts       browser client (cookie session)
```

- **`addJob` is now async** — the job number comes from a Postgres sequence, so
  two cashiers taking devices in at once can no longer be handed the same
  `RM-0xx`. The old client-side `max()+1` could.
- **`updateJob` is optimistic** — the row changes on screen immediately, then
  reconciles with what the database stored. A rejection reloads, so the UI never
  shows a change RLS refused.
- **Intake photos** upload to `repair-intake/<job-id>/…` *after* the insert
  (the path needs the job number) and the row stores paths, not bytes. The
  bucket is private; display uses signed URLs via `signedPhotoUrls()`.
- **Signatures** stay as base64 text on the row — a signature-pad PNG is tens of
  KB, small enough not to be worth a bucket round-trip.

## Without Supabase configured

The app still runs. `RepairContext` reports `backend: "local"`, serves the seed
jobs and dealers from memory, and `proxy.ts` skips the auth redirect — otherwise
a missing `.env.local` would lock everyone out of a demo. **Nothing is saved in
that mode.** Check `backend` from `useRepair()` if you want to show a banner.

## Still local-only

Drafts (`mano_repair_drafts`), warranties, sales, inventory, and the audit log
remain in `localStorage`, so they are still per-browser. Drafts are the obvious
next thing to move if unfinished intakes need to follow staff between devices.
