"use client";

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const data = [
  { name: "Jan", value: 85 },
  { name: "Feb", value: 140 },
  { name: "Mar", value: 115 },
  { name: "Apr", value: 190 },
  { name: "May", value: 165 },
  { name: "Jun", value: 240 },
  { name: "Jul", value: 210 },
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-active)",
        borderRadius: 10, padding: "10px 14px",
        boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
      }}>
        <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>{label}</p>
        <p className="stat-number" style={{ fontSize: 20, color: "var(--text-primary)" }}>
          {payload[0].value}
        </p>
      </div>
    );
  }
  return null;
};

export default function ChartCard({
  title, index = 0, color = "#e8ff47",
}: {
  title: string; index?: number; color?: string;
}) {
  const gradientId = `grad-${title.replace(/\s+/g, "")}`;

  return (
    <div
      className={`fade-up fade-up-${index + 5}`}
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: 16, padding: "24px",
        display: "flex", flexDirection: "column", gap: 20,
        transition: "border-color 0.2s",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border-active)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border)";
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h3 className="heading" style={{ fontSize: 15, color: "var(--text-primary)" }}>{title}</h3>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>Last 7 months</p>
        </div>
        <span style={{
          fontSize: 11, fontWeight: 600, color,
          background: `${color}14`,
          border: `1px solid ${color}28`,
          padding: "4px 10px", borderRadius: 100,
          fontFamily: "'Syne', sans-serif", letterSpacing: "0.04em",
        }}>
          +18%
        </span>
      </div>

      <ResponsiveContainer width="100%" height={160}>
        <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={color} stopOpacity={0.18} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--text-muted)", fontFamily: "DM Sans" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)", fontFamily: "DM Sans" }} axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: "var(--border-active)", strokeWidth: 1 }} />
          <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2} fill={`url(#${gradientId})`} dot={false} activeDot={{ r: 4, fill: color, strokeWidth: 0 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}