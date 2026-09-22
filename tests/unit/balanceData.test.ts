import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { getBalanceData } from "../../src/services/balance/getBalanceData";

describe("getBalanceData Service Unit & Tenant Isolation Tests", () => {
  const tenantA = "00000000-0000-0000-0000-000000000001";
  const tenantB = "00000000-0000-0000-0000-000000000002";
  const dateFrom = new Date("2026-09-01T00:00:00Z");
  const dateTo = new Date("2026-09-30T23:59:59Z");

  test("tenant isolation: queries strictly filter by tenant_id and isolates records", async () => {
    let capturedTenantId: string | null = null;

    const mockSupabase: any = {
      from: (table: string) => {
        const query: any = {
          select: () => query,
          eq: (col: string, val: any) => {
            if (col === "tenant_id") {
              capturedTenantId = val;
            }
            return query;
          },
          neq: () => query,
          gte: () => query,
          lte: () => query,
          order: () => query,
          range: () => query,
          then: (resolve: any) => {
            if (table === "purchase_orders") {
              resolve({
                data: [
                  {
                    id: "po-isolated-1",
                    tenant_id: tenantA,
                    supplier_name: "Proveedor A",
                    purchase_date: "2026-09-10T10:00:00Z",
                    created_at: "2026-09-10T10:00:00Z",
                    total_amount: 100000,
                    extra_costs: 0,
                    status: "completed",
                    purchase_order_items: [
                      {
                        id: "item-1",
                        quantity: 1,
                        unit_cost: 100000,
                        total_cost: 100000
                      }
                    ]
                  }
                ],
                error: null
              });
            } else if (table === "orders") {
              resolve({ data: [], error: null });
            } else if (table === "order_items") {
              resolve({ data: [], error: null });
            } else if (table === "products") {
              resolve({ data: [], error: null });
            } else if (table === "order_cancellations") {
              resolve({ data: [], error: null });
            } else if (table === "shipments") {
              resolve({ data: [], error: null });
            } else if (table === "monthly_expenses") {
              resolve({ data: [], error: null });
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

    assert.equal(capturedTenantId, tenantA);
    assert.equal(resA.balance.validPurchasesCount, 1);
    assert.equal(resA.balance.comprasMercaderia, 100000);
  });

  test("error handling: propagates database error instead of returning artificial zero balance", async () => {
    const mockSupabaseWithError: any = {
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
            if (table === "purchase_orders") {
              resolve({
                data: null,
                error: { message: "Database connection timeout" }
              });
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
          supabase: mockSupabaseWithError,
          tenantId: tenantA,
          dateFrom,
          dateTo,
          packagingCost: 0,
          ignoredOrderIds: []
        });
      },
      /Error obteniendo compras registradas del período: Database connection timeout/
    );
  });
});
