import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  calculateActivityHealth,
  ActivityHealth,
} from "../../src/services/super-admin/activity";

describe("Sprint 33: Super Admin Metrics & Health Classification Tests", () => {
  describe("calculateActivityHealth (Rules V1)", () => {
    test("actividad hoy -> ACTIVE", () => {
      const today = new Date();
      const res = calculateActivityHealth(today.toISOString());
      assert.equal(res.health, "ACTIVE");
      assert.equal(res.daysSince, 0);
      assert.ok(res.reason.includes("reciente"));
    });

    test("actividad hace 5 días -> ACTIVE (0–7 días)", () => {
      const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
      const res = calculateActivityHealth(fiveDaysAgo.toISOString());
      assert.equal(res.health, "ACTIVE");
      assert.equal(res.daysSince, 5);
      assert.ok(res.reason.includes("5 días"));
    });

    test("actividad hace 10 días -> AT_RISK (8–14 días)", () => {
      const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      const res = calculateActivityHealth(tenDaysAgo.toISOString());
      assert.equal(res.health, "AT_RISK");
      assert.equal(res.daysSince, 10);
      assert.ok(res.reason.includes("8–14d"));
    });

    test("actividad hace 20 días -> INACTIVE (15–30 días)", () => {
      const twentyDaysAgo = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);
      const res = calculateActivityHealth(twentyDaysAgo.toISOString());
      assert.equal(res.health, "INACTIVE");
      assert.equal(res.daysSince, 20);
      assert.ok(res.reason.includes("15–30d"));
    });

    test("actividad hace 45 días -> DORMANT (>30 días confirmados)", () => {
      const fortyFiveDaysAgo = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);
      const res = calculateActivityHealth(fortyFiveDaysAgo.toISOString());
      assert.equal(res.health, "DORMANT");
      assert.equal(res.daysSince, 45);
      assert.ok(res.reason.includes(">30d"));
    });

    test("actividad NULL -> UNKNOWN (TRACKING PENDIENTE)", () => {
      const resNull = calculateActivityHealth(null);
      assert.equal(resNull.health, "UNKNOWN");
      assert.equal(resNull.daysSince, null);
      assert.ok(resNull.reason.includes("Tracking pendiente"));

      const resUndefined = calculateActivityHealth(undefined);
      assert.equal(resUndefined.health, "UNKNOWN");
      assert.equal(resUndefined.daysSince, null);

      const resEmpty = calculateActivityHealth("");
      assert.equal(resEmpty.health, "UNKNOWN");
    });

    test("CRITICAL MANDATORY CONTRACT: NULL !== DORMANT", () => {
      const resNull = calculateActivityHealth(null);
      // Under no circumstance should null be classified as DORMANT or infer +30 days
      assert.notEqual(resNull.health, "DORMANT");
      assert.equal(resNull.health, "UNKNOWN");
      assert.equal(resNull.daysSince, null);
    });
  });

  describe("MRR vs Revenue Contract", () => {
    test("calculates MRR by summing monthly_price_snapshot of active subscriptions only", () => {
      const subscriptions = [
        { status: "active", monthly_price_snapshot: 25000 },
        { status: "active", monthly_price_snapshot: 45000 },
        { status: "trialing", monthly_price_snapshot: 45000 }, // excluded
        { status: "cancelled", monthly_price_snapshot: 90000 }, // excluded
        { status: "paused", monthly_price_snapshot: 25000 }, // excluded
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
        { type: "payment", status: "failed", amount: 45000 }, // excluded
        { type: "payment", status: "pending", amount: 25000 }, // excluded
        { type: "refund", status: "approved", amount: 10000 }, // excluded
        { type: "adjustment", status: "approved", amount: 5000 }, // excluded
      ];

      const realRevenue = transactions
        .filter((t) => t.type === "payment" && t.status === "approved")
        .reduce((sum, t) => sum + t.amount, 0);

      assert.equal(realRevenue, 70000);
    });
  });

  describe("Altas and Bajas Definitions", () => {
    const startOfMonth = "2026-09-01T00:00:00.000Z";

    test("Altas counts only first paid subscriptions started this month", () => {
      const subs = [
        { status: "active", started_at: "2026-09-05T00:00:00Z", monthly_price_snapshot: 45000 }, // Alta
        { status: "active", started_at: "2026-08-15T00:00:00Z", monthly_price_snapshot: 25000 }, // Prior month
        { status: "trialing", started_at: "2026-09-08T00:00:00Z", monthly_price_snapshot: 0 }, // Trial (not paid alta)
      ];

      const altas = subs.filter(
        (s) =>
          s.started_at >= startOfMonth &&
          s.status === "active" &&
          s.monthly_price_snapshot > 0
      ).length;

      assert.equal(altas, 1);
    });

    test("Bajas counts only subscriptions effectively cancelled this month", () => {
      const subs = [
        { status: "cancelled", cancelled_at: "2026-09-03T00:00:00Z", cancel_at_period_end: false }, // Baja
        { status: "active", cancel_at_period_end: true, current_period_end: "2026-09-25T00:00:00Z" }, // Pending cancellation (NOT counted as baja yet)
        { status: "cancelled", cancelled_at: "2026-07-01T00:00:00Z" }, // Prior month baja
      ];

      const bajas = subs.filter(
        (s) =>
          s.status === "cancelled" &&
          s.cancelled_at &&
          s.cancelled_at >= startOfMonth
      ).length;

      assert.equal(bajas, 1);
    });
  });
});
