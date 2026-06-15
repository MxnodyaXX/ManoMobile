# Mano Mobile — Complete Feature Document (Page by Page)

**Product:** Mano Mobile Management Suite — a point-of-sale, repair, inventory, and
accounting system for a mobile phone **sales + repair** business (Sri Lanka; currency LKR,
VAT 18%).
**Stack:** Next.js 16 (App Router) + React 19 + TypeScript, MUI/Emotion, Framer Motion,
Recharts, lucide-react icons, `qrcode.react` + `react-barcode` (codes), `jspdf`/`xlsx`
(exports), `html2canvas`. Backend is a .NET scaffold (not yet wired); all data is currently
seed data held in React Context, with repair jobs + warranties persisted to `localStorage`.

This document lists **every feature, page by page**, including small ones, with a short
explanation of each.

---

## 0. Global / cross-cutting features

- **Four role apps** behind one login: Cashier, Technician, Admin, Accounts — each with its
  own sidebar, navbar, theme accent, and pages.
- **Light/Dark theme** — `next-themes` with a CSS-variable design system; light is the default.
- **Fully responsive** — a `useIsMobile` hook drives mobile layouts: collapsible sidebars,
  hamburger menus, horizontally scrollable tab strips, and stacked panels.
- **Animations** — `fade-up` entrance animations and Framer Motion sidebar transitions.
- **Printing** — repair slips, sales invoices, warranty cards, and quotations each render a
  clean print layout (A5) via a hidden print DOM + `@media print` CSS.
- **Exports** — sales/reports/accounts data exports to **PDF** (jspdf + autotable), **Excel**
  (xlsx), and **PNG** (html2canvas).
- **Codes** — QR codes and barcodes are generated on invoices and previews; barcode format is
  configurable (Code128 / Code39 / EAN-13).
- **Persistence (partial)** — repair jobs (`mano_repair_jobs`), warranties (`mano_warranties`),
  and claims (`mano_claims`) survive refresh and are shared across roles via `localStorage`;
  all other modules reset on refresh (seed data only).

---

## 1. Login / Role Selection — `/`

The landing page. No real authentication yet — selecting a role routes into that app.

- **Brand panel** — Mano Mobile logo, tagline, version footer (`v1.0.0`).
- **Four role cards** — Cashier ("Full Access"), Technician ("Repair Focus"),
  Admin ("Admin Only"), Accounts ("Finance"). Each shows an icon, colour, short description,
  hover lift/glow, and "Sign in as…" affordance.
- **Technician name picker** — choosing Technician opens an overlay to pick the technician
  (Kamal / Nimal / Suresh); the choice is passed via URL to load that person's queue.
- **Routing** — cards route to `/cashier`, `/technician?tech=<name>`, `/admin`, `/accounts`.
- **Decorative grid background** — subtle fixed grid pattern.

---

## 2. CASHIER app — `/cashier`

The most feature-rich role ("Full Access"). Left sidebar navigation, top navbar, and a main
content area. Sidebar (collapsible on desktop, drawer on mobile) lists: Home, Repair
Management, Warranty Center, Sales Management, Inventory Management, Customer Management,
Reports, Cash Register, Invoice History, Audit Trail, Admin Control.

### 2.1 Home (Dashboard)
- **Greeting header** — "Good morning" + business name.
- **Pending-jobs alert banner** — warns when repair jobs await parts/assignment, with a
  jump-to-Repairs button.
- **Today snapshot strip** — Revenue Today, Jobs In Queue, Invoices Issued, Pending Pickups.
- **Period filter bar** — Daily / Weekly / Monthly / Yearly toggles that recompute the stat
  blocks and date label.
- **Three stat groups** — Revenue (total, sales, repairs), Sales (total, mobile, accessory,
  other), Repairs (income, labour cost, parts cost, total jobs). Each card shows value +
  % change vs previous period.
- **Quick actions** — New Repair Job, New Sale, Cash Register, View Reports (jump buttons).
- **Recent activity feed** — latest events (sales, repairs, customers, payments).
- **Charts** — Revenue Growth and Sales Overview (Recharts) with growth badges.
- **Info cards** — platform messaging tiles.

### 2.2 Repair Management
A sub-tab page: New Repair, Non-Issued, Issued, Pending, Completed, Cancelled, All Jobs.

