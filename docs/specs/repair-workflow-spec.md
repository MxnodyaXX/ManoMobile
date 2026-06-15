# Repair Workflow Feature Spec — Intake → Warranty

**Status:** Draft v1
**Scope:** The end-to-end repair lifecycle for Mano Mobile, from device intake at the
counter through diagnosis, approval, repair, QC, handover, and post-repair warranty
(including claims). This spec closes the gaps and disconnects in the workflow that exists
today; it is not a greenfield design.

---

## 1. Current state (what already exists)

Understanding the baseline matters — several pieces are already built (in-memory only).

| Stage | Exists today | Where |
|---|---|---|
| Intake form | 4-step wizard: dealer, customer (name/NIC/contact/email), device model + IMEI, received items, fault checkboxes + free text, cost/advance/payment, priority, notes, technician assignment, completion date | `cashier/components/repair/NewRepairForm.tsx` |
| Job record | `RepairJob` with status, priority, cost, advance, IMEI, `receivedItems`, free-text `jobWarranty` | `cashier/contexts/RepairContext.tsx` |
| Status model | Single enum `Non-Issued → Issued → Pending → Completed → Delivered / Cancelled` with an allowed-transition map | `RepairContext.tsx`, `technician/.../StatusUpdateModal.tsx` |
| Diagnosis | `DiagnosticReport` — screen condition, power/touch/charge/speaker/camera/buttons, water damage, IMEI verify, **photos (base64)**, notes | `technician/contexts/TechContext.tsx` |
| Parts | `PartRequest` (Pending/Approved/Issued/Rejected) with `installedAt` | `TechContext.tsx` |
| QC | `FunctionalTest` checklist (11 tests, pass/fail/NA) captured on completion | `StatusUpdateModal.tsx` |
| Warranty issuance | `saveWarranty({ jobId, issuedAt, durationDays, expiresAt })` on completion | `TechContext.tsx` |
| Activity log | Per-job timeline incl. `warranty_issued`, `test_completed`, etc. | `TechContext.tsx` |
| Collection queue | `PendingCollection` list on technician side | `technician/components/collection/PendingCollection.tsx` |

### Key gaps & disconnects this spec addresses
1. **No persistence** — everything resets on refresh (out of scope here; tracked separately, but every entity below assumes a backend will own it).
2. **Two warranty representations that don't talk to each other**: free-text `RepairJob.jobWarranty` vs structured `Warranty` in `TechContext`. Must be unified.
3. **No cosmetic condition + photos captured at *intake*** — only the technician's later diagnostic has photos. Disputes ("that scratch wasn't there") need *before* evidence at drop-off.
4. **No customer consent / signature** at drop-off or handover.
5. **No device unlock capture** (PIN/pattern) needed to test & repair.
6. **No estimate→approval gate** — work can start before the customer agrees to a revised price.
7. **No handover/collection workflow** — `Delivered` is just a status; no balance settlement, no warranty card issued to the customer, no handover signature.
8. **No warranty register, lookup, or claim workflow** — once issued, a warranty cannot be looked up at the counter or claimed.
9. **No customer-facing job/warranty tracking.**

---

## 2. Unified lifecycle (state machine)

Keep the existing `JobStatus` enum but make transitions explicit and add three sub-states
needed for approval and handover. No new top-level statuses are required if we model
**approval** and **payment** as gates on existing transitions.

```
                 ┌─────────────┐
   Intake  ─────▶│ Non-Issued  │  (job card created, awaiting diagnosis/assignment)
                 └─────┬───────┘
                       │ technician runs diagnostic + estimate
                       ▼
                 ┌─────────────┐   estimate > approved? ──▶ AWAIT APPROVAL gate
                 │   Issued    │◀──────────────┐  (customer approves revised quote)
                 │ (in progress)               │
                 └─────┬───────┘               │
            pause │    │ complete              │ resume
                  ▼    ▼                        │
            ┌─────────────┐  ┌─────────────┐    │
            │   Pending   │──┘ │  Completed │────┘ (QC passed + warranty issued)
            │  (paused)   │    └─────┬──────┘
            └─────────────┘          │ customer collects: balance settled + handover signed
                                     ▼
                              ┌─────────────┐
                              │  Delivered  │ (warranty active, clock started at handover)
                              └─────────────┘

   Any state ──▶ Cancelled (reason required; advance refund handled in Sales/Accounts)
```

**Gates (business rules, not statuses):**
- **Approval gate** — if final estimate exceeds the originally agreed `estimatedCost` by more
  than the configurable tolerance (default 0), the job cannot move past `Issued` to
  `Completed` until a customer approval is recorded (in-store signature or SMS/WhatsApp reply).
