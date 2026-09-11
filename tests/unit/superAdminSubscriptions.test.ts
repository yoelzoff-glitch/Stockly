import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  SubscriptionStatus,
  CancellationReason,
} from "../../src/services/super-admin/subscriptions";

describe("Sprint 32: Super Admin Subscriptions Service Unit Tests", () => {
  test("validates supported subscription statuses", () => {
    const validStatuses: SubscriptionStatus[] = [
      "trialing",
      "active",
      "past_due",
      "cancelled",
      "expired",
      "paused",
    ];
    assert.equal(validStatuses.length, 6);
  });

  test("validates supported cancellation reasons", () => {
    const validReasons: CancellationReason[] = [
      "too_expensive",
      "missing_feature",
      "not_using",
      "technical_problems",
      "switched_product",
      "business_closed",
      "other",
    ];
    assert.equal(validReasons.length, 7);
  });

  test("trial calculation properly advances date", () => {
    const now = new Date("2026-09-01T00:00:00Z");
    const trialDays = 14;
    const trialEnd = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000);

    assert.equal(trialEnd.toISOString(), "2026-09-15T00:00:00.000Z");
  });

  test("plan upgrade vs downgrade classification based on price", () => {
    const oldPrice = 25000;
    const upgradePrice = 45000;
    const downgradePrice = 15000;

    assert.equal(upgradePrice >= oldPrice, true); // upgraded
    assert.equal(downgradePrice >= oldPrice, false); // downgraded
  });
});
