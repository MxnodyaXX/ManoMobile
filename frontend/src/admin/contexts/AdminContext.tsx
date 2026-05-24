"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type StaffRole = "Admin" | "Cashier" | "Technician" | "Accounts" | "Procurement";
export type StaffStatus = "Active" | "Inactive" | "Suspended";

export interface StaffMember {
  id: string;
  name: string;
  role: StaffRole;
  email: string;
  phone: string;
  status: StaffStatus;
  joinDate: string;
  lastLogin?: string;
  avatar?: string; // initials used if absent
}

export type SupplierCategory = "Parts" | "Phones" | "Accessories" | "Equipment" | "Services" | "Other";

export interface Supplier {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  category: SupplierCategory;
  vatNumber?: string;
  paymentTerms: string;
  balance: number; // current AP balance
  status: "Active" | "Inactive";
  createdAt: string;
}

export type POStatus = "Draft" | "Approved" | "Sent" | "Partially Received" | "Received" | "Cancelled";

export interface POItem {
  id: string;
  description: string;
  sku?: string;
  quantity: number;
  unitPrice: number;
  receivedQty: number;
}

export interface PurchaseOrder {
  id: string;
  supplierId: string;
  supplierName: string;
  status: POStatus;
  items: POItem[];
  subtotal: number;
  tax: number;
  total: number;
  expectedDelivery: string;
  createdAt: string;
  approvedBy?: string;
  notes?: string;
}

export type DeviceStatus = "Clean" | "Blacklisted" | "In Repair" | "Repaired" | "For Sale" | "Returned";

export interface DeviceRecord {
  id: string;
  imei: string;
  imei2?: string;
  make: string;
  model: string;
  color?: string;
  storage?: string;
  ownerName?: string;
  ownerPhone?: string;
  status: DeviceStatus;
  repairCount: number;
  lastJobId?: string;
  notes?: string;
  registeredAt: string;
}

export type NotificationChannel = "SMS" | "WhatsApp" | "Email";

export interface NotificationTemplate {
  id: string;
  name: string;
  channel: NotificationChannel;
  event: string;
  subject?: string;
  body: string;
  variables: string[];
  isActive: boolean;
}

export interface NotificationLog {
  id: string;
  templateName: string;
  channel: NotificationChannel;
  recipient: string;
  message: string;
  status: "Sent" | "Delivered" | "Failed" | "Pending";
  sentAt: string;
  jobId?: string;
}

export interface SystemSettings {
  businessName: string;
  legalName: string;
  address: string;
  phone: string;
  email: string;
  website?: string;
  vatNumber: string;
  vatRate: number;
  currency: string;
  currencySymbol: string;
  timezone: string;
  receiptFooter: string;
  warrantyDays: number;
  fiscalYearStart: string;
  lowStockThreshold: number;
  requireDiscountAuth: boolean;
  autoBackup: boolean;
}

export interface AuditEntry {
  id: string;
  user: string;
  role: StaffRole;
  action: string;
  module: string;
  detail: string;
  ip?: string;
  timestamp: string;
}

// ─── Context value ────────────────────────────────────────────────────────────

interface AdminContextValue {
  // Staff
  staff: StaffMember[];
  addStaff: (s: Omit<StaffMember, "id">) => void;
  updateStaff: (id: string, patch: Partial<StaffMember>) => void;
  removeStaff: (id: string) => void;

  // Suppliers
  suppliers: Supplier[];
  addSupplier: (s: Omit<Supplier, "id">) => void;
  updateSupplier: (id: string, patch: Partial<Supplier>) => void;

  // Purchase Orders
  purchaseOrders: PurchaseOrder[];
  addPurchaseOrder: (po: Omit<PurchaseOrder, "id">) => void;
  updatePOStatus: (id: string, status: POStatus) => void;

  // Devices
  devices: DeviceRecord[];
  addDevice: (d: Omit<DeviceRecord, "id">) => void;
  updateDevice: (id: string, patch: Partial<DeviceRecord>) => void;

