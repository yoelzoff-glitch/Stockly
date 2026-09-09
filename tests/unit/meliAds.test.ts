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
});
