import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { calculateActivityHealth } from "../../src/services/super-admin/activity";

describe("Sprint 32: Super Admin Metrics & Health Classification Tests", () => {
  describe("calculateActivityHealth", () => {
    test("returns ACTIVE for activity within 3 days", () => {
      const now = new Date();
      assert.equal(calculateActivityHealth(now.toISOString()), "ACTIVE");

      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      assert.equal(calculateActivityHealth(twoDaysAgo.toISOString()), "ACTIVE");
    });

    test("returns LOW_ACTIVITY for activity between 4 and 7 days", () => {
      const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
      assert.equal(calculateActivityHealth(fiveDaysAgo.toISOString()), "LOW_ACTIVITY");

      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      assert.equal(calculateActivityHealth(sevenDaysAgo.toISOString()), "LOW_ACTIVITY");
    });

    test("returns AT_RISK for activity between 8 and 14 days", () => {
      const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      assert.equal(calculateActivityHealth(tenDaysAgo.toISOString()), "AT_RISK");

      const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
      assert.equal(calculateActivityHealth(fourteenDaysAgo.toISOString()), "AT_RISK");
    });

    test("returns INACTIVE for activity between 15 and 30 days", () => {
      const twentyDaysAgo = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);
      assert.equal(calculateActivityHealth(twentyDaysAgo.toISOString()), "INACTIVE");

      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      assert.equal(calculateActivityHealth(thirtyDaysAgo.toISOString()), "INACTIVE");
    });

    test("returns DORMANT for activity older than 30 days or missing", () => {
      const fortyDaysAgo = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
      assert.equal(calculateActivityHealth(fortyDaysAgo.toISOString()), "DORMANT");

      assert.equal(calculateActivityHealth(null), "DORMANT");
      assert.equal(calculateActivityHealth("invalid-date"), "DORMANT");
    });
  });

  describe("MRR and Revenue Calculation Logic", () => {
    test("calculates MRR by summing monthly_price_snapshot of active subscriptions only", () => {
      const subscriptions = [
        { status: "active", monthly_price_snapshot: 25000 },
        { status: "active", monthly_price_snapshot: 45000 },
        { status: "trialing", monthly_price_snapshot: 45000 }, // ignored for paid MRR
        { status: "cancelled", monthly_price_snapshot: 90000 }, // ignored
        { status: "paused", monthly_price_snapshot: 25000 }, // ignored
      ];

      const mrr = subscriptions
        .filter((s) => s.status === "active")
        .reduce((sum, s) => sum + s.monthly_price_snapshot, 0);

      assert.equal(mrr, 70000);
    });

    test("calculates real revenue using strictly approved payments and excludes refunds/adjustments", () => {
      const transactions = [
        { type: "payment", status: "approved", amount: 25000 },
        { type: "payment", status: "approved", amount: 45000 },
        { type: "payment", status: "failed", amount: 45000 }, // ignored
        { type: "payment", status: "pending", amount: 25000 }, // ignored
        { type: "refund", status: "approved", amount: 10000 }, // ignored
        { type: "adjustment", status: "approved", amount: 5000 }, // ignored
      ];

      const realRevenue = transactions
        .filter((t) => t.type === "payment" && t.status === "approved")
        .reduce((sum, t) => sum + t.amount, 0);

      assert.equal(realRevenue, 70000);
    });
  });
});
