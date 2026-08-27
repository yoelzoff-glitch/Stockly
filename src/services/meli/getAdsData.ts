export interface AdsCampaign {
  id: string;
  name: string;
  status: "active" | "paused" | "ended";
  daily_budget: number;
  consumed_budget: number;
  revenue: number;
  acos: number;
  roas: number;
  net_profit: number;
}

export interface ProductAdsMetrics {
  product_id: string;
  meli_item_id: string;
  title: string;
  sku: string | null;
  thumbnail_url: string | null;
  price: number;
  cost: number | null;
  ads_units_sold: number;
  ads_revenue: number;
  clics: number;
  cpc: number;
  roas: number;
  total_product_cost: number;
  total_fee_cost: number;
  total_shipping_cost: number;
  total_packaging_cost: number;
  ads_investment: number;
  clean_net_profit: number;
  clean_net_margin_percent: number;
  acos_percent: number;
  profitability_status: "profitable" | "warning" | "loss" | "missing_cost";
}

export async function getAdsData(tenantId: string, period: string = "30days") {
  // Reset clean state ready to build from scratch
  return {
    period,
    periodLabel: "Este Mes",
    campaigns: [],
    productAdsList: [],
    totalAdsInvestment: 0,
    totalAdsRevenue: 0,
    totalCleanNetProfit: 0,
    averageAcos: 0,
    overallRoas: 0,
    liveAdsAvailable: false
  };
}
