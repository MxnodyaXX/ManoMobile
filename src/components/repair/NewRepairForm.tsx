"use client";

import { useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Dealer {
  id: number;
  name: string;
  address: string;
  contact: string;
  remarks: string;
}

interface FormData {
  // Step 1
  dealerId: string;
  customerName: string;
  customerNIC: string;
  customerContact: string;
  customerEmail: string;

  // Step 2
  deviceModel: string;
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
}

// ─── Sample Data ──────────────────────────────────────────────────────────────

const DEALERS: Dealer[] = [
  { id: 1, name: "Tech Hub Colombo", address: "123 Galle Road, Colombo 03", contact: "+94 11 234 5678", remarks: "Primary dealer - 15% discount" },
  { id: 2, name: "Mobile World Kandy", address: "45 Peradeniya Rd, Kandy", contact: "+94 81 223 4567", remarks: "Wholesale partner" },
  { id: 3, name: "Digital Zone Negombo", address: "78 Sea Street, Negombo", contact: "+94 31 222 3344", remarks: "New dealer - verify identity" },
  { id: 4, name: "Smart Phones Galle", address: "12 Hospital Rd, Galle", contact: "+94 91 224 5566", remarks: "Trusted dealer since 2019" },
];

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
  "Huawei Nova 12", "Vivo Y200 Pro", "Other",
];

// ─── Step Indicator ───────────────────────────────────────────────────────────

const STEPS = [
  { num: 1, label: "Dealer & Customer" },
  { num: 2, label: "Device & Faults" },
  { num: 3, label: "Costs & Job Info" },
  { num: 4, label: "Assign Repairman" },
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
                  color: isDone || isActive ? "#0a0a0f" : "var(--text-secondary)",
                  fontWeight: 700, fontSize: 14, fontFamily: "'Syne', sans-serif",
                  transition: "all 0.2s",
                  flexShrink: 0,
                }}
              >
                {isDone ? "✓" : step.num}
              </div>
              <span style={{
                fontSize: 11, fontFamily: "'DM Sans', sans-serif",
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
  color: "var(--text-primary)", fontSize: 13,
  fontFamily: "'DM Sans', sans-serif", outline: "none",
  transition: "border-color 0.15s", boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, fontFamily: "'Syne', sans-serif",
  color: "var(--text-secondary)", marginBottom: 4, display: "block",
  letterSpacing: "0.04em", textTransform: "uppercase",
};

const sectionHeaderStyle: React.CSSProperties = {
  fontSize: 13, fontWeight: 700, fontFamily: "'Syne', sans-serif",
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
  background: checked ? "rgba(var(--accent-rgb, 180,255,100), 0.08)" : "transparent",
  cursor: "pointer", transition: "all 0.15s", userSelect: "none",
});

// ─── Step 1: Dealer & Customer ────────────────────────────────────────────────