  // Notifications
  templates: NotificationTemplate[];
  notificationLog: NotificationLog[];
  addTemplate: (t: Omit<NotificationTemplate, "id">) => void;
  toggleTemplate: (id: string) => void;
  sendNotification: (log: Omit<NotificationLog, "id">) => void;

  // Settings
  settings: SystemSettings;
  updateSettings: (patch: Partial<SystemSettings>) => void;

  // Audit log
  auditLog: AuditEntry[];
  logAction: (entry: Omit<AuditEntry, "id" | "timestamp">) => void;
}

const AdminContext = createContext<AdminContextValue>({} as AdminContextValue);

// ─── Seed data ────────────────────────────────────────────────────────────────

const SEED_STAFF: StaffMember[] = [
  { id: "ST-001", name: "Pradeep Silva",    role: "Admin",       email: "pradeep@manomobile.lk",  phone: "071-234-5678", status: "Active",    joinDate: "2023-01-15", lastLogin: "2026-05-22 09:12" },
  { id: "ST-002", name: "Ruwan Perera",     role: "Cashier",     email: "ruwan@manomobile.lk",    phone: "072-345-6789", status: "Active",    joinDate: "2023-03-01", lastLogin: "2026-05-22 08:45" },
  { id: "ST-003", name: "Niluka Fernando",  role: "Cashier",     email: "niluka@manomobile.lk",   phone: "077-456-7890", status: "Active",    joinDate: "2024-06-10", lastLogin: "2026-05-21 17:30" },
  { id: "ST-004", name: "Kamal Rajapaksa",  role: "Technician",  email: "kamal@manomobile.lk",    phone: "078-567-8901", status: "Active",    joinDate: "2023-02-20", lastLogin: "2026-05-22 09:00" },
  { id: "ST-005", name: "Nimal Bandara",    role: "Technician",  email: "nimal@manomobile.lk",    phone: "076-678-9012", status: "Active",    joinDate: "2023-08-05", lastLogin: "2026-05-22 08:50" },
  { id: "ST-006", name: "Suresh Kumara",    role: "Technician",  email: "suresh@manomobile.lk",   phone: "075-789-0123", status: "Inactive",  joinDate: "2024-01-10", lastLogin: "2026-04-30 16:00" },
  { id: "ST-007", name: "Fathima Rizwan",   role: "Accounts",    email: "fathima@manomobile.lk",  phone: "074-890-1234", status: "Active",    joinDate: "2023-05-12", lastLogin: "2026-05-22 09:05" },
  { id: "ST-008", name: "Priya Krishnan",   role: "Accounts",    email: "priya@manomobile.lk",    phone: "073-901-2345", status: "Active",    joinDate: "2024-09-01", lastLogin: "2026-05-21 18:00" },
];

const SEED_SUPPLIERS: Supplier[] = [
  { id: "SUP-001", name: "TechParts Lanka (Pvt) Ltd",    contactPerson: "Mahesh Dias",     phone: "011-234-5678", email: "info@techpartslanka.lk",    address: "42, Galle Rd, Colombo 03", category: "Parts",       vatNumber: "VAT-123456", paymentTerms: "Net 30", balance: 85000,  status: "Active",   createdAt: "2023-01-20" },
  { id: "SUP-002", name: "Samsung Distributors SL",       contactPerson: "Ravi Mendis",     phone: "011-345-6789", email: "orders@samsungsl.lk",        address: "15, Nawam Mw, Colombo 02", category: "Phones",      vatNumber: "VAT-234567", paymentTerms: "Net 15", balance: 120000, status: "Active",   createdAt: "2023-02-10" },
  { id: "SUP-003", name: "Accessory World Lanka",          contactPerson: "Shamali Perera",  phone: "071-456-7890", email: "sales@accessoryworld.lk",    address: "88, Pettah Market, Colombo 11", category: "Accessories", paymentTerms: "COD",    balance: 12500,  status: "Active",   createdAt: "2023-06-15" },
  { id: "SUP-004", name: "Fix-It Tools & Equipment",       contactPerson: "Asanka Jayawardena",phone:"077-567-8901",email: "fixittools@gmail.com",       address: "Kandy Road, Kiribathgoda",    category: "Equipment",   paymentTerms: "Net 30", balance: 0,      status: "Active",   createdAt: "2024-03-01" },
  { id: "SUP-005", name: "Oppo / Huawei Partners SL",      contactPerson: "Zhang Wei",       phone: "011-678-9012", email: "partners@oppohp.lk",         address: "World Trade Centre, Colombo 01", category: "Phones",   vatNumber: "VAT-345678", paymentTerms: "Net 30", balance: 60000,  status: "Active",   createdAt: "2024-01-05" },
];

