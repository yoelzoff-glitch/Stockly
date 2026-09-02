import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  getTenantDateTimeParts,
  getMidnightInTimezone,
  getTenantDateString,
  getPeriodRangeInTimezone,
  DEFAULT_TIMEZONE,
} from "../../src/lib/dates";

describe("Date & Timezone Utilities Tests", () => {
  test("getTenantDateTimeParts breaks down date in Argentina timezone", () => {
    // 2026-06-15T15:30:00Z -> In UTC-3 is 2026-06-15 12:30:00
    const d = new Date(Date.UTC(2026, 5, 15, 15, 30, 0));
    const parts = getTenantDateTimeParts(d, DEFAULT_TIMEZONE);

    assert.equal(parts.year, 2026);
    assert.equal(parts.month, 6);
    assert.equal(parts.day, 15);
    assert.equal(parts.hour, 12);
    assert.equal(parts.minute, 30);
  });

  test("getTenantDateString returns YYYY-MM-DD format", () => {
    const d = new Date(Date.UTC(2026, 0, 5, 12, 0, 0));
    const str = getTenantDateString(d, DEFAULT_TIMEZONE);
    assert.equal(str, "2026-01-05");
  });

  test("getMidnightInTimezone returns exact start of day", () => {
    const d = new Date(Date.UTC(2026, 2, 10, 18, 45, 0));
    const midnight = getMidnightInTimezone(d, DEFAULT_TIMEZONE);
    const parts = getTenantDateTimeParts(midnight, DEFAULT_TIMEZONE);

    assert.equal(parts.hour, 0);
    assert.equal(parts.minute, 0);
    assert.equal(parts.second, 0);
    assert.equal(parts.day, 10);
    assert.equal(parts.month, 3);
  });

  test("getPeriodRangeInTimezone handles current_month", () => {
    const { dateFrom, dateTo } = getPeriodRangeInTimezone("current_month", DEFAULT_TIMEZONE);
    assert.ok(dateFrom instanceof Date);
    assert.ok(dateTo instanceof Date);
    assert.ok(dateFrom.getTime() <= dateTo.getTime());

    const fromParts = getTenantDateTimeParts(dateFrom, DEFAULT_TIMEZONE);
    assert.equal(fromParts.day, 1);
    assert.equal(fromParts.hour, 0);
  });

  test("getPeriodRangeInTimezone handles custom date bounds", () => {
    const { dateFrom, dateTo } = getPeriodRangeInTimezone(
      "custom",
      DEFAULT_TIMEZONE,
      "2026-04-01",
      "2026-04-15"
    );

    const fromParts = getTenantDateTimeParts(dateFrom, DEFAULT_TIMEZONE);
    assert.equal(fromParts.year, 2026);
    assert.equal(fromParts.month, 4);
    assert.equal(fromParts.day, 1);

    const toParts = getTenantDateTimeParts(dateTo, DEFAULT_TIMEZONE);
    assert.equal(toParts.year, 2026);
    assert.equal(toParts.month, 4);
    assert.equal(toParts.day, 15);
  });
});
