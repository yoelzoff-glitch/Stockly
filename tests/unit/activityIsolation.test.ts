import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  calculateActivityHealth,
  ActivityHealth,
} from "../../src/services/super-admin/activity";

describe("Sprint 33: Activity Isolation & Throttling Safety Tests", () => {
  test("Separation of Human Activity: last_ml_sync does not affect human health", () => {
    // If a tenant has ml sync today, but human activity was 20 days ago,
    // the health MUST be INACTIVE (not ACTIVE), because automated ML sync is not human activity!
    const twentyDaysAgo = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);
    const health = calculateActivityHealth(twentyDaysAgo.toISOString());

    assert.equal(health.health, "INACTIVE");
    assert.equal(health.daysSince, 20);
  });

  test("Missing human activity with active ML sync must be UNKNOWN, not DORMANT", () => {
    // If last_user_activity_at is null, health MUST be UNKNOWN regardless of sync
    const health = calculateActivityHealth(null);
    assert.equal(health.health, "UNKNOWN");
    assert.equal(health.daysSince, null);
    assert.notEqual(health.health, "DORMANT");
  });

  test("Recent human activity correctly identifies as ACTIVE even if sync is older", () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const health = calculateActivityHealth(twoHoursAgo.toISOString());

    assert.equal(health.health, "ACTIVE");
    assert.equal(health.daysSince, 0);
  });
});