const SEED_POS: PurchaseOrder[] = [
  {
    id: "PO-001", supplierId: "SUP-001", supplierName: "TechParts Lanka (Pvt) Ltd",
    status: "Received", createdAt: "2026-05-05", expectedDelivery: "2026-05-10", approvedBy: "Pradeep Silva",
    items: [
      { id: "i1", description: "iPhone 12 Screen Assembly (OLED)", sku: "SCR-IP12-OLED", quantity: 5,  unitPrice: 8500,  receivedQty: 5 },
      { id: "i2", description: "Samsung A54 Battery 5000mAh",      sku: "BAT-A54",       quantity: 10, unitPrice: 1800,  receivedQty: 10 },
      { id: "i3", description: "Charging Port USB-C (Universal)",  sku: "PORT-USBC-UNI", quantity: 20, unitPrice: 450,   receivedQty: 20 },
    ],
    subtotal: 69500, tax: 12510, total: 82010,
  },
  {
    id: "PO-002", supplierId: "SUP-002", supplierName: "Samsung Distributors SL",
    status: "Sent", createdAt: "2026-05-15", expectedDelivery: "2026-05-25", approvedBy: "Pradeep Silva",
    items: [
      { id: "i4", description: "Samsung Galaxy A55 128GB Black",   sku: "SAM-A55-128-BLK", quantity: 3, unitPrice: 65000, receivedQty: 0 },
      { id: "i5", description: "Samsung Galaxy A35 128GB White",   sku: "SAM-A35-128-WHT", quantity: 5, unitPrice: 52000, receivedQty: 0 },
    ],
    subtotal: 455000, tax: 81900, total: 536900,
  },
  {
    id: "PO-003", supplierId: "SUP-003", supplierName: "Accessory World Lanka",
    status: "Approved", createdAt: "2026-05-18", expectedDelivery: "2026-05-22",
    items: [
      { id: "i6", description: "Phone Cases Assorted (50pcs)",    sku: "CASE-ASST-50",  quantity: 2,  unitPrice: 4500,  receivedQty: 0 },
      { id: "i7", description: "Screen Protectors Tempered Glass", sku: "SCRP-TG-100",  quantity: 3,  unitPrice: 2800,  receivedQty: 0 },
      { id: "i8", description: "Fast Chargers 65W (10pcs)",        sku: "CHRG-65W-10",  quantity: 2,  unitPrice: 6500,  receivedQty: 0 },
    ],
    subtotal: 35600, tax: 6408, total: 42008,
  },
  {
    id: "PO-004", supplierId: "SUP-001", supplierName: "TechParts Lanka (Pvt) Ltd",
    status: "Draft", createdAt: "2026-05-21", expectedDelivery: "2026-05-28",
    items: [
      { id: "i9",  description: "iPhone 14 Screen OLED",   sku: "SCR-IP14-OLED", quantity: 3, unitPrice: 14500, receivedQty: 0 },
      { id: "i10", description: "Redmi Note 13 Battery",   sku: "BAT-RN13",      quantity: 8, unitPrice: 1600,  receivedQty: 0 },
    ],
    subtotal: 56300, tax: 10134, total: 66434,
  },
];

