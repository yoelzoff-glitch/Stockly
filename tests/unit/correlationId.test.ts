import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { getOrCreateCorrelationId, CORRELATION_ID_HEADER } from "../../src/lib/observability/correlationId";

describe("Correlation ID Tests", () => {
  test("generates valid UUID when no input is provided", () => {
    const id = getOrCreateCorrelationId();
    assert.ok(typeof id === "string");
    assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  test("reuses valid string ID", () => {
    const customId = "req-custom-123456";
    const id = getOrCreateCorrelationId(customId);
    assert.equal(id, customId);
  });

  test("extracts correlation ID from Headers object", () => {
    const headers = new Headers();
    headers.set(CORRELATION_ID_HEADER, "test-header-id-99");
    const id = getOrCreateCorrelationId(headers);
    assert.equal(id, "test-header-id-99");
  });

  test("extracts correlation ID from plain object", () => {
    const id = getOrCreateCorrelationId({ "x-request-id": "object-id-42" });
    assert.equal(id, "object-id-42");
  });

  test("rejects arbitrarily long IDs and generates secure UUID fallback", () => {
    const excessivelyLongId = "A".repeat(128);
    const id = getOrCreateCorrelationId(excessivelyLongId);
    assert.notEqual(id, excessivelyLongId);
    assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  test("rejects malformed special characters and generates secure UUID fallback", () => {
    const invalidId = "<script>alert(1)</script>";
    const id = getOrCreateCorrelationId(invalidId);
    assert.notEqual(id, invalidId);
    assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });
});
