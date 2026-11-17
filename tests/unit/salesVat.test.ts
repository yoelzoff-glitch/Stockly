import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateSalesVat, type SalesVatOrder } from "../../src/services/finance/salesVat";
import { getSalesVat } from "../../src/services/finance/getSalesVat";

const order = (overrides: Partial<SalesVatOrder> = {}): SalesVatOrder => ({
  id: "order-1", meli_order_id: "123", total_amount: 121,
  status: "paid", currency_id: "ARS", ...overrides,
});

test("extracts included VAT rather than adding 21% to gross sales", () => {
  assert.deepEqual(calculateSalesVat([order()], 21), {
    gross: 121, net: 100, vat: 21, count: 1, excluded: 0,
  });
  assert.equal(calculateSalesVat([order({ total_amount: 110.5 })], 10.5).vat, 10.5);
  assert.equal(calculateSalesVat([order()], 0).vat, 0);
});

test("excludes unpaid, cancelled, foreign currency, invalid and hidden orders", () => {
  const orders = [order(), order({ status: "cancelled" }), order({ status: "pending" }),
    order({ currency_id: "USD" }), order({ currency_id: null }), order({ total_amount: null }),
    order({ total_amount: -1 }), order({ total_amount: "bad" }),
    order({ id: "hidden" }), order({ meli_order_id: "456" })];
  assert.deepEqual(calculateSalesVat(orders, 21, ["hidden", "456"]), {
    gross: 121, net: 100, vat: 21, count: 1, excluded: 9,
  });
});

test("rounds per order and preserves gross = net + tax, handles empty periods", () => {
  assert.deepEqual(calculateSalesVat([order({ total_amount: 0.03 }), order({ total_amount: 0.03 })], 21), {
    gross: 0.06, net: 0.04, vat: 0.02, count: 2, excluded: 0,
  });
  assert.deepEqual(calculateSalesVat([], 21), { gross: 0, net: 0, vat: 0, count: 0, excluded: 0 });
  assert.throws(() => calculateSalesVat([], -21));
  assert.throws(() => calculateSalesVat([], NaN));
});

function mockDb(enabled: boolean, failPage = false) {
  const calls: unknown[][] = [];
  const db = { from(table: string) {
    calls.push(["from", table]);
    const chain = {
      select(...args: unknown[]) { calls.push(["select", ...args]); return chain; },
      eq(...args: unknown[]) { calls.push(["eq", ...args]); return chain; },
      gte(...args: unknown[]) { calls.push(["gte", ...args]); return chain; },
      lt(...args: unknown[]) { calls.push(["lt", ...args]); return chain; },
      order(...args: unknown[]) { calls.push(["order", ...args]); return chain; },
      maybeSingle: async () => ({ data: { enabled, rate: 21 }, error: null }),
      range: async (start: number, end: number) => {
        calls.push(["range", start, end]);
        if (failPage) return { data: null, error: new Error("database unavailable") };
        return { data: Array.from({ length: start === 0 ? 1000 : 1 }, (_, i) => order({ id: String(start + i) })), error: null };
      },
    };
    return chain;
  } };
  return { db: db as unknown as Parameters<typeof getSalesVat>[0], calls };
}
const from = new Date("2026-11-01T03:00:00Z");
const until = new Date("2026-12-01T03:00:00Z");

test("disabled module does not query orders", async () => {
  const { db, calls } = mockDb(false);
  const data = await getSalesVat(db, "tenant-a", from, until, []);
  assert.equal(data.summary, null);
  assert.equal(calls.some(call => call[1] === "orders"), false);
});

test("loads beyond 1000 orders with tenant and exclusive month boundaries", async () => {
  const { db, calls } = mockDb(true);
  const data = await getSalesVat(db, "tenant-a", from, until, []);
  assert.equal(data.summary?.count, 1001);
  assert.equal(data.summary?.vat, 21021);
  assert.equal(calls.filter(call => call[0] === "eq" && call[1] === "tenant_id" && call[2] === "tenant-a").length, 3);
  assert.ok(calls.some(call => call[0] === "lt" && call[2] === until.toISOString()));
  assert.ok(calls.some(call => call[0] === "gte" && call[2] === from.toISOString()));
});

test("query failures never display a misleading zero balance", async () => {
  const { db } = mockDb(true, true);
  const data = await getSalesVat(db, "tenant-a", from, until, []);
  assert.equal(data.summary, null);
  assert.ok(data.error);
});