function Step1({ data, onChange }: { data: FormData; onChange: (d: Partial<FormData>) => void }) {
  const dealer = DEALERS.find((d) => d.id.toString() === data.dealerId);

  return (
    <div style={{ display: "flex", gap: 20, height: "55%" }}>
      {/* Left: Dealer */}
      <div style={panelStyle}>
        <div style={sectionHeaderStyle}>🏪 Dealer Information</div>
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Select Dealer</label>
          <select
            value={data.dealerId}
            onChange={(e) => onChange({ dealerId: e.target.value })}
            style={{ ...inputStyle, appearance: "none", cursor: "pointer" }}
          >
            <option value="">— Choose a dealer —</option>
            {DEALERS.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, opacity: dealer ? 1 : 0.4, transition: "opacity 0.2s" }}>
          <div>
            <label style={labelStyle}>Address</label>
            <input readOnly style={{ ...inputStyle, background: "var(--bg)" }} value={dealer?.address ?? ""} placeholder="Select dealer above" />
          </div>
          <div>
            <label style={labelStyle}>Contact Number</label>
            <input readOnly style={{ ...inputStyle, background: "var(--bg)" }} value={dealer?.contact ?? ""} placeholder="—" />
          </div>
          <div>
            <label style={labelStyle}>Remarks</label>
            <textarea
              readOnly
              style={{ ...inputStyle, background: "var(--bg)", resize: "none", minHeight: 64 }}
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

function Step2({ data, onChange }: { data: FormData; onChange: (d: Partial<FormData>) => void }) {
  const toggleItem = (list: string[], item: string) =>
    list.includes(item) ? list.filter((i) => i !== item) : [...list, item];

  return (
    <div style={{ display: "flex", gap: 20, height: "100%" }}>
      {/* Left: Device Info & Received Items */}
      <div style={panelStyle}>
        <div style={sectionHeaderStyle}>📱 Device Information</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
          <div>
            <label style={labelStyle}>Device Model *</label>
            <select
              style={{ ...inputStyle, appearance: "none", cursor: "pointer" }}
              value={data.deviceModel}
              onChange={(e) => onChange({ deviceModel: e.target.value })}
            >
              <option value="">— Select Model —</option>
              {DEVICE_MODELS.map((m) => <option key={m}>{m}</option>)}
            </select>
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
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
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
                  {checked && <span style={{ color: "#0a0a0f", fontSize: 10, fontWeight: 700 }}>✓</span>}
                </div>
                <span style={{ fontSize: 12, fontFamily: "'DM Sans', sans-serif", color: "var(--text-primary)" }}>{item}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right: Faults */}
      <div style={panelStyle}>
        <div style={sectionHeaderStyle}>🔧 Device Faults</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 18 }}>
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
                <span style={{ fontSize: 12, fontFamily: "'DM Sans', sans-serif", color: "var(--text-primary)" }}>{fault}</span>
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

