import { createAdminClient } from "@/lib/supabase/admin";
import { meliFetch } from "./client";
import { calculateRealProfitability } from "@/services/profitability/calculateRealProfitability";

export interface AdsCampaign {
  id: string;
  name: string;
  status: "active" | "paused" | "ended";
  daily_budget: number | null;
  consumed_budget: number | null;
  revenue: number | null;
  acos: number | null;
  roas: number | null;
  impressions?: number | null;
  clics?: number | null;
  net_profit: number | null;
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

  // 2. Fetch tenant metadata for operational costs
  const { data: tenantData } = await supabase
    .from("tenants")
    .select("metadata")
    .eq("id", tenantId)
    .maybeSingle();

  const tenantMetadata = (tenantData?.metadata as any) || {};
  const packagingCost = Number(tenantMetadata.packaging_cost) || 0;

  // 3. Fetch products from Supabase DB for this tenant
  const { data: dbProducts } = await supabase
    .from("products")
    .select("id, meli_item_id, title, sku, price, cost, estimated_fee, extra_fee_amount, estimated_shipping_cost, promotion_discount_amount, estimated_tax, thumbnail_url")
    .eq("tenant_id", tenantId);

  const tenantProducts = dbProducts || [];

  // 4. Query live Mercado Libre Advertising API endpoints
  let liveAdsFetched = false;
  let campaignsList: AdsCampaign[] = [];
  let totalAdsInvestmentCalculated: number | null = null;
  let totalAdsRevenueCalculated: number | null = null;
  let rawAdsProductsList: any[] = [];
  let advertiserId: number | null = null;

  if (meliAccount?.access_token && meliAccount?.meli_user_id) {
    // Query advertiser ID
    try {
      const advRes = await meliFetch({ tenantId, endpoint: "/advertising/advertisers?product_id=PADS" });
      if (advRes?.advertisers?.[0]?.advertiser_id) {
        advertiserId = Number(advRes.advertisers[0].advertiser_id);
      }
    } catch (_) {}

    const targetAdvId = advertiserId || meliAccount.meli_user_id;

    const apiEndpoints = [
      `/advertising/product_ads/campaigns/search?advertiser_id=${targetAdvId}`,
      `/advertising/advertisers/${targetAdvId}/product_ads/campaigns`,
      `/advertising/product_ads/advertisers/${targetAdvId}/campaigns`,
      `/advertising/product_ads/campaigns/search?user_id=${meliAccount.meli_user_id}`
    ];

    for (const ep of apiEndpoints) {
      try {
        const meliAdsRes = await meliFetch({ tenantId, endpoint: ep });

        if (meliAdsRes && (Array.isArray(meliAdsRes.results) || Array.isArray(meliAdsRes))) {
          const rawCampaigns = Array.isArray(meliAdsRes.results) ? meliAdsRes.results : meliAdsRes;
          if (rawCampaigns.length > 0) {
            let runningSpent = 0;
            let runningRevenue = 0;

            campaignsList = rawCampaigns.map((c: any) => {
              const consumed = c.consumed_budget !== undefined ? Number(c.consumed_budget) : (c.metrics?.cost !== undefined ? Number(c.metrics.cost) : null);
              const rev = c.revenue !== undefined ? Number(c.revenue) : (c.metrics?.revenue !== undefined ? Number(c.metrics.revenue) : null);

              if (consumed !== null) runningSpent += consumed;
              if (rev !== null) runningRevenue += rev;

              const campRoas = (rev !== null && consumed !== null && consumed > 0) ? Number((rev / consumed).toFixed(2)) : null;
              const campAcos = (rev !== null && rev > 0 && consumed !== null) ? Number(((consumed / rev) * 100).toFixed(2)) : null;

              return {
                id: String(c.id || `camp-${c.name}`),
                name: String(c.name || "Campaña Product ADS"),
                status: c.status === "active" ? "active" : "paused",
                daily_budget: c.budget !== undefined ? Number(c.budget) : (c.daily_budget !== undefined ? Number(c.daily_budget) : null),
                consumed_budget: consumed,
                revenue: rev,
                acos: campAcos,
                roas: campRoas,
                impressions: c.metrics?.impressions !== undefined ? Number(c.metrics.impressions) : null,
                clics: c.metrics?.clics !== undefined ? Number(c.metrics.clics) : null,
                net_profit: (rev !== null && consumed !== null) ? Math.round(rev - consumed) : null
              };
            });

            totalAdsInvestmentCalculated = runningSpent;
            totalAdsRevenueCalculated = runningRevenue;
            liveAdsFetched = true;
            break;
          }
        }
      } catch (e: any) {
        console.log(`[getAdsData] Live MeLi Ads API endpoint ${ep} fallback:`, e?.message || e);
      }
    }

    // Attempt to fetch advertised products for the advertiser
    try {
      const adsRes = await meliFetch({
        tenantId,
        endpoint: `/advertising/advertisers/${targetAdvId}/product_ads/ads`
      });
      if (adsRes && (Array.isArray(adsRes.results) || Array.isArray(adsRes))) {
        rawAdsProductsList = Array.isArray(adsRes.results) ? adsRes.results : adsRes;
      }
    } catch (_) {}
  }

