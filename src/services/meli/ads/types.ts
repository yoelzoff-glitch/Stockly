export type AdsAvailabilityReason =
  | "advertiser_not_available"
  | "advertising_permission_missing"
  | "product_ads_not_enabled"
  | "auth_error"
  | "network_error"
  | "no_meli_account"
  | "demo_mode";

export interface AdsAvailability {
  available: boolean;
  reason?: AdsAvailabilityReason;
  message?: string;
}

export interface AdvertiserInfo {
  advertiserId: number;
  siteId: string;
}

export interface ProductAdsMetricsValues {
  impressions: number | null;
  clicks: number | null;
  cost: number | null;
  cpc: number | null;
  ctr: number | null;
  directAmount: number | null;
  indirectAmount: number | null;
  totalAmount: number | null;
  acos: number | null;
  tacos: number | null;
  roas: number | null;
  cvr: number | null;
  directUnitsQuantity?: number | null;
  indirectUnitsQuantity?: number | null;
  unitsQuantity: number | null;
}

export type AdsMetrics = ProductAdsMetricsValues;

export interface ProductAdsCampaign {
  id: string | number;
  name?: string;
  status?: string;
  budget?: number | null;
  daily_budget?: number | null;
  consumed_budget?: number | null;
  metrics?: Partial<ProductAdsMetricsValues> | null;
  [key: string]: any;
}

export type MeliAdsCampaign = ProductAdsCampaign;

export interface GetProductAdsCampaignsResponse {
  campaigns: ProductAdsCampaign[];
  metricsSummary: AdsMetrics | null;
}

export interface ProductAdsAdGroup {
  id: string | number;
  campaign_id?: string | number;
  name?: string;
  status?: string;
  item_id?: string;
  item_ids?: string[];
  metrics?: Partial<ProductAdsMetricsValues> | null;
  [key: string]: any;
}

export type MeliAdsAdGroup = ProductAdsAdGroup;

export interface ProductAdsCampaignItem {
  id: string;
  name: string;
  status: "active" | "paused" | "ended";
  daily_budget: number | null;
  consumed_budget: number | null;
  revenue: number | null;
  acos: number | null;
  roas: number | null;
  impressions: number | null;
  clics: number | null;
  units_sold: number | null;
  net_profit: number | null;
}

export type AdsCampaignItem = ProductAdsCampaignItem;

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
  clics: number | null;
  cpc: number | null;
  roas: number | null;
  acos_percent: number | null;
  total_product_cost: number | null;
  total_fee_cost: number | null;
  total_shipping_cost: number | null;
  total_packaging_cost: number | null;
  ads_investment: number;
  clean_net_profit: number | null;
  clean_net_margin_percent: number | null;
  profitability_status: "complete" | "missing_cost" | "missing_fee" | "missing_shipping" | "unknown";
}

export interface ProductAdsTotals {
  investment: number | null;
  revenue: number | null;
  cleanNetProfit: number | null;
  averageAcos: number | null;
  overallRoas: number | null;
}

export interface ProductAdsAd {
  id?: string | number;
  item_id: string;
  campaign_id?: string | number;
  ad_group_id?: string | number;
  title?: string | null;
  price?: number | null;
  status?: string | null;
  sku?: string | null;
  thumbnail_url?: string | null;
  metrics?: Partial<ProductAdsMetricsValues> | null;
  raw?: any;
}

export interface AdsDataResult {
  period: string;
  periodLabel: string;
  availability: AdsAvailability;
  advertiser: {
    advertiserId: number | null;
    siteId: string | null;
  };
  campaigns: ProductAdsCampaignItem[];
  adGroups: ProductAdsAdGroup[];
  productAdsList: ProductAdsMetrics[];
  totals: ProductAdsTotals;
  adsError?: string | null;

  // Backwards compatibility properties for existing UI / consumers
  totalAdsInvestment: number | null;
  totalAdsRevenue: number | null;
  totalCleanNetProfit: number | null;
  averageAcos: number | null;
  overallRoas: number | null;
  liveAdsAvailable: boolean;
}
