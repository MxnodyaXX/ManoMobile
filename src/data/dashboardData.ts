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

export const DASHBOARD_STATS: Record<FilterPeriod, DashboardStats> = {
  Daily: {
    totalRevenue:   { value: 128450,  change: "+12%" },
    salesRevenue:   { value: 104950,  change: "+15%" },
    repairRevenue:  { value: 23500,   change: "+4%"  },
    totalSales:     { value: 104950,  change: "+15%" },
    mobileSales:    { value: 95000,   change: "+18%" },
    accessorySales: { value: 8450,    change: "+8%"  },
    otherSales:     { value: 1500,    change: "-5%"  },
    repairIncome:   { value: 23500,   change: "+4%"  },
    repairCost:     { value: 8200,    change: "+2%"  },
    partsCost:      { value: 4800,    change: "+6%"  },
    totalJobs:      { value: 8,       change: "+1"   },
  },
  Weekly: {
    totalRevenue:   { value: 585800,  change: "+9%"  },
    salesRevenue:   { value: 487300,  change: "+11%" },
    repairRevenue:  { value: 98500,   change: "+5%"  },
    totalSales:     { value: 487300,  change: "+11%" },
    mobileSales:    { value: 430000,  change: "+13%" },
    accessorySales: { value: 48600,   change: "+7%"  },
    otherSales:     { value: 8700,    change: "+2%"  },
    repairIncome:   { value: 98500,   change: "+5%"  },
    repairCost:     { value: 34500,   change: "+3%"  },
    partsCost:      { value: 19200,   change: "+8%"  },
    totalJobs:      { value: 23,      change: "+4"   },
  },
  Monthly: {
    totalRevenue:   { value: 2418500, change: "+7%"  },
    salesRevenue:   { value: 2036500, change: "+8%"  },
    repairRevenue:  { value: 382000,  change: "+4%"  },
    totalSales:     { value: 2036500, change: "+8%"  },
    mobileSales:    { value: 1768000, change: "+9%"  },
    accessorySales: { value: 218600,  change: "+5%"  },
    otherSales:     { value: 49900,   change: "+3%"  },
    repairIncome:   { value: 382000,  change: "+4%"  },
    repairCost:     { value: 128500,  change: "+2%"  },
    partsCost:      { value: 74200,   change: "+5%"  },
    totalJobs:      { value: 87,      change: "+12"  },
  },
  Yearly: {
    totalRevenue:   { value: 24360000, change: "+22%" },
    salesRevenue:   { value: 20460000, change: "+24%" },
    repairRevenue:  { value: 3900000,  change: "+14%" },
    totalSales:     { value: 20460000, change: "+24%" },
    mobileSales:    { value: 18200000, change: "+26%" },
    accessorySales: { value: 1920000,  change: "+15%" },
    otherSales:     { value: 340000,   change: "+8%"  },
    repairIncome:   { value: 3900000,  change: "+14%" },
    repairCost:     { value: 1280000,  change: "+10%" },
    partsCost:      { value: 705000,   change: "+12%" },
    totalJobs:      { value: 876,      change: "+124" },
  },
  All: {
    totalRevenue:   { value: 56480000, change: "+100%" },
    salesRevenue:   { value: 47600000, change: "+100%" },
    repairRevenue:  { value: 8880000,  change: "+100%" },
    totalSales:     { value: 47600000, change: "+100%" },
    mobileSales:    { value: 42500000, change: "+100%" },
    accessorySales: { value: 4280000,  change: "+100%" },
    otherSales:     { value: 820000,   change: "+100%" },
    repairIncome:   { value: 8880000,  change: "+100%" },
    repairCost:     { value: 2960000,  change: "+100%" },
    partsCost:      { value: 1540000,  change: "+100%" },
    totalJobs:      { value: 1847,     change: "+100%" },
  },
};

export const REVENUE_CHART_DATA = [
  { name: "Nov", value: 1890000 },
  { name: "Dec", value: 2240000 },
  { name: "Jan", value: 1780000 },
  { name: "Feb", value: 1950000 },
  { name: "Mar", value: 2100000 },
  { name: "Apr", value: 2280000 },
  { name: "May", value: 2418500 },
];

export const SALES_CHART_DATA = [
  { name: "Nov", value: 1580000 },
  { name: "Dec", value: 1920000 },
  { name: "Jan", value: 1480000 },
  { name: "Feb", value: 1640000 },
  { name: "Mar", value: 1780000 },
  { name: "Apr", value: 1920000 },
  { name: "May", value: 2036500 },
];

export function fmtRs(n: number): string {
  if (n >= 1_000_000) return `Rs. ${(n / 1_000_000).toFixed(2)}M`;
  return `Rs. ${n.toLocaleString("en-US")}`;
}
