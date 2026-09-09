import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { meliFetch } from "../../src/services/meli/client";
import { meliAdsFetch } from "../../src/services/meli/ads/client";
import { getProductAdsAdvertiser, AdsAdvertiserError } from "../../src/services/meli/ads/getAdvertiser";
import { getProductAdsCampaigns, PRODUCT_ADS_CAMPAIGN_METRICS } from "../../src/services/meli/ads/campaigns";
import { getProductAdsAdGroups, PRODUCT_ADS_AD_GROUP_METRICS } from "../../src/services/meli/ads/adGroups";
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
});
