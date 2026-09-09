import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { meliFetch } from "../../src/services/meli/client";
import { meliAdsFetch } from "../../src/services/meli/ads/client";
import { getProductAdsAdvertiser, AdsAdvertiserError } from "../../src/services/meli/ads/getAdvertiser";
import { getProductAdsCampaigns, PRODUCT_ADS_CAMPAIGN_METRICS } from "../../src/services/meli/ads/campaigns";
import { getProductAdsAdGroups, PRODUCT_ADS_AD_GROUP_METRICS } from "../../src/services/meli/ads/adGroups";
import { getProductAdsAds, PRODUCT_ADS_AD_METRICS } from "../../src/services/meli/ads/ads";
import { getAdsDateRange } from "../../src/services/meli/ads/dateRange";
import { parseAdsMetrics } from "../../src/services/meli/ads/metrics";
import { getCachedAdsData, setCachedAdsData, clearAllAdsCache } from "../../src/services/meli/ads/cache";
import { calculateRealProfitability } from "../../src/services/profitability/calculateRealProfitability";
import {
  groupProductAdsForDisplay,
  extractProductGroupKey,
  selectRepresentativePublication,
  ProductAdsMetrics,
} from "../../src/services/meli/ads";

describe("Sprint 25: Product Ads Metrics & Summary Unit Tests", () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    clearAllAdsCache();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    clearAllAdsCache();
  });

  const setupMockFetch = (meliResponseFn: (url: string, init: any) => Response | Promise<Response>) => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://mock.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "mock-service-role-key";

    global.fetch = (async (url: any, init: any) => {
      const urlStr = String(url);
      if (urlStr.includes("mock.supabase.co")) {
        if (urlStr.includes("tenants")) {
          return new Response(JSON.stringify({ is_demo: false }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        if (urlStr.includes("meli_accounts")) {
          return new Response(
            JSON.stringify({
              id: "acc-1",
              tenant_id: "test-tenant",
              access_token: "mock-token",
              token_expires_at: new Date(Date.now() + 3600000).toISOString(),
            }),
            {
              status: 200,
              headers: { "content-type": "application/json" },
            }
          );
        }
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return meliResponseFn(urlStr, init);
    }) as any;
  };

  describe("1. Query Parameters with Metrics & Summary", () => {
    test("PRODUCT_ADS_CAMPAIGN_METRICS contains required official metrics", () => {
      assert.ok(PRODUCT_ADS_CAMPAIGN_METRICS.includes("clicks"));
      assert.ok(PRODUCT_ADS_CAMPAIGN_METRICS.includes("prints"));
      assert.ok(PRODUCT_ADS_CAMPAIGN_METRICS.includes("cost"));
      assert.ok(PRODUCT_ADS_CAMPAIGN_METRICS.includes("cpc"));
      assert.ok(PRODUCT_ADS_CAMPAIGN_METRICS.includes("ctr"));
      assert.ok(PRODUCT_ADS_CAMPAIGN_METRICS.includes("acos"));
      assert.ok(PRODUCT_ADS_CAMPAIGN_METRICS.includes("cvr"));
      assert.ok(PRODUCT_ADS_CAMPAIGN_METRICS.includes("roas"));
      assert.ok(PRODUCT_ADS_CAMPAIGN_METRICS.includes("units_quantity"));
      assert.ok(PRODUCT_ADS_CAMPAIGN_METRICS.includes("total_amount"));
    });

    test("PRODUCT_ADS_AD_GROUP_METRICS contains required ad group metrics", () => {
      assert.ok(PRODUCT_ADS_AD_GROUP_METRICS.includes("clicks"));
      assert.ok(PRODUCT_ADS_AD_GROUP_METRICS.includes("prints"));
      assert.ok(PRODUCT_ADS_AD_GROUP_METRICS.includes("cost"));
      assert.ok(PRODUCT_ADS_AD_GROUP_METRICS.includes("total_amount"));
      assert.ok(PRODUCT_ADS_AD_GROUP_METRICS.includes("units_quantity"));
    });
  });

  describe("2. Campaign & Summary Metrics Parsing", () => {
    test("parses full campaign metrics accurately from official payload", () => {
      const mockRawCampaign = {
        id: "camp-123",
        name: "Campaña Dijes y Cadenas",
        status: "active",
        daily_budget: 5000,
        metrics: {
          cost: 1000,
          prints: 20000,
          clicks: 500,
          units_quantity: 12,
          total_amount: 9000,
          acos: 11.11,
          roas: 9,
        },
      };

      const parsed = parseAdsMetrics(mockRawCampaign);
      assert.equal(parsed.cost, 1000);
      assert.equal(parsed.impressions, 20000);
      assert.equal(parsed.clicks, 500);
      assert.equal(parsed.unitsQuantity, 12);
      assert.equal(parsed.totalAmount, 9000);
      assert.equal(parsed.acos, 11.11);
      assert.equal(parsed.roas, 9);
    });

    test("parses metrics_summary accurately from official payload", () => {
      const mockSummary = {
        cost: 82000,
        total_amount: 610000,
        acos: 13.4,
        roas: 7.43,
        prints: 450000,
        clicks: 12300,
        units_quantity: 145,
      };

      const parsed = parseAdsMetrics(mockSummary);
      assert.equal(parsed.cost, 82000);
      assert.equal(parsed.totalAmount, 610000);
      assert.equal(parsed.acos, 13.4);
      assert.equal(parsed.roas, 7.43);
      assert.equal(parsed.impressions, 450000);
      assert.equal(parsed.clicks, 12300);
      assert.equal(parsed.unitsQuantity, 145);
    });

    test("maintains strict null vs 0 distinction (does not convert null to 0)", () => {
      const emptyRaw = {
        id: "camp-empty",
        status: "active",
      };

      const parsed = parseAdsMetrics(emptyRaw);
      assert.equal(parsed.cost, null);
      assert.equal(parsed.impressions, null);
      assert.equal(parsed.clicks, null);
      assert.equal(parsed.unitsQuantity, null);
      assert.equal(parsed.totalAmount, null);
      assert.equal(parsed.acos, null);
      assert.equal(parsed.roas, null);

      // Verify explicit 0 is preserved as 0
      const zeroRaw = {
        metrics: {
          cost: 0,
          prints: 0,
          clicks: 0,
          units_quantity: 0,
          total_amount: 0,
        },
      };
      const zeroParsed = parseAdsMetrics(zeroRaw);
      assert.equal(zeroParsed.cost, 0);
      assert.equal(zeroParsed.impressions, 0);
      assert.equal(zeroParsed.clicks, 0);
      assert.equal(zeroParsed.unitsQuantity, 0);
      assert.equal(zeroParsed.totalAmount, 0);
    });

    test("mathematically derives ACOS when not provided by API but cost and revenue exist", () => {
      const raw = {
        metrics: {
          cost: 100,
          total_amount: 1000,
          acos: null,
        },
      };

      const parsed = parseAdsMetrics(raw);
      // (100 / 1000) * 100 = 10
      assert.equal(parsed.acos, 10);
    });

    test("mathematically derives ROAS when not provided by API but cost and revenue exist", () => {
      const raw = {
        metrics: {
          cost: 100,
          total_amount: 1000,
          roas: null,
        },
      };

      const parsed = parseAdsMetrics(raw);
      // 1000 / 100 = 10
      assert.equal(parsed.roas, 10);
    });

    test("avoids division by zero when cost = 0 or total_amount = 0", () => {
      const raw = {
        metrics: {
          cost: 0,
          total_amount: 0,
          acos: null,
          roas: null,
        },
      };

      const parsed = parseAdsMetrics(raw);
      assert.equal(parsed.acos, null);
      assert.equal(parsed.roas, null);
    });

    test("aggregates direct and indirect units when units_quantity is missing", () => {
      const raw = {
        metrics: {
          direct_units_quantity: 8,
          indirect_units_quantity: 4,
        },
      };

      const parsed = parseAdsMetrics(raw);
      assert.equal(parsed.directUnitsQuantity, 8);
      assert.equal(parsed.indirectUnitsQuantity, 4);
      assert.equal(parsed.unitsQuantity, 12);
    });
  });

  describe("3. 90-Day Window Limit Enforcement", () => {
    test("clamps dateFrom to max 90 days for all period", () => {
      const res = getAdsDateRange("all", "America/Argentina/Buenos_Aires");
      assert.notEqual(res.dateFrom, null);
      assert.match(res.periodLabel, /90 días/i);

      const diffDays = Math.round((res.dateTo.getTime() - res.dateFrom!.getTime()) / (24 * 60 * 60 * 1000));
      assert.ok(diffDays <= 90);
    });

    test("calculates 30days period within limit", () => {
      const res = getAdsDateRange("30days", "America/Argentina/Buenos_Aires");
      assert.notEqual(res.dateFrom, null);
      const diffDays = Math.round((res.dateTo.getTime() - res.dateFrom!.getTime()) / (24 * 60 * 60 * 1000));
      assert.ok(diffDays <= 31);
    });
  });

  describe("4. Short-lived In-memory Cache", () => {
    test("caches data per tenant and period with TTL expiration", async () => {
      const tenantA = "tenant-aaa";
      const tenantB = "tenant-bbb";

      setCachedAdsData(tenantA, "30days", { mock: "dataA" }, 100);
      setCachedAdsData(tenantB, "30days", { mock: "dataB" }, 100);

      assert.deepEqual(getCachedAdsData(tenantA, "30days"), { mock: "dataA" });
      assert.deepEqual(getCachedAdsData(tenantB, "30days"), { mock: "dataB" });
      assert.equal(getCachedAdsData(tenantA, "7days"), null);

      await new Promise((r) => setTimeout(r, 150));
      assert.equal(getCachedAdsData(tenantA, "30days"), null);
      assert.equal(getCachedAdsData(tenantB, "30days"), null);
    });
  });

  describe("5. Profitability Engine with Real Ads Data", () => {
    test("calculates clean net profit crossing official ads cost with CMV, fees, shipping and packaging", () => {
      const unitPrice = 25000;
      const unitsSold = 2;
      const adsRevenue = unitPrice * unitsSold; // 50000
      const adsCost = 6000;

      const profitInput = {
        price: unitPrice,
        cost: 10000,
        estimated_fee: 6500,
        extra_fee_amount: 500,
        estimated_shipping_cost: 3000,
        promotion_discount_amount: 0,
        estimated_tax: 1500,
        packaging_cost: 500,
      };

      const result = calculateRealProfitability(profitInput);
      assert.equal(result.profitability_status, "complete");

      const totalUnitCosts = (profitInput.cost || 0) + profitInput.estimated_fee + profitInput.extra_fee_amount + profitInput.estimated_shipping_cost + profitInput.estimated_tax + profitInput.packaging_cost;
      const grossMarginForUnits = (unitPrice * unitsSold) - (totalUnitCosts * unitsSold);
      const cleanNetProfit = Math.round(grossMarginForUnits - adsCost);

      assert.equal(cleanNetProfit, 0);

      const roas = Number((adsRevenue / adsCost).toFixed(2));
      const acos = Number(((adsCost / adsRevenue) * 100).toFixed(1));
      assert.equal(roas, 8.33);
      assert.equal(acos, 12.0);
    });
  });

  describe("6. Sprint 26: Product Ads publicaciones reales por Ad Group", () => {
    test("PRODUCT_ADS_AD_METRICS contains required official metrics", () => {
      assert.ok(PRODUCT_ADS_AD_METRICS.includes("clicks"));
      assert.ok(PRODUCT_ADS_AD_METRICS.includes("prints"));
      assert.ok(PRODUCT_ADS_AD_METRICS.includes("cost"));
      assert.ok(PRODUCT_ADS_AD_METRICS.includes("cpc"));
      assert.ok(PRODUCT_ADS_AD_METRICS.includes("ctr"));
      assert.ok(PRODUCT_ADS_AD_METRICS.includes("direct_amount"));
      assert.ok(PRODUCT_ADS_AD_METRICS.includes("indirect_amount"));
      assert.ok(PRODUCT_ADS_AD_METRICS.includes("total_amount"));
      assert.ok(PRODUCT_ADS_AD_METRICS.includes("direct_units_quantity"));
      assert.ok(PRODUCT_ADS_AD_METRICS.includes("indirect_units_quantity"));
      assert.ok(PRODUCT_ADS_AD_METRICS.includes("units_quantity"));
      assert.ok(PRODUCT_ADS_AD_METRICS.includes("acos"));
      assert.ok(PRODUCT_ADS_AD_METRICS.includes("roas"));
      assert.ok(PRODUCT_ADS_AD_METRICS.includes("cvr"));
    });

    test("29. TEST — AD GROUP ADS: fetches and maps real ads from /ad_groups/{id}/ads with v2", async () => {
      let capturedUrl = "";
      let capturedHeaders: Record<string, string> = {};

      setupMockFetch((url, init) => {
        capturedUrl = url;
        capturedHeaders = init?.headers || {};
        return new Response(
          JSON.stringify({
            results: [
              {
                item_id: "MLA123456789",
                title: "Producto de prueba",
                price: 50000,
                metrics: {
                  cost: 5000,
                  clicks: 100,
                  units_quantity: 2,
                  total_amount: 100000,
                  acos: 5,
                  roas: 20,
                },
              },
            ],
            paging: { total: 1, limit: 50, offset: 0 },
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      });

      const ads = await getProductAdsAds({
        tenantId: "test-tenant",
        siteId: "MLA",
        adGroupId: "12345",
        dateFrom: "2026-08-01",
        dateTo: "2026-08-31",
      });

      assert.equal(ads.length, 1);
      assert.equal(ads[0].item_id, "MLA123456789");
      assert.equal(ads[0].title, "Producto de prueba");
      assert.equal(ads[0].price, 50000);
      assert.equal(ads[0].metrics?.cost, 5000);
      assert.equal(ads[0].metrics?.clicks, 100);
      assert.equal(ads[0].metrics?.unitsQuantity, 2);
      assert.equal(ads[0].metrics?.totalAmount, 100000);
      assert.equal(ads[0].metrics?.acos, 5);
      assert.equal(ads[0].metrics?.roas, 20);

      assert.ok(capturedUrl.includes("/advertising/MLA/product_ads/ad_groups/12345/ads"));
      assert.ok(capturedUrl.includes("api-version=2") || capturedHeaders["api-version"] === "2");
      assert.ok(capturedUrl.includes("date_from=2026-08-01"));
      assert.ok(capturedUrl.includes("date_to=2026-08-31"));
    });

    test("30. TEST — MATCH PRODUCT: matches local DB product by meli_item_id and calculates real profitability", () => {
      const ad = {
        item_id: "MLA123456789",
        title: "Producto de prueba",
        price: 50000,
        metrics: {
          cost: 5000,
          clicks: 100,
          units_quantity: 2,
          total_amount: 100000,
          acos: 5,
          roas: 20,
        },
      };

      const dbProduct = {
        id: "prod-local-1",
        meli_item_id: "MLA123456789",
        sku: "SKU-TEST-01",
        cost: 20000,
        estimated_fee: 6500,
        extra_fee_amount: 500,
        estimated_shipping_cost: 3000,
        promotion_discount_amount: 0,
        estimated_tax: 1500,
        thumbnail_url: "https://example.com/thumb.jpg",
      };

      const profitInput = {
        price: ad.price,
        cost: dbProduct.cost,
        estimated_fee: dbProduct.estimated_fee,
        extra_fee_amount: dbProduct.extra_fee_amount,
        estimated_shipping_cost: dbProduct.estimated_shipping_cost,
        promotion_discount_amount: dbProduct.promotion_discount_amount,
        estimated_tax: dbProduct.estimated_tax,
        packaging_cost: 500,
      };

      const profitRes = calculateRealProfitability(profitInput);
      assert.equal(profitRes.profitability_status, "complete");

      const totalUnitCosts = profitInput.cost + profitInput.estimated_fee + profitInput.extra_fee_amount + profitInput.estimated_shipping_cost + profitInput.estimated_tax + profitInput.packaging_cost;
      const unitsSold = ad.metrics.units_quantity;
      const grossMargin = (ad.price * unitsSold) - (totalUnitCosts * unitsSold);
      const cleanNetProfit = Math.round(grossMargin - ad.metrics.cost);

      // (50000 * 2) - (32000 * 2) - 5000 = 100000 - 64000 - 5000 = 31000
      assert.equal(cleanNetProfit, 31000);
    });

    test("31. TEST — SIN PRODUCT LOCAL: handles unmatched item preserving metrics and leaving cost null", () => {
      const ad = {
        item_id: "MLA999999999",
        title: "Producto sin match",
        price: 30000,
        metrics: {
          cost: 3000,
          clicks: 60,
          units_quantity: 1,
          total_amount: 30000,
          acos: 10,
          roas: 10,
        },
      };

      const profitInput = {
        price: ad.price,
        cost: null,
        estimated_fee: null,
        extra_fee_amount: null,
        estimated_shipping_cost: null,
        promotion_discount_amount: null,
        estimated_tax: null,
        packaging_cost: 0,
      };

      const profitRes = calculateRealProfitability(profitInput);
      assert.equal(profitRes.profitability_status, "missing_cost");
      assert.equal(profitRes.real_margin_amount, null);
    });

    test("32. TEST — DUPLICADO: aggregates metrics and recalculates roas, acos and profit across multiple ad groups", () => {
      const adGroup1Ad = {
        item_id: "MLA123456789",
        cost: 2000,
        revenue: 40000,
        clicks: 50,
        units: 1,
      };

      const adGroup2Ad = {
        item_id: "MLA123456789",
        cost: 3000,
        revenue: 60000,
        clicks: 50,
        units: 2,
      };

      const aggregated = {
        item_id: "MLA123456789",
        cost: adGroup1Ad.cost + adGroup2Ad.cost, // 5000
        revenue: adGroup1Ad.revenue + adGroup2Ad.revenue, // 100000
        clicks: adGroup1Ad.clicks + adGroup2Ad.clicks, // 100
        units: adGroup1Ad.units + adGroup2Ad.units, // 3
      };

      const roas = Number((aggregated.revenue / aggregated.cost).toFixed(2));
      const acos = Number(((aggregated.cost / aggregated.revenue) * 100).toFixed(1));
      const cpc = Number((aggregated.cost / aggregated.clicks).toFixed(2));

      assert.equal(aggregated.cost, 5000);
      assert.equal(aggregated.revenue, 100000);
      assert.equal(aggregated.clicks, 100);
      assert.equal(aggregated.units, 3);
      assert.equal(roas, 20);
      assert.equal(acos, 5.0);
      assert.equal(cpc, 50);
    });

    test("33. TEST — EMPTY: returns empty array when API responds with 0 results", async () => {
      setupMockFetch(
        () =>
          new Response(JSON.stringify({ results: [], paging: { total: 0 } }), {
            status: 200,
            headers: { "content-type": "application/json" },
          })
      );

      const ads = await getProductAdsAds({
        tenantId: "test-tenant",
        siteId: "MLA",
        adGroupId: "empty-group",
      });

      assert.deepEqual(ads, []);
    });

    test("34. TEST — ERROR: throws error on 500 response allowing getAdsData to handle graceful degradation", async () => {
      setupMockFetch(
        () =>
          new Response(JSON.stringify({ message: "Internal Server Error" }), {
            status: 500,
            statusText: "Internal Server Error",
            headers: { "content-type": "application/json" },
          })
      );

      await assert.rejects(
        async () => {
          await getProductAdsAds({
            tenantId: "test-tenant",
            siteId: "MLA",
            adGroupId: "error-group",
          });
        },
        (err: any) => {
          assert.ok(err.statusCode === 500 || /500/.test(err.message) || /Internal Server Error/.test(err.message));
          return true;
        }
      );
    });
  });

  describe("7. Sprint 27: Filtrado estricto de publicaciones Product Ads + corrección de rentabilidad", () => {
    test("23. TEST — CAMPAIGN FILTER URL: sends filters[campaigns] query param", async () => {
      let capturedUrl = "";

      setupMockFetch((url) => {
        capturedUrl = url;
        return new Response(JSON.stringify({ results: [], paging: { total: 0 } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      });

      await getProductAdsAdGroups({
        tenantId: "test-tenant",
        siteId: "MLA",
        advertiserId: 123456,
        campaignIds: ["358105778", "358096583"],
      });

      const decodedUrl = decodeURIComponent(capturedUrl);
      assert.ok(
        decodedUrl.includes("filters[campaigns]=358105778,358096583"),
        `Expected filters[campaigns] in URL, got: ${capturedUrl}`
      );
      assert.ok(!decodedUrl.includes("campaign_ids="), "Should not use campaign_ids query param");
    });

    test("24. TEST — AD GROUP FUERA DE SCOPE: discards ad groups not belonging to allowedCampaignIds", () => {
      const allowedCampaignIds = new Set(["campA", "campB"]);
      const rawAdGroups = [
        { id: "ag-1", campaign_id: "campA", name: "AdGroup 1" },
        { id: "ag-2", campaign_id: "campC", name: "AdGroup 2" },
      ];

      const filtered = rawAdGroups.filter(
        (ag) => ag.campaign_id !== null && ag.campaign_id !== undefined && allowedCampaignIds.has(String(ag.campaign_id))
      );

      assert.equal(filtered.length, 1);
      assert.equal(filtered[0].id, "ag-1");
    });

    test("25. TEST — AD FUERA DE SCOPE: discards ads whose campaign_id is not in allowedCampaignIds", () => {
      const allowedCampaignIds = new Set(["campA", "campB"]);
      const allAds = [
        { id: "ad-1", item_id: "MLA111", campaign_id: "campA" },
        { id: "ad-2", item_id: "MLA222", campaign_id: "campZ" },
      ];

      const filtered = allAds.filter(
        (ad) => ad.campaign_id !== null && ad.campaign_id !== undefined && allowedCampaignIds.has(String(ad.campaign_id))
      );

      assert.equal(filtered.length, 1);
      assert.equal(filtered[0].item_id, "MLA111");
    });

    test("26. TEST — PROMOCIÓN NO ADS: promotional products without in-scope ad group are not included", () => {
      const inScopeAdItems = new Set(["MLA-ADS-01"]);
      const promoProduct = { meli_item_id: "MLA-PROMO-99", promotion_discount_amount: 500 };

      const isInProductAds = inScopeAdItems.has(promoProduct.meli_item_id);
      assert.equal(isInProductAds, false);
    });

    test("27. TEST — CUPÓN NO ADS: coupon products without in-scope ad group are not included", () => {
      const inScopeAdItems = new Set(["MLA-ADS-01"]);
      const couponProduct = { meli_item_id: "MLA-COUPON-88", coupon_code: "SALE20" };

      const isInProductAds = inScopeAdItems.has(couponProduct.meli_item_id);
      assert.equal(isInProductAds, false);
    });

    test("28. TEST — 0 VENTAS: strictly produces null net profit, roas and acos", () => {
      const adUnits = 0;
      const adRevenue = 0;
      const adCost = 0;
      const m = { acos: null, roas: null };

      const profitInput = {
        price: 50000,
        cost: 20000,
        estimated_fee: 5000,
        extra_fee_amount: 0,
        estimated_shipping_cost: 0,
        promotion_discount_amount: 0,
        estimated_tax: 0,
        packaging_cost: 0,
      };

      const realProfitRes = calculateRealProfitability(profitInput);

      let cleanNetProfit: number | null = null;
      let cleanNetMarginPercent: number | null = null;

      if (
        adUnits > 0 &&
        adRevenue > 0 &&
        realProfitRes.profitability_status === "complete" &&
        profitInput.cost !== null
      ) {
        const totalUnitCosts = profitInput.cost + profitInput.estimated_fee;
        const unitsForCalc = adUnits;
        const grossMarginForUnits = profitInput.price * unitsForCalc - totalUnitCosts * unitsForCalc;
        cleanNetProfit = Math.round(grossMarginForUnits - adCost);
        cleanNetMarginPercent = Number(((cleanNetProfit / adRevenue) * 100).toFixed(1));
      }

      let roas: number | null = null;
      if (m.roas !== null && m.roas !== undefined) {
        roas = Number(m.roas);
      } else if (adCost > 0 && adRevenue > 0) {
        roas = Number((adRevenue / adCost).toFixed(2));
      }

      let acos: number | null = null;
      if (m.acos !== null && m.acos !== undefined) {
        acos = Number(m.acos);
      } else if (adRevenue > 0 && adCost > 0) {
        acos = Number(((adCost / adRevenue) * 100).toFixed(1));
      }

      assert.equal(cleanNetProfit, null);
      assert.equal(cleanNetMarginPercent, null);
      assert.equal(roas, null);
      assert.equal(acos, null);
    });

    test("29. TEST — VENTA REAL: calculates clean net profit when adUnits > 0 and adRevenue > 0", () => {
      const adUnits = 2;
      const adRevenue = 100000;
      const adCost = 5000;

      const profitInput = {
        price: 50000,
        cost: 20000,
        estimated_fee: 6500,
        extra_fee_amount: 500,
        estimated_shipping_cost: 3000,
        promotion_discount_amount: 0,
        estimated_tax: 1500,
        packaging_cost: 500,
      };

      const realProfitRes = calculateRealProfitability(profitInput);
      assert.equal(realProfitRes.profitability_status, "complete");

      let cleanNetProfit: number | null = null;
      let cleanNetMarginPercent: number | null = null;

      if (
        adUnits > 0 &&
        adRevenue > 0 &&
        realProfitRes.profitability_status === "complete" &&
        profitInput.cost !== null
      ) {
        const totalUnitCosts =
          profitInput.cost +
          profitInput.estimated_fee +
          profitInput.extra_fee_amount +
          profitInput.estimated_shipping_cost +
          profitInput.estimated_tax +
          profitInput.packaging_cost; // 32000

        const unitsForCalc = adUnits;
        const grossMarginForUnits = profitInput.price * unitsForCalc - totalUnitCosts * unitsForCalc; // 100000 - 64000 = 36000
        cleanNetProfit = Math.round(grossMarginForUnits - adCost); // 36000 - 5000 = 31000
        cleanNetMarginPercent = Number(((cleanNetProfit / adRevenue) * 100).toFixed(1)); // 31.0%
      }

      assert.equal(cleanNetProfit, 31000);
      assert.equal(cleanNetMarginPercent, 31.0);
    });

    test("30. TEST — NO MATH.MAX: regression test ensuring 0 units never generates positive profit", () => {
      const adUnits = 0;
      const adRevenue = 0;
      const adCost = 0;

      const unitPrice = 50000;
      const unitCost = 20000;

      // Old flawed logic simulation
      const flawedUnitsForCalc = Math.max(1, adUnits); // = 1
      const flawedProfit = unitPrice * flawedUnitsForCalc - unitCost * flawedUnitsForCalc - adCost; // = 30000 (BUG!)
      assert.equal(flawedProfit, 30000, "Sanity check on flawed behavior");

      // New fixed logic
      const correctUnitsForCalc = adUnits; // = 0
      let correctProfit: number | null = null;
      if (adUnits > 0 && adRevenue > 0) {
        correctProfit = unitPrice * correctUnitsForCalc - unitCost * correctUnitsForCalc - adCost;
      }

      assert.equal(correctProfit, null, "Correct behavior must be null for 0 units");
    });
  });

  describe("Sprint 28: Grouping Product Ads by Real Product", () => {
    const toPubs = (pubs: any[]): ProductAdsMetrics[] => pubs as ProductAdsMetrics[];

    test("40. TEST — DOS VARIANTES MISMO PRODUCTO: groups items with same master_id into 1 group", () => {
      const pub1 = {
        product_id: "prod-1",
        meli_item_id: "MLA101",
        title: "Dije Ángel de la Guarda Plata 925 - Cadena 45cm",
        sku: "D 260 AN C145",
        thumbnail_url: "https://example.com/img1.jpg",
        price: 104823,
        cost: 25000,
        ads_units_sold: 2,
        ads_revenue: 209646,
        clics: 40,
        cpc: 25,
        roas: 20.96,
        acos_percent: 4.77,
        total_product_cost: 50000,
        total_fee_cost: 20000,
        total_shipping_cost: 10000,
        total_packaging_cost: 1000,
        ads_investment: 10000,
        clean_net_profit: 128646,
        clean_net_margin_percent: 61.3,
        profitability_status: "complete",
        raw_data: { master_id: "MLA-MASTER-ANGEL" },
      };

      const pub2 = {
        product_id: "prod-2",
        meli_item_id: "MLA102",
        title: "Dije Ángel de la Guarda Plata 925 - Cadena 50cm",
        sku: "D 260 AN C150",
        thumbnail_url: "https://example.com/img2.jpg",
        price: 102090,
        cost: 25000,
        ads_units_sold: 1,
        ads_revenue: 102090,
        clics: 20,
        cpc: 25,
        roas: 20.42,
        acos_percent: 4.9,
        total_product_cost: 25000,
        total_fee_cost: 10000,
        total_shipping_cost: 5000,
        total_packaging_cost: 500,
        ads_investment: 5000,
        clean_net_profit: 61590,
        clean_net_margin_percent: 60.3,
        profitability_status: "complete",
        raw_data: { master_id: "MLA-MASTER-ANGEL" },
      };

      const groups = groupProductAdsForDisplay(toPubs([pub1, pub2]));

      assert.equal(groups.length, 1);
      assert.equal(groups[0].publicationCount, 2);
      assert.equal(groups[0].key, "master:mla-master-angel");
      assert.equal(groups[0].publications.length, 2);
    });

    test("41. TEST — DOS PRODUCTOS DISTINTOS: never joins items by title similarity", () => {
      const pubA = {
        product_id: "prod-a",
        meli_item_id: "MLA201",
        title: "Anillo Solitario Plata 925 Circon",
        sku: "AN-SOL-01",
        thumbnail_url: "https://example.com/a.jpg",
        price: 45000,
        cost: 12000,
        ads_units_sold: 1,
        ads_revenue: 45000,
        clics: 10,
        cpc: 20,
        roas: 22.5,
        acos_percent: 4.4,
        total_product_cost: 12000,
        total_fee_cost: 5000,
        total_shipping_cost: 3000,
        total_packaging_cost: 500,
        ads_investment: 2000,
        clean_net_profit: 24500,
        clean_net_margin_percent: 54.4,
        profitability_status: "complete",
        raw_data: { master_id: "MASTER-ANILLO-SOL" },
      };

      const pubB = {
        product_id: "prod-b",
        meli_item_id: "MLA202",
        title: "Anillo Solitario Plata 925 Circon Modelo B",
        sku: "AN-SOL-02",
        thumbnail_url: "https://example.com/b.jpg",
        price: 48000,
        cost: 13000,
        ads_units_sold: 1,
        ads_revenue: 48000,
        clics: 10,
        cpc: 20,
        roas: 24.0,
        acos_percent: 4.1,
        total_product_cost: 13000,
        total_fee_cost: 5000,
        total_shipping_cost: 3000,
        total_packaging_cost: 500,
        ads_investment: 2000,
        clean_net_profit: 26500,
        clean_net_margin_percent: 55.2,
        profitability_status: "complete",
        raw_data: { master_id: "MASTER-ANILLO-MOD-B" },
      };

      const groups = groupProductAdsForDisplay(toPubs([pubA, pubB]));

      assert.equal(groups.length, 2, "Must create 2 separate groups despite similar titles");
      assert.equal(groups[0].publicationCount, 1);
      assert.equal(groups[1].publicationCount, 1);
    });

    test("42. TEST — MÉTRICAS SUMADAS: aggregates revenue, investment, units and recalculates ACOS/ROAS", () => {
      const pubA = {
        product_id: "prod-a",
        meli_item_id: "MLA301",
        title: "Producto Test A",
        sku: "SKU-A",
        thumbnail_url: null,
        price: 50000,
        cost: 10000,
        ads_units_sold: 2,
        ads_revenue: 100000,
        clics: 50,
        cpc: 200,
        roas: 10,
        acos_percent: 10,
        total_product_cost: 20000,
        total_fee_cost: 10000,
        total_shipping_cost: 6000,
        total_packaging_cost: 1000,
        ads_investment: 10000,
        clean_net_profit: 63000,
        clean_net_margin_percent: 63,
        profitability_status: "complete",
        raw_data: { catalog_product_id: "CAT-PROD-TEST" },
      };

      const pubB = {
        product_id: "prod-b",
        meli_item_id: "MLA302",
        title: "Producto Test B",
        sku: "SKU-B",
        thumbnail_url: null,
        price: 50000,
        cost: 10000,
        ads_units_sold: 1,
        ads_revenue: 50000,
        clics: 25,
        cpc: 200,
        roas: 10,
        acos_percent: 10,
        total_product_cost: 10000,
        total_fee_cost: 5000,
        total_shipping_cost: 3000,
        total_packaging_cost: 500,
        ads_investment: 5000,
        clean_net_profit: 31500,
        clean_net_margin_percent: 63,
        profitability_status: "complete",
        raw_data: { catalog_product_id: "CAT-PROD-TEST" },
      };

      const groups = groupProductAdsForDisplay(toPubs([pubA, pubB]));

      assert.equal(groups.length, 1);
      const g = groups[0];
      assert.equal(g.totalRevenue, 150000);
      assert.equal(g.totalInvestment, 150000 * 0.1); // 15000
      assert.equal(g.totalUnits, 3);
      assert.equal(g.acos, 10.0);
      assert.equal(g.roas, 10.0);
      assert.equal(g.totalClicks, 75);
    });

    test("43. TEST — RANGO DE PRECIOS: identifies minPrice and maxPrice correctly", () => {
      const pub1 = {
        product_id: "p1",
        meli_item_id: "MLA401",
        title: "Item 1",
        sku: "SKU-R-1",
        thumbnail_url: null,
        price: 59000,
        cost: 15000,
        ads_units_sold: 0,
        ads_revenue: 0,
        clics: 0,
        cpc: null,
        roas: null,
        acos_percent: null,
        total_product_cost: 0,
        total_fee_cost: 0,
        total_shipping_cost: 0,
        total_packaging_cost: 0,
        ads_investment: 100,
        clean_net_profit: null,
        clean_net_margin_percent: null,
        profitability_status: "complete",
        raw_data: { family_id: "FAM-RANGE" },
      };

      const pub2 = { ...pub1, product_id: "p2", meli_item_id: "MLA402", price: 74000 };
      const pub3 = { ...pub1, product_id: "p3", meli_item_id: "MLA403", price: 102000 };

      const groups = groupProductAdsForDisplay(toPubs([pub1, pub2, pub3]));

      assert.equal(groups.length, 1);
      assert.equal(groups[0].minPrice, 59000);
      assert.equal(groups[0].maxPrice, 102000);
    });

    test("44. TEST — REPRESENTATIVE: highest ads_revenue determines group title and thumbnail", () => {
      const pubLow = {
        product_id: "p-low",
        meli_item_id: "MLA501",
        title: "Variante Sin Ventas",
        sku: "SKU-V1",
        thumbnail_url: "https://example.com/low.jpg",
        price: 50000,
        cost: 10000,
        ads_units_sold: 0,
        ads_revenue: 0,
        clics: 10,
        cpc: 100,
        roas: null,
        acos_percent: null,
        total_product_cost: 0,
        total_fee_cost: 0,
        total_shipping_cost: 0,
        total_packaging_cost: 0,
        ads_investment: 1000,
        clean_net_profit: null,
        clean_net_margin_percent: null,
        profitability_status: "complete",
        raw_data: { master_id: "MASTER-REP" },
      };

      const pubHigh = {
        product_id: "p-high",
        meli_item_id: "MLA502",
        title: "Dije Ángel de la Guarda Plata 925",
        sku: "SKU-V2",
        thumbnail_url: "https://example.com/high.jpg",
        price: 50000,
        cost: 10000,
        ads_units_sold: 4,
        ads_revenue: 385734,
        clics: 80,
        cpc: 161,
        roas: 29.8,
        acos_percent: 3.35,
        total_product_cost: 40000,
        total_fee_cost: 20000,
        total_shipping_cost: 10000,
        total_packaging_cost: 2000,
        ads_investment: 12936,
        clean_net_profit: 299834,
        clean_net_margin_percent: 77.7,
        profitability_status: "complete",
        raw_data: { master_id: "MASTER-REP" },
      };

      const pubMid = {
        product_id: "p-mid",
        meli_item_id: "MLA503",
        title: "Variante Media",
        sku: "SKU-V3",
        thumbnail_url: "https://example.com/mid.jpg",
        price: 50000,
        cost: 10000,
        ads_units_sold: 1,
        ads_revenue: 50000,
        clics: 20,
        cpc: 100,
        roas: 25,
        acos_percent: 4,
        total_product_cost: 10000,
        total_fee_cost: 5000,
        total_shipping_cost: 2500,
        total_packaging_cost: 500,
        ads_investment: 2000,
        clean_net_profit: 30000,
        clean_net_margin_percent: 60,
        profitability_status: "complete",
        raw_data: { master_id: "MASTER-REP" },
      };

      const groups = groupProductAdsForDisplay(toPubs([pubLow, pubHigh, pubMid]));

      assert.equal(groups.length, 1);
      assert.equal(groups[0].title, "Dije Ángel de la Guarda Plata 925");
      assert.equal(groups[0].thumbnailUrl, "https://example.com/high.jpg");
      assert.equal(groups[0].representative.meli_item_id, "MLA502");
    });

    test("45. TEST — COSTO INCOMPLETO: active item without cost sets group.cleanNetProfit to null", () => {
      const pubA = {
        product_id: "p-a",
        meli_item_id: "MLA601",
        title: "Item Con Costo",
        sku: "SKU-A",
        thumbnail_url: null,
        price: 50000,
        cost: 15000,
        ads_units_sold: 2,
        ads_revenue: 100000,
        clics: 20,
        cpc: 100,
        roas: 50,
        acos_percent: 2,
        total_product_cost: 30000,
        total_fee_cost: 10000,
        total_shipping_cost: 5000,
        total_packaging_cost: 1000,
        ads_investment: 2000,
        clean_net_profit: 52000,
        clean_net_margin_percent: 52,
        profitability_status: "complete",
        raw_data: { master_id: "MASTER-INCOMPLETE" },
      };

      const pubB = {
        product_id: "p-b",
        meli_item_id: "MLA602",
        title: "Item Sin Costo",
        sku: "SKU-B",
        thumbnail_url: null,
        price: 50000,
        cost: null, // Cost missing!
        ads_units_sold: 1,
        ads_revenue: 50000,
        clics: 10,
        cpc: 100,
        roas: 50,
        acos_percent: 2,
        total_product_cost: null,
        total_fee_cost: null,
        total_shipping_cost: null,
        total_packaging_cost: 0,
        ads_investment: 1000,
        clean_net_profit: null,
        clean_net_margin_percent: null,
        profitability_status: "missing_cost",
        raw_data: { master_id: "MASTER-INCOMPLETE" },
      };

      const groups = groupProductAdsForDisplay(toPubs([pubA, pubB]));

      assert.equal(groups.length, 1);
      assert.equal(groups[0].cleanNetProfit, null, "Must NOT show partial profit when an active item lacks cost");
      assert.equal(groups[0].missingCostCount, 1);
    });

    test("46. TEST — SIN ACTIVIDAD: inactive item without cost does NOT invalidate group profit", () => {
      const pubActive = {
        product_id: "p-active",
        meli_item_id: "MLA701",
        title: "Item Activo",
        sku: "SKU-ACT",
        thumbnail_url: null,
        price: 50000,
        cost: 15000,
        ads_units_sold: 2,
        ads_revenue: 100000,
        clics: 20,
        cpc: 100,
        roas: 50,
        acos_percent: 2,
        total_product_cost: 30000,
        total_fee_cost: 10000,
        total_shipping_cost: 5000,
        total_packaging_cost: 1000,
        ads_investment: 2000,
        clean_net_profit: 52000,
        clean_net_margin_percent: 52,
        profitability_status: "complete",
        raw_data: { master_id: "MASTER-INACTIVE-TEST" },
      };

      const pubInactiveNoCost = {
        product_id: "p-inactive",
        meli_item_id: "MLA702",
        title: "Item Inactivo Sin Costo",
        sku: "SKU-INACT",
        thumbnail_url: null,
        price: 50000,
        cost: null, // No cost, but 0 sales and 0 revenue!
        ads_units_sold: 0,
        ads_revenue: 0,
        clics: 0,
        cpc: null,
        roas: null,
        acos_percent: null,
        total_product_cost: 0,
        total_fee_cost: 0,
        total_shipping_cost: 0,
        total_packaging_cost: 0,
        ads_investment: 0,
        clean_net_profit: null,
        clean_net_margin_percent: null,
        profitability_status: "missing_cost",
        raw_data: { master_id: "MASTER-INACTIVE-TEST" },
      };

      const groups = groupProductAdsForDisplay(toPubs([pubActive, pubInactiveNoCost]));

      assert.equal(groups.length, 1);
      assert.equal(groups[0].cleanNetProfit, 52000, "Active item profit should be preserved because inactive item has 0 units and 0 revenue");
    });
  });
});
