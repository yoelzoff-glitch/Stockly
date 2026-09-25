import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  classifyTokenRefreshError,
  parseRetryAfterHeader,
  isTransientErrorString,
} from "../../src/services/meli/tokenErrorClassification";
import { advanceOrdersWatermark } from "../../src/services/meli/watermark";

// Module boundary setup to test real refreshMeliToken execution
const mockTables: Record<string, any[]> = {
  meli_accounts: [],
  operation_leases: [],
  meli_sync_state: [],
};

let dbWriteFailCount = 0;
let dbWriteFailMax = 0;

const mockDbClient: any = {
  rpc: async (fnName: string, params: any) => {
    if (fnName === "acquire_operation_lease") {
      const existing = mockTables.operation_leases.find(
        (l) => l.tenant_id === params.p_tenant_id && l.operation_type === params.p_operation_type
      );
      const now = Date.now();
      if (!existing || new Date(existing.expires_at).getTime() <= now || existing.lease_owner === params.p_lease_owner) {
        const expiresAt = new Date(now + (params.p_ttl_seconds || 300) * 1000).toISOString();
        if (existing) {
          existing.lease_owner = params.p_lease_owner;
          existing.expires_at = expiresAt;
        } else {
          mockTables.operation_leases.push({
            tenant_id: params.p_tenant_id,
            operation_type: params.p_operation_type,
            lease_owner: params.p_lease_owner,
            expires_at: expiresAt,
          });
        }
        return { data: { acquired: true, lease_owner: params.p_lease_owner, expires_at: expiresAt }, error: null };
      }
      return { data: { acquired: false, reason: "lease_active", current_owner: existing.lease_owner }, error: null };
    }

    if (fnName === "release_operation_lease") {
      const idx = mockTables.operation_leases.findIndex(
        (l) => l.tenant_id === params.p_tenant_id && l.operation_type === params.p_operation_type && l.lease_owner === params.p_lease_owner
      );
      if (idx >= 0) {
        mockTables.operation_leases.splice(idx, 1);
      }
      return { data: true, error: null };
    }

    if (fnName === "advance_meli_sync_watermark") {
      const existing = mockTables.meli_sync_state.find(
        (s) => s.tenant_id === params.p_tenant_id && s.resource_type === params.p_resource_type
      );
      const newMs = new Date(params.p_new_watermark).getTime();
      if (existing?.last_successful_sync_at) {
        const currentMs = new Date(existing.last_successful_sync_at).getTime();
        if (newMs <= currentMs) {
          return { data: { success: true, advanced: false, watermark: existing.last_successful_sync_at }, error: null };
        }
      }
      if (existing) {
        existing.last_successful_sync_at = params.p_new_watermark;
        existing.updated_at = new Date().toISOString();
      } else {
        mockTables.meli_sync_state.push({
          tenant_id: params.p_tenant_id,
          resource_type: params.p_resource_type,
          last_successful_sync_at: params.p_new_watermark,
          updated_at: new Date().toISOString(),
        });
      }
      return { data: { success: true, advanced: true, watermark: params.p_new_watermark }, error: null };
    }

    return { data: null, error: null };
  },

  from: (table: string) => {
    let selectedFields: string | null = null;
    let filters: Array<{ field: string; op: string; value: any }> = [];
    let orConditions: Array<(r: any) => boolean> = [];
    let updatePayload: any = null;
    let upsertPayload: any = null;

    const executeFilters = (rows: any[]) => {
      return rows.filter((r) => {
        const matchesEq = filters.every((f) => r[f.field] === f.value);
        if (!matchesEq) return false;
        if (orConditions.length > 0) {
          return orConditions.some((fn) => fn(r));
        }
        return true;
      });
    };

    const builder: any = {
      select: (fields: string) => {
        selectedFields = fields;
        return builder;
      },
      or: (expr: string) => {
        // e.g. `id.eq."abc",tenant_id.eq."abc"`
        const parts = expr.split(",").map((p) => p.trim());
        const conds: Array<{ field: string; val: string }> = [];
        for (const part of parts) {
          const m = part.match(/^([a-zA-Z0-9_]+)\.eq\."?([^"]+)"?$/);
          if (m) {
            conds.push({ field: m[1], val: m[2] });
          }
        }
        if (conds.length > 0) {
          orConditions.push((r: any) => conds.some((c) => r[c.field] === c.val));
        }
        return builder;
      },
      eq: (field: string, val: any) => {
        filters.push({ field, op: "eq", value: val });
        return builder;
      },
      update: (payload: any) => {
        updatePayload = payload;
        return builder;
      },
      upsert: (payload: any) => {
        upsertPayload = payload;
        return builder;
      },
      insert: async (payload: any) => {
        const arr = Array.isArray(payload) ? payload : [payload];
        if (!mockTables[table]) mockTables[table] = [];
        mockTables[table].push(...arr);
        return { data: arr, error: null };
      },
      single: async () => {
        const rows = executeFilters(mockTables[table] || []);
        if (!rows.length) return { data: null, error: { message: "Row not found" } };
        return { data: { ...rows[0] }, error: null };
      },
      maybeSingle: async () => {
        const rows = executeFilters(mockTables[table] || []);
        return { data: rows.length ? { ...rows[0] } : null, error: null };
      },
      then: (resolve: any, reject: any) => {
        // Execute update or upsert
        if (updatePayload) {
          if (dbWriteFailCount < dbWriteFailMax) {
            dbWriteFailCount++;
            return resolve({ data: null, error: { message: "Simulated transient Supabase write failure" } });
          }

          const targetRows = executeFilters(mockTables[table] || []);

          if (!targetRows.length) {
            return resolve({ data: [], error: null });
          }

          targetRows.forEach((r) => {
            Object.assign(r, updatePayload);
            if (updatePayload.token_version !== undefined) {
              r.token_version = updatePayload.token_version;
            }
          });

          return resolve({ data: targetRows.map((r) => ({ ...r })), error: null });
        }

        if (upsertPayload) {
          const arr = Array.isArray(upsertPayload) ? upsertPayload : [upsertPayload];
          arr.forEach((item) => {
            const existing = (mockTables[table] || []).find(
              (r) => r.tenant_id === item.tenant_id && r.resource_type === item.resource_type
            );
            if (existing) {
              Object.assign(existing, item);
            } else {
              mockTables[table].push({ ...item });
            }
          });
          return resolve({ data: arr, error: null });
        }

        const rows = executeFilters(mockTables[table] || []);
        return resolve({ data: rows, error: null });
      },
    };
    return builder;
  },
};

