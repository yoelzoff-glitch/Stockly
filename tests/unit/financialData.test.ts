import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { getFinancialData } from "../../src/services/finance/getFinancialData";

describe("Financial Data & Coupon Calculations Unit Tests", () => {
  const dummyTenantId = "00000000-0000-0000-0000-000000000001";
  const dateFrom = new Date("2026-09-01T00:00:00Z");
  const dateTo = new Date("2026-09-30T23:59:59Z");

  test("accurately calculates totalCupones, packaging, and promos without duplication", async () => {
    // Mock Supabase client
    const mockOrders = [
      {
        id: "order-1",
        total_amount: 80000,
        date_created: "2026-09-05T12:00:00Z",
        status: "paid",
        meli_order_id: "meli-1",
        meli_shipment_id: null,
        raw_data: {
          coupon: { amount: 3000 },
          payments: [{ coupon_amount: 3000, total_paid_amount: 77000, transaction_amount: 80000 }],
          order_items: [
            {
              item: { id: "item-1", seller_sku: "SKU-1", title: "Producto 1" },
              quantity: 1,
              unit_price: 80000,
              sale_fee: 10000,
            },
          ],
        },
      },
      {
        id: "order-2",
        total_amount: 50000,
        date_created: "2026-09-06T12:00:00Z",
        status: "paid",
        meli_order_id: "meli-2",
        meli_shipment_id: null,
        raw_data: {
          coupon: null,
          payments: [{ coupon_amount: 2000, total_paid_amount: 48000, transaction_amount: 50000 }],
          order_items: [
            {
              item: { id: "item-2", seller_sku: "SKU-2", title: "Producto 2" },
              quantity: 1,
              unit_price: 50000,
              sale_fee: 6000,
            },
          ],
        },
      },
    ];

    const mockOrderItems = [
      {
        order_id: "order-1",
        meli_item_id: "item-1",
        title: "Producto 1",
        quantity: 1,
        total_price: 80000,
        estimated_fee: 10000,
        estimated_shipping_cost: 4000,
        sku: "SKU-1",
        unit_cost: 20000,
      },
      {
        order_id: "order-2",
        meli_item_id: "item-2",
        title: "Producto 2",
        quantity: 1,
        total_price: 50000,
        estimated_fee: 6000,
        estimated_shipping_cost: 3000,
        sku: "SKU-2",
        unit_cost: 15000,
      },
    ];

    const mockProducts = [
      {
        id: "p1",
        meli_item_id: "item-1",
        title: "Producto 1",
        sku: "SKU-1",
        status: "active",
        cost: 20000,
        estimated_fee: 10000,
        estimated_shipping_cost: 4000,
        extra_fee_amount: 500,
        promotion_discount_amount: 0,
      },
      {
        id: "p2",
        meli_item_id: "item-2",
        title: "Producto 2",
        sku: "SKU-2",
        status: "active",
        cost: 15000,
        estimated_fee: 6000,
        estimated_shipping_cost: 3000,
        extra_fee_amount: 0,
        promotion_discount_amount: 1000,
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

    const packagingCostPerOrder = 1000;
    const res = await getFinancialData(
      mockSupabase,
      dummyTenantId,
      dateFrom,
      dateTo,
      packagingCostPerOrder,
      []
    );

    // Assertions
    // Total Revenue = 80000 + 50000 = 130000
    assert.equal(res.facturacionBruta, 130000);

    // Total Coupons = 3000 (order 1) + 2000 (order 2) = 5000
    assert.equal(res.totalCupones, 5000);

    // Total Packaging = 2 orders * 1000 = 2000
    assert.equal(res.totalPackaging, 2000);

    // Total Promociones = 500 (extra_fee p1) + 1000 (promo discount p2) = 1500
    assert.equal(res.totalPromociones, 1500);

    // descuentosYCupones = totalCupones (5000) + totalPromociones (1500) = 6500
    assert.equal(res.descuentosYCupones, 6500);

    // promosCuotas = packaging (2000) + cupones (5000) + promos (1500) = 8500
    assert.equal(res.promosCuotas, 8500);

    // Ganancia Neta = Facturación (130000) - CMV (35000) - Comisiones (16000) - Envíos (7000) - Extras/Promos (8500)
    // = 130000 - 35000 - 16000 - 7000 - 8500 = 63500
    assert.equal(res.costosProductos, 35000);
    assert.equal(res.comisionesML, 16000);
    assert.equal(res.envios, 7000);
    assert.equal(res.gananciaNeta, 63500);

    // Notice that promosCuotas (8500) + CMV (35000) + Comisiones (16000) + Envíos (7000) + Ganancia Neta (63500) = Facturación (130000)
    assert.equal(
      res.facturacionBruta - res.costosProductos - res.comisionesML - res.envios - res.promosCuotas,
      res.gananciaNeta
    );
  });
});
