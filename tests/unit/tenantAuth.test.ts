import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  requireAuthenticatedUser,
  requireTenantContext,
  requireTenantRole,
  assertRequestedTenant,
  TenantAuthError,
  toAuthErrorResponse,
} from "../../src/lib/security/tenantAuth";
import { invalidateFeatureFlagCache } from "../../src/lib/safety/featureFlags";

describe("Tenant Authentication & Authorization Service Tests", () => {
  beforeEach(() => {
    invalidateFeatureFlagCache();
  });

  describe("requireAuthenticatedUser", () => {
    test("rejects with 401 when no session exists", async () => {
      const mockUnauthClient = {
        auth: {
          getUser: async () => ({ data: { user: null }, error: { message: "No session" } }),
        },
      };

      await assert.rejects(
        async () => {
          await requireAuthenticatedUser(undefined, mockUnauthClient);
        },
        (err: any) => {
          assert.ok(err instanceof TenantAuthError);
          assert.equal(err.code, "AUTH_REQUIRED");
          assert.equal(err.statusCode, 401);
          return true;
        }
      );
    });

    test("resolves user when session is valid", async () => {
      const mockAuthClient = {
        auth: {
          getUser: async () => ({
            data: { user: { id: "user-123", email: "test@klyvo.com" } },
            error: null,
          }),
        },
      };

      const result = await requireAuthenticatedUser(undefined, mockAuthClient);
      assert.equal(result.user.id, "user-123");
      assert.ok(result.correlationId);
    });
  });

  describe("requireTenantContext", () => {
    test("rejects with 403 when user profile does not exist", async () => {
      const mockClient = {
        auth: {
          getUser: async () => ({ data: { user: { id: "user-no-profile" } }, error: null }),
        },
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
        }),
      };

      await assert.rejects(
        async () => {
          await requireTenantContext(undefined, { customClient: mockClient });
        },
        (err: any) => {
          assert.ok(err instanceof TenantAuthError);
          assert.equal(err.code, "PROFILE_NOT_FOUND");
          assert.equal(err.statusCode, 403);
          return true;
        }
      );
    });

    test("rejects with 403 when profile is inactive (is_active = false)", async () => {
      const mockClient = {
        auth: {
          getUser: async () => ({ data: { user: { id: "user-inactive" } }, error: null }),
        },
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { tenant_id: "tenant-abc", role: "user", is_active: false },
                error: null,
              }),
            }),
          }),
        }),
      };

      await assert.rejects(
        async () => {
          await requireTenantContext(undefined, { customClient: mockClient });
        },
        (err: any) => {
          assert.ok(err instanceof TenantAuthError);
          assert.equal(err.code, "INACTIVE_USER_DENIED");
          assert.equal(err.statusCode, 403);
          return true;
        }
      );
    });

    test("rejects with 403 when profile has no assigned tenant", async () => {
      const mockClient = {
        auth: {
          getUser: async () => ({ data: { user: { id: "user-no-tenant" } }, error: null }),
        },
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { tenant_id: null, role: "user", is_active: true },
                error: null,
              }),
            }),
          }),
        }),
      };

      await assert.rejects(
        async () => {
          await requireTenantContext(undefined, { customClient: mockClient });
        },
        (err: any) => {
          assert.ok(err instanceof TenantAuthError);
          assert.equal(err.code, "TENANT_NOT_ASSIGNED");
          assert.equal(err.statusCode, 403);
          return true;
        }
      );
    });

    test("returns full TenantContext for active user with tenant", async () => {
      const mockClient = {
        auth: {
          getUser: async () => ({ data: { user: { id: "user-ok" } }, error: null }),
        },
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { tenant_id: "tenant-ok-123", role: "owner", is_active: true },
                error: null,
              }),
            }),
          }),
        }),
      };

      const context = await requireTenantContext(undefined, { customClient: mockClient });
      assert.equal(context.userId, "user-ok");
      assert.equal(context.tenantId, "tenant-ok-123");
      assert.equal(context.role, "owner");
      assert.equal(context.isActive, true);
    });
  });

  describe("assertRequestedTenant", () => {
    const mockContext = {
      userId: "user-1",
      tenantId: "tenant-real-123",
      role: "owner" as const,
      isActive: true,
      correlationId: "corr-1",
    };

    test("permits when requestedTenantId is omitted or null", () => {
      assert.doesNotThrow(() => {
        assertRequestedTenant(mockContext, undefined);
        assertRequestedTenant(mockContext, null);
        assertRequestedTenant(mockContext, "");
      });
    });

    test("permits when requestedTenantId matches actual tenantId", () => {
      assert.doesNotThrow(() => {
        assertRequestedTenant(mockContext, "tenant-real-123");
        assertRequestedTenant(mockContext, " tenant-real-123 ");
      });
    });

    test("throws 403 TenantAuthError when requestedTenantId does not match actual tenantId", () => {
      assert.throws(
        () => {
          assertRequestedTenant(mockContext, "tenant-attacker-999");
        },
        (err: any) => {
          assert.ok(err instanceof TenantAuthError);
          assert.equal(err.code, "TENANT_MISMATCH_DENIED");
          assert.equal(err.statusCode, 403);
          return true;
        }
      );
    });
  });

  describe("requireTenantRole with Feature Flag", () => {
    test("permits role when user role matches allowed roles", async () => {
      const mockClient = {
        auth: {
          getUser: async () => ({ data: { user: { id: "user-admin" } }, error: null }),
        },
        from: (table: string) => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { tenant_id: "tenant-xyz", role: "admin", is_active: true },
                error: null,
              }),
            }),
          }),
        }),
      };

      const context = await requireTenantRole(["owner", "admin"], undefined, { customClient: mockClient });
      assert.equal(context.role, "admin");
    });

    test("permits non-matching role when strict_tenant_authorization flag is FALSE (backwards compatibility)", async () => {
      const mockClient = {
        auth: {
          getUser: async () => ({ data: { user: { id: "user-standard" } }, error: null }),
        },
        from: (table: string) => ({
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { enabled: false },
                  error: null,
                }),
              }),
              maybeSingle: async () => ({
                data: { tenant_id: "tenant-xyz", role: "user", is_active: true },
                error: null,
              }),
            }),
          }),
        }),
      };

      // Even though 'user' is not in ['owner', 'admin'], permissive fallback allows it when flag is false
      const context = await requireTenantRole(["owner", "admin"], undefined, { customClient: mockClient });
      assert.equal(context.role, "user");
    });

    test("rejects with 403 when strict_tenant_authorization flag is TRUE and role is not allowed", async () => {
      const mockClient = {
        auth: {
          getUser: async () => ({ data: { user: { id: "user-standard" } }, error: null }),
        },
        from: (table: string) => ({
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { enabled: true },
                  error: null,
                }),
              }),
              maybeSingle: async () => ({
                data: { tenant_id: "tenant-xyz", role: "user", is_active: true },
                error: null,
              }),
            }),
          }),
        }),
      };

      await assert.rejects(
        async () => {
          await requireTenantRole(["owner", "admin"], undefined, { customClient: mockClient });
        },
        (err: any) => {
          assert.ok(err instanceof TenantAuthError);
          assert.equal(err.code, "ROLE_DENIED");
          assert.equal(err.statusCode, 403);
          return true;
        }
      );
    });
  });

  describe("toAuthErrorResponse", () => {
    test("formats TenantAuthError into clean JSON without exposing internals", async () => {
      const authErr = new TenantAuthError("TENANT_MISMATCH_DENIED", "Access forbidden: Tenant mismatch", 403, "corr-xyz");
      const res = toAuthErrorResponse(authErr, "corr-xyz");

      assert.equal(res.status, 403);
      assert.equal(res.headers.get("x-request-id"), "corr-xyz");
      const json = await res.json();
      assert.equal(json.error, "Access forbidden: Tenant mismatch");
    });

    test("handles JSON SyntaxError as 400 Bad Request", async () => {
      const syntaxErr = new SyntaxError("Unexpected token in JSON at position 0");
      const res = toAuthErrorResponse(syntaxErr, "corr-abc");

      assert.equal(res.status, 400);
      const json = await res.json();
      assert.equal(json.error, "Invalid JSON in request payload");
    });
  });
});