**New Repair** — a 5-step intake wizard:
1. **Dealer & Customer** — pick dealer (auto-fills address/contact/remarks); enter customer
   name, NIC, contact, email.
2. **Device & Faults** — device model (with brand auto-detect), 15-digit IMEI, "items received
   with device" checklist (SIM, charger, cover, etc.), a common-faults checklist (12 faults),
   and a free-text fault description.
3. **Costs & Job Info** — estimated cost, advance received, payment method, live balance-due
   card, job priority (Normal/Urgent/Express/VIP), internal notes.
4. **Assign Repairman** — choose technician (shows speciality, active-job count, availability),
   set estimated completion date, repair summary.
5. **Evidence & Sign** *(new)* — **device cosmetic condition** grid (front/back/frame/camera/
   ports/buttons graded Pristine→Damaged + notes); **intake photos** (camera/file capture,
   min 1); **device passcode** capture (PIN/pattern/password/none); **terms & conditions**
   acceptance; **customer signature** pad. Submit is blocked until photo + signature + terms.
- **Active-warranty lookup banner** — if the entered IMEI/phone matches an active warranty,
  prompts to open a warranty claim instead of a paid job.
- On submit: auto-generates a job card and confirmation screen.

**Jobs tables** (Non-Issued / Issued / Pending / Completed / Cancelled / All) — searchable,
filterable job lists with per-row status colour, priority, and a **Job Details modal** that offers:
- **Intake Slip** — printable A5 job card (customer, device, IMEI, items, costs, signature line).
- **Issue Job** — convert a logged job to an issued job with an **Issue Invoice** (customer
  details, discount, paid-amount, credit handling with admin approver, warranty selection).
- **Mark Finished** — finish modal (action taken, QC checks, pricing, warranty).
- **Confirm Pickup** — pickup modal (balance collection, ID-verified checkbox, credit-balance
  handling) that marks the job Delivered.
- **Cancel Job** — cancellation modal with reason picker (changed mind, no budget, parts
  unavailable, no-show, beyond repair, duplicate, other) and refund warning.
- **Repair Invoice Preview** — printable repair invoice.

### 2.3 Warranty Center *(new)*
Three tabs with live counts.
- **Collection** — completed jobs awaiting handover, each as a card with balance due + warranty
  id, and a **Process Handover** action.
  - **Handover modal** — collect balance (with payment method), permissioned "release with
    balance" override, owner / someone-else collector with ID check + relationship/NIC,
    returned-items checklist, **handover signature**; on confirm marks the job Delivered and
    **activates the warranty** (clock starts now), issuing a warranty card.
- **Warranties (register)** — searchable table (by IMEI, phone, name, WR id, invoice) with
  status filter; auto-expires past-due warranties; **expiring-in-7-days** banner; per row:
  **warranty card** (printable A5 card with covered parts, scope, validity, exclusions, QR)
  and **Start Claim**.
- **Claims** — list of warranty claims; each claim can be inspected (notes) and resolved as
  **in coverage → free re-repair job** (auto-creates a Rs. 0 job) or **rejected — out of scope**.

### 2.4 Sales Management (POS)
A sub-tab POS with a global **Held Sales** drawer (park/resume in-progress sales with a badge
count). Sub-tabs:
- **Accessories Sales** — 3-step POS (Select Items → Review Order → Complete Sale). Search by
  code/name, list/grid views, **"Search Manually"** popup with type/brand/supplier filters,
  a **price-range histogram + dual slider**, price/insight sorting, and multi-select add to
  cart. Cart with qty steppers, per-line + overall discount, reveal-buying-price toggle,
  payment method (Cash/Card/Credit), customer info capture, and printable invoice.
- **Mobile Sales** — phone-sale POS with an **IMEI/device search popup** (filter by IMEI last
  digits, name, brand, storage, colour; shows min/suggested price; "in cart" guard).
  Per-device selling price + discount, **Card Payment modal** (requires terminal reference),
  credit-customer picker, and an **A5 landscape printable invoice** with QR + barcode, customer
  block, itemised IMEI lines, totals, terms, and "issued by".
- **Repair Sales** — generate invoices for completed repair jobs, including a credit-record
  confirm flow and printable invoice view.
- **Others** — miscellaneous goods/services (photocopy, lamination, etc.) with its own card
  payment + print preview.
