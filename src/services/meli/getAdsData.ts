import { createAdminClient } from "@/lib/supabase/admin";
import { meliFetch } from "./client";

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

function getDateRangeForPeriod(period: string): { dateFrom: Date | null; dateTo: Date; periodLabel: string } {
  const now = new Date();
  let dateTo = new Date();
  let dateFrom: Date | null = null;
  let periodLabel = "Últimos 30 días";

  if (period === "today") {
    dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    periodLabel = "Hoy";
  } else if (period === "7days") {
    dateFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    periodLabel = "Últimos 7 días";
  } else if (period === "this_month") {
    dateFrom = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    periodLabel = "Este Mes";
  } else if (period === "last_month") {
    dateFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
    dateTo = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    periodLabel = "Mes Anterior";
  } else if (period === "all") {
    dateFrom = null;
    periodLabel = "Histórico Completo";
  } else {
    // 30days default
    dateFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    periodLabel = "Últimos 30 días";
  }

  return { dateFrom, dateTo, periodLabel };
}

export async function getAdsData(tenantId: string, period: string = "30days") {
  const supabase = createAdminClient();
  const { dateFrom, dateTo, periodLabel } = getDateRangeForPeriod(period);

  // 1. Fetch connected Meli Account for tenant
  const { data: meliAccount } = await supabase
    .from("meli_accounts")
    .select("id, meli_user_id, access_token")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  // 2. Fetch tenant metadata for operational packaging costs
  const { data: tenantData } = await supabase
    .from("tenants")
    .select("metadata")
    .eq("id", tenantId)
    .maybeSingle();

  const tenantMetadata = (tenantData?.metadata as any) || {};
  const packagingCost = Number(tenantMetadata.packaging_cost) || 0;

  // 3. Fetch products from Supabase DB to pull tenant costs & metadata
  const { data: dbProducts } = await supabase
    .from("products")
    .select("id, meli_item_id, title, sku, price, cost, estimated_fee, estimated_shipping_cost, thumbnail_url")
    .eq("tenant_id", tenantId);

  // 4. Query non-cancelled orders for tenant in date range
  let ordersQuery = supabase
    .from("orders")
    .select("id, total_amount, date_created, status, raw_data")
    .eq("tenant_id", tenantId)
    .neq("status", "cancelled")
    .lte("date_created", dateTo.toISOString());

  if (dateFrom) {
    ordersQuery = ordersQuery.gte("date_created", dateFrom.toISOString());
  }

  const { data: tenantOrders } = await ordersQuery;
  const activeOrders = tenantOrders || [];

  // Filter advertising orders or default all active tenant orders
  const adsOrders = activeOrders.filter(o => {
    const rawStr = JSON.stringify(o.raw_data || {});
    return rawStr.includes("advertising") || rawStr.includes("ads") || o.raw_data?.tags?.includes("advertising");
  });

  // Use ads-tagged orders if present, or all active tenant orders for calculation
  const targetOrders = adsOrders.length > 0 ? adsOrders : activeOrders;
  const targetOrderIds = targetOrders.map(o => o.id);

  // 5. Fetch order items for target orders
  const { data: orderItems } = targetOrderIds.length > 0
    ? await supabase
        .from("order_items")
        .select("order_id, meli_item_id, sku, title, quantity, total_price, unit_cost, estimated_fee, estimated_shipping_cost")
        .in("order_id", targetOrderIds)
    : { data: [] };

  // Aggregate items dynamically per product (SKU / meli_item_id)
  const itemAggMap: Record<string, {
    meli_item_id: string;
    sku: string | null;
    title: string;
    unitsSold: number;
    revenue: number;
    cost: number;
    fee: number;
    shipping: number;
    thumbnail_url: string | null;
    product_id: string;
  }> = {};

  // First seed map with tenant products
  (dbProducts || []).forEach(p => {
    const key = (p.sku || p.meli_item_id || p.id).toLowerCase();
    itemAggMap[key] = {
      meli_item_id: p.meli_item_id || "",
      sku: p.sku || null,
      title: p.title || "Producto sin título",
      unitsSold: 0,
      revenue: 0,
      cost: Number(p.cost) || 0,
      fee: Number(p.estimated_fee) || (Number(p.price) * 0.14),
      shipping: Number(p.estimated_shipping_cost) || 0,
      thumbnail_url: p.thumbnail_url || null,
      product_id: p.id
    };
  });

  // Accumulate quantities and revenues from actual DB order items
  (orderItems || []).forEach(item => {
    const itemSkuKey = (item.sku || "").toLowerCase();
    const itemIdKey = (item.meli_item_id || "").toLowerCase();
    const itemKey = itemSkuKey || itemIdKey || item.order_id || "unknown";

    if (!itemAggMap[itemKey]) {
      itemAggMap[itemKey] = {
        meli_item_id: item.meli_item_id || "",
        sku: item.sku || null,
        title: item.title || "Producto",
        unitsSold: 0,
        revenue: 0,
        cost: Number(item.unit_cost) || 0,
        fee: Number(item.estimated_fee) || (Number(item.total_price) * 0.14),
        shipping: Number(item.estimated_shipping_cost) || 0,
        thumbnail_url: null,
        product_id: item.order_id
      };
    }

    const target = itemAggMap[itemKey];
    const qty = Number(item.quantity) || 1;
    const rev = Number(item.total_price) || 0;
    target.unitsSold += qty;
    target.revenue += rev;
  });

  // 6. Attempt live fetch from Mercado Libre Product ADS API if connected
  let liveAdsFetched = false;
  let liveCampaignsList: AdsCampaign[] = [];
  let apiTotalConsumedBudget = 0;
  let apiTotalRevenue = 0;

  if (meliAccount?.access_token && meliAccount?.meli_user_id) {
    try {
      const meliAdsRes = await meliFetch({
        tenantId,
        endpoint: `/advertising/product_ads/campaigns/search?user_id=${meliAccount.meli_user_id}`
      });

      if (meliAdsRes && (Array.isArray(meliAdsRes.results) || Array.isArray(meliAdsRes))) {
        const rawCampaigns = Array.isArray(meliAdsRes.results) ? meliAdsRes.results : meliAdsRes;
        if (rawCampaigns.length > 0) {
          liveCampaignsList = rawCampaigns.map((c: any) => {
            const consumed = Number(c.consumed_budget || c.metrics?.cost || 0);
            const rev = Number(c.revenue || c.metrics?.revenue || 0);
            apiTotalConsumedBudget += consumed;
            apiTotalRevenue += rev;
            return {
              id: c.id || `camp-${c.name}`,
              name: c.name || "Campaña Product ADS",
              status: c.status === "active" ? "active" : "paused",
              daily_budget: Number(c.budget || c.daily_budget || 0),
              consumed_budget: consumed,
              revenue: rev,
              acos: Number(c.acos || c.metrics?.acos || 0),
              roas: Number(c.roas || c.metrics?.roas || 0),
              net_profit: Math.round(rev - consumed)
            };
          });
          liveAdsFetched = true;
        }
      }
    } catch (e: any) {
      console.log("[getAdsData] Live MeLi Ads API endpoint pending scope authorization:", e?.message || e);
    }
  }

  // Calculate dynamic totals from aggregated tenant items
  const aggregatedItemsList = Object.values(itemAggMap);
  const totalTenantGrossRevenue = aggregatedItemsList.reduce((sum, i) => sum + i.revenue, 0);

  // Dynamic ad spend: if live API available use apiTotalConsumedBudget, otherwise compute based on 11.5% ACOS benchmark or tenant orders
  const totalAdsRevenueCalculated = liveAdsFetched && apiTotalRevenue > 0 ? apiTotalRevenue : totalTenantGrossRevenue;
  const totalAdsInvestmentCalculated = liveAdsFetched && apiTotalConsumedBudget > 0 ? apiTotalConsumedBudget : Math.round(totalAdsRevenueCalculated * 0.115);

  // Allocate ad investment proportionally across sold items
  const productAdsList: ProductAdsMetrics[] = aggregatedItemsList.map((item, idx) => {
    const price = item.unitsSold > 0 ? Math.round(item.revenue / item.unitsSold) : (item.revenue || 100000);
    const cost = item.cost;
    const fee = item.fee;
    const shipping = item.shipping;
    const unitsSold = item.unitsSold;
    const adsRevenue = item.revenue;

    // Proportionally allocate ad investment per product revenue share
    const revenueShare = totalAdsRevenueCalculated > 0 ? (adsRevenue / totalAdsRevenueCalculated) : (1 / Math.max(1, aggregatedItemsList.length));
    const adsInvestment = Math.round(totalAdsInvestmentCalculated * revenueShare);

    const clics = Math.round(adsInvestment / 210); // Estimated CPC ~$210 ARS
    const cpc = 210;

    const unitProductCost = cost;
    const unitMarginBeforeAds = price - unitProductCost - fee - shipping - packagingCost;
    const totalCleanProfit = Math.round((unitMarginBeforeAds * unitsSold) - adsInvestment);
    const cleanMarginPercent = adsRevenue > 0 ? Number(((totalCleanProfit / adsRevenue) * 100).toFixed(1)) : 0;
    const roas = adsInvestment > 0 ? Number((adsRevenue / adsInvestment).toFixed(2)) : 0;

    let status: "profitable" | "warning" | "loss" | "missing_cost" = "profitable";
    if (cost === null || cost <= 0) {
      status = "missing_cost";
    } else if (totalCleanProfit < 0) {
      status = "loss";
    } else if (cleanMarginPercent < 15) {
      status = "warning";
    }

    return {
      product_id: item.product_id || `ad-prod-${idx}`,
      meli_item_id: item.meli_item_id,
      title: item.title,
      sku: item.sku,
      thumbnail_url: item.thumbnail_url,
      price: Math.round(price),
      cost: cost > 0 ? Math.round(cost) : null,
      ads_units_sold: unitsSold,
      ads_revenue: adsRevenue,
      clics,
      cpc,
      roas,
      total_product_cost: Math.round(unitProductCost * unitsSold),
      total_fee_cost: Math.round(fee * unitsSold),
      total_shipping_cost: Math.round(shipping * unitsSold),
      total_packaging_cost: Math.round(packagingCost * unitsSold),
      ads_investment: adsInvestment,
      clean_net_profit: totalCleanProfit,
      clean_net_margin_percent: cleanMarginPercent,
      acos_percent: roas > 0 ? Number(((1 / roas) * 100).toFixed(1)) : 0,
      profitability_status: status
    };
  });

  // Calculate dynamic overall KPIs
  const totalCleanNetProfit = productAdsList.reduce((sum, item) => sum + item.clean_net_profit, 0);
  const averageAcos = totalAdsRevenueCalculated > 0 ? Number(((totalAdsInvestmentCalculated / totalAdsRevenueCalculated) * 100).toFixed(2)) : 0;
  const overallRoas = totalAdsInvestmentCalculated > 0 ? Number((totalAdsRevenueCalculated / totalAdsInvestmentCalculated).toFixed(2)) : 0;

  // Fallback campaigns list built dynamically for tenant if live API pending
  const campaignsList: AdsCampaign[] = liveAdsFetched ? liveCampaignsList : [
    {
      id: "camp-product-ads",
      name: "Campaña Product ADS",
      status: "active",
      daily_budget: Math.round(totalAdsInvestmentCalculated / 30) || 20000,
      consumed_budget: totalAdsInvestmentCalculated,
      revenue: totalAdsRevenueCalculated,
      acos: averageAcos,
      roas: overallRoas,
      net_profit: totalCleanNetProfit
    }
  ];

  return {
    period,
    periodLabel,
    campaigns: campaignsList,
    productAdsList,
    totalAdsInvestment: totalAdsInvestmentCalculated,
    totalAdsRevenue: totalAdsRevenueCalculated,
    totalCleanNetProfit,
    averageAcos,
    overallRoas,
    liveAdsAvailable: liveAdsFetched
  };
}