- **Payment gate** — `Completed → Delivered` requires `balanceDue === 0` OR an explicit
  "release with balance" override (permissioned, logged).

---

## 3. Data model changes

All new fields are additive. New entities live alongside the existing contexts and will be
backed by API endpoints once the backend exists.

### 3.1 Extend `RepairJob`
```ts
interface RepairJob {
  // … existing fields …

  // Intake evidence & consent
  cosmeticCondition?: DeviceConditionMap;   // see 3.2
  intakePhotos?: string[];                   // base64/URLs captured at drop-off
  devicePasscode?: string;                   // encrypted at rest; PIN/pattern/none
  passcodeType?: "PIN" | "Pattern" | "Password" | "None" | "Provided Separately";
  customerConsentSignature?: string;         // base64 PNG, signed at intake
  termsVersionAccepted?: string;             // which T&C version the customer signed

  // Estimate & approval
  originalEstimate: number;                  // first quote at intake (rename of estimatedCost intent)
  revisedEstimate?: number;                  // technician's post-diagnosis quote
  approval?: EstimateApproval;               // see 3.3

  // Handover
  handover?: HandoverRecord;                 // see 3.6

  // Warranty (replaces free-text jobWarranty)
  warrantyId?: string;                       // FK to Warranty (3.7)
}
```
> **Migration note:** deprecate the free-text `jobWarranty: string`. Existing seed values
> map to a `Warranty` row with `durationDays` parsed from the label.

### 3.2 Device cosmetic condition (NEW)
```ts
type ConditionGrade = "Pristine" | "Good" | "Worn" | "Damaged";
interface DeviceConditionMap {
  front: ConditionGrade;     // screen/glass
  back: ConditionGrade;
  frame: ConditionGrade;
  camera: ConditionGrade;
  ports: ConditionGrade;
  buttons: ConditionGrade;
  notes?: string;            // "deep scratch top-left, dent on right frame"
}
```

### 3.3 Estimate approval (NEW)
```ts
type ApprovalChannel = "In-store" | "SMS" | "WhatsApp" | "Phone";
interface EstimateApproval {
  amount: number;
  approvedBy: string;            // customer name as recorded
  channel: ApprovalChannel;
  signature?: string;           // base64 if in-store
  reference?: string;           // SMS/WhatsApp message id or call note
  approvedAt: string;           // ISO
  recordedByStaff: string;
}
```

### 3.6 Handover record (NEW)
```ts
interface HandoverRecord {
  collectedBy: string;          // who picked up (may differ from customer)
  relationship?: string;        // "Owner", "Family", "Authorized" (+ NIC if not owner)
  idVerified: boolean;
  balanceSettled: number;
  paymentMethod?: "Cash" | "Card" | "Bank Transfer" | "Online";
  releaseWithBalanceOverride?: { approvedByStaff: string; reason: string };
  handoverSignature: string;    // base64, customer signs on collection
  warrantyCardIssued: boolean;
  handedOverBy: string;         // staff
  handedOverAt: string;         // ISO — this is when the warranty clock starts
}
```

### 3.7 Warranty entity (REPLACES dual representation)
```ts
type WarrantyStatus = "Active" | "Expired" | "Void" | "Claimed";
type WarrantyScope  = "Parts & Labour" | "Parts Only" | "Labour Only";

interface Warranty {
  id: string;                   // WR-0001
  jobId: string;
  invoiceNo?: string;
  customerName: string;
  customerPhone: string;
  deviceModel: string;
  imei?: string;
  partsCovered: string[];       // e.g. ["iPhone 13 OLED screen"]
  scope: WarrantyScope;
  durationDays: number;
  issuedAt: string;             // when job completed
  startsAt: string;             // = handover time (clock starts on collection, not completion)
  expiresAt: string;            // startsAt + durationDays
  status: WarrantyStatus;
  voidReason?: string;          // e.g. "physical/water damage", "third-party tamper"
  exclusions: string[];         // standard exclusions snapshot at issue time
  claims: WarrantyClaim[];
}
```

### 3.8 Warranty claim (NEW)
```ts
type ClaimStatus = "Open" | "Under Review" | "Approved" | "Rejected" | "Resolved";
type ClaimResolution = "Re-repair (free)" | "Part replaced (free)" | "Partial charge" | "Rejected — out of scope";

interface WarrantyClaim {
  id: string;                   // CL-0001
  warrantyId: string;
  reportedIssue: string;
  reportedAt: string;
  inspectionNotes?: string;
  withinCoverage: boolean;      // decision after inspection
  resolution?: ClaimResolution;
  newJobId?: string;            // a free re-repair job spawned from the claim
  handledBy: string;
  resolvedAt?: string;
}
```

