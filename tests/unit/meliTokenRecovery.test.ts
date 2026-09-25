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
let rpcCallLog: Array<{ fnName: string; params: any }> = [];
let mockFailMarkUncertain = false;

const mockDbClient: any = {
  rpc: async (fnName: string, params: any) => {
    rpcCallLog.push({ fnName, params });

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

    if (fnName === "renew_operation_lease") {
      const lease = mockTables.operation_leases.find(
        (l) =>
          l.tenant_id === params.p_tenant_id &&
          l.operation_type === params.p_operation_type &&
          l.lease_owner === params.p_lease_owner
      );
      if (!lease || new Date(lease.expires_at).getTime() <= Date.now()) {
        return { data: { renewed: false, reason: "lease_not_found_or_lost" }, error: null };
      }
      lease.expires_at = new Date(Date.now() + params.p_ttl_seconds * 1000).toISOString();
      return { data: { renewed: true, expires_at: lease.expires_at }, error: null };
    }

    if (fnName === "mark_meli_token_rotation_uncertain") {
      if (mockFailMarkUncertain) {
        return { data: { marked: false, reason: "simulated_mark_failure" }, error: null };
      }
      const lease = mockTables.operation_leases.find(
        (l) => l.tenant_id === params.p_tenant_id && l.operation_type === params.p_operation_type
      );
      if (!lease || lease.lease_owner !== params.p_lease_owner) {
        return { data: { marked: false, reason: "lease_not_owned" }, error: null };
      }
      if (new Date(lease.expires_at).getTime() <= Date.now()) {
        return { data: { marked: false, reason: "lease_expired" }, error: null };
      }
      const account = mockTables.meli_accounts.find(
        (a) => a.id === params.p_account_id && a.tenant_id === params.p_tenant_id
      );
      if (!account) {
        return { data: { marked: false, reason: "account_not_found" }, error: null };
      }
      if (account.token_version !== params.p_expected_version) {
        return { data: { marked: false, reason: "version_conflict", actual_version: account.token_version }, error: null };
      }
      account.sync_error = params.p_reason;
      account.last_failure_category = "rotation_uncertain";
      account.last_failure_reason = params.p_reason;
      account.next_retry_at = null;
      account.updated_at = params.p_marked_at || new Date().toISOString();
      return { data: { marked: true, reason: null, actual_version: account.token_version }, error: null };
    }

    if (fnName === "check_meli_token_refresh_lease") {
      const lease = mockTables.operation_leases.find(
        (l) =>
          l.tenant_id === params.p_tenant_id &&
          l.operation_type === params.p_operation_type
      );
      if (!lease || lease.lease_owner !== params.p_lease_owner) {
        return { data: { valid: false, reason: "lease_not_owned" }, error: null };
      }
      if (new Date(lease.expires_at).getTime() <= Date.now()) {
        return { data: { valid: false, reason: "lease_expired" }, error: null };
      }
      return { data: { valid: true, expires_at: lease.expires_at }, error: null };
    }

    if (fnName === "persist_meli_token_rotation") {
      if (dbWriteFailCount < dbWriteFailMax) {
        dbWriteFailCount++;
        return { data: null, error: { message: "Simulated transient Supabase RPC failure" } };
      }
      const lease = mockTables.operation_leases.find(
        (l) =>
          l.tenant_id === params.p_tenant_id &&
          l.operation_type === params.p_operation_type
      );
      if (!lease || lease.lease_owner !== params.p_lease_owner) {
        return { data: { persisted: false, reason: "lease_not_owned" }, error: null };
      }
      if (new Date(lease.expires_at).getTime() <= Date.now()) {
        return { data: { persisted: false, reason: "lease_expired" }, error: null };
      }
      const account = mockTables.meli_accounts.find(
        (a) =>
          a.id === params.p_account_id &&
          a.tenant_id === params.p_tenant_id
      );
      if (!account) {
        return { data: { persisted: false, reason: "account_not_found" }, error: null };
      }
      if (account.token_version !== params.p_expected_version) {
        return { data: { persisted: false, reason: "version_conflict", actual_version: account.token_version }, error: null };
      }
      Object.assign(account, {
        access_token: params.p_access_token,
        refresh_token: params.p_refresh_token,
        token_expires_at: params.p_expires_at,
        token_version: params.p_expected_version + 1,
        status: "connected",
        retry_count: 0,
        next_retry_at: null,
        last_failure_category: null,
        last_failure_reason: null,
        last_success_refresh: params.p_refreshed_at,
        sync_error: null,
      });
      return {
        data: { persisted: true, token_version: account.token_version },
        error: null,
      };
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
      if (!params.p_resource_type || params.p_resource_type.trim().length === 0) {
        return { data: { success: false, reason: "invalid_parameters" }, error: null };
      }
      let existing = mockTables.meli_sync_state.find(
        (s) => s.tenant_id === params.p_tenant_id && s.resource_type === params.p_resource_type
      );
      const newMs = new Date(params.p_new_watermark).getTime();
      if (!existing) {
        existing = {
          tenant_id: params.p_tenant_id,
          resource_type: params.p_resource_type,
          last_successful_sync_at: params.p_new_watermark,
          updated_at: new Date().toISOString(),
        };
        mockTables.meli_sync_state.push(existing);
        return { data: { success: true, advanced: true, watermark: params.p_new_watermark }, error: null };
      }

      const currentMs = new Date(existing.last_successful_sync_at).getTime();
      if (newMs > currentMs) {
        existing.last_successful_sync_at = params.p_new_watermark;
        existing.updated_at = new Date().toISOString();
        return { data: { success: true, advanced: true, watermark: params.p_new_watermark }, error: null };
      }

      return { data: { success: true, advanced: false, watermark: existing.last_successful_sync_at }, error: null };
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

// Import refreshMeliToken and createMeliTokenRefresher after boundary is registered
const {
  refreshMeliToken,
  createMeliTokenRefresher,
  TransientMeliTokenError,
  UncertainMeliTokenRotationError,
} = require("../../src/services/meli/refreshToken");

describe("Sprint: Continuidad Mercado Libre y Recuperación Automática de Ventas", () => {
  const originalFetch = globalThis.fetch;
  const originalEnvAppId = process.env.MELI_CLIENT_ID;
  const originalEnvSecret = process.env.MELI_CLIENT_SECRET;

  beforeEach(() => {
    process.env.MELI_CLIENT_ID = "TEST_APP_ID";
    process.env.MELI_CLIENT_SECRET = "TEST_APP_SECRET";
    dbWriteFailCount = 0;
    dbWriteFailMax = 0;
    rpcCallLog = [];
    mockFailMarkUncertain = false;
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

    test("Caso 1 (OBLIGATORIO): Dos workers compiten con Maps independientes por la misma cuenta y solo uno llama/persiste la rotación", async () => {
      let postCount = 0;
      mockTables.meli_accounts.push({
        id: "acc-concurrent-dist",
        tenant_id: "tenant-dist-1",
        access_token: "OLD_ACC_DIST",
        refresh_token: "OLD_REF_DIST",
        status: "connected",
        token_version: 1,
        token_expires_at: new Date(Date.now() - 1000).toISOString(),
      });

      // Two independent refresher instances with independent Maps sharing ONLY mockDbClient
      const refresherA = createMeliTokenRefresher({ supabase: mockDbClient, inFlightMap: new Map() });
      const refresherB = createMeliTokenRefresher({ supabase: mockDbClient, inFlightMap: new Map() });

      globalThis.fetch = async (url: any) => {
        if (String(url).includes("/oauth/token")) {
          postCount++;
          await new Promise((r) => setTimeout(r, 60));
          return new Response(
            JSON.stringify({
              access_token: "DIST_WINNER_ACC",
              refresh_token: "DIST_WINNER_REF",
              expires_in: 21600,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
        return new Response("{}", { status: 200 });
      };

      const [res1, res2] = await Promise.all([
        refresherA.refresh("acc-concurrent-dist", { force: true }),
        refresherB.refresh("acc-concurrent-dist", { force: true }),
      ]);

      assert.equal(postCount, 1, "Debe existir un único POST OAuth a Mercado Libre");
      assert.equal(res1, "DIST_WINNER_ACC");
      assert.equal(res2, "DIST_WINNER_ACC");

      const dbAccount = mockTables.meli_accounts.find((a) => a.id === "acc-concurrent-dist");
      assert.equal(dbAccount.access_token, "DIST_WINNER_ACC");
      assert.equal(dbAccount.token_version, 2, "token_version debe incrementarse una sola vez");
    });

    test("Caso 1b (OBLIGATORIO): Respuesta 500/502 de Mercado Libre ejecuta un solo POST, no reintenta OAuth y marca rotation_uncertain", async () => {
      let postCount = 0;
      mockTables.meli_accounts.push({
        id: "acc-500-test",
        tenant_id: "tenant-500",
        access_token: "OLD_ACC_500",
        refresh_token: "OLD_REF_500",
        status: "connected",
        token_version: 1,
        token_expires_at: new Date(Date.now() - 1000).toISOString(),
      });

      const refresher = createMeliTokenRefresher({ supabase: mockDbClient, inFlightMap: new Map() });

      globalThis.fetch = async (url: any) => {
        if (String(url).includes("/oauth/token")) {
          postCount++;
          return new Response(
            JSON.stringify({ status: 502, message: "Bad Gateway" }),
            { status: 502, headers: { "Content-Type": "application/json" } }
          );
        }
        return new Response("{}", { status: 200 });
      };

      await assert.rejects(
        async () => {
          await refresher.refresh("acc-500-test", { force: true });
        },
        (err: any) => {
          assert.equal(err.name, "UncertainMeliTokenRotationError");
          return true;
        }
      );

      // 1. fetch called exactly once
      assert.equal(postCount, 1, "fetch debe llamarse exactamente una vez ante 5xx");

      // 2. Previous tokens unchanged
      const dbAccount = mockTables.meli_accounts.find((a) => a.id === "acc-500-test");
      assert.equal(dbAccount.access_token, "OLD_ACC_500");
      assert.equal(dbAccount.refresh_token, "OLD_REF_500");
      assert.equal(dbAccount.token_version, 1);

      // 3. Account ended in rotation_uncertain
      assert.equal(dbAccount.last_failure_category, "rotation_uncertain");
      assert.equal(dbAccount.status, "connected");

      // 4. Subsequent attempt does not invoke OAuth
      await assert.rejects(
        async () => {
          await refresher.refresh("acc-500-test");
        },
        (err: any) => {
          assert.equal(err.name, "UncertainMeliTokenRotationError");
          return true;
        }
      );
      assert.equal(postCount, 1, "Un intento posterior no debe volver a invocar OAuth");
    });

    test("Caso 2 (OBLIGATORIO): Un worker pierde el lease antes de persistir y no puede sobrescribir tokens", async () => {
      mockTables.meli_accounts.push({
        id: "acc-lease-loss-1",
        tenant_id: "tenant-ll-1",
        access_token: "PROTECTED_OLD_ACCESS",
        refresh_token: "PROTECTED_OLD_REFRESH",
        status: "connected",
        token_version: 1,
        token_expires_at: new Date(Date.now() - 1000).toISOString(),
      });

      globalThis.fetch = async (url: any) => {
        if (String(url).includes("/oauth/token")) {
          // While OAuth call is running, another worker steals the lease!
          const lease = mockTables.operation_leases.find(
            (l) => l.tenant_id === "tenant-ll-1" && l.operation_type === "meli_token_refresh:acc-lease-loss-1"
          );
          if (lease) {
            lease.lease_owner = "competitor-worker-stole-lease";
          }
          return new Response(
            JSON.stringify({
              access_token: "NEW_ACC_FROM_OAUTH",
              refresh_token: "NEW_REF_FROM_OAUTH",
              expires_in: 21600,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
        return new Response("{}", { status: 200 });
      };

      await assert.rejects(
        async () => {
          await refreshMeliToken("acc-lease-loss-1", { force: true });
        },
        (err: any) => {
          assert.equal(err.name, "UncertainMeliTokenRotationError");
          return true;
        }
      );

      // Existing tokens in DB must NOT be overwritten!
      const dbAccount = mockTables.meli_accounts.find((a) => a.id === "acc-lease-loss-1");
      assert.equal(dbAccount.access_token, "PROTECTED_OLD_ACCESS");
      assert.equal(dbAccount.refresh_token, "PROTECTED_OLD_REFRESH");
      assert.equal(dbAccount.token_version, 1);
      assert.equal(dbAccount.status, "connected");
    });

    test("Caso 3 (OBLIGATORIO): Flujo completo de versión obsoleta - Worker obsoleto no puede persistir, no re-llama OAuth y recupera el ganador vigente", async () => {
      let postCount = 0;
      mockTables.meli_accounts.push({
        id: "acc-stale-v-test",
        tenant_id: "tenant-sv",
        access_token: "INITIAL_V1_TOKEN",
        refresh_token: "INITIAL_V1_REFRESH",
        status: "connected",
        token_version: 1,
        token_expires_at: new Date(Date.now() - 1000).toISOString(),
      });

      const staleRefresher = createMeliTokenRefresher({ supabase: mockDbClient, inFlightMap: new Map() });

      globalThis.fetch = async (url: any) => {
        if (String(url).includes("/oauth/token")) {
          postCount++;
          // While stale worker is waiting for OAuth, a concurrent winner advances to version 2!
          const acc = mockTables.meli_accounts.find((a) => a.id === "acc-stale-v-test");
          if (acc) {
            acc.access_token = "WINNING_V2_TOKEN";
            acc.refresh_token = "WINNING_V2_REFRESH";
            acc.token_version = 2;
            acc.token_expires_at = new Date(Date.now() + 6 * 3600 * 1000).toISOString();
          }
          return new Response(
            JSON.stringify({
              access_token: "STALE_WORKER_TRYING_OVERWRITE",
              refresh_token: "STALE_WORKER_REF",
              expires_in: 21600,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
        return new Response("{}", { status: 200 });
      };

      const result = await staleRefresher.refresh("acc-stale-v-test", { force: true });

      // 1. OAuth was called only once by stale worker
      assert.equal(postCount, 1);

      // 2. Winner's token was recovered
      assert.equal(result, "WINNING_V2_TOKEN");

      // 3. Database retains version 2 and winning token intact
      const dbAccount = mockTables.meli_accounts.find((a) => a.id === "acc-stale-v-test");
      assert.equal(dbAccount.access_token, "WINNING_V2_TOKEN");
      assert.equal(dbAccount.token_version, 2);
    });

    test("Caso 4 (OBLIGATORIO): Ante conflicto de versión, se recupera el token vigente del worker ganador", async () => {
      mockTables.meli_accounts.push({
        id: "acc-winner-rec",
        tenant_id: "tenant-wr",
        access_token: "INITIAL_TOKEN",
        refresh_token: "INITIAL_REFRESH",
        status: "connected",
        token_version: 1,
        token_expires_at: new Date(Date.now() - 1000).toISOString(),
      });

      globalThis.fetch = async (url: any) => {
        if (String(url).includes("/oauth/token")) {
          // While this worker is in OAuth, another worker already persisted version 2!
          const acc = mockTables.meli_accounts.find((a) => a.id === "acc-winner-rec");
          if (acc) {
            acc.access_token = "WINNING_WORKER_ACCESS_TOKEN";
            acc.refresh_token = "WINNING_WORKER_REFRESH_TOKEN";
            acc.token_version = 2;
            acc.token_expires_at = new Date(Date.now() + 6 * 3600 * 1000).toISOString();
          }
          return new Response(
            JSON.stringify({
              access_token: "LOSING_WORKER_ACC",
              refresh_token: "LOSING_WORKER_REF",
              expires_in: 21600,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
        return new Response("{}", { status: 200 });
      };

      const token = await refreshMeliToken("acc-winner-rec", { force: true });
      assert.equal(token, "WINNING_WORKER_ACCESS_TOKEN", "Debe reutilizar el token del worker ganador");

      const dbAccount = mockTables.meli_accounts.find((a) => a.id === "acc-winner-rec");
      assert.equal(dbAccount.access_token, "WINNING_WORKER_ACCESS_TOKEN");
      assert.equal(dbAccount.token_version, 2);
    });

    test("Caso 4b (OBLIGATORIO): Un lease vencido no puede renovarse y OAuth nunca es llamado", async () => {
      let oauthCalled = false;
      const tenantId = "tenant-expired-lease";
      const accountId = "acc-expired-lease";

      mockTables.meli_accounts.push({
        id: accountId,
        tenant_id: tenantId,
        access_token: "OLD_ACC_EXPIRED",
        refresh_token: "OLD_REF_EXPIRED",
        status: "connected",
        token_version: 1,
        token_expires_at: new Date(Date.now() - 1000).toISOString(),
      });

      // Worker already owns the lease, but expires_at is in the PAST
      const leaseOwner = `worker-holding-expired-lease`;
      mockTables.operation_leases.push({
        tenant_id: tenantId,
        operation_type: `meli_token_refresh:${accountId}`,
        lease_owner: leaseOwner,
        expires_at: new Date(Date.now() - 5000).toISOString(), // Expired
      });

      globalThis.fetch = async () => {
        oauthCalled = true;
        return new Response("{}", { status: 200 });
      };

      // 1. Direct renew_operation_lease RPC test:
      const renewResult = await mockDbClient.rpc("renew_operation_lease", {
        p_tenant_id: tenantId,
        p_operation_type: `meli_token_refresh:${accountId}`,
        p_lease_owner: leaseOwner,
        p_ttl_seconds: 180,
      });

      assert.equal(renewResult.data.renewed, false, "Un lease vencido nunca puede revivirse ni renovarse");

      // 2. Full refresh flow test when lease is expired and renewal fails:
      const originalAcquire = mockDbClient.rpc;
      mockDbClient.rpc = async (fn: string, p: any) => {
        if (fn === "acquire_operation_lease") {
          mockTables.operation_leases.push({
            tenant_id: p.p_tenant_id,
            operation_type: p.p_operation_type,
            lease_owner: p.p_lease_owner,
            expires_at: new Date(Date.now() - 10000).toISOString(), // Already expired!
          });
          return { data: { acquired: true, lease_owner: p.p_lease_owner, expires_at: new Date(Date.now() - 10000).toISOString() }, error: null };
        }
        return originalAcquire(fn, p);
      };

      try {
        const refresher = createMeliTokenRefresher({ supabase: mockDbClient, inFlightMap: new Map() });
        await assert.rejects(
          async () => {
            await refresher.refresh(accountId, { force: true });
          },
          (err: any) => {
            assert.equal(err.name, "TransientMeliTokenError");
            return true;
          }
        );

        // OAuth was NOT called!
        assert.equal(oauthCalled, false, "OAuth no debe llamarse cuando la renovación del lease falla");
      } finally {
        mockDbClient.rpc = originalAcquire;
      }
    });

    test("Caso 5 (OBLIGATORIO): Timeout o error ambiguo de red - Orden estricto marca -> liberación de lease", async () => {
      let postCount = 0;
      mockTables.meli_accounts.push({
        id: "acc-timeout-test",
        tenant_id: "tenant-to",
        access_token: "PRE_TIMEOUT_ACCESS",
        refresh_token: "PRE_TIMEOUT_REFRESH",
        status: "connected",
        token_version: 1,
        token_expires_at: new Date(Date.now() - 1000).toISOString(),
      });

      globalThis.fetch = async (url: any) => {
        if (String(url).includes("/oauth/token")) {
          postCount++;
          const err = new Error("fetch failed (network dropped after sending POST)");
          err.name = "TypeError";
          throw err;
        }
        return new Response("{}", { status: 200 });
      };

      await assert.rejects(
        async () => {
          await refreshMeliToken("acc-timeout-test", { force: true });
        },
        (err: any) => {
          assert.equal(err.name, "UncertainMeliTokenRotationError");
          return true;
        }
      );

      // 1. OAuth invoked exactly once!
      assert.equal(postCount, 1);

      // 2. Existing tokens do not change
      const dbAccount = mockTables.meli_accounts.find((a) => a.id === "acc-timeout-test");
      assert.equal(dbAccount.access_token, "PRE_TIMEOUT_ACCESS");
      assert.equal(dbAccount.refresh_token, "PRE_TIMEOUT_REFRESH");
      assert.equal(dbAccount.token_version, 1);

      // 3. Account status stays connected, category is rotation_uncertain
      assert.equal(dbAccount.status, "connected");
      assert.equal(dbAccount.last_failure_category, "rotation_uncertain");

      // 4. Verificación obligatoria de orden: mark_meli_token_rotation_uncertain ANTES de release_operation_lease
      const idxMark = rpcCallLog.findIndex((c) => c.fnName === "mark_meli_token_rotation_uncertain");
      const idxRelease = rpcCallLog.findIndex((c) => c.fnName === "release_operation_lease");
      assert.ok(idxMark !== -1, "Debe llamarse a mark_meli_token_rotation_uncertain");
      assert.ok(idxRelease !== -1, "Debe liberarse el lease una vez confirmada la marca");
      assert.ok(idxMark < idxRelease, "mark_meli_token_rotation_uncertain debe ejecutarse ANTES de release_operation_lease");

      // 5. No new automatic refresh while rotation_uncertain
      await assert.rejects(
        async () => {
          await refreshMeliToken("acc-timeout-test");
        },
        (err: any) => {
          assert.equal(err.name, "UncertainMeliTokenRotationError");
          assert.match(err.message, /estado incierto/i);
          return true;
        }
      );
      assert.equal(postCount, 1, "No debe invocar OAuth nuevamente mientras siga rotation_uncertain");
    });

    test("Caso 5b (OBLIGATORIO): Si falla la persistencia de la marca incierta, NO se libera el lease ni ocurre otro POST", async () => {
      let postCount = 0;
      mockTables.meli_accounts.push({
        id: "acc-fail-mark-test",
        tenant_id: "tenant-fm",
        access_token: "INTACT_FM_ACC",
        refresh_token: "INTACT_FM_REF",
        status: "connected",
        token_version: 1,
        token_expires_at: new Date(Date.now() - 1000).toISOString(),
      });

      mockFailMarkUncertain = true; // Force simulated failure of mark RPC

      globalThis.fetch = async (url: any) => {
        if (String(url).includes("/oauth/token")) {
          postCount++;
          const err = new Error("Connection reset by peer");
          err.name = "TimeoutError";
          throw err;
        }
        return new Response("{}", { status: 200 });
      };

      await assert.rejects(
        async () => {
          await refreshMeliToken("acc-fail-mark-test", { force: true });
        },
        (err: any) => {
          assert.equal(err.name, "UncertainMeliTokenRotationError");
          return true;
        }
      );

      // 1. Exactly one POST OAuth
      assert.equal(postCount, 1);

      // 2. release_operation_lease was NOT called! Lease remains held until TTL
      const leaseReleaseCalls = rpcCallLog.filter((c) => c.fnName === "release_operation_lease");
      assert.equal(leaseReleaseCalls.length, 0, "No debe liberarse voluntariamente el lease si la marca no se confirmó");

      // 3. Tokens remain intact
      const dbAccount = mockTables.meli_accounts.find((a) => a.id === "acc-fail-mark-test");
      assert.equal(dbAccount.access_token, "INTACT_FM_ACC");
      assert.equal(dbAccount.refresh_token, "INTACT_FM_REF");
    });

    test("Caso 6 (OBLIGATORIO): Respuesta OAuth sin refresh_token, sin access_token o con expires_in inválido no modifica tokens", async () => {
      mockTables.meli_accounts.push({
        id: "acc-invalid-resp",
        tenant_id: "tenant-ir",
        access_token: "INTACT_ACCESS",
        refresh_token: "INTACT_REFRESH",
        status: "connected",
        token_version: 1,
        token_expires_at: new Date(Date.now() - 1000).toISOString(),
      });

      // 6a: Missing refresh_token
      globalThis.fetch = async () => {
        return new Response(
          JSON.stringify({ access_token: "NEW_ACC", expires_in: 21600 }), // No refresh_token!
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      };

      await assert.rejects(
        async () => {
          await refreshMeliToken("acc-invalid-resp", { force: true });
        },
        (err: any) => {
          assert.equal(err.name, "UncertainMeliTokenRotationError");
          return true;
        }
      );

      const dbAccount = mockTables.meli_accounts.find((a) => a.id === "acc-invalid-resp");
      assert.equal(dbAccount.access_token, "INTACT_ACCESS");
      assert.equal(dbAccount.refresh_token, "INTACT_REFRESH");

      // 6b: Invalid expires_in <= 0
      dbAccount.last_failure_category = null;
      globalThis.fetch = async () => {
        return new Response(
          JSON.stringify({ access_token: "NEW_ACC", refresh_token: "NEW_REF", expires_in: -10 }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      };

      await assert.rejects(
        async () => {
          await refreshMeliToken("acc-invalid-resp", { force: true });
        },
        (err: any) => {
          assert.equal(err.name, "UncertainMeliTokenRotationError");
          return true;
        }
      );

      assert.equal(dbAccount.access_token, "INTACT_ACCESS");
      assert.equal(dbAccount.refresh_token, "INTACT_REFRESH");
    });

    test("Caso 7 (OBLIGATORIO): Respuesta HTTP 429 clasificación y backoff correctos", async () => {
      mockTables.meli_accounts.push({
        id: "acc-429-case",
        tenant_id: "tenant-429-c",
        access_token: "OLD_ACC",
        refresh_token: "OLD_REF",
        status: "connected",
        token_version: 1,
        retry_count: 0,
        token_expires_at: new Date(Date.now() + 10000).toISOString(),
      });

      globalThis.fetch = async () => {
        return new Response(
          JSON.stringify({ status: 429, message: "local_rate_limited", error: "rate_limited" }),
          { status: 429, headers: { "Content-Type": "application/json", "Retry-After": "15" } }
        );
      };

      await assert.rejects(
        async () => {
          await refreshMeliToken("acc-429-case", { force: true });
        },
        (err: any) => {
          assert.equal(err.name, "TransientMeliTokenError");
          assert.equal(err.statusCode, 429);
          assert.equal(err.retryAfterMs, 15000);
          return true;
        }
      );

      const dbAccount = mockTables.meli_accounts.find((a) => a.id === "acc-429-case");
      assert.equal(dbAccount.status, "connected");
      assert.equal(dbAccount.last_failure_category, "rate_limit");
      assert.equal(dbAccount.retry_count, 1);
      assert.ok(dbAccount.next_retry_at !== null);
      assert.ok(new Date(dbAccount.next_retry_at).getTime() > Date.now());
    });

    test("Caso 8 (OBLIGATORIO): invalid_grant clasifica como permanente; tras rotation_uncertain no produce desconexión destructiva", async () => {
      // 8a: Clean account gets invalid_grant -> status error
      mockTables.meli_accounts.push({
        id: "acc-ig-clean",
        tenant_id: "tenant-ig-1",
        access_token: "OLD_A",
        refresh_token: "OLD_R",
        status: "connected",
        token_version: 1,
        last_failure_category: null,
      });

      globalThis.fetch = async () => {
        return new Response(
          JSON.stringify({ error: "invalid_grant", message: "Grant invalid" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      };

      await assert.rejects(async () => refreshMeliToken("acc-ig-clean", { force: true }));
      const dbClean = mockTables.meli_accounts.find((a) => a.id === "acc-ig-clean");
      assert.equal(dbClean.status, "error");
      assert.equal(dbClean.last_failure_category, "permanent_auth");

      // 8b: Account in rotation_uncertain gets invalid_grant -> MUST NOT disconnect destructively or delete tokens!
      mockTables.meli_accounts.push({
        id: "acc-ig-uncertain",
        tenant_id: "tenant-ig-2",
        access_token: "PROTECTED_A",
        refresh_token: "PROTECTED_R",
        status: "connected",
        token_version: 1,
        last_failure_category: "rotation_uncertain",
      });

      await assert.rejects(
        async () => refreshMeliToken("acc-ig-uncertain", { force: true }),
        (err: any) => {
          assert.equal(err.name, "UncertainMeliTokenRotationError");
          return true;
        }
      );

      const dbUncertain = mockTables.meli_accounts.find((a) => a.id === "acc-ig-uncertain");
      assert.equal(dbUncertain.status, "connected", "No debe pasar a error si venía de rotation_uncertain");
      assert.equal(dbUncertain.access_token, "PROTECTED_A", "No debe borrar tokens");
      assert.equal(dbUncertain.refresh_token, "PROTECTED_R", "No debe borrar tokens");
    });
  });

  describe("3. Watermark Monotónico y Protección de Sincronización", () => {
    test("Caso 9 (OBLIGATORIO): Inserción concurrente inicial del watermark", async () => {
      const tenantId = "tenant-watermark-race";
      mockTables.meli_sync_state = [];

      const t1 = "2026-09-25T11:00:00.000Z";
      const t2 = "2026-09-25T11:05:00.000Z";

      // Concurrent invocation of initial insert
      const [res1, res2] = await Promise.all([
        advanceOrdersWatermark(mockDbClient, tenantId, t1),
        advanceOrdersWatermark(mockDbClient, tenantId, t2),
      ]);

      assert.ok(res1.watermark);
      assert.ok(res2.watermark);

      const rows = mockTables.meli_sync_state.filter((s) => s.tenant_id === tenantId);
      assert.equal(rows.length, 1, "Debe existir una única fila en meli_sync_state para el tenant y resource");
      assert.equal(rows[0].last_successful_sync_at, t2, "El watermark final almacenado debe ser el mayor");
    });

    test("Caso 10 (OBLIGATORIO): Una ejecución antigua termina después que una nueva y no retrocede el watermark", async () => {
      const tenantId = "tenant-watermark-mono";
      mockTables.meli_sync_state = [];

      const tNew = "2026-09-25T12:00:00.000Z";
      const tOld = "2026-09-25T11:30:00.000Z";

      const resNew = await advanceOrdersWatermark(mockDbClient, tenantId, tNew);
      assert.equal(resNew.advanced, true);
      assert.equal(resNew.watermark, tNew);

      const resOld = await advanceOrdersWatermark(mockDbClient, tenantId, tOld);
      assert.equal(resOld.advanced, false, "No debe avanzar el watermark con un valor anterior");
      assert.equal(resOld.watermark, tNew, "El valor almacenado no debe retroceder");

      const dbRow = mockTables.meli_sync_state.find((s) => s.tenant_id === tenantId);
      assert.equal(dbRow.last_successful_sync_at, tNew);
    });

    test("Caso 11 (OBLIGATORIO): Ningún camino de syncOrders escribe directamente el watermark", () => {
      const fs = require("node:fs");
      const path = require("node:path");
      const syncOrdersContent = fs.readFileSync(
        path.resolve(__dirname, "../../src/services/meli/syncOrders.ts"),
        "utf8"
      );

      assert.doesNotMatch(
        syncOrdersContent,
        /\.from\s*\(\s*["']meli_sync_state["']\s*\)\s*\.(upsert|update|insert)/i,
        "syncOrders.ts no debe realizar escrituras directas (upsert/update/insert) a meli_sync_state"
      );

      assert.match(
        syncOrdersContent,
        /advanceOrdersWatermark\s*\(/,
        "syncOrders.ts debe usar advanceOrdersWatermark para actualizar el watermark"
      );
    });
  });

  describe("4. Dashboard UI: Categorías Normalizadas y Watermark de Ventas", () => {
    test("Caso 12 (OBLIGATORIO): La UI reconoce exactamente las categorías generadas por backend", () => {
      const { computeMeliCardState } = require("../../src/components/dashboard/meli-card.tsx");

      // 1. rotation_uncertain
      const uncertainState = computeMeliCardState({
        id: "acc-1",
        status: "connected",
        token_expires_at: new Date(Date.now() + 100000).toISOString(),
        last_failure_category: "rotation_uncertain",
        last_failure_reason: "Rotación no confirmada",
      });
      assert.equal(uncertainState.isRotationUncertain, true);
      assert.equal(uncertainState.badgeVariant, "warning");
      assert.equal(uncertainState.badgeLabel, "Rotación protegida");
      assert.equal(uncertainState.isPermanentError, false);

      // 2. rate_limit
      const rateLimitState = computeMeliCardState({
        id: "acc-1",
        status: "connected",
        token_expires_at: new Date(Date.now() + 100000).toISOString(),
        last_failure_category: "rate_limit",
      });
      assert.equal(rateLimitState.isTransientFailure, true);
      assert.equal(rateLimitState.badgeLabel, "Reintentando automáticamente");

      // 3. network
      const networkState = computeMeliCardState({
        id: "acc-1",
        status: "connected",
        token_expires_at: new Date(Date.now() + 100000).toISOString(),
        last_failure_category: "network",
      });
      assert.equal(networkState.isTransientFailure, true);
      assert.equal(networkState.badgeLabel, "Reintentando automáticamente");

      // 4. timeout
      const timeoutState = computeMeliCardState({
        id: "acc-1",
        status: "connected",
        token_expires_at: new Date(Date.now() + 100000).toISOString(),
        last_failure_category: "timeout",
      });
      assert.equal(timeoutState.isTransientFailure, true);
      assert.equal(timeoutState.badgeLabel, "Reintentando automáticamente");

      // 5. server_error
      const serverErrorState = computeMeliCardState({
        id: "acc-1",
        status: "connected",
        token_expires_at: new Date(Date.now() + 100000).toISOString(),
        last_failure_category: "server_error",
      });
      assert.equal(serverErrorState.isTransientFailure, true);
      assert.equal(serverErrorState.badgeLabel, "Reintentando automáticamente");

      // 6. permanent_auth
      const permanentState = computeMeliCardState({
        id: "acc-1",
        status: "error",
        token_expires_at: new Date(Date.now() + 100000).toISOString(),
        last_failure_category: "permanent_auth",
      });
      assert.equal(permanentState.isPermanentError, true);
      assert.equal(permanentState.badgeVariant, "danger");
      assert.equal(permanentState.badgeLabel, "Requiere reconexión");
    });

    test("Caso 13 (OBLIGATORIO): La fecha mostrada como última venta proviene del watermark de órdenes", () => {
      const { computeMeliCardState } = require("../../src/components/dashboard/meli-card.tsx");

      const ordersWatermark = "2026-09-25T10:30:00.000Z";
      const productsSyncAt = "2026-09-25T14:00:00.000Z";

      // 13a: With orders watermark: strictly uses orders watermark, ignores products last_sync_at
      const stateWithWatermark = computeMeliCardState(
        {
          id: "acc-1",
          status: "connected",
          token_expires_at: new Date(Date.now() + 100000).toISOString(),
          last_sync_at: productsSyncAt,
        },
        {
          last_successful_sync_at: ordersWatermark,
        }
      );
      assert.equal(stateWithWatermark.lastSalesSyncAt, ordersWatermark);
      assert.notEqual(
        stateWithWatermark.lastSalesSyncStr,
        "Todavía no hay una sincronización de ventas confirmada"
      );

      // 13b: Without orders watermark: does NOT fallback to meli_accounts.last_sync_at
      const stateWithoutWatermark = computeMeliCardState(
        {
          id: "acc-1",
          status: "connected",
          token_expires_at: new Date(Date.now() + 100000).toISOString(),
          last_sync_at: productsSyncAt,
        },
        {
          last_successful_sync_at: null,
        }
      );
      assert.equal(stateWithoutWatermark.lastSalesSyncAt, null);
      assert.equal(
        stateWithoutWatermark.lastSalesSyncStr,
        "Todavía no hay una sincronización de ventas confirmada"
      );
    });

    test("Caso 14 (OBLIGATORIO): Durante rotation_uncertain no se ofrece ni permite el refresh manual", () => {
      const { computeMeliCardState } = require("../../src/components/dashboard/meli-card.tsx");

      const uncertainState = computeMeliCardState({
        id: "acc-uncertain-ui-test",
        status: "connected",
        token_expires_at: new Date(Date.now() + 100000).toISOString(),
        last_failure_category: "rotation_uncertain",
        last_failure_reason: "Network timeout during OAuth refresh",
      });

      assert.equal(uncertainState.isRotationUncertain, true);
      assert.equal(uncertainState.canManualRefresh, false, "No debe habilitar ni ofrecer refresco manual");
      assert.equal(uncertainState.badgeVariant, "warning");
      assert.equal(uncertainState.badgeLabel, "Rotación protegida");
    });
  });
});