function Step3({ data, onChange }: { data: FormData; onChange: (d: Partial<FormData>) => void }) {
  const estimated = parseFloat(data.estimatedCost) || 0;
  const advance = parseFloat(data.advancePaid) || 0;
  const balance = estimated - advance;

  return (
    <div style={{ display: "flex", gap: 20, height: "100%" }}>
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
            <select
              style={{ ...inputStyle, appearance: "none", cursor: "pointer" }}
              value={data.paymentMethod}
              onChange={(e) => onChange({ paymentMethod: e.target.value })}
            >
              <option value="">— Select Method —</option>
              <option>Cash</option>
              <option>Card</option>
              <option>Bank Transfer</option>
              <option>Online Payment</option>
            </select>
          </div>

          {/* Balance Summary Card */}
          <div style={{
            marginTop: 8, padding: "16px 18px", borderRadius: 10,
            background: "var(--bg)", border: "1px solid var(--border)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: "'DM Sans', sans-serif" }}>Estimated Cost</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", fontFamily: "'Syne', sans-serif" }}>
                LKR {estimated.toLocaleString("en-LK", { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: "'DM Sans', sans-serif" }}>Advance Paid</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#4ade80", fontFamily: "'Syne', sans-serif" }}>
                − LKR {advance.toLocaleString("en-LK", { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10, display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", fontFamily: "'Syne', sans-serif" }}>Balance Due</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: balance > 0 ? "var(--accent)" : "#4ade80", fontFamily: "'Syne', sans-serif" }}>
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
                      color: isActive ? "#0a0a0f" : "var(--text-secondary)",
                      fontWeight: isActive ? 700 : 400, fontSize: 12, cursor: "pointer",
                      fontFamily: "'Syne', sans-serif", transition: "all 0.15s",
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
            background: "rgba(var(--accent-rgb, 180,255,100), 0.06)",
            border: "1px dashed var(--accent)",
          }}>
            <p style={{ margin: 0, fontSize: 12, fontFamily: "'DM Sans', sans-serif", color: "var(--text-secondary)", lineHeight: 1.6 }}>
              💡 A job card will be auto-generated with a unique reference number upon submission. The customer will be notified via SMS if a contact number is provided.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Step 4: Assign Repairman ─────────────────────────────────────────────────

function Step4({ data, onChange }: { data: FormData; onChange: (d: Partial<FormData>) => void }) {
  return (
    <div style={{ display: "flex", gap: 20, height: "100%" }}>
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
                  background: isSelected ? "rgba(var(--accent-rgb, 180,255,100), 0.06)" : "var(--bg)",
                  cursor: canSelect ? "pointer" : "not-allowed",
                  opacity: canSelect ? 1 : 0.5, transition: "all 0.15s",
                }}
              >
                <div style={{
                  width: 44, height: 44, borderRadius: "50%",
                  background: isSelected ? "var(--accent)" : "var(--border)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 18, fontWeight: 700, flexShrink: 0,
                  color: isSelected ? "#0a0a0f" : "var(--text-secondary)",
                  fontFamily: "'Syne', sans-serif",
                }}>
                  {r.name.charAt(0)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, fontFamily: "'Syne', sans-serif", color: "var(--text-primary)", marginBottom: 3 }}>
                    {r.name}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: "'DM Sans', sans-serif" }}>
                    {r.speciality} · {r.activeJobs} active job{r.activeJobs !== 1 ? "s" : ""}
                  </div>
                </div>
                <div style={{
                  padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                  background: r.available ? "rgba(74, 222, 128, 0.12)" : "rgba(239, 68, 68, 0.12)",
                  color: r.available ? "#4ade80" : "#ef4444",
                  fontFamily: "'Syne', sans-serif",
                }}>
                  {r.available ? "Available" : "Busy"}
                </div>
                {isSelected && (
                  <div style={{
                    width: 22, height: 22, borderRadius: "50%", background: "var(--accent)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 12, color: "#0a0a0f", fontWeight: 700,
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
              background: "rgba(var(--accent-rgb, 180,255,100), 0.06)",
              border: "1px solid var(--accent)",
            }}>
              {(() => {
                const r = REPAIRMEN.find((rm) => rm.id.toString() === data.assignedRepairman);
                return r ? (
                  <>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: "'DM Sans', sans-serif", marginBottom: 6 }}>
                      Assigned to
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, fontFamily: "'Syne', sans-serif", color: "var(--text-primary)", marginBottom: 4 }}>
                      {r.name}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: "'DM Sans', sans-serif" }}>
                      {r.speciality}
                    </div>
                  </>
                ) : null;
              })()}
            </div>
          )}

          <div style={{
            marginTop: "auto", padding: "14px 16px", borderRadius: 10,
            background: "var(--bg)", border: "1px solid var(--border)",
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, fontFamily: "'Syne', sans-serif", color: "var(--text-secondary)", marginBottom: 10 }}>
              REPAIR SUMMARY
            </div>
            {[
              ["Repairman", REPAIRMEN.find((r) => r.id.toString() === data.assignedRepairman)?.name ?? "Not assigned"],
              ["Completion", data.estimatedCompletion || "Not set"],
            ].map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
                <span style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: "'DM Sans', sans-serif" }}>{k}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", fontFamily: "'Syne', sans-serif" }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Form Component ──────────────────────────────────────────────────────

const INITIAL: FormData = {
  dealerId: "", customerName: "", customerNIC: "", customerContact: "", customerEmail: "",
  deviceModel: "", deviceIMEI: "", receivedItems: [], faultCheckboxes: [], faultDescription: "",
  estimatedCost: "", advancePaid: "", paymentMethod: "", jobPriority: "Normal", jobNotes: "",
  assignedRepairman: "", estimatedCompletion: "",
};

