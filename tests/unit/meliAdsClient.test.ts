import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { AdsAdvertiserError } from "../../src/services/meli/ads/getAdvertiser";

describe("Sprint 24: Ads Client Error Classification & Edge Cases", () => {
  test("AdsAdvertiserError preserves error reasons and status codes", () => {
    const authErr = new AdsAdvertiserError("auth_error", "Session expired", 401);
    assert.equal(authErr.reason, "auth_error");
    assert.equal(authErr.statusCode, 401);
    assert.equal(authErr.name, "AdsAdvertiserError");
    assert.equal(authErr.code, "UNAUTHORIZED");

    const permErr = new AdsAdvertiserError("advertising_permission_missing", "Missing permission", 403);
    assert.equal(permErr.reason, "advertising_permission_missing");
    assert.equal(permErr.statusCode, 403);
    assert.equal(permErr.code, "FORBIDDEN");

    const notEnabledErr = new AdsAdvertiserError("product_ads_not_enabled", "Not enabled", 404);
    assert.equal(notEnabledErr.reason, "product_ads_not_enabled");
    assert.equal(notEnabledErr.statusCode, 404);
    assert.equal(notEnabledErr.code, "NOT_FOUND");
  });
});
