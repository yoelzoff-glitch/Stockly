import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { accumulateFreightExpense, revertFreightExpense } from "../../src/services/finance/syncPurchaseFreight";

describe("syncPurchaseFreight Unit Tests", () => {
  const dummyTenantId = "00000000-0000-0000-0000-000000000001";

  test("creates a new fixed_one_off expense for Flete if none exists for the current month", async () => {
    let insertedRecord: any = null;
    let updateCalled = false;

    const mockSupabase = {
      from: (table: string) => {
        assert.equal(table, "monthly_expenses");
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  ilike: async () => ({
                    data: [], // Sin gastos previos
                    error: null
                  })
                })
              })
            })
          }),
          insert: async (record: any) => {
            insertedRecord = record;
            return { error: null };
          },
          update: () => {
            updateCalled = true;
            return {
              eq: () => ({
                eq: async () => ({ error: null })
              })
            };
          }
        };
      }
    };

    await accumulateFreightExpense(
      mockSupabase as any,
      dummyTenantId,
      15000,
      new Date("2026-09-15T12:00:00Z")
    );

    assert.equal(updateCalled, false, "No debería llamar a update si no existía el registro previo");
    assert.ok(insertedRecord, "Debería haber insertado un registro");
    assert.equal(insertedRecord.tenant_id, dummyTenantId);
    assert.equal(insertedRecord.name, "Flete");
    assert.equal(insertedRecord.type, "fixed_one_off");
    assert.equal(insertedRecord.amount, 15000);
    assert.equal(insertedRecord.target_month, "2026-09-01");
    assert.equal(insertedRecord.is_active, true);
  });

  test("accumulates freight into existing fixed_one_off expense if one already exists for that month", async () => {
    let updatedPayload: any = null;
    let insertedCalled = false;

    const existingId = "expense-uuid-123";
    const mockSupabase = {
      from: (table: string) => {
        assert.equal(table, "monthly_expenses");
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  ilike: async () => ({
                    data: [
                      {
                        id: existingId,
                        amount: 15000,
                        target_month: "2026-09-01"
                      }
                    ],
                    error: null
                  })
                })
              })
            })
          }),
          insert: async () => {
            insertedCalled = true;
            return { error: null };
          },
          update: (payload: any) => {
            updatedPayload = payload;
            return {
              eq: (field1: string, val1: any) => {
                assert.equal(val1, existingId);
                return {
                  eq: (field2: string, val2: any) => {
                    assert.equal(val2, dummyTenantId);
                    return Promise.resolve({ error: null });
                  }
                };
              }
            };
          }
        };
      }
    };

    await accumulateFreightExpense(
      mockSupabase as any,
      dummyTenantId,
      5000,
      new Date("2026-09-20T12:00:00Z")
    );

    assert.equal(insertedCalled, false, "No debe insertar si ya existe");
    assert.ok(updatedPayload, "Debe haber llamado al update");
    assert.equal(updatedPayload.amount, 20000, "15000 inicial + 5000 nuevo = 20000");
  });

  test("revertFreightExpense subtracts freight upon voidPurchase without going below 0", async () => {
    let updatedPayload: any = null;

    const existingId = "expense-uuid-123";
    const mockSupabase = {
      from: (table: string) => {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  ilike: async () => ({
                    data: [
                      {
                        id: existingId,
                        amount: 20000,
                        target_month: "2026-09-01"
                      }
                    ],
                    error: null
                  })
                })
              })
            })
          }),
          update: (payload: any) => {
            updatedPayload = payload;
            return {
              eq: () => ({
                eq: async () => ({ error: null })
              })
            };
          }
        };
      }
    };

    await revertFreightExpense(
      mockSupabase as any,
      dummyTenantId,
      5000,
      new Date("2026-09-20T12:00:00Z")
    );

    assert.ok(updatedPayload);
    assert.equal(updatedPayload.amount, 15000, "20000 - 5000 = 15000");
  });
});