- **Sales History** — browse/search past sales; void or reprint transactions.
- **Daily Summary** — today's revenue snapshot broken down by category.
- **Quotation** — price-estimate CRUD: create/edit multi-line quotes (qty, unit price, %
  discount, live totals), validity date, notes; statuses Active/Converted/Expired with counts;
  **mark converted**; **print quotation** (A5). Seeded with sample quotes.
- **Credit Customer Picker** — shared component to attach a credit account to a sale or add a
  new credit customer at the POS.
- **Split Payment modal** & **Discount Auth modal** — shared: split a bill across cash/card,
  and require manager authorisation for discounts above a threshold.

### 2.5 Inventory Management
Tabs: **Overview**, **Mobile Devices**, **Accessories**.
- **Overview** — stock value, low-stock and out-of-stock indicators.
- **Mobile Devices** — per-unit phone stock (IMEI, brand, storage, colour, supplier,
  buying/min/suggested price); add/edit device modal; delete confirm.
- **Accessories** — product stock (category, brand, supplier, price, stock level with
  colour-coded thresholds); add/edit product modal.
- **Stock Adjust modal** — adjust quantities with reason.
- **Admin Approval modal** — gate sensitive inventory actions behind admin credentials.
- **ComboField** — typeahead combo inputs for brand/category/supplier reuse.

**Stock Receiving** (within inventory) — purchase-order + goods-receipt workflow:
- **New PO modal** — create purchase orders (supplier, line items, qty, unit price).
- **Receive Stock modal** — receive against a PO (full/partial), updating stock.

### 2.6 Customer Management
Sub-tabs: **All Customers** and **Credit Customers**.
- **All Customers** — searchable customer directory; **Customer Detail modal** (profile,
  contact, history).
- **Credit Customers** — customers with outstanding credit balances:
  - **Record Payment modal** — log a repayment against a balance.
  - **History modal** — view a customer's credit transaction history.
  - **Add Credit Customer modal** — onboard a new credit account (limit, terms).

### 2.7 Reports
- **Reports Management** — sales/repair/financial report views with the shared **Export
  Buttons** (PDF / Excel / PNG) and filtering.

### 2.8 Cash Register
- **Cash drawer log** — running list of cash-in / cash-out entries (opening float, cash sales,
  repair payments, petty cash) with reason, amount, time, and operator.
- **Add entry** — record a manual cash-in or cash-out with a reason.
- (Shift open/close + variance tracking is modelled in the Shift context: open shift with
  float, close with counted balance, auto-computed variance, and shift history.)

### 2.9 Invoice History
- **Unified invoice browser** — all sales, repair, and return invoices, **filterable by type,
  status, and date**, with search and reprint.

### 2.10 Audit Trail
- **Activity log** — chronological record of actions (sale created/voided/returned, repair
  created/updated, stock received/adjusted, shift opened/closed, discount authorised, credit
  sale, PO created, customer added, price changed, login/logout) with action icon, entity,
  detail, user, amount, and timestamp.

### 2.11 Admin Control (reference data)
Tabs: **Item Categories**, **Brands**, **Suppliers**, **Barcode**, **Settings**.
- **Categories** — CRUD list of accessory categories (search, add, edit, delete-confirm).
- **Brands** — CRUD brands typed as Device / Accessory / Both, each linked to relevant
  categories via chip toggles.
- **Suppliers** — CRUD suppliers (name, phone, email) linked to the brands they carry.
- **Barcode** — configure barcode format (Code128/Code39/EAN-13), code prefix, bar width/
  height, font size, show-text toggle, with a **live barcode preview**.
- **Settings** — change admin **username/password** (requires current password, min length,
  confirm match) with success/error feedback.

---

## 3. TECHNICIAN app — `/technician`

Repair-focused. Starts with a **technician login** (pick Kamal/Nimal/Suresh) unless passed via
URL. Green-accented sidebar/navbar. Pages: Dashboard, My Jobs, Pending Collection, Parts &
Stock, Job History, My Performance, My Shift.

### 3.1 Dashboard
- **Active-job live timer** — the in-progress ("Issued") job with a second-by-second elapsed
  timer.
- **Queue stats** — counts of assigned/active/paused/completed jobs.
- **Quick actions** — open the **Status Update** modal, **Part Request** modal, and a parts
  view.
- **Priority-coded job cards** (Low/Normal/High/Urgent).

