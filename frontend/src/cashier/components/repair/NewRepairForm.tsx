"use client";

import { useState, useRef } from "react";
import { useIsMobile } from "@/cashier/hooks/useIsMobile";
import { useRepair, IN_HOUSE_DEALER, type ConditionGrade, type DeviceConditionMap, type RepairJob, type RepairDealer } from "@/cashier/contexts/RepairContext";
import { useWarranty, effectiveStatus } from "@/cashier/contexts/WarrantyContext";
import { usePersistentState } from "@/cashier/hooks/usePersistentState";
import SignaturePad from "@/cashier/components/shared/SignaturePad";
import Combobox from "@/cashier/components/shared/Combobox";
import { lookupModelNumber } from "@/cashier/data/modelNumbers";
import { ShieldCheck, Camera, Lock, X as XIcon, Hash, Printer, CheckCircle2 } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FormData {
  // Step 1
  dealerId: string;
  customerName: string;
  customerNIC: string;
  customerContact: string;
  customerEmail: string;

  // Step 2
  deviceModel: string;
  deviceModelNumber: string;
  deviceIMEI: string;
  receivedItems: string[];
  faultCheckboxes: string[];
  faultDescription: string;

  // Step 3
  estimatedCost: string;
  advancePaid: string;
  paymentMethod: string;
  jobPriority: string;
  jobNotes: string;

  // Step 4
  assignedRepairman: string;
  estimatedCompletion: string;

  // Step 5 — Evidence & Sign
  condition: DeviceConditionMap;
  intakePhotos: string[];
  passcodeType: "PIN" | "Pattern" | "Password" | "None" | "Provided Separately";
  passcode: string;
  signature: string;
  termsAccepted: boolean;
}

const CONDITION_ZONES: { key: keyof Omit<DeviceConditionMap, "notes">; label: string }[] = [
  { key: "front",   label: "Front / Screen" },
  { key: "back",    label: "Back" },
  { key: "frame",   label: "Frame / Sides" },
  { key: "camera",  label: "Camera Glass" },
  { key: "ports",   label: "Ports" },
  { key: "buttons", label: "Buttons" },
];

const GRADES: { value: ConditionGrade; color: string }[] = [
  { value: "Pristine", color: "#4ade80" },
  { value: "Good",     color: "#60a5fa" },
  { value: "Worn",     color: "#fbbf24" },
  { value: "Damaged",  color: "#f87171" },
];

const TERMS_VERSION = "v1.0";

// ─── Sample Data ──────────────────────────────────────────────────────────────

const REPAIRMEN = [
  { id: 1, name: "Kasun Perera", speciality: "Screen & Battery", available: true, activeJobs: 2 },
  { id: 2, name: "Dilshan Fernando", speciality: "Motherboard & IC", available: true, activeJobs: 1 },
  { id: 3, name: "Nuwan Silva", speciality: "Software & Flashing", available: false, activeJobs: 4 },
  { id: 4, name: "Asitha Jayawardena", speciality: "Water Damage", available: true, activeJobs: 0 },
];

const RECEIVED_ITEMS = ["SIM Card", "Back Cover", "Charger", "Data Cable", "Earphones", "Memory Card", "SIM Tray", "Battery", "Box", "Other Accessories"];

const COMMON_FAULTS = [
  "Screen Cracked / Broken",
  "Screen Not Displaying",
  "Touch Not Working",
  "Battery Draining Fast",
  "Won't Turn On / Dead",
  "Charging Port Faulty",
  "Speaker / Mic Issue",
  "Camera Not Working",
  "Software / Bootloop",
  "Water Damage",
  "Overheating",
  "Signal / Network Issue",
];

const DEVICE_MODELS = [
  "iPhone 16 Pro Max", "iPhone 16 Pro", "iPhone 16", "iPhone 15 Pro Max", "iPhone 15",
  "Samsung Galaxy S25 Ultra", "Samsung Galaxy S25", "Samsung Galaxy A55", "Samsung Galaxy A35",
  "Xiaomi 14 Pro", "Xiaomi 14", "Redmi Note 13 Pro", "Redmi 13C",
  "OPPO Reno 12 Pro", "OPPO A60", "OnePlus 12", "Realme GT 6",
  "Huawei Nova 12", "Vivo Y200 Pro",
];

// ─── Step Indicator ───────────────────────────────────────────────────────────

const STEPS = [
  { num: 1, label: "Dealer & Customer" },
  { num: 2, label: "Device & Faults" },
  { num: 3, label: "Costs & Job Info" },
  { num: 4, label: "Assign Repairman" },
  { num: 5, label: "Evidence & Sign" },
];

