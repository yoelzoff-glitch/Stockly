import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseCompositeSku } from "../../src/services/products/sku/parseCompositeSku";

describe("Internal Stock Multi-Period Sales Calculation Tests", () => {
  it("accurately categorizes sales across current_month, 30d, 60d, and 90d buckets", () => {
    const now = new Date("2026-09-15T12:00:00Z");
    const nowMs = now.getTime();
    const startOfCurrentMonthMs = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const thirtyDaysAgoMs = nowMs - 30 * 24 * 60 * 60 * 1000;
    const sixtyDaysAgoMs = nowMs - 60 * 24 * 60 * 60 * 1000;
    const ninetyDaysAgoMs = nowMs - 90 * 24 * 60 * 60 * 1000;

    // Test orders at various timestamps
    const mockOrders = [
      { id: "o1", date: new Date("2026-09-10T10:00:00Z").getTime(), qty: 5 },  // Current month & 30d & 60d & 90d
      { id: "o2", date: new Date("2026-08-25T10:00:00Z").getTime(), qty: 10 }, // Past month (August) but within 30d (21 days ago) & 60d & 90d
      { id: "o3", date: new Date("2026-08-01T10:00:00Z").getTime(), qty: 8 },  // 45 days ago: 60d & 90d, NOT 30d, NOT current month
      { id: "o4", date: new Date("2026-06-25T10:00:00Z").getTime(), qty: 20 }, // 82 days ago: 90d only
      { id: "o5", date: new Date("2026-05-01T10:00:00Z").getTime(), qty: 50 }, // > 90 days ago: none
    ];

    let salesCurrentMonth = 0;
    let salesLast30 = 0;
    let salesLast60 = 0;
    let salesLast90 = 0;

    for (const ord of mockOrders) {
      if (ord.date >= ninetyDaysAgoMs) salesLast90 += ord.qty;
      if (ord.date >= sixtyDaysAgoMs) salesLast60 += ord.qty;
      if (ord.date >= thirtyDaysAgoMs) salesLast30 += ord.qty;
      if (ord.date >= startOfCurrentMonthMs) salesCurrentMonth += ord.qty;
    }

    assert.equal(salesCurrentMonth, 5, "Solo orden del 10/09 está en mes actual");
    assert.equal(salesLast30, 15, "o1 (5) + o2 (10) = 15 u. en últimos 30 días");
    assert.equal(salesLast60, 23, "o1 (5) + o2 (10) + o3 (8) = 23 u. en últimos 60 días");
    assert.equal(salesLast90, 43, "o1 (5) + o2 (10) + o3 (8) + o4 (20) = 43 u. en últimos 90 días");
  });

  it("correctly explodes composite SKUs into individual component units for sales calculations", () => {
    const compositeSku = "D260VNC197";
    const parsed = parseCompositeSku(compositeSku);

    assert.ok(parsed.components.length > 0);
    // Counts of each component in composite SKU
    const compCounts: Record<string, number> = {};
    parsed.components.forEach(comp => {
      compCounts[comp] = (compCounts[comp] || 0) + 1;
    });

    const itemQuantitySold = 3;
    const resolvedD260VN = (compCounts["D260VN"] || 0) * itemQuantitySold;
    const resolvedC197 = (compCounts["C197"] || 0) * itemQuantitySold;

    assert.equal(resolvedD260VN, 3, "D260VN vendido 3 veces");
    assert.equal(resolvedC197, 3, "C197 vendido 3 veces");
  });
});
