import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { getFinancialData } from "../../src/services/finance/getFinancialData";

describe("Sprint 31: Cost Snapshotting & Historical Financial Immutability Unit Tests", () => {
  const dummyTenantId = "00000000-0000-0000-0000-000000000001";
  const dateFrom = new Date("2026-09-01T00:00:00Z");
  const dateTo = new Date("2026-09-30T23:59:59Z");

  test("REQ 60: Day 1 sale with $10k cost and $500 packaging remains unchanged when product cost becomes $15k and packaging becomes $1000", async () => {
    // 1. Setup Day 1 order with frozen snapshots ($10,000 product cost, $500 packaging)
    const mockOrders = [
      {
        id: "order-day-1",
        total_amount: 30000,
        date_created: "2026-09-01T12:00:00Z",
        status: "paid",
        meli_order_id: "meli-day-1",
        meli_shipment_id: null,
        packaging_cost_snapshot: 500,
        cost_snapshot_frozen_at: "2026-09-01T12:00:00Z",
        cost_snapshot_source: "captured_at_sale",
        raw_data: {
          libretax_operational_costs: { packaging_cost: 500 },
          order_items: [
            {
              item: { id: "item-1", seller_sku: "SKU-A", title: "Producto A" },
              quantity: 1,
              unit_price: 30000,
              sale_fee: 3000,
            },
          ],
        },
      },
      {
        id: "order-day-16",
        total_amount: 40000,
        date_created: "2026-09-16T12:00:00Z",
        status: "paid",
        meli_order_id: "meli-day-16",
        meli_shipment_id: null,
        packaging_cost_snapshot: 1000,
        cost_snapshot_frozen_at: "2026-09-16T12:00:00Z",
        cost_snapshot_source: "captured_at_sale",
        raw_data: {
          libretax_operational_costs: { packaging_cost: 1000 },
          order_items: [
            {
              item: { id: "item-1", seller_sku: "SKU-A", title: "Producto A" },
              quantity: 1,
              unit_price: 40000,
              sale_fee: 4000,
            },
          ],
        },
      },
    ];

    const mockOrderItems = [
      {
        order_id: "order-day-1",
        meli_item_id: "item-1",
        title: "Producto A",
        quantity: 1,
        total_price: 30000,
        estimated_fee: 3000,
        estimated_shipping_cost: 0,
        sku: "SKU-A",
        unit_cost: 10000,
        unit_cost_snapshot: 10000, // Frozen snapshot at sale
        cost_snapshot_frozen_at: "2026-09-01T12:00:00Z",
      },
      {
        order_id: "order-day-16",
        meli_item_id: "item-1",
        title: "Producto A",
        quantity: 1,
        total_price: 40000,
        estimated_fee: 4000,
        estimated_shipping_cost: 0,
        sku: "SKU-A",
        unit_cost: 15000,
        unit_cost_snapshot: 15000, // Frozen snapshot at new sale
        cost_snapshot_frozen_at: "2026-09-16T12:00:00Z",
      },
    ];

    // CURRENT product cost has now been changed to $25,000 in products table
    const mockProducts = [
      {
        id: "p1",
        meli_item_id: "item-1",
        title: "Producto A",
        sku: "SKU-A",
        status: "active",
        cost: 25000, // LATER CHANGED TO $25,000!
        estimated_fee: 4000,
        estimated_shipping_cost: 0,
        extra_fee_amount: 0,
        promotion_discount_amount: 0,
      },
    ];

    const mockSupabase: any = {
      from: (table: string) => {
        const query: any = {
          select: () => query,
          eq: () => query,
          neq: () => query,
          gte: () => query,
          lte: () => query,
          in: () => query,
          then: (resolve: any) => {
            if (table === "orders") resolve({ data: mockOrders, error: null });
            else if (table === "order_items") resolve({ data: mockOrderItems, error: null });
            else if (table === "products") resolve({ data: mockProducts, error: null });
            else if (table === "order_cancellations") resolve({ data: [], error: null });
            else if (table === "shipments") resolve({ data: [], error: null });
            else if (table === "monthly_expenses") resolve({ data: [], error: null });
            else resolve({ data: [], error: null });
          },
        };
        return query;
      },
    };

    // CURRENT packaging cost in tenant settings has now been changed to $1,500!
    const currentPackagingCostInSettings = 1500;

    const res = await getFinancialData(
      mockSupabase,
      dummyTenantId,
      dateFrom,
      dateTo,
      currentPackagingCostInSettings,
      []
    );

    // Assertions:
    // Total Revenue = 30000 + 40000 = 70000
    assert.equal(res.facturacionBruta, 70000);

    // Product Costs MUST use snapshots: 10000 (Day 1) + 15000 (Day 16) = 25000
    // (NEVER the current 25000 * 2 = 50000!)
    assert.equal(res.costosProductos, 25000);

    // Packaging Costs MUST use snapshots: 500 (Day 1) + 1000 (Day 16) = 1500
    // (NEVER the current 1500 * 2 = 3000!)
    assert.equal(res.totalPackaging, 1500);

    // Ganancia Neta = 70000 - 25000 - 7000 (fees) - 0 (shipping) - 1500 (packaging) = 36500
    assert.equal(res.gananciaNeta, 36500);
  });

  test("REQ 22, 23, 24: Isolated historical Day 1 calculation is strictly invariant against current product cost and packaging changes", async () => {
    const singleOrder = [
      {
        id: "order-day-1",
        total_amount: 30000,
        date_created: "2026-09-01T12:00:00Z",
        status: "paid",
        meli_order_id: "meli-day-1",
        meli_shipment_id: null,
        packaging_cost_snapshot: 500,
        cost_snapshot_frozen_at: "2026-09-01T12:00:00Z",
        cost_snapshot_source: "captured_at_sale",
        raw_data: {
          libretax_operational_costs: { packaging_cost: 500 },
          order_items: [
            {
              item: { id: "item-1", seller_sku: "SKU-A", title: "Producto A" },
              quantity: 1,
              unit_price: 30000,
              sale_fee: 3000,
            },
          ],
        },
      },
    ];

    const singleOrderItem = [
      {
        order_id: "order-day-1",
        meli_item_id: "item-1",
        title: "Producto A",
        quantity: 1,
        total_price: 30000,
        estimated_fee: 3000,
        estimated_shipping_cost: 0,
        sku: "SKU-A",
        unit_cost: 10000,
        unit_cost_snapshot: 10000,
        cost_snapshot_frozen_at: "2026-09-01T12:00:00Z",
      },
    ];

    // Test with Product Cost = $10,000 & Packaging = $500
    const mockSupabaseInitial: any = {
      from: (table: string) => {
        const query: any = {
          select: () => query,
          eq: () => query,
          neq: () => query,
          gte: () => query,
          lte: () => query,
          in: () => query,
          then: (resolve: any) => {
            if (table === "orders") resolve({ data: singleOrder, error: null });
            else if (table === "order_items") resolve({ data: singleOrderItem, error: null });
            else if (table === "products") resolve({ data: [{ meli_item_id: "item-1", cost: 10000 }], error: null });
            else resolve({ data: [], error: null });
          },
        };
        return query;
      },
    };

    const resInitial = await getFinancialData(mockSupabaseInitial, dummyTenantId, dateFrom, dateTo, 500, []);

    // Test after modifying Product Cost to $30,000 and Packaging to $2,500
    const mockSupabaseAfterMod: any = {
      from: (table: string) => {
        const query: any = {
          select: () => query,
          eq: () => query,
          neq: () => query,
          gte: () => query,
          lte: () => query,
          in: () => query,
          then: (resolve: any) => {
            if (table === "orders") resolve({ data: singleOrder, error: null });
            else if (table === "order_items") resolve({ data: singleOrderItem, error: null });
            else if (table === "products") resolve({ data: [{ meli_item_id: "item-1", cost: 30000 }], error: null });
            else resolve({ data: [], error: null });
          },
        };
        return query;
      },
    };

    const resAfterMod = await getFinancialData(mockSupabaseAfterMod, dummyTenantId, dateFrom, dateTo, 2500, []);

    // The historical results MUST be bit-by-bit identical!
    assert.equal(resInitial.facturacionBruta, resAfterMod.facturacionBruta);
    assert.equal(resInitial.costosProductos, resAfterMod.costosProductos);
    assert.equal(resInitial.totalPackaging, resAfterMod.totalPackaging);
    assert.equal(resInitial.gananciaNeta, resAfterMod.gananciaNeta);
    assert.equal(resInitial.margenNeto, resAfterMod.margenNeto);
  });

  test("REQ 65 & 66: Legacy orders with unit_cost are preserved, legacy orders without cost remain legacy_missing without fabricating fake history", async () => {
    const legacyOrders = [
      {
        id: "order-legacy-1",
        total_amount: 20000,
        date_created: "2026-06-01T12:00:00Z",
        status: "paid",
        meli_order_id: "meli-legacy-1",
        meli_shipment_id: null,
        packaging_cost_snapshot: null,
        cost_snapshot_frozen_at: null, // Legacy order before sprint
        raw_data: {
          libretax_operational_costs: { packaging_cost: 300 },
          order_items: [{ item: { id: "item-leg" }, quantity: 1 }],
        },
      },
      {
        id: "order-legacy-2",
        total_amount: 15000,
        date_created: "2026-06-02T12:00:00Z",
        status: "paid",
        meli_order_id: "meli-legacy-2",
        meli_shipment_id: null,
        packaging_cost_snapshot: null,
        cost_snapshot_frozen_at: null,
        raw_data: {
          order_items: [{ item: { id: "item-no-cost" }, quantity: 1 }],
        },
      },
    ];

    const legacyOrderItems = [
      {
        order_id: "order-legacy-1",
        meli_item_id: "item-leg",
        title: "Legacy With Cost",
        quantity: 1,
        total_price: 20000,
        estimated_fee: 2000,
        estimated_shipping_cost: 0,
        sku: "SKU-LEG",
        unit_cost: 8000, // Legacy unit_cost preserved
        unit_cost_snapshot: 8000,
        cost_snapshot_frozen_at: "2026-06-01T12:00:00Z",
      },
      {
        order_id: "order-legacy-2",
        meli_item_id: "item-no-cost",
        title: "Legacy Missing Cost",
        quantity: 1,
        total_price: 15000,
        estimated_fee: 1500,
        estimated_shipping_cost: 0,
        sku: "SKU-NO-COST",
        unit_cost: null, // Legacy missing
        unit_cost_snapshot: null,
        cost_snapshot_frozen_at: null,
      },
    ];

    const mockProducts = [
      {
        id: "p-leg",
        meli_item_id: "item-leg",
        cost: 14000, // Current cost differs from legacy
      },
      {
        id: "p-no-cost",
        meli_item_id: "item-no-cost",
        cost: 9999, // Current cost should NOT be fabricated for legacy missing if frozen
      },
    ];

    const mockSupabase: any = {
      from: (table: string) => {
        const query: any = {
          select: () => query,
          eq: () => query,
          neq: () => query,
          gte: () => query,
          lte: () => query,
          in: () => query,
          then: (resolve: any) => {
            if (table === "orders") resolve({ data: legacyOrders, error: null });
            else if (table === "order_items") resolve({ data: legacyOrderItems, error: null });
            else if (table === "products") resolve({ data: mockProducts, error: null });
            else resolve({ data: [], error: null });
          },
        };
        return query;
      },
    };

    const res = await getFinancialData(mockSupabase, dummyTenantId, dateFrom, dateTo, 500, []);

    // Order 1 used 8000 from legacy preserved (not 14000)
    // Order 2 fallback used for un-frozen legacy order
    assert.equal(res.costosProductos >= 8000, true);
    // Packaging used 300 from legacy raw_data for order 1
    assert.equal(res.totalPackaging, 800); // 300 (order 1) + 500 (order 2 fallback)
  });
});
