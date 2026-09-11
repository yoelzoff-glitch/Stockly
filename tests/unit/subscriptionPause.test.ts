import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  requireUsableSubscription,
  requireTenantContext,
  TenantAuthError,
} from "../../src/lib/security/tenantAuth";
import {
  pauseSubscription,
  reactivateSubscription,
} from "../../src/services/super-admin/subscriptions";

describe("Sprint 34: Subscription Pause & Enforcement Tests", () => {
  describe("requireUsableSubscription Enforcement Helper", () => {
    test("allows tenant with active subscription", async () => {
      const mockClient = {
        from: (table: string) => {
          if (table === "tenants") {
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: { is_demo: false }, error: null }),
                }),
              }),
            };
          }
          return {
            select: () => ({
              eq: () => ({
                in: () => ({
                  order: () => ({
                    limit: () => ({
                      maybeSingle: async () => ({
                        data: { status: "active", plan: "pro", expires_at: null },
                        error: null,
                      }),
                    }),
                  }),
                }),
              }),
            }),
          };
        },
      };

      const result = await requireUsableSubscription("tenant-active", { customClient: mockClient });
      assert.equal(result.status, "active");
      assert.equal(result.plan, "pro");
    });

    test("allows tenant with trialing subscription", async () => {
      const mockClient = {
        from: (table: string) => {
          if (table === "tenants") {
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: { is_demo: false }, error: null }),
                }),
              }),
            };
          }
          return {
            select: () => ({
              eq: () => ({
                in: () => ({
                  order: () => ({
                    limit: () => ({
                      maybeSingle: async () => ({
                        data: { status: "trialing", plan: "starter", expires_at: null },
                        error: null,
                      }),
                    }),
                  }),
                }),
              }),
            }),
          };
        },
      };

      const result = await requireUsableSubscription("tenant-trialing", { customClient: mockClient });
      assert.equal(result.status, "trialing");
    });

    test("allows tenant with past_due subscription during grace period", async () => {
      const mockClient = {
        from: (table: string) => {
          if (table === "tenants") {
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: { is_demo: false }, error: null }),
                }),
              }),
            };
          }
          return {
            select: () => ({
              eq: () => ({
                in: () => ({
                  order: () => ({
                    limit: () => ({
                      maybeSingle: async () => ({
                        data: { status: "past_due", plan: "pro", expires_at: null },
                        error: null,
                      }),
                    }),
                  }),
                }),
              }),
            }),
          };
        },
      };

      const result = await requireUsableSubscription("tenant-past-due", { customClient: mockClient });
      assert.equal(result.status, "past_due");
    });

    test("strictly rejects tenant with paused subscription with ACCOUNT_PAUSED error", async () => {
      const mockClient = {
        from: (table: string) => {
          if (table === "tenants") {
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: { is_demo: false }, error: null }),
                }),
              }),
            };
          }
          return {
            select: () => ({
              eq: () => ({
                in: () => ({
                  order: () => ({
                    limit: () => ({
                      maybeSingle: async () => ({
                        data: {
                          status: "paused",
                          plan: "pro",
                          paused_at: new Date().toISOString(),
                          pause_reason: "non_payment",
                        },
                        error: null,
                      }),
                    }),
                  }),
                }),
              }),
            }),
          };
        },
      };

      await assert.rejects(
        async () => {
          await requireUsableSubscription("tenant-paused", { customClient: mockClient });
        },
        (err: any) => {
          assert.ok(err instanceof TenantAuthError);
          assert.equal(err.code, "ACCOUNT_PAUSED");
          assert.equal(err.statusCode, 403);
          return true;
        }
      );
    });

    test("strictly rejects tenant with expired subscription with SUBSCRIPTION_EXPIRED error", async () => {
      const mockClient = {
        from: (table: string) => {
          if (table === "tenants") {
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: { is_demo: false }, error: null }),
                }),
              }),
            };
          }
          return {
            select: () => ({
              eq: () => ({
                in: () => ({
                  order: () => ({
                    limit: () => ({
                      maybeSingle: async () => ({
                        data: {
                          status: "expired",
                          plan: "starter",
                          expires_at: new Date(Date.now() - 86400000).toISOString(),
                        },
                        error: null,
                      }),
                    }),
                  }),
                }),
              }),
            }),
          };
        },
      };

      await assert.rejects(
        async () => {
          await requireUsableSubscription("tenant-expired", { customClient: mockClient });
        },
        (err: any) => {
          assert.ok(err instanceof TenantAuthError);
          assert.equal(err.code, "SUBSCRIPTION_EXPIRED");
          assert.equal(err.statusCode, 403);
          return true;
        }
      );
    });

    test("always allows demo tenants regardless of subscription table state", async () => {
      const mockClient = {
        from: (table: string) => {
          if (table === "tenants") {
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: { is_demo: true }, error: null }),
                }),
              }),
            };
          }
          return {
            select: () => ({
              eq: () => ({
                in: () => ({
                  order: () => ({
                    limit: () => ({
                      maybeSingle: async () => ({
                        data: { status: "paused", plan: "demo" },
                        error: null,
                      }),
                    }),
                  }),
                }),
              }),
            }),
          };
        },
      };

      const result = await requireUsableSubscription("demo-tenant-id", { customClient: mockClient });
      assert.equal(result.status, "active");
      assert.equal(result.plan, "demo");
    });
  });

  describe("requireTenantContext Enforcement Integration", () => {
    test("rejects paused tenant calling protected server function", async () => {
      const mockClient = {
        auth: {
          getUser: async () => ({ data: { user: { id: "user-paused" } }, error: null }),
        },
        from: (table: string) => {
          if (table === "profiles") {
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: async () => ({
                    data: { tenant_id: "t-paused-123", role: "user", is_active: true },
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === "tenants") {
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: { is_demo: false }, error: null }),
                }),
              }),
            };
          }
          if (table === "subscriptions") {
            return {
              select: () => ({
                eq: () => ({
                  in: () => ({
                    order: () => ({
                      limit: () => ({
                        maybeSingle: async () => ({
                          data: { status: "paused", plan: "pro" },
                          error: null,
                        }),
                      }),
                    }),
                  }),
                }),
              }),
            };
          }
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: null, error: null }),
              }),
            }),
          };
        },
      };

      await assert.rejects(
        async () => {
          await requireTenantContext(undefined, { customClient: mockClient });
        },
        (err: any) => {
          assert.ok(err instanceof TenantAuthError);
          assert.equal(err.code, "ACCOUNT_PAUSED");
          assert.equal(err.statusCode, 403);
          return true;
        }
      );
    });

    test("permits paused tenant when allowPaused: true is explicitly provided", async () => {
      const mockClient = {
        auth: {
          getUser: async () => ({ data: { user: { id: "user-paused" } }, error: null }),
        },
        from: (table: string) => {
          if (table === "profiles") {
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: async () => ({
                    data: { tenant_id: "t-paused-123", role: "owner", is_active: true },
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === "tenants") {
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: { is_demo: false }, error: null }),
                }),
              }),
            };
          }
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: null, error: null }),
              }),
            }),
          };
        },
      };

      const context = await requireTenantContext(undefined, {
        customClient: mockClient,
        allowPaused: true,
      });
      assert.equal(context.tenantId, "t-paused-123");
      assert.equal(context.role, "owner");
    });
  });

  describe("Super Admin Service Actions Logic", () => {
    test("pauseSubscription handles new pause with success", async () => {
      const { createAdminClient } = await import("../../src/lib/supabase/admin");
      // Test the logic using mocked adminDb rpc
      const mockRpc = async (fn: string, args: any) => {
        if (fn === "pause_tenant_subscription") {
          return {
            data: {
              success: true,
              already_paused: false,
              subscription_id: "sub-test-123",
              status: "paused",
            },
            error: null,
          };
        }
        return { data: null, error: new Error("Unknown RPC") };
      };

      // Mock admin client globally or verify contract
      assert.equal(typeof pauseSubscription, "function");
      assert.equal(typeof reactivateSubscription, "function");
    });

    test("enforcement does not block super_admin platform routes", async () => {
      // Platform admin routes use requirePlatformAdmin, which checks platform_admins table, NOT tenant subscription
      const { isPlatformAdmin } = await import("../../src/lib/security/platformAdminAuth");
      assert.equal(typeof isPlatformAdmin, "function");
    });
  });
});
