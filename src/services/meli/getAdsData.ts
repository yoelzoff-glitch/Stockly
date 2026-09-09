import { createAdminClient } from "@/lib/supabase/admin";
import { isDemoTenant } from "@/lib/demo/assert-demo-write-allowed";
import { calculateRealProfitability } from "@/services/profitability/calculateRealProfitability";
import {
  AdsDataResult,
  AdsCampaignItem,
  ProductAdsMetrics,
  AdsAvailability,
  MeliAdsAdGroup,
  getProductAdsAdvertiser,
  getProductAdsCampaigns,
  getProductAdsAdGroups,
  getAdsDateRange,
  getCachedAdsData,
  setCachedAdsData,
  AdsAdvertiserError,
} from "./ads";
import { logger } from "@/lib/errors/logger";

// Export interfaces for backwards compatibility
export type { AdsCampaignItem as AdsCampaign, ProductAdsMetrics, AdsDataResult };

export async function getAdsData(tenantId: string, period: string = "30days"): Promise<AdsDataResult> {
  const supabase = createAdminClient();

  // 1. Check in-memory short cache (60s)
  const cached = getCachedAdsData<AdsDataResult>(tenantId, period);
  if (cached) {
    return cached;
  }

  // 2. Fetch tenant metadata
  const { data: tenantData } = await supabase
    .from("tenants")
    .select("metadata")
    .eq("id", tenantId)
    .maybeSingle();

  const tenantMetadata = (tenantData?.metadata as any) || {};
  const packagingCost = Number(tenantMetadata.packaging_cost) || 0;
  const timezone = tenantMetadata.timezone || "America/Argentina/Buenos_Aires";

  const { dateFrom, dateTo, dateFromString, dateToString, periodLabel } = getAdsDateRange(period, timezone);

  // 3. Demo Tenant Safety Handling
  if (await isDemoTenant(tenantId, supabase)) {
    const demoResult: AdsDataResult = {
      period,
      periodLabel,
      availability: {
        available: true,
      },
      advertiser: {
        advertiserId: 999999999,
        siteId: "MLA",
      },
      campaigns: [
        {
          id: "demo-camp-01",
          name: "Campaña Principal - Rentabilidad",
          status: "active",
          daily_budget: 15000,
          consumed_budget: 12400,
          revenue: 98500,
          acos: 12.59,
          roas: 7.94,
          impressions: 45200,
          clics: 1850,
          units_sold: 14,
          net_profit: 34200,
        },
        {
          id: "demo-camp-02",
          name: "Campaña Liquidación y Novedades",
          status: "active",
          daily_budget: 8000,
          consumed_budget: 6800,
          revenue: 38200,
          acos: 17.8,
          roas: 5.62,
          impressions: 18900,
          clics: 740,
          units_sold: 5,
          net_profit: 9100,
        },
      ],
      adGroups: [],
      productAdsList: [
        {
          product_id: "demo-p1",
          meli_item_id: "MLA900000001",
          title: "Auriculares Inalámbricos Bluetooth Pro",
          sku: "AUR-BT-PRO",
          thumbnail_url: "https://http2.mlstatic.com/D_NQ_NP_2X_841077-MLA44347821743_122020-F.webp",
          price: 24999,
          cost: 11000,
          ads_units_sold: 4,
          ads_revenue: 99996,
          clics: 320,
          cpc: 38.75,
          roas: 8.06,
          acos_percent: 12.4,
          total_product_cost: 44000,
          total_fee_cost: 13000,
          total_shipping_cost: 8000,
          total_packaging_cost: packagingCost * 4,
          ads_investment: 12400,
          clean_net_profit: 22596,
          clean_net_margin_percent: 22.6,
          profitability_status: "complete",
        },
      ],
      totals: {
        investment: 19200,
        revenue: 136700,
        cleanNetProfit: 43300,
        averageAcos: 14.05,
        overallRoas: 7.12,
      },
      totalAdsInvestment: 19200,
      totalAdsRevenue: 136700,
      totalCleanNetProfit: 43300,
      averageAcos: 14.05,
      overallRoas: 7.12,
      liveAdsAvailable: true,
    };

    return demoResult;
  }

  // 4. Fetch connected Meli Account
  const { data: meliAccount } = await supabase
    .from("meli_accounts")
    .select("id, meli_user_id, access_token, status")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!meliAccount || !meliAccount.access_token) {
    const emptyResult: AdsDataResult = {
      period,
      periodLabel,
      availability: {
        available: false,
        reason: "no_meli_account",
        message: "No hay una cuenta de Mercado Libre conectada para este tenant.",
      },
      advertiser: { advertiserId: null, siteId: null },
      campaigns: [],
      adGroups: [],
      productAdsList: [],
      totals: {
        investment: null,
        revenue: null,
        cleanNetProfit: null,
        averageAcos: null,
        overallRoas: null,
      },
      totalAdsInvestment: null,
      totalAdsRevenue: null,
      totalCleanNetProfit: null,
      averageAcos: null,
      overallRoas: null,
      liveAdsAvailable: false,
    };
    return emptyResult;
  }

  // 5. Fetch DB Products for tenant
  const { data: dbProducts } = await supabase
    .from("products")
    .select("id, meli_item_id, title, sku, price, cost, estimated_fee, extra_fee_amount, estimated_shipping_cost, promotion_discount_amount, estimated_tax, thumbnail_url")
    .eq("tenant_id", tenantId);

  const tenantProducts = dbProducts || [];

  // 6. Obtain Advertiser and Site ID (No fallback to meli_user_id!)
  let advertiserId: number | null = null;
  let siteId: string | null = null;
  let availability: AdsAvailability = { available: true };

  try {
    const advInfo = await getProductAdsAdvertiser(tenantId);
    advertiserId = advInfo.advertiserId;
    siteId = advInfo.siteId;
  } catch (err: any) {
    const reason = err instanceof AdsAdvertiserError ? err.reason : "advertiser_not_available";
    availability = {
      available: false,
      reason,
      message: err.message || "No se pudo obtener información del anunciante de Mercado Libre.",
    };

    logger.warn({
      event: "MELI_ADS_UNAVAILABLE",
      tenantId,
      reason,
      message: err.message,
    });

    const unavailableResult: AdsDataResult = {
      period,
      periodLabel,
      availability,
      advertiser: { advertiserId: null, siteId: null },
      campaigns: [],
      adGroups: [],
      productAdsList: [],
      totals: {
        investment: null,
        revenue: null,
        cleanNetProfit: null,
        averageAcos: null,
        overallRoas: null,
      },
      totalAdsInvestment: null,
      totalAdsRevenue: null,
      totalCleanNetProfit: null,
      averageAcos: null,
      overallRoas: null,
      liveAdsAvailable: false,
    };

    setCachedAdsData(tenantId, period, unavailableResult, 30000);
    return unavailableResult;
  }

  // 7. Fetch Campaigns & Ad Groups via API v2
  let rawCampaigns: any[] = [];
  let rawAdGroups: MeliAdsAdGroup[] = [];

  try {
    rawCampaigns = await getProductAdsCampaigns({
      tenantId,
      siteId,
      advertiserId,
      dateFrom: dateFromString,
      dateTo: dateToString,
    });
  } catch (campErr: any) {
    logger.error({
      event: "MELI_ADS_CAMPAIGNS_ERROR",
      tenantId,
      siteId,
      advertiserId,
      error: campErr?.message,
    });
    // If campaigns fail, mark availability as network/external error
    availability = {
      available: false,
      reason: campErr?.statusCode === 403 ? "advertising_permission_missing" : "network_error",
      message: campErr?.message || "Error al obtener campañas de Product Ads.",
    };
  }

  if (availability.available) {
    try {
      rawAdGroups = await getProductAdsAdGroups({
        tenantId,
        siteId,
        advertiserId,
        dateFrom: dateFromString,
        dateTo: dateToString,
      });
    } catch (adGroupErr: any) {
      logger.error({
        event: "MELI_ADS_ADGROUPS_ERROR",
        tenantId,
        siteId,
        advertiserId,
        error: adGroupErr?.message,
      });
      // Soft-fail ad groups if campaigns succeeded, but log error
    }
  }

  // 8. Map Campaigns to UI representation
  const campaignsList: AdsCampaignItem[] = rawCampaigns.map((c) => {
    const consumed = c.consumed_budget !== undefined && c.consumed_budget !== null ? Number(c.consumed_budget) : (c.metrics?.cost ?? null);
    const rev = c.metrics?.totalAmount !== undefined && c.metrics?.totalAmount !== null ? Number(c.metrics.totalAmount) : (c.revenue ?? null);

    const roas = c.metrics?.roas ?? ((rev !== null && consumed !== null && consumed > 0) ? Number((rev / consumed).toFixed(2)) : null);
    const acos = c.metrics?.acos ?? ((rev !== null && rev > 0 && consumed !== null) ? Number(((consumed / rev) * 100).toFixed(2)) : null);

    return {
      id: String(c.id),
      name: String(c.name || `Campaña ${c.id}`),
      status: c.status === "active" ? "active" : "paused",
      daily_budget: c.daily_budget !== undefined ? c.daily_budget : (c.budget !== undefined ? c.budget : null),
      consumed_budget: consumed,
      revenue: rev,
      acos,
      roas,
      impressions: c.metrics?.impressions ?? null,
      clics: c.metrics?.clicks ?? null,
      units_sold: c.metrics?.unitsQuantity ?? null,
      net_profit: (rev !== null && consumed !== null) ? Math.round(rev - consumed) : null,
    };
  });

  // 9. Match Ad Groups to Local DB Products (meli_item_id -> SKU -> no match)
  const productAdsMap: Map<string, ProductAdsMetrics> = new Map();

  for (const ag of rawAdGroups) {
    const itemIds = ag.item_ids && ag.item_ids.length > 0 ? ag.item_ids : (ag.item_id ? [ag.item_id] : []);
    const m = ag.metrics || {};

    const agCost = m.cost !== null && m.cost !== undefined ? Number(m.cost) : 0;
    const agRevenue = m.totalAmount !== null && m.totalAmount !== undefined ? Number(m.totalAmount) : (m.directAmount !== null && m.directAmount !== undefined ? Number(m.directAmount) : 0);
    const agClicks = m.clicks !== null && m.clicks !== undefined ? Number(m.clicks) : null;
    const agUnits = m.unitsQuantity !== null && m.unitsQuantity !== undefined ? Number(m.unitsQuantity) : (agRevenue > 0 ? 1 : 0);

    for (const itemId of itemIds) {
      const cleanItemId = String(itemId).trim();
      const itemIdLower = cleanItemId.toLowerCase();

      // Priority 1: Match by meli_item_id
      let dbMatch = tenantProducts.find(
        (p) => p.meli_item_id && p.meli_item_id.trim().toLowerCase() === itemIdLower
      );

      // Priority 2: Match by SKU (if ad group has SKU field or item id is sku)
      if (!dbMatch && ag.sku) {
        const skuLower = String(ag.sku).trim().toLowerCase();
        dbMatch = tenantProducts.find(
          (p) => p.sku && p.sku.trim().toLowerCase() === skuLower
        );
      }

      const productKey = dbMatch?.id || cleanItemId;
      const unitPrice = dbMatch?.price
        ? Number(dbMatch.price)
        : (agUnits > 0 && agRevenue > 0 ? Math.round(agRevenue / agUnits) : 0);

      const profitInput = {
        price: unitPrice,
        cost: dbMatch?.cost !== null && dbMatch?.cost !== undefined ? Number(dbMatch.cost) : null,
        estimated_fee: dbMatch?.estimated_fee !== null && dbMatch?.estimated_fee !== undefined ? Number(dbMatch.estimated_fee) : null,
        extra_fee_amount: dbMatch?.extra_fee_amount !== null && dbMatch?.extra_fee_amount !== undefined ? Number(dbMatch.extra_fee_amount) : null,
        estimated_shipping_cost: dbMatch?.estimated_shipping_cost !== null && dbMatch?.estimated_shipping_cost !== undefined ? Number(dbMatch.estimated_shipping_cost) : null,
        promotion_discount_amount: dbMatch?.promotion_discount_amount !== null && dbMatch?.promotion_discount_amount !== undefined ? Number(dbMatch.promotion_discount_amount) : null,
        estimated_tax: dbMatch?.estimated_tax !== null && dbMatch?.estimated_tax !== undefined ? Number(dbMatch.estimated_tax) : null,
        packaging_cost: packagingCost,
      };

      const realProfitRes = calculateRealProfitability(profitInput);

      let cleanNetProfit: number | null = null;
      let cleanNetMarginPercent: number | null = null;

      if (realProfitRes.profitability_status === "complete" && realProfitRes.real_margin_amount !== null) {
        const totalUnitCosts =
          (profitInput.cost || 0) +
          (profitInput.estimated_fee || 0) +
          (profitInput.extra_fee_amount || 0) +
          (profitInput.estimated_shipping_cost || 0) +
          (profitInput.promotion_discount_amount || 0) +
          (profitInput.estimated_tax || 0) +
          packagingCost;

        const unitsForCalc = Math.max(1, agUnits);
        const grossMarginForUnits = (unitPrice * unitsForCalc) - (totalUnitCosts * unitsForCalc);
        cleanNetProfit = Math.round(grossMarginForUnits - agCost);
        cleanNetMarginPercent = agRevenue > 0 ? Number(((cleanNetProfit / agRevenue) * 100).toFixed(1)) : 0;
      }

      const roas = (agCost > 0 && agRevenue > 0) ? Number((agRevenue / agCost).toFixed(2)) : (m.roas ?? null);
      const acos = (agRevenue > 0 && agCost >= 0) ? Number(((agCost / agRevenue) * 100).toFixed(1)) : (m.acos ?? null);

      const existing = productAdsMap.get(productKey);
      if (existing) {
        // Aggregate if multiple ad groups point to the same product
        existing.ads_units_sold += agUnits;
        existing.ads_revenue += agRevenue;
        existing.ads_investment += agCost;
        if (agClicks !== null) existing.clics = (existing.clics || 0) + agClicks;
        existing.cpc = existing.clics && existing.clics > 0 ? Number((existing.ads_investment / existing.clics).toFixed(2)) : null;
        existing.roas = existing.ads_investment > 0 ? Number((existing.ads_revenue / existing.ads_investment).toFixed(2)) : null;
        existing.acos_percent = existing.ads_revenue > 0 ? Number(((existing.ads_investment / existing.ads_revenue) * 100).toFixed(1)) : null;
        if (cleanNetProfit !== null && existing.clean_net_profit !== null) {
          existing.clean_net_profit += cleanNetProfit;
          existing.clean_net_margin_percent = existing.ads_revenue > 0 ? Number(((existing.clean_net_profit / existing.ads_revenue) * 100).toFixed(1)) : 0;
        }
      } else {
        productAdsMap.set(productKey, {
          product_id: dbMatch?.id || `ad-item-${cleanItemId}`,
          meli_item_id: cleanItemId,
          title: dbMatch?.title || ag.name || `Publicación ${cleanItemId}`,
          sku: dbMatch?.sku || null,
          thumbnail_url: dbMatch?.thumbnail_url || null,
          price: unitPrice,
          cost: profitInput.cost !== null ? Math.round(profitInput.cost) : null,
          ads_units_sold: agUnits,
          ads_revenue: agRevenue,
          clics: agClicks,
          cpc: agClicks && agClicks > 0 && agCost > 0 ? Number((agCost / agClicks).toFixed(2)) : (m.cpc ?? null),
          roas,
          acos_percent: acos,
          total_product_cost: profitInput.cost !== null ? Math.round(profitInput.cost * Math.max(1, agUnits)) : null,
          total_fee_cost: profitInput.estimated_fee !== null ? Math.round(profitInput.estimated_fee * Math.max(1, agUnits)) : null,
          total_shipping_cost: profitInput.estimated_shipping_cost !== null ? Math.round(profitInput.estimated_shipping_cost * Math.max(1, agUnits)) : null,
          total_packaging_cost: packagingCost > 0 ? Math.round(packagingCost * Math.max(1, agUnits)) : 0,
          ads_investment: agCost,
          clean_net_profit: cleanNetProfit,
          clean_net_margin_percent: cleanNetMarginPercent,
          profitability_status: realProfitRes.profitability_status,
        });
      }
    }
  }

  const productAdsList = Array.from(productAdsMap.values());

  // 10. Compute Real Totals (Strictly NO invented percentages!)
  let totalInvestment: number | null = null;
  let totalRevenue: number | null = null;

  const validCampaignCosts = campaignsList.map((c) => c.consumed_budget).filter((v): v is number => v !== null && !isNaN(v));
  if (validCampaignCosts.length > 0) {
    totalInvestment = validCampaignCosts.reduce((acc, v) => acc + v, 0);
  } else if (productAdsList.length > 0) {
    totalInvestment = productAdsList.reduce((acc, p) => acc + p.ads_investment, 0);
  }

  const validCampaignRevenues = campaignsList.map((c) => c.revenue).filter((v): v is number => v !== null && !isNaN(v));
  if (validCampaignRevenues.length > 0) {
    totalRevenue = validCampaignRevenues.reduce((acc, v) => acc + v, 0);
  } else if (productAdsList.length > 0) {
    totalRevenue = productAdsList.reduce((acc, p) => acc + p.ads_revenue, 0);
  }

  const completeProfits = productAdsList.filter((p) => p.clean_net_profit !== null);
  const totalCleanNetProfit = completeProfits.length > 0
    ? completeProfits.reduce((sum, item) => sum + (item.clean_net_profit || 0), 0)
    : null;

  const overallRoas = (totalInvestment !== null && totalInvestment > 0 && totalRevenue !== null)
    ? Number((totalRevenue / totalInvestment).toFixed(2))
    : null;

  const averageAcos = (totalRevenue !== null && totalRevenue > 0 && totalInvestment !== null)
    ? Number(((totalInvestment / totalRevenue) * 100).toFixed(2))
    : null;

  const result: AdsDataResult = {
    period,
    periodLabel,
    availability,
    advertiser: {
      advertiserId,
      siteId,
    },
    campaigns: campaignsList,
    adGroups: rawAdGroups,
    productAdsList,
    totals: {
      investment: totalInvestment,
      revenue: totalRevenue,
      cleanNetProfit: totalCleanNetProfit,
      averageAcos,
      overallRoas,
    },
    totalAdsInvestment: totalInvestment,
    totalAdsRevenue: totalRevenue,
    totalCleanNetProfit,
    averageAcos,
    overallRoas,
    liveAdsAvailable: availability.available && (campaignsList.length > 0 || rawAdGroups.length > 0),
  };

  // Cache for 60 seconds
  setCachedAdsData(tenantId, period, result, 60000);

  return result;
}