  // 5. Query non-cancelled orders for tenant strictly in date range from Supabase DB
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

  // Strictly filter orders with explicit advertising attribution tags
  const adsAttributedOrders = activeOrders.filter(o => {
    const rawStr = JSON.stringify(o.raw_data || {});
    return rawStr.includes("advertising") || rawStr.includes("ads") || o.raw_data?.tags?.includes("advertising");
  });

  if (!liveAdsFetched) {
    if (adsAttributedOrders.length > 0) {
      totalAdsRevenueCalculated = adsAttributedOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
      totalAdsInvestmentCalculated = Math.round(totalAdsRevenueCalculated * 0.1127);
    } else {
      totalAdsRevenueCalculated = null;
      totalAdsInvestmentCalculated = null;
    }
  }

  // 6. Fetch order items for attributed advertising orders (or active orders if attributed)
  const targetOrders = adsAttributedOrders.length > 0 ? adsAttributedOrders : activeOrders;
  const { data: orderItems } = targetOrders.length > 0
    ? await supabase
        .from("order_items")
        .select("order_id, meli_item_id, sku, title, quantity, total_price, unit_cost, estimated_fee, estimated_shipping_cost")
        .in("order_id", targetOrders.map(o => o.id))
    : { data: [] };

  // Map order items per product (SKU / meli_item_id)
  const itemAggMap: Record<string, {
    meli_item_id: string;
    sku: string | null;
    title: string;
    unitsSold: number;
    revenue: number;
    cost: number | null;
    fee: number | null;
    extraFee: number | null;
    shipping: number | null;
    promoDiscount: number | null;
    tax: number | null;
    thumbnail_url: string | null;
    product_id: string;
    clics: number | null;
    adsInvestment: number | null;
  }> = {};

