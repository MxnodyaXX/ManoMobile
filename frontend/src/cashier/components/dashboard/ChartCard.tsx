"use client";

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { fmtRs } from "@/cashier/data/dashboardData";

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-active)",
        borderRadius: 10, padding: "10px 14px",
        boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
      }}>
        <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginBottom: 4, fontWeight: 600 }}>{label}</p>
        <p className="stat-number" style={{ fontSize: 18, color: "var(--text-primary)" }}>
          {fmtRs(payload[0].value)}
        </p>
      </div>
    );
  }
  return null;
};

export default function ChartCard({
  title,
  index = 0,
  color = "#e8e8e8",
  data,
  badge,
}: {
  title: string;
  index?: number;
  color?: string;
  data?: { name: string; value: number }[];
  badge?: string;
}) {
  const gradientId = `grad-${title.replace(/\s+/g, "")}`;

  return (
    <div
      className={`fade-up fade-up-${index + 5}`}
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: 14, padding: "22px 24px",
        display: "flex", flexDirection: "column", gap: 20,
        transition: "border-color 0.2s, box-shadow 0.2s",
        boxShadow: "var(--shadow-card)",
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
          <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2, fontWeight: 500 }}>Last 7 months</p>
        </div>
        {badge && (
          <span style={{
            fontSize: 12, fontWeight: 700, color: color,
            background: `${color}15`,
            border: `1px solid ${color}30`,
            padding: "4px 12px", borderRadius: 100,
            letterSpacing: "0.01em",
          }}>
            {badge}
          </span>
        )}
      </div>

      <ResponsiveContainer width="100%" height={160}>
        <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={color} stopOpacity={0.2} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 12, fill: "var(--text-muted)", fontFamily: "Plus Jakarta Sans", fontWeight: 500 }}
            axisLine={false} tickLine={false}
          />
          <YAxis
            tickFormatter={(v) => {
              if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
              if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
              return `${v}`;
            }}
            tick={{ fontSize: 11, fill: "var(--text-muted)", fontFamily: "Plus Jakarta Sans", fontWeight: 500 }}
            axisLine={false} tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: "var(--border-active)", strokeWidth: 1 }} />
          <Area
            type="monotone" dataKey="value"
            stroke={color} strokeWidth={2.5}
            fill={`url(#${gradientId})`}
            dot={false}
            activeDot={{ r: 5, fill: color, strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