const SEED_DEVICES: DeviceRecord[] = [
  { id: "DEV-001", imei: "355678901234567", make: "Apple",   model: "iPhone 12 Pro",     color: "Pacific Blue",  storage: "128GB", ownerName: "Chaminda Wijesinghe", ownerPhone: "071-111-2222", status: "Repaired",   repairCount: 2, lastJobId: "JB-045", registeredAt: "2025-08-10" },
  { id: "DEV-002", imei: "490123456789012", make: "Samsung", model: "Galaxy A54 5G",     color: "Awesome Black", storage: "256GB", ownerName: "Nadeeka Rathnayake",  ownerPhone: "077-222-3333", status: "In Repair",  repairCount: 1, lastJobId: "JB-062", registeredAt: "2026-03-22" },
  { id: "DEV-003", imei: "864567890123456", make: "Xiaomi",  model: "Redmi Note 11",     color: "Graphite Gray", storage: "64GB",  ownerName: "Kasun Peiris",        ownerPhone: "072-333-4444", status: "Clean",      repairCount: 1, lastJobId: "JB-038", registeredAt: "2025-11-05" },
  { id: "DEV-004", imei: "359012345678901", make: "Apple",   model: "iPhone 14",         color: "Midnight",      storage: "256GB", ownerName: "Dilani Gunawardena",  ownerPhone: "074-444-5555", status: "In Repair",  repairCount: 1, lastJobId: "JB-071", registeredAt: "2026-05-10" },
  { id: "DEV-005", imei: "012345678901234", make: "Oppo",    model: "Reno 8 5G",         color: "Shimmer Gold",  storage: "128GB", ownerName: "Shantha Siriwardena", ownerPhone: "078-555-6666", status: "Clean",      repairCount: 0, registeredAt: "2026-04-18" },
  { id: "DEV-006", imei: "123456789012345", make: "Huawei",  model: "Nova 11i",          color: "Mint Green",    storage: "128GB", ownerName: "Ranjith Jayasena",    ownerPhone: "076-666-7777", status: "Blacklisted", repairCount: 0, notes: "Reported stolen — PD ref: 2026/CR/4521", registeredAt: "2026-05-01" },
];

const SEED_TEMPLATES: NotificationTemplate[] = [
  { id: "TPL-001", name: "Job Received",            channel: "SMS",      event: "job_received",   body: "Hi {customerName}, your {deviceModel} has been received at Mano Mobile. Job ID: {jobId}. We will update you once the diagnosis is complete. Call: 011-XXX-XXXX",                           variables: ["{customerName}", "{deviceModel}", "{jobId}"], isActive: true },
  { id: "TPL-002", name: "Ready for Collection",    channel: "SMS",      event: "job_ready",      body: "Good news, {customerName}! Your {deviceModel} repair is complete. Please collect from Mano Mobile during business hours. Job: {jobId}. Amount: Rs. {amount}",                           variables: ["{customerName}", "{deviceModel}", "{jobId}", "{amount}"], isActive: true },
  { id: "TPL-003", name: "Payment Reminder",        channel: "SMS",      event: "payment_due",    body: "Dear {customerName}, you have an outstanding balance of Rs. {balance} at Mano Mobile. Please settle at your earliest convenience. Call: 011-XXX-XXXX",                                  variables: ["{customerName}", "{balance}"], isActive: true },
  { id: "TPL-004", name: "Repair Update (WhatsApp)",channel: "WhatsApp", event: "job_update",     body: "Hi {customerName} 👋\n\nUpdate on your {deviceModel} (Job #{jobId}):\n\n*Status:* {status}\n*Technician:* {techName}\n*Notes:* {notes}\n\nMano Mobile 📱",                            variables: ["{customerName}", "{deviceModel}", "{jobId}", "{status}", "{techName}", "{notes}"], isActive: true },
  { id: "TPL-005", name: "Welcome New Customer",    channel: "SMS",      event: "new_customer",   body: "Welcome to Mano Mobile, {customerName}! Thank you for choosing us. We are committed to providing the best mobile repair service. Save our number for future repairs.",                   variables: ["{customerName}"], isActive: false },
  { id: "TPL-006", name: "Invoice Email",           channel: "Email",    event: "invoice_issued", subject: "Your Invoice from Mano Mobile — #{invoiceId}", body: "Dear {customerName},\n\nPlease find attached your invoice #{invoiceId} for Rs. {amount}.\n\nThank you for your business!\n\nMano Mobile Team", variables: ["{customerName}", "{invoiceId}", "{amount}"], isActive: true },
];

