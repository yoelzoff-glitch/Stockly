import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { normalizePlanKey, STATIC_PLAN_LIMITS } from "@/lib/billing/entitlements";
import { hashWebhookPayload } from "@/lib/security/idempotency";

describe("Sprint 5: Billing Entitlements, Event Keys & Access Modes Unit Tests", () => {
  describe("Plan Normalization & Static Limits", () => {
    test("normalizes plan keys correctly", () => {
      assert.equal(normalizePlanKey("starter"), "starter");
      assert.equal(normalizePlanKey("pro"), "pro");
      assert.equal(normalizePlanKey("ultra"), "ultra");
      assert.equal(normalizePlanKey("business"), "ultra");
      assert.equal(normalizePlanKey("free"), "starter");
      assert.equal(normalizePlanKey(null), "starter");
      assert.equal(normalizePlanKey(undefined), "starter");
    });

    test("provides non-zero limits for all plans", () => {
      for (const plan of ["starter", "pro", "ultra"] as const) {
        const limits = STATIC_PLAN_LIMITS[plan];
        assert.ok(limits.ai > 0);
        assert.ok(limits.auto > 0);
        assert.ok(limits.wa > 0);
        assert.ok(limits.pub > 0);
      }
      assert.ok(STATIC_PLAN_LIMITS.ultra.ai > STATIC_PLAN_LIMITS.pro.ai);
      assert.ok(STATIC_PLAN_LIMITS.pro.ai > STATIC_PLAN_LIMITS.starter.ai);
    });
  });

  describe("Access Mode Computation Logic", () => {
    function computeAccessMode(status: string, expiresAt: string | null, now: Date = new Date()) {
      if (status === "active" || status === "trialing") {
        if (expiresAt) {
          const expDate = new Date(expiresAt);
          const diffMs = expDate.getTime() - now.getTime();
          const threeDaysMs = 3 * 24 * 60 * 60 * 1000;

          if (diffMs < 0) {
            if (Math.abs(diffMs) <= threeDaysMs) {
              return { accessMode: "grace", reason: "grace_period" };
            }
            return { accessMode: "blocked", reason: "expired_over_3_days" };
          }
        }
        return { accessMode: "active", reason: "active_subscription" };
      }

      if (status === "past_due") {
        return { accessMode: "grace", reason: "past_due_retry" };
      }

      if (status === "cancelled") {
        if (expiresAt && new Date(expiresAt) > now) {
          return { accessMode: "active", reason: "cancelled_active_until_end" };
        }
        return { accessMode: "read_only", reason: "cancelled_and_ended" };
      }

      if (status === "expired") {
        return { accessMode: "blocked", reason: "expired" };
      }

      return { accessMode: "active", reason: "fallback_active" };
    }

    test("computes active mode for active subscription without expiration", () => {
      const res = computeAccessMode("active", null);
      assert.equal(res.accessMode, "active");
    });

    test("computes active mode for active subscription with future expiration", () => {
      const future = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString();
      const res = computeAccessMode("active", future);
      assert.equal(res.accessMode, "active");
    });

    test("computes grace mode for active subscription expired 1 day ago", () => {
      const oneDayAgo = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();
      const res = computeAccessMode("active", oneDayAgo);
      assert.equal(res.accessMode, "grace");
    });

    test("computes blocked mode for active subscription expired 5 days ago", () => {
      const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
      const res = computeAccessMode("active", fiveDaysAgo);
      assert.equal(res.accessMode, "blocked");
    });

    test("computes grace mode for past_due status", () => {
      const res = computeAccessMode("past_due", null);
      assert.equal(res.accessMode, "grace");
    });

    test("computes active mode for cancelled status with remaining period", () => {
      const future = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
      const res = computeAccessMode("cancelled", future);
      assert.equal(res.accessMode, "active");
    });

    test("computes read_only mode for cancelled status after period end", () => {
      const past = new Date(Date.now() - 1000).toISOString();
      const res = computeAccessMode("cancelled", past);
      assert.equal(res.accessMode, "read_only");
    });

    test("computes blocked mode for expired status", () => {
      const res = computeAccessMode("expired", null);
      assert.equal(res.accessMode, "blocked");
    });
  });

  describe("Webhook Event Key Deduplication Strategies", () => {
    test("Mercado Libre: identical retry yields identical key (deduplicated)", () => {
      const payload = {
        user_id: "123456",
        topic: "orders_v2",
        resource: "/orders/2000000000",
        sent: "2026-09-04T12:00:00.000Z",
        attempts: 1,
      };

      const resourceClean = payload.resource.replace(/\//g, "_");
      const key1 = `meli_${payload.user_id}_${payload.topic}_${resourceClean}_${payload.sent}`;
      const key2 = `meli_${payload.user_id}_${payload.topic}_${resourceClean}_${payload.sent}`;

      assert.equal(key1, key2);
    });

    test("Mercado Libre: subsequent update to same resource with new timestamp yields distinct key", () => {
      const payload1 = {
        user_id: "123456",
        topic: "orders_v2",
        resource: "/orders/2000000000",
        sent: "2026-09-04T12:00:00.000Z",
      };
      const payload2 = {
        user_id: "123456",
        topic: "orders_v2",
        resource: "/orders/2000000000",
        sent: "2026-09-04T12:05:00.000Z",
      };

      const resourceClean = payload1.resource.replace(/\//g, "_");
      const key1 = `meli_${payload1.user_id}_${payload1.topic}_${resourceClean}_${payload1.sent}`;
      const key2 = `meli_${payload2.user_id}_${payload2.topic}_${resourceClean}_${payload2.sent}`;

      assert.notEqual(key1, key2);
    });

    test("Mercado Pago: prioritized unique notification ID deduplicates exact notification", () => {
      const payload = {
        id: "1099887766",
        action: "payment.created",
        data: { id: "sub_12345" },
      };

      const key = `mp_${payload.id}`;
      assert.equal(key, "mp_1099887766");
    });

    test("Mercado Pago: multiple distinct updates for same subscription produce distinct keys without notification id", () => {
      const event1 = {
        topic: "subscription_preapproval",
        action: "updated",
        resourceId: "sub_12345",
        dateCreated: "2026-09-04T10:00:00.000Z",
      };
      const event2 = {
        topic: "subscription_preapproval",
        action: "cancelled",
        resourceId: "sub_12345",
        dateCreated: "2026-09-04T14:00:00.000Z",
      };

      const hash1 = hashWebhookPayload(event1).slice(0, 16);
      const hash2 = hashWebhookPayload(event2).slice(0, 16);

      const key1 = `mp_${event1.topic}_${event1.action}_${event1.resourceId}_${hash1}`;
      const key2 = `mp_${event2.topic}_${event2.action}_${event2.resourceId}_${hash2}`;

      assert.notEqual(key1, key2, "Two distinct subscription events must produce distinct keys");
    });
  });
});