function StepIndicator({ current }: { current: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 18 }}>
      {STEPS.map((step, idx) => {
        const isDone = current > step.num;
        const isActive = current === step.num;
        return (
          <div key={step.num} style={{ display: "flex", alignItems: "center", flex: idx < STEPS.length - 1 ? 1 : "unset" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <div
                style={{
                  width: 20, height: 20, borderRadius: "50%",
                  background: isDone ? "var(--accent)" : isActive ? "var(--accent)" : "var(--bg-card)",
                  border: `2px solid ${isDone || isActive ? "var(--accent)" : "var(--border)"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: isDone || isActive ? "var(--accent-fg)" : "var(--text-secondary)",
                  fontWeight: 700, fontSize: 14, fontFamily: "'Plus Jakarta Sans', sans-serif",
                  transition: "all 0.2s",
                  flexShrink: 0,
                }}
              >
                {isDone ? "✓" : step.num}
              </div>
              <span style={{
                fontSize: 11, fontFamily: "'Plus Jakarta Sans', sans-serif",
                color: isActive ? "var(--accent)" : isDone ? "var(--text-primary)" : "var(--text-secondary)",
                fontWeight: isActive ? 600 : 400, whiteSpace: "nowrap",
              }}>
                {step.label}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div style={{
                flex: 1, height: 2, margin: "0 8px", marginBottom: 22,
                background: isDone ? "var(--accent)" : "var(--border)",
                transition: "background 0.3s",
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Shared Styles ────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "9px 12px", borderRadius: 8,
  border: "1px solid var(--border)", background: "var(--bg-card)",
  color: "var(--text-primary)", fontSize: 13.5,
  fontFamily: "'Plus Jakarta Sans', sans-serif", outline: "none",
  transition: "border-color 0.15s", boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 700, fontFamily: "'Plus Jakarta Sans', sans-serif",
  color: "var(--text-secondary)", marginBottom: 5, display: "block",
  letterSpacing: "0.06em", textTransform: "uppercase",
};

const sectionHeaderStyle: React.CSSProperties = {
  fontSize: 13, fontWeight: 700, fontFamily: "'Plus Jakarta Sans', sans-serif",
  color: "var(--accent)", marginBottom: 14, paddingBottom: 8,
  borderBottom: "1px solid var(--border)", letterSpacing: "0.02em",
};

const panelStyle: React.CSSProperties = {
  background: "var(--bg-card)", border: "1px solid var(--border)",
  borderRadius: 12, padding: "20px 22px", flex: 1,
};

const checkboxItemStyle = (checked: boolean): React.CSSProperties => ({
  display: "flex", alignItems: "center", gap: 8, padding: "7px 10px",
  borderRadius: 7, border: `1px solid ${checked ? "var(--accent)" : "var(--border)"}`,
  background: checked ? "rgba(var(--accent-rgb, 232,232,232), 0.08)" : "transparent",
  cursor: "pointer", transition: "all 0.15s", userSelect: "none",
});

// ─── Step 1: Dealer & Customer ────────────────────────────────────────────────

/** "2021-07-05" → "05 Jul 2021". */
function fmtJoined(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function Step1({ data, onChange, isMobile, dealers }: { data: FormData; onChange: (d: Partial<FormData>) => void; isMobile?: boolean; dealers: RepairDealer[] }) {
  const dealer = dealers.find((d) => d.id.toString() === data.dealerId);

  return (
    <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 20, alignItems: isMobile ? "stretch" : "flex-start" }}>
      {/* Left: Dealer */}
      <div style={panelStyle}>
        <div style={sectionHeaderStyle}>🏪 Dealer Information</div>
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Select Dealer</label>
          <Combobox
            value={dealer?.name ?? ""}
            options={dealers.map((d) => d.name)}
            allowAdd={false}
            placeholder={dealers.length ? "— Choose a dealer —" : "No dealers — add them in Admin Control"}
            onChange={(name) => {
              const match = dealers.find((d) => d.name === name);
              onChange({ dealerId: match ? String(match.id) : "" });
            }}
          />
          {dealers.length === 0 && (
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 5 }}>
              Add repair dealers under Admin Control → Repair Dealers.
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, opacity: dealer ? 1 : 0.4, transition: "opacity 0.2s" }}>
          <div>
            <label style={labelStyle}>Address</label>
            <input readOnly style={{ ...inputStyle, background: "var(--bg-primary)" }} value={dealer?.address ?? ""} placeholder="Select dealer above" />
          </div>
          <div>
            <label style={labelStyle}>Contact Number</label>
            <input readOnly style={{ ...inputStyle, background: "var(--bg-primary)" }} value={dealer?.contact ?? ""} placeholder="—" />
          </div>
          <div>
            <label style={labelStyle}>Joining Date</label>
            <input readOnly style={{ ...inputStyle, background: "var(--bg-primary)" }} value={dealer ? fmtJoined(dealer.joinedAt) : ""} placeholder="—" />
          </div>
          <div>
            <label style={labelStyle}>Remarks</label>
            <textarea
              readOnly
              style={{ ...inputStyle, background: "var(--bg-primary)", resize: "none", minHeight: 64 }}
              value={dealer?.remarks ?? ""}
            />
          </div>
        </div>
      </div>

      {/* Right: Customer */}
      <div style={panelStyle}>
        <div style={sectionHeaderStyle}>👤 Customer Information</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={labelStyle}>Full Name *</label>
            <input
              style={inputStyle}
              placeholder="e.g. Kasun Perera"
              value={data.customerName}
              onChange={(e) => onChange({ customerName: e.target.value })}
            />
          </div>
          <div>
            <label style={labelStyle}>NIC Number</label>
            <input
              style={inputStyle}
              placeholder="e.g. 199912345678"
              value={data.customerNIC}
              onChange={(e) => onChange({ customerNIC: e.target.value })}
            />
          </div>
          <div>
            <label style={labelStyle}>Contact Number *</label>
            <input
              style={inputStyle}
              placeholder="e.g. 077 123 4567"
              value={data.customerContact}
              onChange={(e) => onChange({ customerContact: e.target.value })}
            />
          </div>
          <div>
            <label style={labelStyle}>Email Address</label>
            <input
              style={inputStyle}
              placeholder="e.g. customer@email.com"
              type="email"
              value={data.customerEmail}
              onChange={(e) => onChange({ customerEmail: e.target.value })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Step 2: Device & Faults ──────────────────────────────────────────────────

function Step2({ data, onChange, isMobile, models, onAddModel }: { data: FormData; onChange: (d: Partial<FormData>) => void; isMobile?: boolean; models: string[]; onAddModel: (m: string) => void }) {
  const toggleItem = (list: string[], item: string) =>
    list.includes(item) ? list.filter((i) => i !== item) : [...list, item];

  // When a model number is entered, try to resolve the device model.
  const [lookupResult, setLookupResult] = useState<string | null>(null);
  const handleModelNumber = (raw: string) => {
    onChange({ deviceModelNumber: raw });
    const hit = lookupModelNumber(raw);
    if (hit) {
      onChange({ deviceModelNumber: raw, deviceModel: hit.model });
      // make sure the resolved model is in the combobox list
      if (!models.includes(hit.model)) onAddModel(hit.model);
      setLookupResult(`${hit.brand} ${hit.model}`);
    } else {
      setLookupResult(raw.trim() ? "no-match" : null);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 20, alignItems: isMobile ? "stretch" : "flex-start" }}>
      {/* Left: Device Info & Received Items */}
      <div style={panelStyle}>
        <div style={sectionHeaderStyle}>📱 Device Information</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
          <div>
            <label style={labelStyle}><Hash size={11} style={{ verticalAlign: "-1px" }} /> Model Number</label>
            <input
              style={inputStyle}
              placeholder="e.g. M2006C3LMG — auto-fills the model"
              value={data.deviceModelNumber}
              onChange={(e) => handleModelNumber(e.target.value)}
            />
            {lookupResult && lookupResult !== "no-match" && (
              <p style={{ fontSize: 11, color: "#4ade80", fontFamily: "'Plus Jakarta Sans', sans-serif", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                <CheckCircle2 size={12} /> Identified: <strong>{lookupResult}</strong>
              </p>
            )}
            {lookupResult === "no-match" && (
              <p style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif", marginTop: 4 }}>
                Not in the local database — select or type the model below.
              </p>
            )}
          </div>
          <div>
            <label style={labelStyle}>Device Model *</label>
            <Combobox
              value={data.deviceModel}
              options={models}
              onAddOption={onAddModel}
              placeholder="Type or select a model…"
              onChange={(m) => onChange({ deviceModel: m })}
            />
          </div>
          <div>
            <label style={labelStyle}>IMEI Number</label>
            <input
              style={inputStyle}
              placeholder="15-digit IMEI"
              maxLength={15}
              value={data.deviceIMEI}
              onChange={(e) => onChange({ deviceIMEI: e.target.value.replace(/\D/g, "") })}
            />
          </div>
        </div>

        <div style={sectionHeaderStyle}>📦 Items Received With Device</div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 6 }}>
          {RECEIVED_ITEMS.map((item) => {
            const checked = data.receivedItems.includes(item);
            return (
              <div
                key={item}
                style={checkboxItemStyle(checked)}
                onClick={() => onChange({ receivedItems: toggleItem(data.receivedItems, item) })}
              >
                <div style={{
                  width: 16, height: 16, borderRadius: 4, border: `2px solid ${checked ? "var(--accent)" : "var(--border)"}`,
                  background: checked ? "var(--accent)" : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0, transition: "all 0.15s",
                }}>
                  {checked && <span style={{ color: "var(--accent-fg)", fontSize: 10, fontWeight: 700 }}>✓</span>}
                </div>
                <span style={{ fontSize: 12, fontFamily: "'Plus Jakarta Sans', sans-serif", color: "var(--text-primary)" }}>{item}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right: Faults */}
      <div style={panelStyle}>
        <div style={sectionHeaderStyle}>🔧 Device Faults</div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 6, marginBottom: 18 }}>
          {COMMON_FAULTS.map((fault) => {
            const checked = data.faultCheckboxes.includes(fault);
            return (
              <div
                key={fault}
                style={checkboxItemStyle(checked)}
                onClick={() => onChange({ faultCheckboxes: toggleItem(data.faultCheckboxes, fault) })}
              >
                <div style={{
                  width: 16, height: 16, borderRadius: 4, border: `2px solid ${checked ? "#ff6b6b" : "var(--border)"}`,
                  background: checked ? "#ff6b6b" : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0, transition: "all 0.15s",
                }}>
                  {checked && <span style={{ color: "#fff", fontSize: 10, fontWeight: 700 }}>✓</span>}
                </div>
                <span style={{ fontSize: 12, fontFamily: "'Plus Jakarta Sans', sans-serif", color: "var(--text-primary)" }}>{fault}</span>
              </div>
            );
          })}
        </div>

        <div>
          <label style={labelStyle}>Additional Fault Description</label>
          <textarea
            style={{ ...inputStyle, resize: "vertical", minHeight: 90 }}
            placeholder="Describe any additional issues or customer-reported symptoms in detail..."
            value={data.faultDescription}
            onChange={(e) => onChange({ faultDescription: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Step 3: Costs & Job Info ─────────────────────────────────────────────────

function Step3({ data, onChange, isMobile }: { data: FormData; onChange: (d: Partial<FormData>) => void; isMobile?: boolean }) {
  const estimated = parseFloat(data.estimatedCost) || 0;
  const advance = parseFloat(data.advancePaid) || 0;
  const balance = estimated - advance;

  return (
    <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 20, alignItems: isMobile ? "stretch" : "flex-start" }}>
      {/* Left: Financials */}
      <div style={panelStyle}>
        <div style={sectionHeaderStyle}>💰 Cost & Payment</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={labelStyle}>Estimated Repair Cost (LKR)</label>
            <input
              style={inputStyle}
              type="number"
              min={0}
              placeholder="0.00"
              value={data.estimatedCost}
              onChange={(e) => onChange({ estimatedCost: e.target.value })}
            />
          </div>
          <div>
            <label style={labelStyle}>Advance Received (LKR)</label>
            <input
              style={inputStyle}
              type="number"
              min={0}
              placeholder="0.00"
              value={data.advancePaid}
              onChange={(e) => onChange({ advancePaid: e.target.value })}
            />
          </div>
          <div>
            <label style={labelStyle}>Payment Method</label>
            <Combobox
              value={data.paymentMethod}
              options={["Cash", "Card", "Bank Transfer", "Online Payment"]}
              allowAdd={false}
              placeholder="— Select Method —"
              onChange={(m) => onChange({ paymentMethod: m })}
            />
          </div>

          {/* Balance Summary Card */}
          <div style={{
            marginTop: 8, padding: "16px 18px", borderRadius: 10,
            background: "var(--bg-primary)", border: "1px solid var(--border)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Estimated Cost</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                LKR {estimated.toLocaleString("en-LK", { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Advance Paid</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#4ade80", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                − LKR {advance.toLocaleString("en-LK", { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10, display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Balance Due</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: balance > 0 ? "var(--accent)" : "#4ade80", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                LKR {balance.toLocaleString("en-LK", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Right: Job Info */}
      <div style={panelStyle}>
        <div style={sectionHeaderStyle}>📋 Job Details</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={labelStyle}>Job Priority</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {["Normal", "Urgent", "Express", "VIP"].map((p) => {
                const colors: Record<string, string> = { Normal: "var(--accent)", Urgent: "#f59e0b", Express: "#f97316", VIP: "#a855f7" };
                const isActive = data.jobPriority === p;
                return (
                  <button
                    key={p}
                    onClick={() => onChange({ jobPriority: p })}
                    style={{
                      padding: "7px 18px", borderRadius: 7, border: `1px solid ${isActive ? colors[p] : "var(--border)"}`,
                      background: isActive ? colors[p] : "transparent",
                      color: isActive ? "var(--accent-fg)" : "var(--text-secondary)",
                      fontWeight: isActive ? 700 : 400, fontSize: 12, cursor: "pointer",
                      fontFamily: "'Plus Jakarta Sans', sans-serif", transition: "all 0.15s",
                    }}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label style={labelStyle}>Job / Internal Notes</label>
            <textarea
              style={{ ...inputStyle, resize: "vertical", minHeight: 120 }}
              placeholder="Add any internal notes about this job, special handling instructions, customer preferences, etc."
              value={data.jobNotes}
              onChange={(e) => onChange({ jobNotes: e.target.value })}
            />
          </div>

          <div style={{
            padding: "12px 14px", borderRadius: 8,
            background: "rgba(var(--accent-rgb, 232,232,232), 0.06)",
            border: "1px dashed var(--accent)",
          }}>
            <p style={{ margin: 0, fontSize: 12, fontFamily: "'Plus Jakarta Sans', sans-serif", color: "var(--text-secondary)", lineHeight: 1.6 }}>
              💡 A job card will be auto-generated with a unique reference number upon submission. The customer will be notified via SMS if a contact number is provided.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Step 4: Assign Repairman ─────────────────────────────────────────────────

function Step4({ data, onChange, isMobile }: { data: FormData; onChange: (d: Partial<FormData>) => void; isMobile?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 20, alignItems: isMobile ? "stretch" : "flex-start" }}>
      <div style={{ ...panelStyle, flex: 1.3 }}>
        <div style={sectionHeaderStyle}>🛠️ Available Repairmen</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {REPAIRMEN.map((r) => {
            const isSelected = data.assignedRepairman === r.id.toString();
            const canSelect = r.available;
            return (
              <div
                key={r.id}
                onClick={() => canSelect && onChange({ assignedRepairman: r.id.toString() })}
                style={{
                  display: "flex", alignItems: "center", gap: 14, padding: "14px 16px",
                  borderRadius: 10, border: `1px solid ${isSelected ? "var(--accent)" : "var(--border)"}`,
                  background: isSelected ? "rgba(var(--accent-rgb, 232,232,232), 0.06)" : "var(--bg)",
                  cursor: canSelect ? "pointer" : "not-allowed",
                  opacity: canSelect ? 1 : 0.5, transition: "all 0.15s",
                }}
              >
                <div style={{
                  width: 44, height: 44, borderRadius: "50%",
                  background: isSelected ? "var(--accent)" : "var(--border)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 18, fontWeight: 700, flexShrink: 0,
                  color: isSelected ? "var(--accent-fg)" : "var(--text-secondary)",
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                }}>
                  {r.name.charAt(0)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, fontFamily: "'Plus Jakarta Sans', sans-serif", color: "var(--text-primary)", marginBottom: 3 }}>
                    {r.name}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                    {r.speciality} · {r.activeJobs} active job{r.activeJobs !== 1 ? "s" : ""}
                  </div>
                </div>
                <div style={{
                  padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                  background: r.available ? "rgba(74, 222, 128, 0.12)" : "rgba(239, 68, 68, 0.12)",
                  color: r.available ? "#4ade80" : "#ef4444",
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                }}>
                  {r.available ? "Available" : "Busy"}
                </div>
                {isSelected && (
                  <div style={{
                    width: 22, height: 22, borderRadius: "50%", background: "var(--accent)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 12, color: "var(--accent-fg)", fontWeight: 700,
                  }}>✓</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ ...panelStyle, flex: 1 }}>
        <div style={sectionHeaderStyle}>📅 Schedule & Completion</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={labelStyle}>Estimated Completion Date</label>
            <input
              type="date"
              style={inputStyle}
              value={data.estimatedCompletion}
              onChange={(e) => onChange({ estimatedCompletion: e.target.value })}
            />
          </div>

          {data.assignedRepairman && (
            <div style={{
              padding: "14px 16px", borderRadius: 10,
              background: "rgba(var(--accent-rgb, 232,232,232), 0.06)",
              border: "1px solid var(--accent)",
            }}>
              {(() => {
                const r = REPAIRMEN.find((rm) => rm.id.toString() === data.assignedRepairman);
                return r ? (
                  <>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: "'Plus Jakarta Sans', sans-serif", marginBottom: 6 }}>
                      Assigned to
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, fontFamily: "'Plus Jakarta Sans', sans-serif", color: "var(--text-primary)", marginBottom: 4 }}>
                      {r.name}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                      {r.speciality}
                    </div>
                  </>
                ) : null;
              })()}
            </div>
          )}

          <div style={{
            marginTop: "auto", padding: "14px 16px", borderRadius: 10,
            background: "var(--bg-primary)", border: "1px solid var(--border)",
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, fontFamily: "'Plus Jakarta Sans', sans-serif", color: "var(--text-secondary)", marginBottom: 10 }}>
              REPAIR SUMMARY
            </div>
            {[
              ["Repairman", REPAIRMEN.find((r) => r.id.toString() === data.assignedRepairman)?.name ?? "Not assigned"],
              ["Completion", data.estimatedCompletion || "Not set"],
            ].map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
                <span style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{k}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Step 5: Evidence & Sign ──────────────────────────────────────────────────

function Step5({ data, onChange, isMobile }: { data: FormData; onChange: (d: Partial<FormData>) => void; isMobile?: boolean }) {
  const fileRef = useRef<HTMLInputElement>(null);

  const setCond = (key: keyof Omit<DeviceConditionMap, "notes">, grade: ConditionGrade) =>
    onChange({ condition: { ...data.condition, [key]: grade } });

  const onFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).slice(0, 6).forEach(file => {
      const reader = new FileReader();
      reader.onload = () => onChange({ intakePhotos: [...data.intakePhotos, reader.result as string] });
      reader.readAsDataURL(file);
    });
  };

  const removePhoto = (i: number) =>
    onChange({ intakePhotos: data.intakePhotos.filter((_, idx) => idx !== i) });

  return (
    <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 20, alignItems: isMobile ? "stretch" : "flex-start" }}>
      {/* Left: Condition + Passcode */}
      <div style={panelStyle}>
        <div style={sectionHeaderStyle}>🩹 Device Cosmetic Condition</div>
        <p style={{ fontSize: 11.5, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif", marginBottom: 12, lineHeight: 1.5 }}>
          Record the device&apos;s condition <strong>at drop-off</strong> — this protects both the
          customer and the shop in any dispute.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 9, marginBottom: 16 }}>
          {CONDITION_ZONES.map(zone => (
            <div key={zone.key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: "'Plus Jakarta Sans', sans-serif", width: isMobile ? 90 : 110, flexShrink: 0 }}>{zone.label}</span>
              <div style={{ display: "flex", gap: 4, flex: 1 }}>
                {GRADES.map(g => {
                  const active = data.condition[zone.key] === g.value;
                  return (
                    <button key={g.value} type="button" onClick={() => setCond(zone.key, g.value)}
                      style={{
                        flex: 1, padding: "5px 4px", borderRadius: 6, fontSize: 10.5, fontWeight: 600,
                        border: `1px solid ${active ? g.color : "var(--border)"}`,
                        background: active ? `${g.color}1e` : "transparent",
                        color: active ? g.color : "var(--text-muted)",
                        cursor: "pointer", transition: "all 0.12s", fontFamily: "'Plus Jakarta Sans', sans-serif",
                      }}>
                      {g.value}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Condition Notes</label>
          <textarea
            style={{ ...inputStyle, resize: "vertical", minHeight: 56 }}
            placeholder="e.g. deep scratch top-left corner, small dent on right frame…"
            value={data.condition.notes ?? ""}
            onChange={e => onChange({ condition: { ...data.condition, notes: e.target.value } })}
          />
        </div>

        <div style={sectionHeaderStyle}><Lock size={12} style={{ verticalAlign: "-1px" }} /> Device Unlock</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div>
            <label style={labelStyle}>Passcode Type</label>
            <select
              style={{ ...inputStyle, appearance: "none", cursor: "pointer" }}
              value={data.passcodeType}
              onChange={e => onChange({ passcodeType: e.target.value as FormData["passcodeType"] })}
            >
              {["None", "PIN", "Pattern", "Password", "Provided Separately"].map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          {(data.passcodeType === "PIN" || data.passcodeType === "Pattern" || data.passcodeType === "Password") && (
            <div>
              <label style={labelStyle}>{data.passcodeType} (visible only to technician)</label>
              <input
                style={inputStyle}
                placeholder={data.passcodeType === "Pattern" ? "e.g. 1-2-3-6-9" : "Enter unlock code"}
                value={data.passcode}
                onChange={e => onChange({ passcode: e.target.value })}
              />
            </div>
          )}
        </div>
      </div>

      {/* Right: Photos + Terms + Signature */}
      <div style={panelStyle}>
        <div style={sectionHeaderStyle}><Camera size={12} style={{ verticalAlign: "-1px" }} /> Intake Photos *</div>
        <input ref={fileRef} type="file" accept="image/*" multiple capture="environment" style={{ display: "none" }} onChange={e => onFiles(e.target.files)} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))", gap: 8, marginBottom: 8 }}>
          {data.intakePhotos.map((src, i) => (
            <div key={i} style={{ position: "relative", aspectRatio: "1", borderRadius: 8, overflow: "hidden", border: "1px solid var(--border)" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`intake ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              <button type="button" onClick={() => removePhoto(i)} style={{ position: "absolute", top: 3, right: 3, width: 18, height: 18, borderRadius: "50%", background: "rgba(0,0,0,0.6)", border: "none", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <XIcon size={11} />
              </button>
            </div>
          ))}
          <button type="button" onClick={() => fileRef.current?.click()}
            style={{ aspectRatio: "1", borderRadius: 8, border: "1px dashed var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, fontSize: 10.5, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            <Camera size={18} /> Add
          </button>
        </div>
        <p style={{ fontSize: 10.5, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif", marginBottom: 16 }}>
          Recommended: front, back, and both sides. At least one is required.
        </p>

        {/* Terms */}
        <div style={{ padding: "12px 14px", borderRadius: 10, background: "var(--bg-primary)", border: "1px solid var(--border)", marginBottom: 14 }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: "'Plus Jakarta Sans', sans-serif", marginBottom: 8 }}>Terms &amp; Conditions ({TERMS_VERSION})</p>
          <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11, color: "var(--text-secondary)", fontFamily: "'Plus Jakarta Sans', sans-serif", lineHeight: 1.6 }}>
            <li>Repair warranty covers only the parts/labour listed on completion.</li>
            <li>The shop is not liable for data loss; please back up your device.</li>
            <li>Devices uncollected after 90 days may be disposed of to recover costs.</li>
            <li>Condition above is agreed as the device&apos;s state at drop-off.</li>
          </ul>
          <label style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 10, cursor: "pointer" }}>
            <div onClick={() => onChange({ termsAccepted: !data.termsAccepted })} style={{ width: 18, height: 18, borderRadius: 5, border: `2px solid ${data.termsAccepted ? "var(--accent)" : "var(--border)"}`, background: data.termsAccepted ? "var(--accent)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {data.termsAccepted && <span style={{ color: "var(--accent-fg)", fontSize: 11, fontWeight: 700 }}>✓</span>}
            </div>
            <span style={{ fontSize: 12, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Customer has read and accepts the terms above</span>
          </label>
        </div>

        <SignaturePad value={data.signature} onChange={s => onChange({ signature: s })} label="Customer Signature *" />
      </div>
    </div>
  );
}

// ─── Main Form Component ──────────────────────────────────────────────────────

const INITIAL: FormData = {
  dealerId: "", customerName: "", customerNIC: "", customerContact: "", customerEmail: "",
  deviceModel: "", deviceModelNumber: "", deviceIMEI: "", receivedItems: [], faultCheckboxes: [], faultDescription: "",
  estimatedCost: "", advancePaid: "", paymentMethod: "", jobPriority: "Normal", jobNotes: "",
  assignedRepairman: "", estimatedCompletion: "",
  condition: { front: "Good", back: "Good", frame: "Good", camera: "Good", ports: "Good", buttons: "Good" },
  intakePhotos: [], passcodeType: "None", passcode: "", signature: "", termsAccepted: false,
};

function detectBrand(model: string): string {
  const m = model.toLowerCase();
  if (m.includes("iphone") || m.includes("ipad") || m.includes("macbook")) return "Apple";
  if (m.includes("samsung") || m.includes("galaxy")) return "Samsung";
  if (m.includes("xiaomi") || m.includes("redmi") || m.includes("poco")) return "Xiaomi";
  if (m.includes("oppo")) return "OPPO";
  if (m.includes("oneplus")) return "OnePlus";
  if (m.includes("realme")) return "Realme";
  if (m.includes("huawei") || m.includes("honor")) return "Huawei";
  if (m.includes("vivo")) return "Vivo";
  if (m.includes("nokia")) return "Nokia";
  return "Other";
}

export default function NewRepairForm({ onClose }: { onClose?: () => void }) {
  const { addJob, dealers } = useRepair();
  const { warranties } = useWarranty();
  const [customModels, setCustomModels] = usePersistentState<string[]>("mano_custom_models", []);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormData>(INITIAL);
  const [createdJob, setCreatedJob] = useState<RepairJob | null>(null);
  const isMobile = useIsMobile();

  // Base catalogue + any models the user has typed/saved before.
  const modelOptions = [...new Set([...DEVICE_MODELS, ...customModels])].sort();
  const addModel = (m: string) => {
    const v = m.trim();
    if (v && !DEVICE_MODELS.includes(v) && !customModels.includes(v)) {
      setCustomModels((prev) => [...prev, v]);
    }
  };

  const update = (partial: Partial<FormData>) => setForm((f) => ({ ...f, ...partial }));

  // Warranty lookup — does this device already have an active warranty?
  const existingWarranty = (() => {
    const imei = form.deviceIMEI.replace(/\s/g, "");
    const phone = form.customerContact.replace(/\s/g, "");
    if (!imei && !phone) return undefined;
    return warranties.find(w =>
      effectiveStatus(w) === "Active" &&
      ((imei && w.imei?.replace(/\s/g, "") === imei) ||
       (phone.length >= 7 && w.customerPhone.replace(/\s/g, "").endsWith(phone.slice(-7)))),
    );
  })();

  const canProceed = () => {
    if (step === 1) return form.customerName.trim() && form.customerContact.trim();
    if (step === 2) return form.deviceModel.trim();
    if (step === 3) return form.estimatedCost.trim();
    return true;
  };

  const canSubmit =
    form.intakePhotos.length > 0 && form.signature.trim() !== "" && form.termsAccepted;

  const handleSubmit = () => {
    const repairman = REPAIRMEN.find(r => String(r.id) === form.assignedRepairman);
    // The dealer picked in step 1 travels with the job — it drives the dealer
    // panel in Repair Management and whether the slip prints as a job receipt
    // (in-house) or a sales invoice billed to the dealer.
    const dealer = dealers.find(d => String(d.id) === form.dealerId);
    const issueFaults = [
      ...form.faultCheckboxes,
      ...(form.faultDescription.trim() ? [form.faultDescription.trim()] : []),
    ].join(", ") || "General Repair";

    const job = addJob({
      customerName: form.customerName || "Walk-in",
      phone: form.customerContact,
      brand: detectBrand(form.deviceModel),
      model: form.deviceModel,
      modelNumber: form.deviceModelNumber || undefined,
      issue: issueFaults,
      technician: repairman?.name ?? "Unassigned",
      status: "Non-Issued",
      priority: (form.jobPriority as "Low" | "Normal" | "High" | "Urgent") || "Normal",
      estimatedCost: parseFloat(form.estimatedCost) || 0,
      originalEstimate: parseFloat(form.estimatedCost) || 0,
      advancePaid: parseFloat(form.advancePaid) || 0,
      createdAt: new Date().toISOString().slice(0, 10),
      estimatedCompletion: form.estimatedCompletion || new Date().toISOString().slice(0, 10),
      imei: form.deviceIMEI || undefined,
      dealer: dealer?.name ?? IN_HOUSE_DEALER,
      dealerId: dealer?.id,
      receivedItems: form.receivedItems.length ? form.receivedItems : undefined,
      cosmeticCondition: form.condition,
      intakePhotos: form.intakePhotos.length ? form.intakePhotos : undefined,
      passcodeType: form.passcodeType,
      devicePasscode: form.passcode || undefined,
      customerConsentSignature: form.signature || undefined,
      termsVersionAccepted: form.termsAccepted ? TERMS_VERSION : undefined,
    });
    setCreatedJob(job);
  };

  const startNewRepair = () => { setForm(INITIAL); setStep(1); setCreatedJob(null); };

  return (
    <div
      style={{
        display: "flex", flexDirection: "column",
        flex: 1, minHeight: 0,
        background: "var(--bg-primary)",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}
    >
      

      {/* Step Indicator */}
      <div style={{ padding: isMobile ? "14px 16px 8px" : "20px 28px 10px", flexShrink: 0 }}>
        <StepIndicator current={step} />
      </div>

      {/* Active-warranty alert — surfaced once IMEI / phone is known */}
      {existingWarranty && (
        <div style={{ margin: isMobile ? "0 16px 10px" : "0 28px 10px", display: "flex", alignItems: "flex-start", gap: 10, padding: "11px 14px", borderRadius: 10, background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.3)" }}>
          <ShieldCheck size={15} color="#a78bfa" style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: "'Plus Jakarta Sans', sans-serif", lineHeight: 1.5 }}>
            <strong style={{ color: "#a78bfa" }}>Active warranty found</strong> — {existingWarranty.id} covering{" "}
            {existingWarranty.partsCovered.join(", ")} (expires {existingWarranty.expiresAt?.slice(0, 10)}). If this
            is the same fault, open a <strong>warranty claim</strong> in the Warranty Center instead of a paid job.
          </p>
        </div>
      )}

      {/* Step Content */}
      <div style={{ flex: isMobile ? "none" : 1, padding: isMobile ? "0 16px" : "0 28px", minHeight: 0, overflowY: isMobile ? "visible" : "auto" }}>
        {step === 1 && <Step1 data={form} onChange={update} isMobile={isMobile} dealers={dealers} />}
        {step === 2 && <Step2 data={form} onChange={update} isMobile={isMobile} models={modelOptions} onAddModel={addModel} />}
        {step === 3 && <Step3 data={form} onChange={update} isMobile={isMobile} />}
        {step === 4 && <Step4 data={form} onChange={update} isMobile={isMobile} />}
        {step === 5 && <Step5 data={form} onChange={update} isMobile={isMobile} />}
      </div>

      {/* Footer Navigation */}
      <div style={{
        padding: isMobile ? "12px 16px" : "14px 28px",
        borderTop: "1px solid var(--border)",
        background: "var(--bg-card)", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginTop: isMobile ? 16 : 0,
      }}>
        <button
          onClick={() => setStep((s) => s - 1)}
          disabled={step === 1}
          style={{
            padding: "9px 22px", borderRadius: 8, border: "1px solid var(--border)",
            background: "transparent", color: step === 1 ? "var(--border)" : "var(--text-secondary)",
            cursor: step === 1 ? "not-allowed" : "pointer", fontSize: 13,
            fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, transition: "all 0.15s",
          }}
        >
          ← Back
        </button>

        <div style={{ display: "flex", gap: 6 }}>
          {[1, 2, 3, 4, 5].map((s) => (
            <div key={s} style={{
              width: s === step ? 20 : 6, height: 6, borderRadius: 3,
              background: s <= step ? "var(--accent)" : "var(--border)",
              transition: "all 0.2s",
            }} />
          ))}
        </div>

        {step < 5 ? (
          <button
            onClick={() => setStep((s) => s + 1)}
            disabled={!canProceed()}
            style={{
              padding: "9px 22px", borderRadius: 8, border: "none",
              background: canProceed() ? "var(--accent)" : "var(--border)",
              color: canProceed() ? "var(--accent-fg)" : "var(--text-secondary)",
              cursor: canProceed() ? "pointer" : "not-allowed",
              fontSize: 13, fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700,
              transition: "all 0.15s",
            }}
          >
            Next Step →
          </button>
        ) : (
          <button
            onClick={() => canSubmit && handleSubmit()}
            disabled={!canSubmit}
            title={canSubmit ? "" : "Add at least one photo, capture the signature, and accept the terms"}
            style={{
              padding: "9px 24px", borderRadius: 8, border: "none",
              background: canSubmit ? "var(--accent)" : "var(--border)",
              color: canSubmit ? "var(--accent-fg)" : "var(--text-secondary)",
              cursor: canSubmit ? "pointer" : "not-allowed",
              fontSize: 13, fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontWeight: 700,
            }}
          >
            ✓ Create Repair Job
          </button>
        )}
      </div>

      {createdJob && <JobReceiptPopup job={createdJob} onNew={startNewRepair} onClose={onClose} />}
    </div>
  );
}

// ─── Job-created popup with printable receipt ─────────────────────────────────

function JobReceiptPopup({ job, onNew, onClose }: { job: RepairJob; onNew: () => void; onClose?: () => void }) {
  const slipRef = useRef<HTMLDivElement>(null);
  const balance = job.estimatedCost - job.advancePaid;

  const handlePrint = () => {
    if (!slipRef.current) return;
    const el = document.createElement("div"); el.id = "__jobslip__"; el.innerHTML = slipRef.current.outerHTML;
    document.body.appendChild(el);
    const st = document.createElement("style"); st.id = "__jobslip_style__";
    st.textContent = `@page{size:A5 portrait;margin:10mm}#__jobslip__{display:none}@media print{body{visibility:hidden}#__jobslip__{display:block!important;visibility:visible;position:fixed;top:0;left:0;width:100%}#__jobslip__ *{visibility:visible}}`;
    document.head.appendChild(st); window.print();
    setTimeout(() => { document.getElementById("__jobslip__")?.remove(); document.getElementById("__jobslip_style__")?.remove(); }, 500);
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1200, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 18,
    }}>
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 18, width: "min(440px, calc(100vw - 24px))", maxHeight: "92vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,0.55)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        <div style={{ padding: "26px 24px 18px", textAlign: "center" }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(74,222,128,0.12)", border: "2px solid #4ade80", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
            <CheckCircle2 size={28} color="#4ade80" />
          </div>
          <p style={{ fontSize: 19, fontWeight: 800, color: "var(--text-primary)" }}>Repair Job Created</p>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
            Job <strong style={{ color: "var(--accent)" }}>{job.id}</strong> · {job.brand} {job.model}
          </p>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 10, lineHeight: 1.5 }}>
            Print the job receipt for the customer, or hand-write the job number on a chit if you prefer.
          </p>
        </div>

        {/* Hidden printable slip */}
        <div style={{ position: "absolute", left: -99999, top: 0 }}>
          <div ref={slipRef} style={{ background: "#fff", color: "#000", padding: "26px 30px", fontFamily: "Arial, sans-serif", width: 480 }}>
            <div style={{ textAlign: "center", borderBottom: "2px solid #000", paddingBottom: 10, marginBottom: 14 }}>
              <h2 style={{ margin: 0, fontWeight: 900, fontSize: 18, letterSpacing: "0.05em" }}>MANO MOBILE CENTRE</h2>
              <p style={{ margin: "3px 0 0", fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>New Job Receipt</p>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
              <tbody>
                {[
                  ["Job No.", job.id],
                  ["Date Received", job.createdAt],
                  ["Customer", `${job.customerName} · ${job.phone}`],
                  ["Device", `${job.brand} ${job.model}${job.modelNumber ? ` (${job.modelNumber})` : ""}`],
                  ["IMEI", job.imei || "—"],
                  ["Reported fault", job.issue],
                  ["Items received", (job.receivedItems || []).join(", ") || "—"],
                  ["Technician", job.technician],
                  ["Est. completion", job.estimatedCompletion],
                ].map(([k, v]) => (
                  <tr key={k}><td style={{ padding: "3px 8px 3px 0", fontWeight: 700, width: 110, verticalAlign: "top" }}>{k}:</td><td style={{ padding: "3px 0" }}>{v}</td></tr>
                ))}
              </tbody>
            </table>
            <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #999", marginTop: 12, fontSize: 11 }}>
              <tbody>
                <tr style={{ background: "#f0f0f0" }}>
                  <th style={{ padding: "4px 8px", textAlign: "left" }}>Estimated</th>
                  <th style={{ padding: "4px 8px", textAlign: "left", borderLeft: "1px solid #999" }}>Advance</th>
                  <th style={{ padding: "4px 8px", textAlign: "left", borderLeft: "1px solid #999" }}>Balance</th>
                </tr>
                <tr>
                  <td style={{ padding: "4px 8px" }}>Rs. {job.estimatedCost.toLocaleString()}</td>
                  <td style={{ padding: "4px 8px", borderLeft: "1px solid #999" }}>Rs. {job.advancePaid.toLocaleString()}</td>
                  <td style={{ padding: "4px 8px", borderLeft: "1px solid #999", fontWeight: 700 }}>Rs. {balance.toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
            <p style={{ fontSize: 8.5, color: "#666", marginTop: 12, lineHeight: 1.4 }}>
              Please keep this receipt and present it when collecting your device. Mano Mobile is not
              responsible for pre-existing damage not noted at intake. Warranty applies only to the work performed.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div style={{ padding: "0 20px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
          <button onClick={handlePrint} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "11px", borderRadius: 10, border: "none", background: "var(--accent)", color: "var(--accent-fg)", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            <Printer size={16} /> Print Job Receipt
          </button>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={onNew} style={{ flex: 1, padding: "10px", borderRadius: 10, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              + New Repair
            </button>
            {onClose && (
              <button onClick={onClose} style={{ flex: 1, padding: "10px", borderRadius: 10, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                Done
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}