import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  PlatformAdminAuthError,
  requirePlatformAdmin,
} from "../../src/lib/security/platformAdminAuth";

describe("Sprint 32: Super Admin Platform Authorization Tests", () => {
  test("PlatformAdminAuthError properties and inheritance", () => {
    const err = new PlatformAdminAuthError(
      "PLATFORM_ADMIN_REQUIRED",
      "Platform admin required",
      403,
      "corr-123"
    );
    assert.equal(err.name, "PlatformAdminAuthError");
    assert.equal(err.code, "PLATFORM_ADMIN_REQUIRED");
    assert.equal(err.statusCode, 403);
    assert.equal(err.correlationId, "corr-123");
    assert.ok(err instanceof Error);
  });

  test("PlatformAdminAuthError defaults statusCode to 403", () => {
    const err = new PlatformAdminAuthError("PLATFORM_ROLE_UNAUTHORIZED", "Unauthorized role");
    assert.equal(err.statusCode, 403);
  });
});
