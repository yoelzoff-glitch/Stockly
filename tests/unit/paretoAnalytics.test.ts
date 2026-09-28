import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { getParetoAnalysis } from "../../src/services/analytics/pareto";
import { AnalyticsDataset } from "../../src/services/analytics/analyticsDataset";

describe("Pareto 80/20 Analysis & Dataset Price Projection Unit Tests", () => {
  const dummyTenantId = "00000000-0000-0000-0000-000000000001";
  const now = new Date();
  const dateFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const dateTo = now;

  function createMockDataset(orderItems: any[]): AnalyticsDataset {
    return {
      tenantId: dummyTenantId,
      dateFrom,
      dateTo,
      orders: [],
      activeOrders: [],
      orderItems,
      products: [],
      shipments: [],
      cancellations: [],
      fetchedAt: Date.now(),
    };
  }

  test("calculates Pareto 80/20 accurately when dataset items contain total_price and unit_price", async () => {
    const mockItems = [
      {
        order_id: "order-1",
        title: "Producto Estrella A",
        sku: "SKU-A",
        quantity: 2,
        unit_price: 35000,
        total_price: 70000,
      },
      {
        order_id: "order-2",
        title: "Producto B",
        sku: "SKU-B",
        quantity: 1,
        unit_price: 20000,
        total_price: 20000,
      },
      {
        order_id: "order-3",
        title: "Producto C",
        sku: "SKU-C",
        quantity: 1,
        unit_price: 10000,
        total_price: 10000,
      },
    ];

    const dataset = createMockDataset(mockItems);
    const result = await getParetoAnalysis({
      tenantId: dummyTenantId,
      dataset,
    });

    assert.equal(result.totalRevenue, 100000);
    assert.equal(result.totalProductsSold, 4);

    // Product A generated 70% (70,000 / 100,000)
    // Product B takes it to 90% (cumulative 90,000), crossing the 80% mark
    // So 2 products are required to reach 80%
    assert.equal(result.productsToReach80, 2);
    assert.equal(result.paretoProducts.length, 2);
    assert.equal(result.longTailProducts.length, 1);

    assert.equal(result.paretoProducts[0].sku, "SKU-A");
    assert.equal(result.paretoProducts[0].revenue, 70000);
    assert.equal(result.paretoProducts[0].cumulative_percentage, 70);

    assert.equal(result.paretoProducts[1].sku, "SKU-B");
    assert.equal(result.paretoProducts[1].revenue, 20000);
    assert.equal(result.paretoProducts[1].cumulative_percentage, 90);

    assert.equal(result.longTailProducts[0].sku, "SKU-C");
    assert.equal(result.longTailProducts[0].revenue, 10000);
    assert.equal(result.longTailProducts[0].cumulative_percentage, 100);
  });

  test("resiliently uses total_price when unit_price is undefined", async () => {
    const mockItems = [
      {
        order_id: "order-1",
        title: "Producto Sin Unit Price",
        sku: "SKU-NO-UNIT",
        quantity: 3,
        unit_price: undefined,
        total_price: 60000,
      },
    ];

    const dataset = createMockDataset(mockItems);
    const result = await getParetoAnalysis({
      tenantId: dummyTenantId,
      dataset,
    });

    assert.equal(result.totalRevenue, 60000);
    assert.equal(result.paretoProducts.length, 1);
    assert.equal(result.paretoProducts[0].revenue, 60000);
    assert.equal(result.paretoProducts[0].cumulative_percentage, 100);
    assert.equal(result.productsToReach80, 1);
  });

  test("resiliently falls back to unit_price * quantity when total_price is null or zero", async () => {
    const mockItems = [
      {
        order_id: "order-1",
        title: "Producto Solo Unit Price",
        sku: "SKU-UNIT-ONLY",
        quantity: 2,
        unit_price: 25000,
        total_price: null,
      },
    ];

    const dataset = createMockDataset(mockItems);
    const result = await getParetoAnalysis({
      tenantId: dummyTenantId,
      dataset,
    });

    assert.equal(result.totalRevenue, 50000);
    assert.equal(result.paretoProducts.length, 1);
    assert.equal(result.paretoProducts[0].revenue, 50000);
    assert.equal(result.productsToReach80, 1);
  });

  test("safely handles empty orders or zero revenue without crashing or dividing by zero", async () => {
    const dataset = createMockDataset([]);
    const result = await getParetoAnalysis({
      tenantId: dummyTenantId,
      dataset,
    });

    assert.equal(result.totalRevenue, 0);
    assert.equal(result.totalProductsSold, 0);
    assert.equal(result.productsToReach80, 0);
    assert.equal(result.percentageOfCatalog, 0);
    assert.equal(result.paretoProducts.length, 0);
    assert.equal(result.longTailProducts.length, 0);
  });

  test("safely handles catalog items with zero price without marking all as 80% winners", async () => {
    const mockItems = [
      {
        order_id: "order-1",
        title: "Item Gratuito / Muestra",
        sku: "SKU-FREE",
        quantity: 5,
        unit_price: 0,
        total_price: 0,
      },
    ];

    const dataset = createMockDataset(mockItems);
    const result = await getParetoAnalysis({
      tenantId: dummyTenantId,
      dataset,
    });

    assert.equal(result.totalRevenue, 0);
    assert.equal(result.totalProductsSold, 5);
    assert.equal(result.productsToReach80, 0);
    assert.equal(result.percentageOfCatalog, 0);
    assert.equal(result.paretoProducts.length, 0);
    assert.equal(result.longTailProducts.length, 1);
  });
});