---

## 4. Stage-by-stage specification

### Stage 1 — Intake (drop-off)
**Actor:** Cashier. **Extends:** `NewRepairForm.tsx`.

**New requirements (added to the existing 4-step wizard):**
1. **Warranty lookup first.** On entering IMEI/phone, auto-check the warranty register. If an
   **active warranty** matches, surface a banner: *"This device has an active warranty
   (WR-0123, screen, expires 2026-08-01) — start a warranty claim instead?"* with a one-click
   path to Stage 8.
2. **Cosmetic condition capture (Step 2).** A body-map / grid of `DeviceConditionMap` zones,
   each graded, plus **intake photos** (min 1, recommend 4: front, back, both sides). Reuse the
   base64 photo pattern already used by `DiagnosticReport.photos`.
3. **Device passcode capture (Step 2).** PIN/Pattern/Password/None — stored **encrypted**, shown
   only to the assigned technician, auto-purged on `Delivered`.
4. **Consent & signature (new Step: Review & Sign).** Render a summary (device, faults, estimate,
   received items, condition) + the shop's T&C (warranty terms, data-loss disclaimer, unclaimed-
   device policy). Capture **customer signature** on a canvas. Record `termsVersionAccepted`.
5. **Auto-issue job card** (already promised in UI copy) — now actually generates a printable
   job card with QR linking to the customer tracking page (Stage 9).

**Acceptance criteria:**
- Cannot submit without: customer name + contact, device model, ≥1 cosmetic photo, signature.
- If active warranty exists for the IMEI, the form requires an explicit "New paid job — not a
  warranty claim" acknowledgement before proceeding.
- Job card prints/exports as PDF (jspdf already in deps) and includes QR + job id + intake photos thumbnail.

---

### Stage 2 — Diagnosis & estimate
**Actor:** Technician. **Extends:** `DiagnosticModal.tsx` + `DiagnosticReport`.

- Largely exists. **Add:** the technician sets a **`revisedEstimate`** as part of the diagnostic.
- If `revisedEstimate > originalEstimate` (+ tolerance), the job is flagged
  **"Awaiting customer approval"** and the **approval gate** (3.3) blocks completion.
- A one-tap **"Request approval"** action sends the customer the revised quote via SMS/WhatsApp
  template (templates already exist in AdminContext) and records an `EstimateApproval` when they reply.

**Acceptance criteria:**
- Starting repair (`Non-Issued → Issued`) keeps today's soft warning if no diagnostic exists.
- `Issued → Completed` is **blocked** when an approval is required and none is recorded.

---

### Stage 3 — Repair & parts
**Actor:** Technician. **Mostly exists** (`PartRequest`, job timer, internal notes).

- **Add:** when a `PartRequest` reaches `Issued`/`installedAt`, the consumed part is recorded
  against the job for (a) warranty `partsCovered`, and (b) inventory deduction (cross-module —
  inventory integration tracked separately but the hook is defined here:
  `onPartInstalled(jobId, sku, qty)`).

---

### Stage 4 — QC / functional test
**Actor:** Technician. **Exists** (`FunctionalTest` in `StatusUpdateModal`).

- **Add rule:** if any functional test is marked **fail**, completion requires an explicit
  acknowledgement ("Completing with known failing items") captured in `completionNotes`, OR the
  job must go back to `Issued`. Prevents silent handover of a still-broken device.

---

### Stage 5 — Warranty issuance (at completion)
**Actor:** Technician. **Exists but must be upgraded** from the thin `saveWarranty` to the full
`Warranty` entity (3.7).

- On completion, build a `Warranty` with `scope`, `partsCovered` (from installed parts),
  `exclusions` (snapshot from system settings), `durationDays` (existing chooser).
- **`startsAt` is NOT set yet** — warranty is "Issued, pending collection." The clock starts at
  **handover** (Stage 6). This is a deliberate fix: today `expiresAt` is computed at completion,
  which shortchanges customers who collect days later.

**Acceptance criteria:**
- Completing a job creates exactly one `Warranty` linked via `RepairJob.warrantyId`.
- `durationDays === 0` ("No Warranty") creates no `Warranty` row but records the choice in the log.

---

### Stage 6 — Handover / collection
**Actor:** Cashier. **NEW workflow** (replaces bare `Delivered` status). Triggered from
`PendingCollection`.

