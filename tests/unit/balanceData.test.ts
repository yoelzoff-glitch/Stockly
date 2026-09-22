import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { getBalanceData } from "../../src/services/balance/getBalanceData";

describe("getBalanceData Service Unit, High Volume & Error Propagation Tests", () => {
  const tenantA = "00000000-0000-0000-0000-000000000001";
  const tenantB = "00000000-0000-0000-0000-000000000002";
  const dateFrom = new Date("2026-09-01T00:00:00Z");
  const dateTo = new Date("2026-09-30T23:59:59Z");

  test("tenant isolation: queries strictly filter by tenant_id and isolates records between 2 tenants", async () => {
    const requestedTenantIds: string[] = [];

    const mockSupabase: any = {
      from: (table: string) => {
        const query: any = {
          select: () => query,
          eq: (col: string, val: any) => {
            if (col === "tenant_id") {
              requestedTenantIds.push(val);
            }
            return query;
          },
          neq: () => query,
          gte: () => query,
          lte: () => query,
          order: () => query,
          range: () => query,
          in: () => query,
          then: (resolve: any) => {
            const currentTenant = requestedTenantIds[requestedTenantIds.length - 1];
            if (table === "purchase_orders") {
              if (currentTenant === tenantA) {
                resolve({
                  data: [
                    {
                      id: "po-tenant-A",
                      tenant_id: tenantA,
                      supplier_name: "Proveedor A",
                      purchase_date: "2026-09-10T10:00:00Z",
                      created_at: "2026-09-10T10:00:00Z",
                      total_amount: 100000,
                      extra_costs: 0,
                      status: "completed",
                      purchase_order_items: [
                        { id: "item-a", quantity: 1, unit_cost: 100000, total_cost: 100000 }
                      ]
                    }
                  ],
                  error: null
                });
              } else {
                resolve({
                  data: [
                    {
                      id: "po-tenant-B",
                      tenant_id: tenantB,
                      supplier_name: "Proveedor B",
                      purchase_date: "2026-09-12T10:00:00Z",
                      created_at: "2026-09-12T10:00:00Z",
                      total_amount: 500000,
                      extra_costs: 0,
                      status: "completed",
                      purchase_order_items: [
                        { id: "item-b", quantity: 5, unit_cost: 100000, total_cost: 500000 }
                      ]
                    }
                  ],
                  error: null
                });
              }
            } else {
              resolve({ data: [], error: null });
            }
          }
        };
        return query;
      }
    };

    const resA = await getBalanceData({
      supabase: mockSupabase,
      tenantId: tenantA,
      dateFrom,
      dateTo,
      packagingCost: 0,
      ignoredOrderIds: []
    });

    const resB = await getBalanceData({
      supabase: mockSupabase,
      tenantId: tenantB,
      dateFrom,
      dateTo,
      packagingCost: 0,
      ignoredOrderIds: []
    });

    assert.equal(resA.balance.comprasMercaderia, 100000);
    assert.equal(resB.balance.comprasMercaderia, 500000);
    assert.notEqual(resA.balance.comprasMercaderia, resB.balance.comprasMercaderia);
  });

  test("error handling: propagates sales (orders) query error without returning artificial zero", async () => {
    const mockSupabaseSalesError: any = {
      from: (table: string) => {
        const query: any = {
          select: () => query,
          eq: () => query,
          neq: () => query,
          gte: () => query,
          lte: () => query,
          order: () => query,
          range: () => query,
          then: (resolve: any) => {
            if (table === "orders") {
              resolve({ data: null, error: { message: "Conexión a tabla orders abortada" } });
            } else {
              resolve({ data: [], error: null });
            }
          }
        };
        return query;
      }
    };

    await assert.rejects(
      async () => {
        await getBalanceData({
          supabase: mockSupabaseSalesError,
          tenantId: tenantA,
          dateFrom,
          dateTo,
          packagingCost: 0,
          ignoredOrderIds: []
        });
      },
      /Conexión a tabla orders abortada/
    );
  });

  test("error handling: propagates monthly_expenses query error without returning artificial zero", async () => {
    const mockSupabaseExpensesError: any = {
      from: (table: string) => {
        const query: any = {
          select: () => query,
          eq: () => query,
          neq: () => query,
          gte: () => query,
          lte: () => query,
          order: () => query,
          range: () => query,
          then: (resolve: any) => {
            if (table === "monthly_expenses") {
              resolve({ data: null, error: { message: "Error crítico en tabla monthly_expenses" } });
            } else {
              resolve({ data: [], error: null });
            }
          }
        };
        return query;
      }
    };

    await assert.rejects(
      async () => {
        await getBalanceData({
          supabase: mockSupabaseExpensesError,
          tenantId: tenantA,
          dateFrom,
          dateTo,
          packagingCost: 0,
          ignoredOrderIds: []
        });
      },
      /Error al consultar gastos mensuales en Finanzas: Error crítico en tabla monthly_expenses/
    );
  });

  test("high volume pagination (>1.000 sales orders and >1.000 purchases): avoids truncation and uses stable tiebreaker", async () => {
    let orderRangeCalls = 0;
    let purchaseRangeCalls = 0;
    const orderedFields: Record<string, string[]> = {};

    // Generate 1200 sales orders and 1100 purchases
    const TOTAL_ORDERS = 1200;
    const TOTAL_PURCHASES = 1100;

    const mockSupabaseLarge: any = {
      from: (table: string) => {
        const query: any = {
          select: () => query,
          eq: () => query,
          neq: () => query,
          gte: () => query,
          lte: () => query,
          in: () => query,
          order: (field: string) => {
            if (!orderedFields[table]) orderedFields[table] = [];
            orderedFields[table].push(field);
            return query;
          },
          range: (from: number, to: number) => {
            if (table === "orders") {
              orderRangeCalls++;
              const count = Math.min(to - from + 1, Math.max(0, TOTAL_ORDERS - from));
              const slice = Array.from({ length: count }, (_, i) => ({
                id: `order-${from + i}`,
                total_amount: 1000,
                date_created: "2026-09-15T12:00:00Z",
                status: "paid",
                meli_order_id: `meli-${from + i}`,
                meli_shipment_id: null,
                raw_data: { payments: [], order_items: [] }
              }));
              return {
                then: (resolve: any) => resolve({ data: slice, error: null })
              };
            }
            if (table === "purchase_orders") {
              purchaseRangeCalls++;
              const count = Math.min(to - from + 1, Math.max(0, TOTAL_PURCHASES - from));
              const slice = Array.from({ length: count }, (_, i) => ({
                id: `po-${from + i}`,
                supplier_name: `Proveedor ${from + i}`,
                purchase_date: "2026-09-15T12:00:00Z",
                created_at: "2026-09-15T12:00:00Z",
                total_amount: 500,
                extra_costs: 0,
                status: "completed",
                purchase_order_items: [
                  { id: `poi-${from + i}`, quantity: 1, unit_cost: 500, total_cost: 500 }
                ]
              }));
              return {
                then: (resolve: any) => resolve({ data: slice, error: null })
              };
            }
            return query;
          },
          then: (resolve: any) => {
            resolve({ data: [], error: null });
          }
        };
        return query;
      }
    };

    const res = await getBalanceData({
      supabase: mockSupabaseLarge,
      tenantId: tenantA,
      dateFrom,
      dateTo,
      packagingCost: 0,
      ignoredOrderIds: []
    });

    // Verification: Both tables fetched in multiple pages (page 1: 1000 items, page 2: remaining)
    assert.equal(orderRangeCalls, 2, "Orders should paginate in 2 calls for 1200 items");
    assert.equal(purchaseRangeCalls, 2, "Purchases should paginate in 2 calls for 1100 items");

    // Total sales orders = 1200 * 1000 = 1.200.000 revenue
    assert.equal(res.financials.facturacionBruta, 1200000);
    // Total purchases = 1100 * 500 = 550.000 merchandise cost
    assert.equal(res.balance.comprasMercaderia, 550000);
    assert.equal(res.balance.validPurchasesCount, 1100);

    // Verify stable ordering with ID tiebreaker was used for both
    assert.ok(orderedFields["orders"].includes("id"), "Orders must have ID tiebreaker in ordering");
    assert.ok(orderedFields["purchase_orders"].includes("id"), "Purchases must have ID tiebreaker in ordering");
  });
});