const SEED_NOTIF_LOG: NotificationLog[] = [
  { id: "NL-001", templateName: "Job Received",         channel: "SMS",      recipient: "+94711112222", message: "Hi Chaminda, your iPhone 12 Pro has been received at Mano Mobile. Job ID: JB-045...", status: "Delivered", sentAt: "2026-05-20 10:15", jobId: "JB-045" },
  { id: "NL-002", templateName: "Ready for Collection", channel: "SMS",      recipient: "+94772223333", message: "Good news, Nadeeka! Your Samsung Galaxy A54 repair is complete...",                    status: "Delivered", sentAt: "2026-05-21 14:30", jobId: "JB-062" },
  { id: "NL-003", templateName: "Payment Reminder",     channel: "SMS",      recipient: "+94774445555", message: "Dear Dilani, you have an outstanding balance of Rs. 8,500 at Mano Mobile...",          status: "Failed",    sentAt: "2026-05-21 09:00" },
  { id: "NL-004", templateName: "Repair Update (WhatsApp)", channel: "WhatsApp", recipient: "+94724446666",message: "Hi Shantha 👋\n\nUpdate on your Oppo Reno 8...",                                   status: "Delivered", sentAt: "2026-05-22 08:45", jobId: "JB-071" },
];

const SEED_SETTINGS: SystemSettings = {
  businessName:    "Mano Mobile",
  legalName:       "Mano Mobile (Pvt) Ltd",
  address:         "No. 55, Main Street, Colombo 10, Sri Lanka",
  phone:           "011-234-5678",
  email:           "info@manomobile.lk",
  website:         "www.manomobile.lk",
  vatNumber:       "VAT-20261234",
  vatRate:         18,
  currency:        "LKR",
  currencySymbol:  "Rs.",
  timezone:        "Asia/Colombo",
  receiptFooter:   "Thank you for choosing Mano Mobile! Warranty: 30 days on parts & labour.",
  warrantyDays:    30,
  fiscalYearStart: "January",
  lowStockThreshold: 5,
  requireDiscountAuth: true,
  autoBackup:      true,
};

const SEED_AUDIT: AuditEntry[] = [
  { id: "AU-001", user: "Ruwan Perera",   role: "Cashier",    action: "Created Invoice",     module: "Sales",    detail: "Invoice #INV-2026-0342 — Rs. 12,500",                    timestamp: "2026-05-22 09:45" },
  { id: "AU-002", user: "Pradeep Silva",  role: "Admin",      action: "Approved PO",          module: "Procurement", detail: "PO-003 approved — Accessory World Lanka — Rs. 42,008", timestamp: "2026-05-22 09:30" },
  { id: "AU-003", user: "Fathima Rizwan", role: "Accounts",   action: "Posted Journal Entry", module: "Accounts", detail: "JE-016 — Salary Payment May 2026 — Rs. 55,000",          timestamp: "2026-05-22 09:15" },
  { id: "AU-004", user: "Kamal Rajapaksa",role: "Technician", action: "Status Updated",       module: "Repairs",  detail: "Job JB-071 → Ready for Collection",                       timestamp: "2026-05-22 08:55" },
  { id: "AU-005", user: "Ruwan Perera",   role: "Cashier",    action: "Applied Discount",     module: "Sales",    detail: "10% discount on INV-2026-0341 — Auth: Pradeep",           timestamp: "2026-05-22 08:40" },
  { id: "AU-006", user: "Pradeep Silva",  role: "Admin",      action: "Added Staff",          module: "Admin",    detail: "New staff: Niluka Fernando (Cashier)",                    timestamp: "2026-05-21 17:00" },
  { id: "AU-007", user: "Nimal Bandara",  role: "Technician", action: "Part Requested",       module: "Parts",    detail: "Samsung A54 Battery — qty 1 — Job JB-069",               timestamp: "2026-05-21 16:30" },
  { id: "AU-008", user: "Fathima Rizwan", role: "Accounts",   action: "Recorded AR Payment",  module: "Accounts", detail: "Rs. 25,000 from Telecom Hub (Pvt) Ltd — INV-AR-003",     timestamp: "2026-05-21 15:45" },
];

// ─── Sequences ────────────────────────────────────────────────────────────────