### 3.2 My Jobs
- **Assigned job list** with **SLA helpers** (due/overdue indicators vs estimated completion).
- **Job Detail panel** with the full action set:
  - **Status Update modal** — guided state machine (Not Started → In Progress → Paused/
    Completed) with allowed-transition buttons; pause requires a reason; **active-job conflict**
    auto-pauses another running job; **completion** captures a work summary, an **11-point
    functional QC checklist** (pass/fail/NA), **warranty** (duration + scope), and the
    **estimate-approval gate** (if final cost exceeds the intake quote, requires customer
    approval via in-store signature or SMS/WhatsApp/Phone reference). Issues the unified
    warranty (pending activation until collection).
  - **Diagnostic modal** — pre-repair diagnostic: screen condition (Good/Cracked/Shattered/
    Dead), power/touch/charging/speaker/camera/buttons tri-state checks, water-damage flag,
    **IMEI verification**, notes, and **photo capture**.
  - **Part Request modal** — request a spare part for a job (part, SKU, qty, note).
  - **Escalation modal** — raise an escalation flag (reason, priority Low/Medium/High) and
    later resolve it.
  - **Internal Notes modal** — add internal notes with optional photos.
  - **Customer Message modal** — compose a status message to the customer.
  - **Activity Log panel** — per-job timeline of every action (status changes, parts, notes,
    diagnostics, tests, escalations, messages, warranty issued).

### 3.3 Pending Collection
- **Completed-jobs queue** awaiting customer pickup, with balance-due totals and a
  **Notify Customer** action; hands off to the cashier for payment/handover.

### 3.4 Parts & Stock
- **Spare-parts availability** list with **stock-level badges**; **request a part** with a
  status badge (Pending/Approved/Issued/Rejected) and mark-installed tracking.

### 3.5 Job History
- **Completed/cancelled history** table for the logged-in technician (device, issue, customer,
  est. cost, outcome, date).

### 3.6 My Performance
- **Personal KPIs** — completed jobs, active/paused counts, on-time rate, plus contributions
  from diagnostics, tests, notes, escalations, and part requests; bar-chart breakdowns and a
  rating element.

### 3.7 My Shift
- **Shift tracker** — clock in/out, start/end breaks, and shift history (built on the Tech
  shift model).

---

## 4. ADMIN app — `/admin`

System configuration & access control. Purple-accented. Powered by a rich Admin context
(staff, suppliers, purchase orders, devices, notification templates + logs, settings, audit).

### 4.1 Dashboard
- **Admin overview** — high-level system stats and recent admin activity.

### 4.2 Staff Management
- **Staff directory** — list of staff with role (Admin/Cashier/Technician/Accounts/
  Procurement), email, phone, status (Active/Inactive/Suspended), join date, last login.
- **Add / edit / remove staff** — manage staff accounts and roles.

### 4.3 Suppliers
- **Supplier database** — name, contact person, phone, email, address, category
  (Parts/Phones/Accessories/Equipment/Services/Other), VAT number, payment terms, current
  AP balance, status; **add/edit** suppliers.

### 4.4 Purchase Orders
- **PO management** — purchase orders with supplier, line items (description, SKU, qty, unit
  price, received qty), subtotal/tax/total, expected delivery, approver, notes, and statuses
  (Draft → Approved → Sent → Partially Received → Received / Cancelled); **create PO** and
  **update PO status**.

### 4.5 Device Registry
- **IMEI registry** — every device known to the shop: IMEI(s), make/model/colour/storage,
  owner name/phone, status (Clean / Blacklisted / In Repair / Repaired / For Sale / Returned),
  repair count, last job, notes (e.g. stolen/PD reference); **add/edit** devices. Supports
  blacklist tracking.

### 4.6 Notifications
- **Message templates** — SMS / WhatsApp / Email templates keyed to events (job received,
  ready for collection, payment reminder, repair update, welcome, invoice email) with variable
  placeholders ({customerName}, {deviceModel}, {jobId}, {amount}…) and active toggles.
- **Add template / toggle active / send** — manage and dispatch templates.
- **Notification log** — sent-message history with channel, recipient, message, status
  (Sent/Delivered/Failed/Pending), timestamp, linked job.

