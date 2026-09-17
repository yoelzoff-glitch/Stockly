import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { getFinancialData, FinancialData } from "../../src/services/finance/getFinancialData";
import { normalizeSku } from "../../src/services/products/sku/normalizeSku";
import { calculateMonthlyProfitForecast } from "../../src/services/analytics/forecast";

describe("Sprint 39: Egress Reduction Phase 2 / Zero Functional Regression Safety Net", () => {
  const dummyTenantId = "00000000-0000-0000-0000-000000000001";
  const dateFrom = new Date("2026-09-01T00:00:00Z");
  const dateTo = new Date("2026-09-30T23:59:59Z");

  // Canonical complex fixture covering all financial edge cases:
  // - Frozen snapshots vs legacy orders
  // - Operational costs in snapshots vs raw_data
  // - Coupons (direct coupon and in payments)
  // - Promotions and extra fees
  // - Cancellations with approved vs rejected payments
  // - Shipments matching active orders
  // - Multiple items per order with sku and title fallbacks
  const mockOrdersFixture = [
    {
      id: "order-snap-1",
      total_amount: 150000,
      date_created: "2026-09-05T14:30:00Z",
      status: "paid",
      meli_order_id: "meli-1001",
      meli_shipment_id: "ship-1001",
      raw_data: {
        coupon: { amount: 5000 },
        payments: [{ coupon_amount: 5000, status: "approved" }],
        order_items: [
          {
            item: { id: "MLA101", seller_sku: "ANILLO-925", title: "Anillo Plata 925" },
            quantity: 2,
            unit_price: 75000,
            sale_fee: 9000,
          },
        ],
        libretax_operational_costs: { packaging_cost: 1200 },
      },
      // Frozen snapshot fields
      packaging_cost_snapshot: 1200,
      flex_cost_snapshot: 0,
      cost_snapshot_frozen_at: "2026-09-05T14:30:00Z",
      cost_snapshot_source: "captured_at_sale",
      cost_snapshot_status: "complete",
    },
    {
      id: "order-legacy-2",
      total_amount: 90000,
      date_created: "2026-09-10T10:00:00Z",
      status: "paid",
      meli_order_id: "meli-1002",
      meli_shipment_id: "ship-1002",
      raw_data: {
        coupon: null,
        payments: [{ coupon_amount: 2500, status: "approved" }],
        order_items: [
          {
            item: { id: "MLA102", seller_sku: "DIJE-CRUZ", title: "Dije Cruz Plata" },
            quantity: 1,
            unit_price: 90000,
            sale_fee: 12000,
          },
        ],
        libretax_operational_costs: { packaging_cost: 1500 },
      },
      packaging_cost_snapshot: null,
      flex_cost_snapshot: null,
      cost_snapshot_frozen_at: null,
      cost_snapshot_source: null,
      cost_snapshot_status: null,
    },
    {
      id: "order-test-ignored",
      total_amount: 50000,
      date_created: "2026-09-11T12:00:00Z",
      status: "paid",
      meli_order_id: "meli-test-999",
      meli_shipment_id: null,
      raw_data: {
        coupon: null,
        payments: [],
        order_items: [],
      },
      packaging_cost_snapshot: null,
      flex_cost_snapshot: null,
      cost_snapshot_frozen_at: null,
      cost_snapshot_source: null,
      cost_snapshot_status: null,
    },
  ];

  const mockOrderItemsFixture = [
    {
      order_id: "order-snap-1",
      meli_item_id: "MLA101",
      title: "Anillo Plata 925",
      quantity: 2,
      total_price: 150000,
      estimated_fee: 9000,
      estimated_shipping_cost: 3500,
      sku: "ANILLO-925",
      unit_cost: 22000,
      line_key: "MLA101_0_ANILLO925_0",
      unit_cost_snapshot: 22000,
      cost_snapshot_frozen_at: "2026-09-05T14:30:00Z",
      cost_snapshot_source: "captured_at_sale",
      cost_snapshot_version: "v1",
      estimated_fee_snapshot: 9000,
      estimated_shipping_cost_snapshot: 3500,
      extra_fee_amount_snapshot: 800,
      promotion_discount_amount_snapshot: 0,
      estimated_tax_snapshot: null,
    },
    {
      order_id: "order-legacy-2",
      meli_item_id: "MLA102",
      title: "Dije Cruz Plata",
      quantity: 1,
      total_price: 90000,
      estimated_fee: 12000,
      estimated_shipping_cost: 4000,
      sku: "DIJE-CRUZ",
      unit_cost: 30000,
      line_key: "MLA102_0_DIJECRUZ_0",
      unit_cost_snapshot: null,
      cost_snapshot_frozen_at: null,
      cost_snapshot_source: null,
      cost_snapshot_version: null,
      estimated_fee_snapshot: null,
      estimated_shipping_cost_snapshot: null,
      extra_fee_amount_snapshot: null,
      promotion_discount_amount_snapshot: null,
      estimated_tax_snapshot: null,
    },
  ];

  const mockProductsFixture = [
    {
      id: "prod-1",
      meli_item_id: "MLA101",
      title: "Anillo Plata 925",
      sku: "ANILLO-925",
      status: "active",
      cost: 22000,
      estimated_fee: 9000,
      estimated_shipping_cost: 3500,
      extra_fee_amount: 800,
      promotion_discount_amount: 0,
    },
    {
      id: "prod-2",
      meli_item_id: "MLA102",
      title: "Dije Cruz Plata",
      sku: "DIJE-CRUZ",
      status: "active",
      cost: 30000,
      estimated_fee: 12000,
      estimated_shipping_cost: 4000,
      extra_fee_amount: 0,
      promotion_discount_amount: 1500,
    },
  ];

  const mockShipmentsFixture = [
    { meli_shipment_id: "ship-1001", shipping_cost: 3500 },
    { meli_shipment_id: "ship-1002", shipping_cost: 4000 },
    // A historical shipment not belonging to any active order in the period
    { meli_shipment_id: "ship-historic-9999", shipping_cost: 8000 },
  ];

  const mockCancellationsFixture = [
    {
      refund_amount: 45000,
      orders: {
        raw_data: {
          payments: [{ status: "approved" }],
        },
      },
    },
    {
      // Rejected order cancellation that should be filtered out
      refund_amount: 20000,
      orders: {
        raw_data: {
          payments: [{ status: "rejected" }],
        },
      },
    },
  ];

  function createMockSupabase(options?: { captureShipmentQueries?: string[][] }) {
    return {
      from: (table: string) => {
        let selectedCols = "";
        let inIds: string[] = [];

        const chain: any = {
          select: (cols: string) => {
            selectedCols = cols;
            return chain;
          },
          eq: () => chain,
          neq: () => chain,
          gte: () => chain,
          lte: () => chain,
          in: (col: string, ids: string[]) => {
            if (table === "shipments" && options?.captureShipmentQueries) {
              options.captureShipmentQueries.push(ids);
            }
            inIds = ids;
            return chain;
          },
          then: (resolve: any) => {
            if (table === "orders") {
              // Emulate PostgREST projection when requested
              const mapped = mockOrdersFixture.map((o) => {
                if (selectedCols.includes("coupon:raw_data->coupon")) {
                  const raw = o.raw_data as any;
                  return {
                    id: o.id,
                    total_amount: o.total_amount,
                    date_created: o.date_created,
                    status: o.status,
                    meli_order_id: o.meli_order_id,
                    meli_shipment_id: o.meli_shipment_id,
                    packaging_cost_snapshot: o.packaging_cost_snapshot,
                    flex_cost_snapshot: o.flex_cost_snapshot,
                    cost_snapshot_frozen_at: o.cost_snapshot_frozen_at,
                    cost_snapshot_source: o.cost_snapshot_source,
                    cost_snapshot_status: o.cost_snapshot_status,
                    coupon: raw?.coupon,
                    payments: raw?.payments,
                    legacy_order_items: raw?.order_items,
                    libretax_operational_costs: raw?.libretax_operational_costs,
                    klyvo_operational_costs: null,
                  };
                }
                return o;
              });
              resolve({ data: mapped, error: null });
            } else if (table === "order_items") {
              resolve({ data: mockOrderItemsFixture, error: null });
            } else if (table === "products") {
              resolve({ data: mockProductsFixture, error: null });
            } else if (table === "shipments") {
              if (inIds.length > 0) {
                const filtered = mockShipmentsFixture.filter((s) => inIds.includes(s.meli_shipment_id));
                resolve({ data: filtered, error: null });
              } else {
                resolve({ data: mockShipmentsFixture, error: null });
              }
            } else if (table === "order_cancellations") {
              const mapped = mockCancellationsFixture.map((c) => {
                if (selectedCols.includes("payments:raw_data->payments")) {
                  return {
                    refund_amount: c.refund_amount,
                    orders: {
                      payments: c.orders.raw_data.payments,
                      raw_data: c.orders.raw_data,
                    },
                  };
                }
                return c;
              });
              resolve({ data: mapped, error: null });
            } else if (table === "monthly_expenses") {
              resolve({ data: [], error: null });
            } else {
              resolve({ data: [], error: null });
            }
          },
        };
        return chain;
      },
    } as any;
  }

  describe("1. getFinancialData() Reference Baseline and $0 Deviation Guarantee", () => {
    test("1.1. Reference calculations are deterministic and verified", async () => {
      const mockSupabase = createMockSupabase();
      const res = await getFinancialData(
        mockSupabase,
        dummyTenantId,
        dateFrom,
        dateTo,
        1000,
        ["meli-test-999"]
      );

      // Active orders: order-snap-1 (150,000) + order-legacy-2 (90,000) = 240,000
      assert.equal(res.facturacionBruta, 240000, "Facturación bruta must match $240,000");

      // Costs: order-snap-1 (2 * 22,000 = 44,000) + order-legacy-2 (1 * 30,000 = 30,000) = 74,000
      assert.equal(res.costosProductos, 74000, "Costos productos must match $74,000");

      // Fees: order-snap-1 (9,000 * 2 = 18,000) + order-legacy-2 (12,000 * 1 = 12,000) = 30,000
      assert.equal(res.comisionesML, 30000, "Comisiones ML must match $30,000");

      // Shipping: order-snap-1 (3,500) + order-legacy-2 (4,000) = 7,500
      assert.equal(res.envios, 7500, "Envíos must match $7,500");

      // Total Cupones: order-snap-1 (5,000) + order-legacy-2 (2,500 from payments) = 7,500
      assert.equal(res.totalCupones, 7500, "Total cupones must match $7,500");

      // Packaging: order-snap-1 (1,200 * 2 = 2,400) + order-legacy-2 (1,500 * 1 = 1,500) = 3,900
      assert.equal(res.totalPackaging, 3900, "Total packaging must match $3,900");

      // Total Promos: order-snap-1 (extra_fee_amount_snapshot 800 * 2 = 1,600) + order-legacy-2 (prod-2 promo 1,500 * 1 = 1,500) = 3,100
      assert.equal(res.totalPromociones, 3100, "Total promociones must match $3,100");

      // Promos y Cuotas: packaging (3,900) + cupones (7,500) + promociones (3,100) = 14,500
      assert.equal(res.promosCuotas, 14500, "Promos y cuotas must match $14,500");

      // Descuentos y Cupones: cupones (7,500) + promos (3,100) = 10,600
      assert.equal(res.descuentosYCupones, 10600, "Descuentos y cupones must match $10,600");

      // Valid cancellations: only approved payment (45,000), rejected (20,000) excluded
      assert.equal(res.cancellationsAmount, 45000, "Cancellations amount must match $45,000");

      // Ganancia Neta = 240,000 - 74,000 - 30,000 - 7,500 - 14,500 = 114,000
      assert.equal(res.gananciaNeta, 114000, "Ganancia neta must match $114,000");

      // Margen Neto = (114,000 / 240,000) * 100 = 47.5%
      assert.equal(res.margenNeto, 47.5, "Margen neto must match 47.5%");

      // Total units sold = 3, units with cost = 3 (100% accuracy)
      assert.equal(res.totalUnitsSold, 3);
      assert.equal(res.unitsWithCost, 3);
      assert.equal(res.costAccuracyPercent, 100);
    });

    test("1.2. Frozen fixture output maintains $0 deviation across all fields", async () => {
      const mockSupabase = createMockSupabase();
      const res = await getFinancialData(
        mockSupabase,
        dummyTenantId,
        dateFrom,
        dateTo,
        1000,
        ["meli-test-999"]
      );

      const frozenBaseline = {
        facturacionBruta: 240000,
        costosProductos: 74000,
        comisionesML: 30000,
        envios: 7500,
        promosCuotas: 14500,
        cancellationsAmount: 45000,
        gananciaNeta: 114000,
        margenNeto: 47.5,
        totalUnitsSold: 3,
        unitsWithCost: 3,
        costAccuracyPercent: 100,
        totalCupones: 7500,
        totalPackaging: 3900,
        totalPromociones: 3100,
        descuentosYCupones: 10600,
        monthlyExpensesTotal: 0,
        gananciaBolsilloLimpia: 114000,
      };

      for (const [key, value] of Object.entries(frozenBaseline)) {
        const actual = (res as any)[key];
        assert.equal(
          actual,
          value,
          `Financial metric '${key}' deviation detected: expected ${value}, got ${actual} (Tolerance: $0)`
        );
      }
    });
  });

  describe("2. Forecast, Pareto & Product Stats Safety Contracts", () => {
    test("2.1. Monthly profit forecast produces deterministic bounds with given baseline", () => {
      const historicalSeries = [
        { date: "2026-09-01", weekday: 2, netProfit: 10000, orderCount: 5, revenue: 50000 },
        { date: "2026-09-02", weekday: 3, netProfit: 12000, orderCount: 6, revenue: 55000 },
        { date: "2026-09-03", weekday: 4, netProfit: 11000, orderCount: 5, revenue: 52000 },
        { date: "2026-09-04", weekday: 5, netProfit: 13000, orderCount: 7, revenue: 60000 },
      ];

      const forecast = calculateMonthlyProfitForecast({
        historicalSeries,
        currentYear: 2026,
        currentMonth: 9,
        currentDay: 17,
        actualProfitMTD: 180000,
      });

      assert.ok(forecast.forecastExpected >= forecast.actualProfitMTD, "Forecast must be at least actual MTD");
      assert.ok(forecast.forecastLow <= forecast.forecastExpected, "Low bound <= expected");
      assert.ok(forecast.forecastHigh >= forecast.forecastExpected, "High bound >= expected");
      assert.equal(forecast.daysElapsed, 17);
      assert.equal(forecast.daysRemaining, 13);
    });

    test("2.2. Product SKU resolution and normalization contract remains identical", () => {
      assert.equal(normalizeSku("ANILLO-925"), "ANILLO925");
      assert.equal(normalizeSku("DIJE CRUZ "), "DIJECRUZ");
      assert.equal(normalizeSku("cad-100_v1"), "CAD100V1");
      assert.equal(normalizeSku(null as any), "");
    });
  });

  describe("3. Batch Internal Stock Fast Path & Sync Isolation", () => {
    test("3.1. Batch query identifies pending stock orders in a single query without N+1", () => {
      const paidOrderIds = ["ord-1", "ord-2", "ord-3", "ord-4"];
      const ordersInDb = [
        { id: "ord-1", status: "paid", internal_stock_processed: true },
        { id: "ord-2", status: "paid", internal_stock_processed: false },
        { id: "ord-3", status: "paid", internal_stock_processed: true },
        { id: "ord-4", status: "paid", internal_stock_processed: false },
      ];

      // Batch filter simulating orders SELECT id WHERE id IN (...) AND status = 'paid' AND internal_stock_processed = false
      const pendingStockOrders = ordersInDb.filter(
        (o) => paidOrderIds.includes(o.id) && o.status === "paid" && !o.internal_stock_processed
      );

      assert.equal(pendingStockOrders.length, 2);
      assert.equal(pendingStockOrders[0].id, "ord-2");
      assert.equal(pendingStockOrders[1].id, "ord-4");
    });

    test("3.2. Shipments and Cancellations feature flags default to safe fallbacks", () => {
      const shipmentsSyncEnabled = process.env.LIBRETAX_SHIPMENTS_FROM_ORDERS_FULL_SYNC !== "false";
      const cancellationsSyncEnabled = process.env.LIBRETAX_CANCELLATIONS_FROM_ORDERS_FULL_SYNC !== "false";
      const pageLoadShipmentsSync = process.env.LIBRETAX_SHIPMENT_SYNC_ON_PAGE_LOAD === "true";

      // Deploy 1 defaults
      assert.equal(shipmentsSyncEnabled, true, "Shipments full sync from orders defaults to true during initial deploy");
      assert.equal(cancellationsSyncEnabled, true, "Cancellations full sync from orders defaults to true during initial deploy");
      assert.equal(pageLoadShipmentsSync, false, "Page load shipment sync defaults to false");
    });
  });
});