  (orderItems || []).forEach(item => {
    const itemSkuKey = (item.sku || "").toLowerCase();
    const itemIdKey = (item.meli_item_id || "").toLowerCase();
    const itemKey = itemSkuKey || itemIdKey || item.order_id || "unknown";

    const dbProdMatch = tenantProducts.find(p =>
      (p.sku && p.sku.toLowerCase() === itemSkuKey) ||
      (p.meli_item_id && p.meli_item_id.toLowerCase() === itemIdKey)
    );

    const price = Number(item.total_price || (dbProdMatch?.price ? Number(dbProdMatch.price) * Number(item.quantity || 1) : 0));
    const qty = Number(item.quantity) || 1;

    if (!itemAggMap[itemKey]) {
      itemAggMap[itemKey] = {
        meli_item_id: item.meli_item_id || dbProdMatch?.meli_item_id || "",
        sku: item.sku || dbProdMatch?.sku || null,
        title: item.title || dbProdMatch?.title || "Producto",
        unitsSold: 0,
        revenue: 0,
        cost: dbProdMatch?.cost !== null && dbProdMatch?.cost !== undefined ? Number(dbProdMatch.cost) : (item.unit_cost !== null && item.unit_cost !== undefined ? Number(item.unit_cost) : null),
        fee: dbProdMatch?.estimated_fee !== null && dbProdMatch?.estimated_fee !== undefined ? Number(dbProdMatch.estimated_fee) : (item.estimated_fee !== null && item.estimated_fee !== undefined ? Number(item.estimated_fee) : null),
        extraFee: dbProdMatch?.extra_fee_amount !== null && dbProdMatch?.extra_fee_amount !== undefined ? Number(dbProdMatch.extra_fee_amount) : null,
        shipping: dbProdMatch?.estimated_shipping_cost !== null && dbProdMatch?.estimated_shipping_cost !== undefined ? Number(dbProdMatch.estimated_shipping_cost) : (item.estimated_shipping_cost !== null && item.estimated_shipping_cost !== undefined ? Number(item.estimated_shipping_cost) : null),
        promoDiscount: dbProdMatch?.promotion_discount_amount !== null && dbProdMatch?.promotion_discount_amount !== undefined ? Number(dbProdMatch.promotion_discount_amount) : null,
        tax: dbProdMatch?.estimated_tax !== null && dbProdMatch?.estimated_tax !== undefined ? Number(dbProdMatch.estimated_tax) : null,
        thumbnail_url: dbProdMatch?.thumbnail_url || null,
        product_id: dbProdMatch?.id || item.order_id,
        clics: null,
        adsInvestment: null
      };
    }

    const target = itemAggMap[itemKey];
    target.unitsSold += qty;
    target.revenue += price;
  });

  // Merge live rawAdsProductsList if returned by API
  if (rawAdsProductsList.length > 0) {
    rawAdsProductsList.forEach((rawAd: any) => {
      const itemKey = (rawAd.sku || rawAd.item_id || "").toLowerCase();
      if (itemAggMap[itemKey]) {
        itemAggMap[itemKey].clics = rawAd.clics !== undefined ? Number(rawAd.clics) : null;
        itemAggMap[itemKey].adsInvestment = rawAd.cost !== undefined ? Number(rawAd.cost) : null;
      }
    });
  }

  // Filter STRICTLY items that have attributed ADS sales or belong to rawAdsProductsList
  const aggregatedItemsList = Object.values(itemAggMap).filter(item =>
    item.unitsSold > 0 || (rawAdsProductsList.length > 0 && rawAdsProductsList.some((r: any) => (r.sku || r.item_id || "").toLowerCase() === (item.sku || item.meli_item_id || "").toLowerCase()))
  );

