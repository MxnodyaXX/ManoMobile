"use client";

import { createContext, useContext, useState, ReactNode } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type JobStatus = "Non-Issued" | "Issued" | "Pending" | "Completed" | "Delivered" | "Cancelled";

export interface RepairJob {
  id: string;
  customerName: string;
  phone: string;
  brand: string;
  model: string;
  issue: string;
  technician: string;
  status: JobStatus;
  priority: "Low" | "Normal" | "High" | "Urgent";
  estimatedCost: number;
  advancePaid: number;
  createdAt: string;
  estimatedCompletion: string;
  imei?: string;
  jobWarranty?: string;
  dealer?: string;
  cancelReason?: string;
  receivedItems?: string[];
}

// ─── Seed Data ────────────────────────────────────────────────────────────────

export const INITIAL_JOBS: RepairJob[] = [
  { id: "RM-001", customerName: "Kasun Perera",       phone: "+94 77 123 4567", brand: "Apple",   model: "iPhone 14 Pro",  issue: "Screen Damage",  technician: "Kamal",  status: "Non-Issued", priority: "High",   estimatedCost: 25000, advancePaid: 5000,  createdAt: "2025-04-20", estimatedCompletion: "2025-04-22", imei: "351988100241349", dealer: "MANO MOBILE", receivedItems: ["SIM Card", "Charger"] },
  { id: "RM-002", customerName: "Nimali Silva",        phone: "+94 71 234 5678", brand: "Samsung", model: "Galaxy S23",      issue: "Battery",        technician: "Nimal",  status: "Issued",     priority: "Normal", estimatedCost: 8000,  advancePaid: 2000,  createdAt: "2025-04-21", estimatedCompletion: "2025-04-23", imei: "354668771114184", dealer: "MANO MOBILE", receivedItems: ["Back Cover"] },
  { id: "RM-003", customerName: "Roshan Fernando",     phone: "+94 76 345 6789", brand: "Xiaomi",  model: "Redmi Note 12",  issue: "Charging Port",  technician: "Suresh", status: "Pending",    priority: "Urgent", estimatedCost: 4500,  advancePaid: 1000,  createdAt: "2025-04-19", estimatedCompletion: "2025-04-21", imei: "354682282577565", dealer: "MANO MOBILE" },
  { id: "RM-004", customerName: "Dilini Rajapaksa",    phone: "+94 70 456 7890", brand: "Apple",   model: "iPhone 13",      issue: "Camera",         technician: "Kamal",  status: "Completed",  priority: "Normal", estimatedCost: 15000, advancePaid: 15000, createdAt: "2025-04-18", estimatedCompletion: "2025-04-20", imei: "356822002345678", jobWarranty: "3 MONTHS WARRANTY [NORMAL]", dealer: "MANO MOBILE" },
  { id: "RM-005", customerName: "Pradeep Jayawardena", phone: "+94 75 567 8901", brand: "Oppo",    model: "Reno 8",         issue: "Speaker / Mic",  technician: "Nimal",  status: "Non-Issued", priority: "Low",    estimatedCost: 3000,  advancePaid: 0,     createdAt: "2025-04-22", estimatedCompletion: "2025-04-25", dealer: "MANO MOBILE" },
  { id: "RM-006", customerName: "Samantha Bandara",    phone: "+94 78 678 9012", brand: "Samsung", model: "Galaxy A54",     issue: "Water Damage",   technician: "Suresh", status: "Issued",     priority: "High",   estimatedCost: 12000, advancePaid: 3000,  createdAt: "2025-04-21", estimatedCompletion: "2025-04-24", imei: "864562049583598", dealer: "MANO MOBILE" },
  { id: "RM-007", customerName: "Chamara Wijesinghe",  phone: "+94 72 789 0123", brand: "Huawei",  model: "P30 Pro",        issue: "Software",       technician: "Kamal",  status: "Pending",    priority: "Normal", estimatedCost: 5000,  advancePaid: 2000,  createdAt: "2025-04-20", estimatedCompletion: "2025-04-22", dealer: "MANO MOBILE" },
  { id: "RM-008", customerName: "Isuru Madushanka",    phone: "+94 74 890 1234", brand: "OnePlus", model: "Nord 3",         issue: "Back Glass",     technician: "Nimal",  status: "Delivered",  priority: "Low",    estimatedCost: 6000,  advancePaid: 6000,  createdAt: "2025-04-17", estimatedCompletion: "2025-04-19", imei: "860123456789012", jobWarranty: "1 MONTH WARRANTY [NORMAL]", dealer: "MANO MOBILE" },
  { id: "RM-009", customerName: "Malini Dissanayake",  phone: "+94 76 901 2345", brand: "Apple",   model: "iPhone 12",      issue: "Battery Drain",  technician: "Suresh", status: "Cancelled",  priority: "Normal", estimatedCost: 9500,  advancePaid: 0,     createdAt: "2025-04-16", estimatedCompletion: "2025-04-18", dealer: "MANO MOBILE", cancelReason: "Customer cancelled — no budget" },
];

// ─── Context ──────────────────────────────────────────────────────────────────

interface RepairContextValue {
  jobs: RepairJob[];
  addJob: (partial: Omit<RepairJob, "id">) => void;
  updateJob: (id: string, changes: Partial<RepairJob>) => void;
}

const RepairContext = createContext<RepairContextValue>({
  jobs: INITIAL_JOBS,
  addJob: () => {},
  updateJob: () => {},
});

function nextJobId(jobs: RepairJob[]): string {
  const nums = jobs
    .map(j => parseInt(j.id.replace("RM-", ""), 10))
    .filter(n => !isNaN(n));
  const max = nums.length ? Math.max(...nums) : 0;
  return `RM-${String(max + 1).padStart(3, "0")}`;
}

export function RepairProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<RepairJob[]>(INITIAL_JOBS);

  const addJob = (partial: Omit<RepairJob, "id">) => {
    setJobs(prev => {
      const id = nextJobId(prev);
      return [{ id, ...partial }, ...prev];
    });
  };

  const updateJob = (id: string, changes: Partial<RepairJob>) => {
    setJobs(prev => prev.map(j => (j.id === id ? { ...j, ...changes } : j)));
  };

  return (
    <RepairContext.Provider value={{ jobs, addJob, updateJob }}>
      {children}
    </RepairContext.Provider>
  );
}

export function useRepair() {
  return useContext(RepairContext);
}