let staffSeq    = SEED_STAFF.length;
let supSeq      = SEED_SUPPLIERS.length;
let poSeq       = SEED_POS.length;
let devSeq      = SEED_DEVICES.length;
let tplSeq      = SEED_TEMPLATES.length;
let logSeq      = SEED_NOTIF_LOG.length;
let auditSeq    = SEED_AUDIT.length;

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AdminProvider({ children }: { children: ReactNode }) {
  const [staff,           setStaff]          = useState<StaffMember[]>(SEED_STAFF);
  const [suppliers,       setSuppliers]      = useState<Supplier[]>(SEED_SUPPLIERS);
  const [purchaseOrders,  setPOs]            = useState<PurchaseOrder[]>(SEED_POS);
  const [devices,         setDevices]        = useState<DeviceRecord[]>(SEED_DEVICES);
  const [templates,       setTemplates]      = useState<NotificationTemplate[]>(SEED_TEMPLATES);
  const [notificationLog, setNotifLog]       = useState<NotificationLog[]>(SEED_NOTIF_LOG);
  const [settings,        setSettings]       = useState<SystemSettings>(SEED_SETTINGS);
  const [auditLog,        setAuditLog]       = useState<AuditEntry[]>(SEED_AUDIT);

  const addStaff    = (s: Omit<StaffMember, "id">)         => setStaff(p => [...p, { ...s, id: `ST-${String(++staffSeq).padStart(3,"0")}` }]);
  const updateStaff = (id: string, patch: Partial<StaffMember>) => setStaff(p => p.map(s => s.id === id ? { ...s, ...patch } : s));
  const removeStaff = (id: string)                         => setStaff(p => p.filter(s => s.id !== id));

  const addSupplier    = (s: Omit<Supplier, "id">) => setSuppliers(p => [...p, { ...s, id: `SUP-${String(++supSeq).padStart(3,"0")}` }]);
  const updateSupplier = (id: string, patch: Partial<Supplier>) => setSuppliers(p => p.map(s => s.id === id ? { ...s, ...patch } : s));

  const addPurchaseOrder = (po: Omit<PurchaseOrder, "id">) => setPOs(p => [...p, { ...po, id: `PO-${String(++poSeq).padStart(3,"0")}` }]);
  const updatePOStatus   = (id: string, status: POStatus)  => setPOs(p => p.map(po => po.id === id ? { ...po, status } : po));

  const addDevice    = (d: Omit<DeviceRecord, "id">) => setDevices(p => [...p, { ...d, id: `DEV-${String(++devSeq).padStart(3,"0")}` }]);
  const updateDevice = (id: string, patch: Partial<DeviceRecord>) => setDevices(p => p.map(d => d.id === id ? { ...d, ...patch } : d));

  const addTemplate    = (t: Omit<NotificationTemplate, "id">) => setTemplates(p => [...p, { ...t, id: `TPL-${String(++tplSeq).padStart(3,"0")}` }]);
  const toggleTemplate = (id: string) => setTemplates(p => p.map(t => t.id === id ? { ...t, isActive: !t.isActive } : t));
  const sendNotification = (log: Omit<NotificationLog, "id">) => setNotifLog(p => [{ ...log, id: `NL-${String(++logSeq).padStart(3,"0")}` }, ...p]);

  const updateSettings = (patch: Partial<SystemSettings>) => setSettings(p => ({ ...p, ...patch }));

  const logAction = (entry: Omit<AuditEntry, "id" | "timestamp">) =>
    setAuditLog(p => [{ ...entry, id: `AU-${String(++auditSeq).padStart(3,"0")}`, timestamp: new Date().toLocaleString("en-GB").replace(",", "") }, ...p]);

  return (
    <AdminContext.Provider value={{
      staff, addStaff, updateStaff, removeStaff,
      suppliers, addSupplier, updateSupplier,
      purchaseOrders, addPurchaseOrder, updatePOStatus,
      devices, addDevice, updateDevice,
      templates, notificationLog, addTemplate, toggleTemplate, sendNotification,
      settings, updateSettings,
      auditLog, logAction,
    }}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  return useContext(AdminContext);
}