export default function NewRepairForm({ onClose }: { onClose?: () => void }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormData>(INITIAL);
  const [submitted, setSubmitted] = useState(false);

  const update = (partial: Partial<FormData>) => setForm((f) => ({ ...f, ...partial }));

  const canProceed = () => {
    if (step === 1) return form.customerName.trim() && form.customerContact.trim();
    if (step === 2) return form.deviceModel.trim();
    if (step === 3) return form.estimatedCost.trim();
    return true;
  };

  const handleSubmit = () => {
    console.log("Repair Job Submitted:", form);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        height: "100%", gap: 16, textAlign: "center",
      }}>
        <div style={{ fontSize: 56 }}>✅</div>
        <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'Syne', sans-serif", color: "var(--text-primary)" }}>
          Repair Job Created!
        </div>
        <div style={{ fontSize: 14, color: "var(--text-secondary)", fontFamily: "'DM Sans', sans-serif" }}>
          Job card has been generated and repairman notified.
        </div>
        <button
          onClick={() => { setForm(INITIAL); setStep(1); setSubmitted(false); }}
          style={{
            marginTop: 10, padding: "10px 28px", borderRadius: 8, border: "none",
            background: "var(--accent)", color: "#0a0a0f", fontWeight: 700, fontSize: 14,
            cursor: "pointer", fontFamily: "'Syne', sans-serif",
          }}
        >
          New Repair
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex", flexDirection: "column",
        height: "100vh", maxHeight: "100vh",
        background: "var(--bg)", overflow: "hidden",
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      

      {/* Step Indicator */}
      <div style={{ padding: "20px 28px 10px", flexShrink: 0 }}>
        <StepIndicator current={step} />
      </div>

      {/* Step Content — fills remaining space, no scroll */}
      <div style={{ flex: 1, padding: "0 28px", minHeight: 0 }}>
        {step === 1 && <Step1 data={form} onChange={update} />}
        {step === 2 && <Step2 data={form} onChange={update} />}
        {step === 3 && <Step3 data={form} onChange={update} />}
        {step === 4 && <Step4 data={form} onChange={update} />}
      </div>

      {/* Footer Navigation */}
      <div style={{
        padding: "14px 28px", borderTop: "1px solid var(--border)",
        background: "var(--bg-card)", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <button
          onClick={() => setStep((s) => s - 1)}
          disabled={step === 1}
          style={{
            padding: "9px 22px", borderRadius: 8, border: "1px solid var(--border)",
            background: "transparent", color: step === 1 ? "var(--border)" : "var(--text-secondary)",
            cursor: step === 1 ? "not-allowed" : "pointer", fontSize: 13,
            fontFamily: "'Syne', sans-serif", fontWeight: 600, transition: "all 0.15s",
          }}
        >
          ← Back
        </button>

        <div style={{ display: "flex", gap: 6 }}>
          {[1, 2, 3, 4].map((s) => (
            <div key={s} style={{
              width: s === step ? 20 : 6, height: 6, borderRadius: 3,
              background: s <= step ? "var(--accent)" : "var(--border)",
              transition: "all 0.2s",
            }} />
          ))}
        </div>

        {step < 4 ? (
          <button
            onClick={() => setStep((s) => s + 1)}
            disabled={!canProceed()}
            style={{
              padding: "9px 22px", borderRadius: 8, border: "none",
              background: canProceed() ? "var(--accent)" : "var(--border)",
              color: canProceed() ? "#0a0a0f" : "var(--text-secondary)",
              cursor: canProceed() ? "pointer" : "not-allowed",
              fontSize: 13, fontFamily: "'Syne', sans-serif", fontWeight: 700,
              transition: "all 0.15s",
            }}
          >
            Next Step →
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            style={{
              padding: "9px 24px", borderRadius: 8, border: "none",
              background: "var(--accent)", color: "#0a0a0f",
              cursor: "pointer", fontSize: 13, fontFamily: "'Syne', sans-serif",
              fontWeight: 700,
            }}
          >
            ✓ Create Repair Job
          </button>
        )}
      </div>
    </div>
  );
}