**Flow:**
1. Scan/lookup job → show outstanding balance.
2. **Payment gate:** collect `balanceDue`. If unpaid, require permissioned
   "release with balance" override (logged to audit).
3. **ID check** if `collectedBy` ≠ customer (capture relationship + NIC).
4. **Return received items** checklist (echoes intake `receivedItems`).
5. **Customer signs** handover (canvas) confirming device received in working order + items returned.
6. System **activates the warranty**: set `startsAt = now`, `expiresAt = now + durationDays`,
   status `Active`; **issues the warranty card** (printable/PDF + SMS/WhatsApp copy with QR).
7. Job → `Delivered`. Purge stored passcode.

**Acceptance criteria:**
- Cannot reach `Delivered` without handover signature and (settled balance OR override).
- Warranty `startsAt` equals handover timestamp, not completion timestamp.
- Warranty card contains: WR id, device + IMEI, parts covered, scope, start/expiry, exclusions, QR.

---

### Stage 7 — Warranty register & lookup
**Actor:** Cashier / Admin. **NEW screen.**

- A searchable register of all `Warranty` rows (by IMEI, phone, WR id, invoice, status).
- Status auto-derives: `Active` until `expiresAt`, then `Expired` (nightly job / on read).
- Row detail shows the originating job, parts, claims history, and a **"Start claim"** action.
- Dashboard surfaces: warranties expiring in 7 days, active count, claim rate.

---

### Stage 8 — Warranty claim
**Actor:** Cashier (open) + Technician (inspect) + Admin (approve edge cases). **NEW workflow.**

**Flow:**
1. From an `Active` warranty, **open a claim** (`WarrantyClaim`, status `Open`) with the reported issue.
2. Device is taken in (a lightweight intake — reuse condition capture) → technician inspects →
   sets `withinCoverage` and `inspectionNotes`.
3. **Decision:**
   - **In coverage** → spawn a **free re-repair job** (`newJobId`, `originalEstimate = 0`,
     flagged `Warranty Claim`), run it through Stages 3–6. Resolution = "Re-repair (free)".
   - **Out of coverage** (physical/water/tamper per `exclusions`) → `Rejected — out of scope`;
     offer a normal paid job instead.
   - **Partial** → quote the chargeable portion; record `Partial charge`.
4. Claim closes (`Resolved`/`Rejected`); warranty status → `Claimed` if a covered repair was done
   (does **not** extend expiry unless settings say otherwise — configurable
   `warrantyResetsOnClaim`).

**Acceptance criteria:**
- A claim can only be opened against an `Active` warranty.
- An approved in-coverage claim creates a zero-cost linked job; the customer is never invoiced for covered work.
- All claim decisions are written to the audit log.

---

### Stage 9 — Customer-facing tracking (supporting)
**Actor:** Customer (no login). **NEW, read-only public page.**

- The QR on the job card / warranty card opens a tokenised status page:
  current status, ETA, estimate + approval prompt, and (post-handover) warranty validity.
- Approval can be granted here (feeds Stage 2 approval gate).

---

## 5. Settings (Admin → System Settings additions)

Add to the existing `SystemSettings`:
- `defaultWarrantyDays` (currently `warrantyDays` exists — reuse).
- `warrantyExclusions: string[]` (snapshotted onto each warranty at issue).
- `warrantyScopeDefault: WarrantyScope`.
- `estimateApprovalTolerance: number` (LKR or %).
- `warrantyResetsOnClaim: boolean`.
- `unclaimedDeviceDays: number` (for the unclaimed-device policy in T&C).
- `termsVersion: string` + editable T&C body.

---

## 6. Cross-module touch points
- **Sales/Cash register:** advance at intake, balance at handover, refund on cancel.
- **Inventory:** part install → stock deduction (`onPartInstalled`).
- **Accounts:** repair revenue recognised on `Delivered`; warranty re-repairs are zero-revenue cost events.
- **Notifications:** intake received, approval request, ready-for-collection, warranty card,
  warranty-expiring reminder — all map to existing `NotificationTemplate` events.
- **Audit:** every gate override, approval, handover, and claim decision is logged.

---

## 7. Suggested build order
1. Unify warranty into the `Warranty` entity; migrate `jobWarranty` (unblocks 5–8).
2. Intake: cosmetic condition + photos + signature + passcode (biggest dispute-prevention win).
3. Handover workflow + warranty activation on collection (fixes the warranty-clock bug).
4. Warranty register & lookup.
5. Estimate approval gate.
6. Warranty claims.
7. Customer-facing tracking page.

Items 1–3 are the high-value core; 4–7 layer on top without rework.
