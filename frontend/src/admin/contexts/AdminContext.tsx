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

const SEED_STAFF: StaffMember[] = [];

const SEED_SUPPLIERS: Supplier[] = [];

const SEED_POS: PurchaseOrder[] = [];

const SEED_DEVICES: DeviceRecord[] = [];

/**
 * SMS templates are no longer defined here: they live in the `sms_templates`
 * table so an Admin can edit the wording, and the Notifications screen reads
 * them through useSmsTemplates(). Keeping a second copy in this context would
 * drift from what actually gets sent.
 */
const SEED_TEMPLATES: NotificationTemplate[] = [];

const SEED_NOTIF_LOG: NotificationLog[] = [];

/**
 * Business identity starts blank and is filled in under Admin Control →
 * Settings. The invented address, phone and VAT number that used to sit here
 * printed straight onto customer invoices, which is the one place a plausible
 * fake is genuinely dangerous. Only regional/format defaults are kept.
 */
const SEED_SETTINGS: SystemSettings = {
  businessName:    "",
  legalName:       "",
  address:         "",
  phone:           "",
  email:           "",
  website:         "",
  vatNumber:       "",
  vatRate:         0,
  currency:        "LKR",
  currencySymbol:  "Rs.",
  timezone:        "Asia/Colombo",
  receiptFooter:   "",
  warrantyDays:    0,
  fiscalYearStart: "January",
  lowStockThreshold: 0,
  requireDiscountAuth: true,
  autoBackup:      true,
};

const SEED_AUDIT: AuditEntry[] = [];

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