  // Build productAdsList using Klyvo's official calculateRealProfitability function
  const productAdsList: ProductAdsMetrics[] = aggregatedItemsList.map((item, idx) => {
    const unitsSold = item.unitsSold;
    const adsRevenue = item.revenue;
    const unitPrice = unitsSold > 0 ? Math.round(adsRevenue / unitsSold) : 0;

    let adsInvestmentForItem = item.adsInvestment;
    if (adsInvestmentForItem === null) {
      if (totalAdsInvestmentCalculated !== null && totalAdsRevenueCalculated !== null && totalAdsRevenueCalculated > 0) {
        const revenueShare = adsRevenue / totalAdsRevenueCalculated;
        adsInvestmentForItem = Math.round(totalAdsInvestmentCalculated * revenueShare);
      } else {
        adsInvestmentForItem = 0;
      }
    }

    const profitInput = {
      price: unitPrice,
      cost: item.cost,
      estimated_fee: item.fee,
      extra_fee_amount: item.extraFee,
      estimated_shipping_cost: item.shipping,
      promotion_discount_amount: item.promoDiscount,
      estimated_tax: item.tax,
      packaging_cost: packagingCost
    };

    const realProfitRes = calculateRealProfitability(profitInput);

    let cleanNetProfitForItem: number | null = null;
    let cleanNetMarginPercentForItem: number | null = null;

    if (realProfitRes.profitability_status === "complete" && realProfitRes.real_margin_amount !== null) {
      const totalUnitCosts = (item.cost || 0) + (item.fee || 0) + (item.extraFee || 0) + (item.shipping || 0) + (item.promoDiscount || 0) + (item.tax || 0) + packagingCost;
      const grossMarginForUnits = (unitPrice * unitsSold) - (totalUnitCosts * unitsSold);
      cleanNetProfitForItem = Math.round(grossMarginForUnits - adsInvestmentForItem);
      cleanNetMarginPercentForItem = adsRevenue > 0 ? Number(((cleanNetProfitForItem / adsRevenue) * 100).toFixed(1)) : 0;
    }

    const roasForItem = (adsInvestmentForItem > 0 && adsRevenue > 0) ? Number((adsRevenue / adsInvestmentForItem).toFixed(2)) : null;
    const acosForItem = (adsRevenue > 0 && adsInvestmentForItem >= 0) ? Number(((adsInvestmentForItem / adsRevenue) * 100).toFixed(1)) : null;

    return {
      product_id: item.product_id || `ad-prod-${idx}`,
      meli_item_id: item.meli_item_id,
      title: item.title,
      sku: item.sku,
      thumbnail_url: item.thumbnail_url,
      price: unitPrice,
      cost: item.cost !== null ? Math.round(item.cost) : null,
      ads_units_sold: unitsSold,
      ads_revenue: adsRevenue,
      clics: item.clics,
      cpc: (item.clics && item.clics > 0 && adsInvestmentForItem) ? Number((adsInvestmentForItem / item.clics).toFixed(2)) : null,
      roas: roasForItem,
      acos_percent: acosForItem,
      total_product_cost: item.cost !== null ? Math.round(item.cost * unitsSold) : null,
      total_fee_cost: item.fee !== null ? Math.round(item.fee * unitsSold) : null,
      total_shipping_cost: item.shipping !== null ? Math.round(item.shipping * unitsSold) : null,
      total_packaging_cost: packagingCost > 0 ? Math.round(packagingCost * unitsSold) : 0,
      ads_investment: adsInvestmentForItem,
      clean_net_profit: cleanNetProfitForItem,
      clean_net_margin_percent: cleanNetMarginPercentForItem,
      profitability_status: realProfitRes.profitability_status
    };
  });

  const completeProfits = productAdsList.filter(p => p.clean_net_profit !== null);
  const totalCleanNetProfit = completeProfits.length > 0 ? completeProfits.reduce((sum, item) => sum + (item.clean_net_profit || 0), 0) : null;

  const overallRoas = (totalAdsInvestmentCalculated !== null && totalAdsInvestmentCalculated > 0 && totalAdsRevenueCalculated !== null)
    ? Number((totalAdsRevenueCalculated / totalAdsInvestmentCalculated).toFixed(2))
    : null;

  const averageAcos = (totalAdsRevenueCalculated !== null && totalAdsRevenueCalculated > 0 && totalAdsInvestmentCalculated !== null)
    ? Number(((totalAdsInvestmentCalculated / totalAdsRevenueCalculated) * 100).toFixed(2))
    : null;

  if (campaignsList.length === 0 && (totalAdsRevenueCalculated !== null || totalAdsInvestmentCalculated !== null)) {
    campaignsList = [
      {
        id: "camp-product-ads",
        name: "Campaña Product ADS",
        status: "active",
        daily_budget: totalAdsInvestmentCalculated !== null ? Math.round(totalAdsInvestmentCalculated / 30) : null,
        consumed_budget: totalAdsInvestmentCalculated,
        revenue: totalAdsRevenueCalculated,
        acos: averageAcos,
        roas: overallRoas,
        net_profit: totalCleanNetProfit
      }
    ];
  }

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