### 4.7 Permissions
- **Role-based access matrix** — 17 modules × 5 roles grid; each cell cycles **Full / View /
  None**; colour-coded per role; **save** and **reset to defaults**. (UI-level; not yet
  enforced at runtime.)

### 4.8 System Settings
- **Business profile** — business/legal name, address, phone, email, website.
- **Finance** — VAT number, VAT rate, currency + symbol, timezone, fiscal-year start.
- **Operations** — receipt footer text, warranty days, low-stock threshold,
  require-discount-authorisation toggle, auto-backup toggle.
- **Audit entries** — admin-side audit log of configuration actions.

---

## 5. ACCOUNTS app — `/accounts`

Finance role ("Accounts"). Amber-accented. Starts with a staff selector. Built on a
double-entry accounting engine over a **Chart of Accounts** (Assets/Liabilities/Equity/
Revenue/COGS/Expenses) with normal-balance-aware balance computation.

### 5.1 Dashboard
- **Financial KPIs** — month-to-date revenue, cash position (cash + bank), total AR
  outstanding, total AP outstanding, and summary tiles/charts.

### 5.2 General Ledger
- **Journal entries** — posted double-entry journals (date, reference, description, balanced
  debit/credit lines, status Draft/Posted/Voided, created-by). Seeded with a full May 2026 set
  (opening balances, weekly revenue/COGS, purchases, expenses).
- **New Journal Entry modal** — create a balanced multi-line journal entry.
- **Void entry** — void a posted entry (removed from balances).

### 5.3 Accounts Receivable (AR)
- **AR register** — customer invoices (repair/sales) with invoice date, due date, amount,
  paid, and status (Outstanding/Partial/Paid/Overdue).
- **Record Payment modal** — apply a payment, auto-updating paid amount + status.
- **New AR Record modal** — add a receivable.
- **AR ageing** — current / 1–30 / 31–60 / 61–90 / 90+ day buckets.

### 5.4 Accounts Payable (AP)
- **AP register** — supplier bills with due dates, amount, paid, status, and category.
- **AP Payment modal** — record payments to suppliers.
- **Add AP / Expense modal** — add a payable or a direct expense (category, vendor, method).
- **AP ageing** — same bucket structure as AR.

### 5.5 Financial Reports
- **Income Statement (P&L)** — revenue, COGS, gross profit + margin, operating expenses,
  operating/net income + net margin.
- **Balance Sheet** — assets, liabilities, equity (incl. current-period net income), with
  totals that balance.
- **Cash Flow Statement** — IAS 7 style cash-flow view.
- **Tax / VAT Summary** — VAT collected vs paid and net VAT due.
- **Exports** — each statement exports to PDF (IAS 1 / IAS 7 formatted, with header) and a
  combined Excel workbook; VAT return export.

---

## 6. CUSTOMER tracking — `/track` *(public, no login)*

For customers (typically via a QR on the job/warranty card).
- **Job lookup** — enter a job number (e.g. `RM-001`) to see status.
- **Progress tracker** — Received → In Repair → Ready → Collected stepper with estimated-ready
  date.
- **Estimate approval** — if the repair cost was revised upward, the customer can **approve the
  new amount online**, which feeds back into the technician's approval gate.
- **Warranty status** — covered parts, scope, status, and valid-until date once a warranty
  exists.

---

## 7. Shared components & utilities (used across pages)

- **SignaturePad** — reusable canvas signature capture (intake, approval, handover).
- **Export Buttons** — one-click PDF / Excel / PNG export wherever data tables appear.
- **Held Sales Drawer** — park/resume incomplete sales.
- **Split Payment / Discount Auth modals** — multi-tender payments and manager-authorised
  discounts.
- **Dashboard primitives** — StatCard, StatGroup, InfoCard, ChartCard, FilterBar.
- **Stat/format helpers** — LKR formatting, date-label helpers, data labels.

---

## 8. Known limitations (so the feature list isn't misread)

- **No real backend/auth yet** — role selection is open; the .NET API is a scaffold.
- **Permissions matrix is display-only** — not enforced at runtime.
- **Most modules are seed-data only** — only repair jobs, warranties, and claims persist
  (localStorage); other data resets on refresh.
- **Notifications/SMS/WhatsApp are simulated** — templates and logs exist, but no gateway sends
  real messages.
- **Printing is browser-print** — not wired to thermal printers/hardware.
```

Built for a future backend: the React contexts map cleanly onto API resources.
