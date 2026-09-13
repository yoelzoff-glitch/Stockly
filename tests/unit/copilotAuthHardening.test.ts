import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  requireAuthenticatedUser,
  requireTenantContext,
  TenantAuthError,
  toAuthErrorResponse,
} from "../../src/lib/security/tenantAuth";

describe("Copilot Auth Hardening & SSR Tenant Isolation Tests", () => {
  const rootDir = path.resolve(__dirname, "../..");

  describe("1. requireAuthenticatedUser Session Resolution & Fallbacks", () => {
    test("Priority 1: resolves user from Supabase SSR cookie when present", async () => {
      const mockClient = {
        auth: {
          getUser: async (token?: string) => {
            if (!token) {
              // Cookie lookup
              return {
                data: { user: { id: "cookie-user-123", email: "user@test.com" } },
                error: null,
              };
            }
            return { data: { user: null }, error: { message: "Unexpected token call" } };
          },
        },
      };

      const req = new Request("http://localhost/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const result = await requireAuthenticatedUser(req, mockClient);
      assert.equal(result.user.id, "cookie-user-123");
      assert.ok(result.correlationId);
    });

    test("Priority 2: falls back to Supabase Bearer token when cookie is absent/invalid", async () => {
      const validToken = "supabase-test-access-token-xyz";
      let validatedTokenParam: string | undefined;

      const mockClient = {
        auth: {
          getUser: async (token?: string) => {
            if (!token) {
              // Cookie lookup fails
              return { data: { user: null }, error: { message: "No active session cookie" } };
            }
            validatedTokenParam = token;
            if (token === validToken) {
              return {
                data: { user: { id: "bearer-user-456", email: "bearer@test.com" } },
                error: null,
              };
            }
            return { data: { user: null }, error: { message: "Invalid bearer token" } };
          },
        },
      };

      const req = new Request("http://localhost/api/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${validToken}`,
        },
      });

      const result = await requireAuthenticatedUser(req, mockClient);
      assert.equal(validatedTokenParam, validToken);
      assert.equal(result.user.id, "bearer-user-456");
    });

    test("Rejects with 401 when both cookie and Bearer token are absent or invalid", async () => {
      const mockClient = {
        auth: {
          getUser: async () => ({
            data: { user: null },
            error: { message: "Invalid JWT / expired" },
          }),
        },
      };

      const req = new Request("http://localhost/api/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer invalid-token",
        },
      });

      await assert.rejects(
        async () => {
          await requireAuthenticatedUser(req, mockClient);
        },
        (err: any) => {
          assert.ok(err instanceof TenantAuthError);
          assert.equal(err.code, "AUTH_REQUIRED");
          assert.equal(err.statusCode, 401);
          return true;
        }
      );
    });

    test("Rejects with 401 for expired session and formats clean response with error code", async () => {
      const mockClient = {
        auth: {
          getUser: async () => ({
            data: { user: null },
            error: { message: "JWT expired" },
          }),
        },
      };

      try {
        await requireAuthenticatedUser(undefined, mockClient);
        assert.fail("Should have thrown TenantAuthError");
      } catch (err: any) {
        assert.equal(err.statusCode, 401);
        const response = toAuthErrorResponse(err, "test-corr-id");
        assert.equal(response.status, 401);
        const json = await response.json();
        assert.equal(json.code, "AUTH_REQUIRED");
        assert.equal(json.error, "Authentication required");
      }
    });
  });

  describe("2. requireTenantContext Strict Server-Side Derivation", () => {
    test("Derives tenantId strictly from profiles.tenant_id for authenticated user.id", async () => {
      const mockClient = {
        auth: {
          getUser: async () => ({
            data: { user: { id: "authenticated-user-789" } },
            error: null,
          }),
        },
        from: (table: string) => {
          if (table === "profiles") {
            return {
              select: () => ({
                eq: (col: string, val: string) => {
                  assert.equal(col, "id");
                  assert.equal(val, "authenticated-user-789");
                  return {
                    maybeSingle: async () => ({
                      data: { tenant_id: "tenant-derived-999", role: "admin", is_active: true },
                      error: null,
                    }),
                  };
                },
              }),
            };
          }
          if (table === "tenants") {
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: async () => ({
                    data: { is_demo: false },
                    error: null,
                  }),
                }),
              }),
            };
          }
          return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) };
        },
      };

      const context = await requireTenantContext(undefined, {
        customClient: mockClient,
        allowPaused: true,
      });

      assert.equal(context.userId, "authenticated-user-789");
      assert.equal(context.tenantId, "tenant-derived-999");
      assert.equal(context.role, "admin");
    });
  });

  describe("3. API Route POST /api/ai/chat Security Boundaries", () => {
    const routePath = path.join(rootDir, "src/app/api/ai/chat/route.ts");
    const routeContent = fs.readFileSync(routePath, "utf-8");

    test("POST /api/ai/chat strictly invokes requireTenantContext(request) as first barrier", () => {
      assert.ok(
        routeContent.includes("const context = await requireTenantContext(request);"),
        "POST handler must immediately call requireTenantContext(request)"
      );
    });

    test("POST /api/ai/chat derives tenantId exclusively from context.tenantId (ignores body)", () => {
      assert.ok(
        routeContent.includes("const tenantId = context.tenantId;"),
        "tenantId must be obtained directly from context.tenantId"
      );
      assert.ok(
        !routeContent.includes("body.tenantId") && !routeContent.includes("body?.tenantId"),
        "tenantId must NEVER be accepted or assigned from request body"
      );
    });

    test("POST /api/ai/chat never leaks raw technical errors (e.g. database traces or JWTs)", () => {
      assert.ok(
        routeContent.includes("toAuthErrorResponse(error"),
        "Auth errors must be handled via toAuthErrorResponse"
      );
      assert.ok(
        routeContent.includes("No pude consultar tus datos en este momento"),
        "Internal server errors must return friendly localized message"
      );
    });
  });

  describe("4. Dashboard Layout Auth Enforcement", () => {
    const layoutPath = path.join(rootDir, "src/app/dashboard/layout.tsx");
    const layoutContent = fs.readFileSync(layoutPath, "utf-8");

    test("DashboardLayout immediately redirects unauthenticated users to /login", () => {
      assert.ok(
        layoutContent.includes('if (!user) {\n    redirect("/login");\n  }') ||
        layoutContent.includes('if (!user) {\r\n    redirect("/login");\r\n  }'),
        "Dashboard layout must redirect to /login if user is null"
      );
    });

    test("DashboardLayout does NOT contain fallback unauthenticated render block", () => {
      // Must not render LibretaXCopilot or Navbar outside an authenticated session
      const countCopilot = (layoutContent.match(/<LibretaXCopilot/g) || []).length;
      assert.equal(countCopilot, 1, "There must only be 1 LibretaXCopilot instance in authenticated branch");
    });
  });

  describe("5. Copilot Frontend Session Transport & Error Mapping", () => {
    const copilotPath = path.join(rootDir, "src/components/copilot/LibretaXCopilot.tsx");
    const copilotContent = fs.readFileSync(copilotPath, "utf-8");

    test("LibretaXCopilot includes credentials: 'same-origin' in chat fetch", () => {
      assert.ok(
        copilotContent.includes('credentials: "same-origin"'),
        "Fetch call must specify credentials: 'same-origin'"
      );
    });

    test("LibretaXCopilot sends only message and NEVER sends tenantId", () => {
      assert.ok(
        copilotContent.includes("body: JSON.stringify({ message: text })"),
        "Request payload must strictly be { message: text }"
      );
      assert.ok(
        !copilotContent.includes("tenantId:"),
        "Copilot component must never send tenantId"
      );
    });

    test("LibretaXCopilot maps 401 to friendly re-login prompt with action button", () => {
      assert.ok(
        copilotContent.includes("Tu sesión venció. Volvé a iniciar sesión para seguir usando LibretaX Copilot."),
        "Must map 401 to session expired message"
      );
      assert.ok(
        copilotContent.includes('label: "Iniciar sesión"'),
        "Must provide Iniciar sesión action button for 401"
      );
      assert.ok(
        copilotContent.includes('href: "/login"'),
        "Action button must direct to /login"
      );
    });
  });
});
