export type FilterPeriod = "Daily" | "Weekly" | "Monthly" | "Yearly" | "All";

export interface StatValue {
  value: number;
  change: string;
}

export interface DashboardStats {
  totalRevenue:   StatValue;
  salesRevenue:   StatValue;
  repairRevenue:  StatValue;
  totalSales:     StatValue;
  mobileSales:    StatValue;
  accessorySales: StatValue;
  otherSales:     StatValue;
  repairIncome:   StatValue;
  repairCost:     StatValue;
  partsCost:      StatValue;
  totalJobs:      StatValue;
}

export const DASHBOARD_STATS: Record<FilterPeriod, DashboardStats> = (() => {
  // Zeroed: the dashboard shows real figures once sales/repair data exists.
  // Inventing numbers here made an empty system look like a trading business.
  const blank: DashboardStats = {
    totalRevenue:   { value: 0, change: "" },
    salesRevenue:   { value: 0, change: "" },
    repairRevenue:  { value: 0, change: "" },
    totalSales:     { value: 0, change: "" },
    mobileSales:    { value: 0, change: "" },
    accessorySales: { value: 0, change: "" },
    otherSales:     { value: 0, change: "" },
    repairIncome:   { value: 0, change: "" },
    repairCost:     { value: 0, change: "" },
    partsCost:      { value: 0, change: "" },
    totalJobs:      { value: 0, change: "" },
  };
  return { Daily: blank, Weekly: blank, Monthly: blank, Yearly: blank, All: blank };
})();

export const REVENUE_CHART_DATA = [];

export const SALES_CHART_DATA = [];

export function fmtRs(n: number): string {
  if (n >= 1_000_000) return `Rs. ${(n / 1_000_000).toFixed(2)}M`;
  return `Rs. ${n.toLocaleString("en-US")}`;
}
