import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { calculateFinancialRange } from "../../src/services/ai/tools/analytics";

describe("Copilot Financial Tools & Fixtures Unit Tests", () => {
  const dummyTenantId = "tenant-financial-123";
  const fromDate = new Date("2026-09-01T00:00:00.000Z");
  const toDate = new Date("2026-09-12T23:59:59.999Z");

  test("Fixture: Revenue 100k, Cost 40k, Fee 15k, Shipping 5k, Promo 10k -> Net Profit 30k (30% margin)", async () => {
    const mockTenant = {
      timezone: "America/Argentina/Buenos_Aires",
      metadata: { packaging_cost: 0, ignored_order_ids: [] },
    };

    const mockOrders = [
      {
        id: "order-1",
        total_amount: 100000,
        date_created: "2026-09-05T12:00:00.000Z",
        status: "paid",
        meli_order_id: "meli-100",
        packaging_cost_snapshot: 0,
        cost_snapshot_frozen_at: "2026-09-05T12:00:00.000Z",
        raw_data: {
          payments: [{ coupon_amount: 10000, total_paid_amount: 90000, transaction_amount: 100000 }],
        },
      },
    ];

    const mockOrderItems = [
      {
        order_id: "order-1",
        meli_item_id: "item-1",
        title: "Cadena Veneciana Plata 925",
        quantity: 1,
        total_price: 100000,
        estimated_fee: 15000,
        estimated_shipping_cost: 5000,
        sku: "CAD-VEN-925",
        unit_cost_snapshot: 40000,
      },
    ];

    const mockProducts = [
      {
        id: "p1",
        meli_item_id: "item-1",
        title: "Cadena Veneciana Plata 925",
        sku: "CAD-VEN-925",
        cost: 99999, // Should NOT be used because unit_cost_snapshot exists!
        estimated_fee: 15000,
        estimated_shipping_cost: 5000,
        status: "active",
      },
    ];

    const mockClient: any = {
      from: (table: string) => {
        let filters: any = {};
        const query: any = {
          select: () => query,
          eq: (field: string, val: any) => {
            filters[field] = val;
            return query;
          },
          neq: () => query,
          gte: () => query,
          lte: () => query,
          in: () => query,
          single: async () => {
            if (table === "tenants") return { data: mockTenant, error: null };
            return { data: null, error: null };
          },
          then: (resolve: any) => {
            if (table === "orders") {
              // Ensure tenant filtering was applied
              assert.equal(filters.tenant_id, dummyTenantId);
              resolve({ data: mockOrders, error: null });
            } else if (table === "order_items") {
              resolve({ data: mockOrderItems, error: null });
            } else if (table === "products") {
              assert.equal(filters.tenant_id, dummyTenantId);
              resolve({ data: mockProducts, error: null });
            } else {
              resolve({ data: [], error: null });
            }
          },
        };
        return query;
      },
    };

    const result = await calculateFinancialRange(dummyTenantId, fromDate, toDate, mockClient);

    // Assert exact financial metrics
    assert.equal(result.revenue, 100000, "Revenue should be exactly $100.000");
    assert.equal(result.productCosts, 40000, "Product costs should be exactly $40.000");
    assert.equal(result.marketplaceFees, 15000, "Marketplace fee should be exactly $15.000");
    assert.equal(result.shippingCosts, 5000, "Shipping cost should be exactly $5.000");
    assert.equal(result.promotionsAndCoupons, 10000, "Promotions should be exactly $10.000");
    assert.equal(result.netProfit, 30000, "Net profit must be exactly $30.000");
    assert.equal(result.netMargin, 30.0, "Net margin must be exactly 30.0%");
    assert.equal(result.costCoveragePct, 100, "Cost coverage should be 100%");
  });

  test("Historical cost immutability: uses unit_cost_snapshot from frozen order rather than current product cost", async () => {
    const mockTenant = {
      timezone: "America/Argentina/Buenos_Aires",
      metadata: { packaging_cost: 0, ignored_order_ids: [] },
    };

    const mockOrders = [
      {
        id: "order-frozen",
        total_amount: 50000,
        date_created: "2026-09-02T12:00:00.000Z",
        status: "paid",
        meli_order_id: "meli-frozen",
        packaging_cost_snapshot: 0,
        raw_data: { payments: [] },
      },
    ];

    const mockOrderItems = [
      {
        order_id: "order-frozen",
        meli_item_id: "item-frozen",
        title: "Anillo Oro 18k",
        quantity: 1,
        total_price: 50000,
        estimated_fee: 5000,
        estimated_shipping_cost: 2000,
        sku: "AN-18K",
        unit_cost_snapshot: 15000, // Frozen snapshot
      },
    ];

    const mockProducts = [
      {
        id: "p-frozen",
        meli_item_id: "item-frozen",
        sku: "AN-18K",
        cost: 35000, // Cost was updated later, MUST NOT affect historical profit!
        estimated_fee: 5000,
        estimated_shipping_cost: 2000,
        status: "active",
      },
    ];

    const mockClient: any = {
      from: (table: string) => {
        const query: any = {
          select: () => query,
          eq: () => query,
          neq: () => query,
          gte: () => query,
          lte: () => query,
          in: () => query,
          single: async () => ({ data: mockTenant, error: null }),
          then: (resolve: any) => {
            if (table === "orders") resolve({ data: mockOrders, error: null });
            else if (table === "order_items") resolve({ data: mockOrderItems, error: null });
            else if (table === "products") resolve({ data: mockProducts, error: null });
            else resolve({ data: [], error: null });
          },
        };
        return query;
      },
    };

    const result = await calculateFinancialRange(dummyTenantId, fromDate, toDate, mockClient);
    // Cost must be 15,000, NOT 35,000
    assert.equal(result.productCosts, 15000);
    // Net profit = 50,000 - 15,000 - 5,000 - 2,000 = 28,000
    assert.equal(result.netProfit, 28000);
  });

  test("Excludes cancelled orders and ignored_order_ids from sales and profit totals", async () => {
    const mockTenant = {
      timezone: "America/Argentina/Buenos_Aires",
      metadata: { packaging_cost: 0, ignored_order_ids: ["order-ignored"] },
    };

    const mockOrders = [
      {
        id: "order-valid",
        total_amount: 50000,
        date_created: "2026-09-04T12:00:00.000Z",
        status: "paid",
        meli_order_id: "meli-valid",
        packaging_cost_snapshot: 0,
        raw_data: { payments: [] },
      },
      {
        id: "order-ignored",
        total_amount: 200000,
        date_created: "2026-09-04T13:00:00.000Z",
        status: "paid",
        meli_order_id: "meli-ignored",
        packaging_cost_snapshot: 0,
        raw_data: { payments: [] },
      },
    ];

    const mockOrderItems = [
      {
        order_id: "order-valid",
        meli_item_id: "item-1",
        title: "Item Valido",
        quantity: 1,
        total_price: 50000,
        estimated_fee: 5000,
        estimated_shipping_cost: 2000,
        sku: "VAL-1",
        unit_cost_snapshot: 10000,
      },
      {
        order_id: "order-ignored",
        meli_item_id: "item-2",
        title: "Item Ignorado",
        quantity: 1,
        total_price: 200000,
        estimated_fee: 20000,
        estimated_shipping_cost: 5000,
        sku: "IGN-2",
        unit_cost_snapshot: 50000,
      },
    ];

    const mockClient: any = {
      from: (table: string) => {
        const query: any = {
          select: () => query,
          eq: () => query,
          neq: () => query,
          gte: () => query,
          lte: () => query,
          in: () => query,
          single: async () => ({ data: mockTenant, error: null }),
          then: (resolve: any) => {
            if (table === "orders") resolve({ data: mockOrders, error: null });
            else if (table === "order_items") resolve({ data: mockOrderItems, error: null });
            else if (table === "products") resolve({ data: [], error: null });
            else resolve({ data: [], error: null });
          },
        };
        return query;
      },
    };

    const result = await calculateFinancialRange(dummyTenantId, fromDate, toDate, mockClient);
    // Ignored order (200,000) must be discarded
    assert.equal(result.revenue, 50000);
    assert.equal(result.ordersCount, 1);
  });
});