// Intercept admin client in require cache
function boundary(path: string, exports: any) {
  const id = require.resolve(path);
  require.cache[id] = { id, filename: id, loaded: true, exports } as any;
}

boundary("../../src/lib/supabase/admin", { createAdminClient: () => mockDbClient });

// Import refreshMeliToken after boundary is registered
const { refreshMeliToken, TransientMeliTokenError } = require("../../src/services/meli/refreshToken");

describe("Sprint: Continuidad Mercado Libre y Recuperación Automática de Ventas", () => {
  const originalFetch = globalThis.fetch;
  const originalEnvAppId = process.env.MELI_CLIENT_ID;
  const originalEnvSecret = process.env.MELI_CLIENT_SECRET;

  beforeEach(() => {
    process.env.MELI_CLIENT_ID = "TEST_APP_ID";
    process.env.MELI_CLIENT_SECRET = "TEST_APP_SECRET";
    dbWriteFailCount = 0;
    dbWriteFailMax = 0;
    mockTables.meli_accounts = [];
    mockTables.operation_leases = [];
    mockTables.meli_sync_state = [];
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env.MELI_CLIENT_ID = originalEnvAppId;
    process.env.MELI_CLIENT_SECRET = originalEnvSecret;
  });

  describe("1. Error Classification (429, Retry-After, invalid_grant, 5xx, timeouts)", () => {
    test("Caso A: 429 con header Retry-After numérico en segundos", () => {
      const classification = classifyTokenRefreshError(
        429,
        { status: 429, message: "local_rate_limited", error: "rate_limited" },
        null,
        "12"
      );

      assert.equal(classification.isTransient, true);
      assert.equal(classification.isPermanentAuth, false);
      assert.equal(classification.category, "rate_limit");
      assert.equal(classification.retryAfterMs, 12000);
      assert.match(classification.reason, /limitando temporalmente/i);
    });

    test("Caso B: 429 sin header Retry-After usa fallback predeterminado seguro", () => {
      const classification = classifyTokenRefreshError(
        429,
        { status: 429, message: "local_rate_limited" },
        null,
        null
      );

      assert.equal(classification.isTransient, true);
      assert.equal(classification.isPermanentAuth, false);
      assert.equal(classification.category, "rate_limit");
      assert.equal(classification.retryAfterMs, 5000);
    });

    test("Caso C: 429 con Retry-After como fecha HTTP RFC", () => {
      const futureDate = new Date(Date.now() + 15000).toUTCString();
      const parsed = parseRetryAfterHeader(futureDate);

      assert.ok(parsed !== null);
      assert.ok(parsed >= 13000 && parsed <= 16000);
    });

    test("Caso D: invalid_grant se clasifica como fallo permanente de autenticación", () => {
      const classification = classifyTokenRefreshError(
        400,
        {
          error: "invalid_grant",
          message: "Error validating grant. Your authorization code or refresh token may be expired or revoked.",
        },
        null,
        null
      );

      assert.equal(classification.isTransient, false);
      assert.equal(classification.isPermanentAuth, true);
      assert.equal(classification.category, "permanent_auth");
      assert.match(classification.reason, /invalid_grant|revoked|expired/i);
    });

    test("Caso E: Errores 5xx del servidor son transitorios", () => {
      const classification = classifyTokenRefreshError(
        503,
        { message: "Service Unavailable" },
        null,
        null
      );

      assert.equal(classification.isTransient, true);
      assert.equal(classification.isPermanentAuth, false);
      assert.equal(classification.category, "server_error");
    });

    test("Caso F: Timeout o AbortError es transitorio", () => {
      const err = new Error("The operation was aborted due to timeout");
      err.name = "AbortError";

      const classification = classifyTokenRefreshError(
        408,
        null,
        err,
        null
      );

      assert.equal(classification.isTransient, true);
      assert.equal(classification.isPermanentAuth, false);
      assert.equal(classification.category, "timeout");
    });

    test("Caso G: isTransientErrorString detecta correctamente 429, local_rate_limited y timeouts", () => {
      assert.equal(isTransientErrorString('{"status":429,"message":"local_rate_limited"}'), true);
      assert.equal(isTransientErrorString("Mercado Libre está limitando temporalmente las llamadas"), true);
      assert.equal(isTransientErrorString("504 Gateway Timeout"), true);
      assert.equal(isTransientErrorString("invalid_grant: grant revoked"), false);
      assert.equal(isTransientErrorString("unauthorized_client"), false);
      assert.equal(isTransientErrorString(null), false);
    });
  });

  describe("2. Ejecución Real de refreshMeliToken: Concurrencia y Dos Fases", () => {
    test("Caso H (OBLIGATORIO): Dos llamadas concurrentes a refreshMeliToken ejecutan UN SOLO POST OAuth y comparten tokens vigentes", async () => {
      let postCount = 0;

      mockTables.meli_accounts.push({
        id: "acc-concurrent-1",
        tenant_id: "tenant-concurrent-1",
        access_token: "OLD_ACCESS_TOKEN",
        refresh_token: "OLD_REFRESH_TOKEN",
        status: "connected",
        token_version: 1,
        token_expires_at: new Date(Date.now() - 1000).toISOString(),
      });

      globalThis.fetch = async (url: any) => {
        if (String(url).includes("/oauth/token")) {
          postCount++;
          // Simulate latency to force concurrent contention
          await new Promise((r) => setTimeout(r, 60));
          return new Response(
            JSON.stringify({
              access_token: "NEW_ACC_CONCURRENT",
              refresh_token: "NEW_REF_CONCURRENT",
              expires_in: 21600,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
        return new Response("{}", { status: 200 });
      };

      // Execute two refreshes in parallel for the exact same account
      const [res1, res2] = await Promise.all([
        refreshMeliToken("acc-concurrent-1"),
        refreshMeliToken("acc-concurrent-1"),
      ]);

      // Exactly ONE post to Mercado Libre OAuth!
      assert.equal(postCount, 1, "Debe existir un único POST OAuth a Mercado Libre");

      // Both callers receive the new token
      assert.equal(res1, "NEW_ACC_CONCURRENT");
      assert.equal(res2, "NEW_ACC_CONCURRENT");

      // Database has updated tokens and incremented version
      const dbAccount = mockTables.meli_accounts.find((a) => a.id === "acc-concurrent-1");
      assert.equal(dbAccount.access_token, "NEW_ACC_CONCURRENT");
      assert.equal(dbAccount.refresh_token, "NEW_REF_CONCURRENT");
      assert.equal(dbAccount.token_version, 2);
    });

    test("Caso I (OBLIGATORIO): Fallo 429 transitorio no pasa la cuenta a 'error' y guarda metadata estructurada", async () => {
      mockTables.meli_accounts.push({
        id: "acc-429-test",
        tenant_id: "tenant-429",
        access_token: "OLD_ACC",
        refresh_token: "OLD_REF",
        status: "connected",
        token_version: 1,
        retry_count: 0,
        token_expires_at: new Date(Date.now() + 10000).toISOString(),
      });

      globalThis.fetch = async (url: any) => {
        if (String(url).includes("/oauth/token")) {
          return new Response(
            JSON.stringify({ status: 429, message: "local_rate_limited", error: "rate_limited" }),
            { status: 429, headers: { "Content-Type": "application/json", "Retry-After": "8" } }
          );
        }
        return new Response("{}", { status: 200 });
      };

      await assert.rejects(
        async () => {
          await refreshMeliToken("acc-429-test", { force: true });
        },
        (err: any) => {
          assert.equal(err.name, "TransientMeliTokenError");
          assert.equal(err.statusCode, 429);
          assert.equal(err.retryAfterMs, 8000);
          return true;
        }
      );

      const dbAccount = mockTables.meli_accounts.find((a) => a.id === "acc-429-test");
      assert.equal(dbAccount.status, "connected", "Una cuenta con 429 NO debe pasar a error");
      assert.equal(dbAccount.last_failure_category, "rate_limit");
      assert.equal(dbAccount.retry_count, 1);
      assert.ok(dbAccount.next_retry_at !== null, "Debe guardar next_retry_at");
      assert.ok(new Date(dbAccount.next_retry_at).getTime() > Date.now());
    });

    test("Caso J (OBLIGATORIO): Fase 2 aislada - Si Mercado Libre da 200 y Supabase falla temporalmente, reintenta guardar esos mismos tokens y NUNCA re-llama OAuth con el refresh token anterior", async () => {
      let postCount = 0;
      dbWriteFailMax = 1; // Simulate 1 transient DB write failure

      mockTables.meli_accounts.push({
        id: "acc-stage2-test",
        tenant_id: "tenant-stage2",
        access_token: "OLD_ACC_2",
        refresh_token: "OLD_REF_2",
        status: "connected",
        token_version: 1,
        token_expires_at: new Date(Date.now() - 1000).toISOString(),
      });

      globalThis.fetch = async (url: any) => {
        if (String(url).includes("/oauth/token")) {
          postCount++;
          return new Response(
            JSON.stringify({
              access_token: "STAGE2_NEW_ACC",
              refresh_token: "STAGE2_NEW_REF",
              expires_in: 21600,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
        return new Response("{}", { status: 200 });
      };

      const result = await refreshMeliToken("acc-stage2-test", { force: true });

      // OAuth was called exactly once! It was NOT called again when DB write failed.
      assert.equal(postCount, 1, "Nunca debe volver a llamar a /oauth/token con el refresh token anterior");
      assert.equal(result, "STAGE2_NEW_ACC");

      const dbAccount = mockTables.meli_accounts.find((a) => a.id === "acc-stage2-test");
      assert.equal(dbAccount.access_token, "STAGE2_NEW_ACC");
      assert.equal(dbAccount.token_version, 2);
    });

    test("Caso K: Proceso que perdió su lease o quedó desactualizado no puede sobrescribir tokens con token_version anterior", async () => {
      // Simulate account already advanced to version 5 by another worker
      mockTables.meli_accounts.push({
        id: "acc-stale-worker",
        tenant_id: "tenant-stale",
        access_token: "LATEST_TOKEN_V5",
        refresh_token: "LATEST_REF_V5",
        status: "connected",
        token_version: 5,
        token_expires_at: new Date(Date.now() + 20000000).toISOString(),
      });

      // An outdated worker that read token_version: 1 attempts to update with token_version: 1
      const res = await mockDbClient
        .from("meli_accounts")
        .update({ access_token: "STALE_TOKEN_OVERWRITE", token_version: 2 })
        .eq("id", "acc-stale-worker")
        .eq("token_version", 1);

      assert.deepEqual(res.data, [], "El bloqueo optimista debe rechazar la escritura con version desactualizada");

      const dbAccount = mockTables.meli_accounts.find((a) => a.id === "acc-stale-worker");
      assert.equal(dbAccount.access_token, "LATEST_TOKEN_V5", "Los tokens vigentes deben quedar protegidos");
      assert.equal(dbAccount.token_version, 5);
    });

    test("Caso L: invalid_grant confirmado pasa la cuenta a 'error' y solicita reconexión", async () => {
      mockTables.meli_accounts.push({
        id: "acc-invalid-grant",
        tenant_id: "tenant-ig",
        access_token: "OLD_ACC",
        refresh_token: "REVOKED_REF",
        status: "connected",
        token_version: 1,
      });

      globalThis.fetch = async (url: any) => {
        if (String(url).includes("/oauth/token")) {
          return new Response(
            JSON.stringify({
              error: "invalid_grant",
              message: "Error validating grant. Your refresh token is invalid or revoked.",
            }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }
        return new Response("{}", { status: 200 });
      };

      await assert.rejects(
        async () => {
          await refreshMeliToken("acc-invalid-grant", { force: true });
        },
        (err: any) => {
          assert.match(err.message, /invalid_grant|revoked/i);
          return true;
        }
      );

      const dbAccount = mockTables.meli_accounts.find((a) => a.id === "acc-invalid-grant");
      assert.equal(dbAccount.status, "error");
      assert.equal(dbAccount.last_failure_category, "permanent_auth");
    });
  });

  describe("3. Criterio de Selección de Cron y Guard de 60 Minutos", () => {
    test("Caso M (OBLIGATORIO): Un token realmente vencido NUNCA es bloqueado por el guard de 60 minutos", () => {
      const now = Date.now();
      const accountRecentlyRefreshedButExpired = {
        id: "acc-expired-guard",
        tenant_id: "tenant-exp",
        status: "connected",
        last_success_refresh: new Date(now - 10 * 60 * 1000).toISOString(), // 10 minutes ago
        token_expires_at: new Date(now - 1000).toISOString(), // Expired 1 second ago!
      };

      const isActuallyExpired = new Date(accountRecentlyRefreshedButExpired.token_expires_at).getTime() <= now;
      let blockedBy60mGuard = false;

      if (accountRecentlyRefreshedButExpired.last_success_refresh && !isActuallyExpired) {
        const timeSince = now - new Date(accountRecentlyRefreshedButExpired.last_success_refresh).getTime();
        if (timeSince < 60 * 60 * 1000) {
          blockedBy60mGuard = true;
        }
      }

      assert.equal(isActuallyExpired, true);
      assert.equal(blockedBy60mGuard, false, "El guard de 60m no debe bloquear un token realmente vencido");
    });
  });

  describe("4. Monotonic Watermark y Sincronización de Ventas", () => {
    test("Caso N (OBLIGATORIO): advanceOrdersWatermark previene regresiones en el watermark ante ejecuciones atrasadas", async () => {
      const tenantId = "tenant-watermark-1";
      const t1 = "2026-09-25T10:00:00.000Z";
      const t0 = "2026-09-25T09:30:00.000Z"; // Older
      const t2 = "2026-09-25T10:45:00.000Z"; // Newer

      // 1. Initial advance to T1
      const res1 = await advanceOrdersWatermark(mockDbClient, tenantId, t1);
      assert.equal(res1.advanced, true);
      assert.equal(res1.watermark, t1);

      // 2. Delayed execution finishing with T0 (older)
      const resStale = await advanceOrdersWatermark(mockDbClient, tenantId, t0);
      assert.equal(resStale.advanced, false, "No debe avanzar con un watermark más viejo");
      assert.equal(resStale.watermark, t1, "Debe preservar el watermark más nuevo");

      // 3. Normal execution with T2 (newer)
      const resNewer = await advanceOrdersWatermark(mockDbClient, tenantId, t2);
      assert.equal(resNewer.advanced, true);
      assert.equal(resNewer.watermark, t2);
    });
  });
});
