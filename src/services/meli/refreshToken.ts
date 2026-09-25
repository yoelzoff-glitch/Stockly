import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/errors/logger";
import {
  acquireOperationLease,
  releaseOperationLease,
  renewOperationLease,
} from "@/lib/security/leases";
import {
  classifyTokenRefreshError,
  TokenRefreshClassification,
} from "./tokenErrorClassification";

export class TransientMeliTokenError extends Error {
  readonly isTransient = true;
  readonly retryAfterMs?: number;
  readonly statusCode?: number;

  constructor(message: string, options?: { retryAfterMs?: number; statusCode?: number }) {
    super(message);
    this.name = "TransientMeliTokenError";
    this.retryAfterMs = options?.retryAfterMs;
    this.statusCode = options?.statusCode;
  }
}

export class UncertainMeliTokenRotationError extends Error {
  readonly isRotationUncertain = true;

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "UncertainMeliTokenRotationError";
  }
}

const inFlightRefreshes = new Map<string, Promise<string>>();
const FRESH_TOKEN_THRESHOLD_MS = 3 * 60 * 60 * 1000;
const LEASE_TTL_SECONDS = 180;

export interface RefreshMeliTokenOptions {
  force?: boolean;
  /** Access token that produced a 401. If DB already has another token, reuse it. */
  staleAccessToken?: string | null;
}

function hasFreshAccessToken(account: any): boolean {
  if (!account?.access_token || !account?.token_expires_at || account.status !== "connected") return false;
  return new Date(account.token_expires_at).getTime() - Date.now() > FRESH_TOKEN_THRESHOLD_MS;
}

function validateOAuthTokenResponse(value: any): {
  accessToken: string;
  refreshToken: string;
  expiresInSec: number;
} | null {
  if (!value || typeof value !== "object") return null;
  if (typeof value.access_token !== "string" || value.access_token.trim().length === 0) return null;
  if (typeof value.refresh_token !== "string" || value.refresh_token.trim().length === 0) return null;
  const expiresInSec = Number(value.expires_in);
  if (!Number.isFinite(expiresInSec) || expiresInSec <= 0) return null;
  const calculatedExpiry = Date.now() + expiresInSec * 1000;
  if (isNaN(calculatedExpiry) || calculatedExpiry <= Date.now()) return null;
  return {
    accessToken: value.access_token.trim(),
    refreshToken: value.refresh_token.trim(),
    expiresInSec,
  };
}

async function assertRefreshLease(
  supabase: any,
  params: { tenantId: string; accountId: string; operationType: string; leaseOwner: string }
): Promise<void> {
  const renewed = await renewOperationLease(
    {
      tenantId: params.tenantId,
      operationType: params.operationType,
      leaseOwner: params.leaseOwner,
      ttlSeconds: LEASE_TTL_SECONDS,
    },
    supabase
  );
  if (!renewed) {
    throw new TransientMeliTokenError("No se pudo confirmar la propiedad del lease de renovación.", {
      retryAfterMs: 5000,
      statusCode: 409,
    });
  }

  const { data, error } = await supabase.rpc("check_meli_token_refresh_lease", {
    p_tenant_id: params.tenantId,
    p_account_id: params.accountId,
    p_operation_type: params.operationType,
    p_lease_owner: params.leaseOwner,
  });
  if (error) {
    throw new TransientMeliTokenError(
      "La protección atómica de renovación todavía no está disponible. Reintente después de aplicar la migración.",
      { retryAfterMs: 30000, statusCode: 503 }
    );
  }
  if (!data?.valid) {
    throw new TransientMeliTokenError(`Lease de renovación no válido: ${data?.reason || "unknown"}`, {
      retryAfterMs: 5000,
      statusCode: 409,
    });
  }
}

async function markRotationUncertain(
  supabase: any,
  params: { tenantId: string; accountId: string; expectedVersion: number; reason: string }
): Promise<void> {
  await supabase
    .from("meli_accounts")
    .update({
      sync_error: params.reason,
      last_failure_category: "rotation_uncertain",
      last_failure_reason: params.reason,
      next_retry_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.accountId)
    .eq("tenant_id", params.tenantId)
    .eq("token_version", params.expectedVersion);

  try {
    const { upsertStateAlert } = await import("@/services/notifications/notificationService");
    await upsertStateAlert({
      tenantId: params.tenantId,
      type: "sync_failed",
      severity: "danger",
      title: "Renovación de Mercado Libre pendiente de verificación",
      body: "Mercado Libre pudo haber rotado la credencial, pero no se confirmó su persistencia. Detuvimos nuevos intentos para proteger la conexión.",
      actionUrl: "/dashboard/integrations",
      actionLabel: "Revisar integración",
      entityType: "integration",
      entityId: params.accountId,
      dedupeKey: `tenant:${params.tenantId}:state:meli_rotation_uncertain`,
      count: 1,
      metadata: { stage: "oauth_rotation_persistence" },
    });
  } catch (alertError: any) {
    logger.error({
      event: "MELI_TOKEN_UNCERTAIN_ALERT_FAILED",
      tenantId: params.tenantId,
      accountId: params.accountId,
      error: alertError?.message,
    });
  }
}

export async function refreshMeliToken(
  meliAccountIdOrTenantId: string,
  options?: RefreshMeliTokenOptions
): Promise<string> {
  const supabaseAdmin = createAdminClient();
  const { data: initialAccount, error: lookupError } = await supabaseAdmin
    .from("meli_accounts")
    .select("id, tenant_id, access_token, refresh_token, token_expires_at, status, sync_error, last_success_refresh, next_retry_at, retry_count, token_version, last_failure_category")
    .or(`id.eq."${meliAccountIdOrTenantId}",tenant_id.eq."${meliAccountIdOrTenantId}"`)
    .maybeSingle();

  if (lookupError || !initialAccount) {
    throw new Error(`Meli account not found for reference: ${meliAccountIdOrTenantId}`);
  }

  const tenantId = initialAccount.tenant_id;
  const accountId = initialAccount.id;
  const initialVersion = initialAccount.token_version ?? 1;

  if (initialAccount.last_failure_category === "rotation_uncertain") {
    throw new UncertainMeliTokenRotationError(
      "La última rotación de Mercado Libre quedó en estado incierto. Se requiere verificación operativa antes de volver a intentar."
    );
  }

  if (
    options?.staleAccessToken &&
    initialAccount.access_token &&
    initialAccount.access_token !== options.staleAccessToken &&
    hasFreshAccessToken(initialAccount)
  ) {
    return initialAccount.access_token;
  }

  const existingInFlight = inFlightRefreshes.get(accountId);
  if (existingInFlight) return await existingInFlight;

  if (!options?.force && hasFreshAccessToken(initialAccount)) {
    return initialAccount.access_token;
  }

  const refreshPromise = (async (): Promise<string> => {
    const workerId = `refresh-${accountId}-${randomUUID().slice(0, 8)}`;
    const leaseOperationType = `meli_token_refresh:${accountId}`;
    let leaseAcquired = false;

    try {
      const leaseResult = await acquireOperationLease(
        {
          tenantId,
          operationType: leaseOperationType,
          leaseOwner: workerId,
          ttlSeconds: LEASE_TTL_SECONDS,
        },
        supabaseAdmin
      );
      leaseAcquired = leaseResult.acquired;

      if (!leaseAcquired) {
        const pollStartedAt = Date.now();
        while (Date.now() - pollStartedAt < 5000) {
          await new Promise((resolve) => setTimeout(resolve, process.env.NODE_ENV === "test" ? 20 : 500));
          const { data: peerAccount } = await supabaseAdmin
            .from("meli_accounts")
            .select("access_token, token_expires_at, status, token_version")
            .eq("id", accountId)
            .maybeSingle();
          if (
            peerAccount?.access_token &&
            (peerAccount.token_version ?? 1) > initialVersion &&
            hasFreshAccessToken(peerAccount)
          ) {
            return peerAccount.access_token;
          }
        }

        const retryLease = await acquireOperationLease(
          {
            tenantId,
            operationType: leaseOperationType,
            leaseOwner: workerId,
            ttlSeconds: LEASE_TTL_SECONDS,
          },
          supabaseAdmin
        );
        if (!retryLease.acquired) {
          throw new TransientMeliTokenError("Renovación de token en curso por otra instancia.", {
            retryAfterMs: 5000,
            statusCode: 409,
          });
        }
        leaseAcquired = true;
      }

      const { data: account, error: freshError } = await supabaseAdmin
        .from("meli_accounts")
        .select("id, tenant_id, access_token, refresh_token, token_expires_at, status, next_retry_at, retry_count, token_version, last_failure_category")
        .eq("id", accountId)
        .single();
      if (freshError || !account) throw new Error(`Failed to read fresh account state for: ${accountId}`);

      if (account.last_failure_category === "rotation_uncertain") {
        throw new UncertainMeliTokenRotationError(
          "La rotación anterior quedó en estado incierto; se detuvieron nuevos intentos automáticos."
        );
      }

      if ((account.token_version ?? 1) > initialVersion && hasFreshAccessToken(account)) {
        return account.access_token;
      }
      if (
        options?.staleAccessToken &&
        account.access_token &&
        account.access_token !== options.staleAccessToken &&
        hasFreshAccessToken(account)
      ) {
        return account.access_token;
      }
      if (!options?.force && hasFreshAccessToken(account)) return account.access_token;

      if (!options?.force && account.next_retry_at) {
        const retryWaitMs = new Date(account.next_retry_at).getTime() - Date.now();
        if (retryWaitMs > 0) {
          if (account.access_token && new Date(account.token_expires_at).getTime() > Date.now()) {
            return account.access_token;
          }
          throw new TransientMeliTokenError("Mercado Libre está en espera programada.", {
            retryAfterMs: retryWaitMs,
            statusCode: 429,
          });
        }
      }

      const clientId = process.env.MELI_CLIENT_ID || process.env.NEXT_PUBLIC_MELI_APP_ID;
      const clientSecret = process.env.MELI_CLIENT_SECRET;
      if (!clientId || !clientSecret) throw new Error("Missing Mercado Libre App ID or Secret in environment variables");
      if (!account.refresh_token) {
        const error: any = new Error("No hay un token de renovación disponible.");
        error.classification = classifyTokenRefreshError(401, { error: "invalid_grant", message: error.message });
        throw error;
      }

      await assertRefreshLease(supabaseAdmin, {
        tenantId,
        accountId,
        operationType: leaseOperationType,
        leaseOwner: workerId,
      });

      let responseData: any = null;
      for (let attempt = 1; attempt <= 2; attempt++) {
        let response: Response;
        try {
          response = await fetch("https://api.mercadolibre.com/oauth/token", {
            method: "POST",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              grant_type: "refresh_token",
              client_id: clientId,
              client_secret: clientSecret,
              refresh_token: account.refresh_token,
            }),
            signal: AbortSignal.timeout(15000),
          });
        } catch (error) {
          throw new UncertainMeliTokenRotationError(
            "No se recibió una respuesta confirmada de Mercado Libre durante la rotación. No se reutilizará el refresh token anterior.",
            { cause: error }
          );
        }

        if (!response.ok) {
          const body = await response.json().catch(() => null);
          const classification = classifyTokenRefreshError(
            response.status,
            body,
            null,
            response.headers.get("retry-after")
          );
          if (
            classification.isTransient &&
            classification.category === "server_error" &&
            attempt < 2
          ) {
            await new Promise((resolve) => setTimeout(resolve, process.env.NODE_ENV === "test" ? 20 : 750));
            await assertRefreshLease(supabaseAdmin, {
              tenantId,
              accountId,
              operationType: leaseOperationType,
              leaseOwner: workerId,
            });
            continue;
          }
          const error: any = new Error(classification.reason);
          error.classification = classification;
          error.status = response.status;
          throw error;
        }

        try {
          responseData = await response.json();
        } catch (error) {
          throw new UncertainMeliTokenRotationError(
            "Mercado Libre respondió al refresh, pero no se pudo confirmar el nuevo par de tokens.",
            { cause: error }
          );
        }
        break;
      }

      const validated = validateOAuthTokenResponse(responseData);
      if (!validated) {
        throw new UncertainMeliTokenRotationError(
          "Mercado Libre respondió al refresh con un par de tokens incompleto o un vencimiento inválido."
        );
      }

      // Re-validate and assert lease ownership immediately before persisting
      try {
        await assertRefreshLease(supabaseAdmin, {
          tenantId,
          accountId,
          operationType: leaseOperationType,
          leaseOwner: workerId,
        });
      } catch (leaseErr) {
        throw new UncertainMeliTokenRotationError(
          "Se perdió la propiedad del lease antes de persistir la rotación. No se sobrescribirán tokens.",
          { cause: leaseErr }
        );
      }

      const refreshedAt = new Date().toISOString();
      const expiresAt = new Date(Date.now() + validated.expiresInSec * 1000).toISOString();
      const expectedVersion = account.token_version ?? 1;
      let lastPersistenceError = "unknown";

      for (let dbAttempt = 1; dbAttempt <= 3; dbAttempt++) {
        const { data: persistResult, error: persistError } = await supabaseAdmin.rpc(
          "persist_meli_token_rotation",
          {
            p_tenant_id: tenantId,
            p_account_id: accountId,
            p_operation_type: leaseOperationType,
            p_lease_owner: workerId,
            p_expected_version: expectedVersion,
            p_access_token: validated.accessToken,
            p_refresh_token: validated.refreshToken,
            p_expires_at: expiresAt,
            p_refreshed_at: refreshedAt,
          }
        );

        if (!persistError && persistResult?.persisted) {
          await supabaseAdmin.from("audit_logs").insert({
            tenant_id: tenantId,
            action: "token_refreshed",
            entity_type: "meli_account",
            entity_id: accountId,
            metadata: { expires_at: expiresAt, token_version: expectedVersion + 1 },
          });
          logger.info({ event: "MELI_TOKEN_REFRESH_SUCCESS", tenantId, accountId, expiresAt });
          return validated.accessToken;
        }

        const { data: persistedAccount } = await supabaseAdmin
          .from("meli_accounts")
          .select("access_token, token_expires_at, status, token_version")
          .eq("id", accountId)
          .maybeSingle();

        if (
          persistedAccount?.token_version === expectedVersion + 1 &&
          persistedAccount?.access_token === validated.accessToken
        ) {
          return validated.accessToken;
        }

        if (
          persistedAccount?.access_token &&
          (persistedAccount.token_version ?? 1) > expectedVersion &&
          hasFreshAccessToken(persistedAccount)
        ) {
          logger.info({
            event: "MELI_PEER_WORKER_ADVANCED_VERSION",
            tenantId,
            accountId,
            tokenVersion: persistedAccount.token_version,
          });
          return persistedAccount.access_token;
        }

        lastPersistenceError = persistError?.message || persistResult?.reason || "persistence_not_confirmed";
        if (["lease_not_owned", "lease_expired", "version_conflict", "account_not_found"].includes(persistResult?.reason)) {
          break;
        }
        if (dbAttempt < 3) {
          await new Promise((resolve) => setTimeout(resolve, process.env.NODE_ENV === "test" ? 20 : 400 * dbAttempt));
        }
      }

      throw new UncertainMeliTokenRotationError(
        `Mercado Libre rotó los tokens, pero su persistencia no pudo confirmarse (${lastPersistenceError}).`
      );
    } finally {
      if (leaseAcquired) {
        await releaseOperationLease(
          { tenantId, operationType: leaseOperationType, leaseOwner: workerId },
          supabaseAdmin
        ).catch(() => {});
      }
    }
  })();

  inFlightRefreshes.set(accountId, refreshPromise);
  try {
    return await refreshPromise;
  } catch (error: any) {
    if (error?.isRotationUncertain) {
      // Re-read fresh account state to see if another worker already succeeded and advanced token_version
      const { data: latestAccount } = await supabaseAdmin
        .from("meli_accounts")
        .select("access_token, token_expires_at, status, token_version")
        .eq("id", accountId)
        .maybeSingle();

      if (
        latestAccount?.access_token &&
        (latestAccount.token_version ?? 1) > initialVersion &&
        hasFreshAccessToken(latestAccount)
      ) {
        logger.info({
          event: "MELI_RECOVERED_WINNING_WORKER_TOKEN_POST_UNCERTAIN",
          tenantId,
          accountId,
          tokenVersion: latestAccount.token_version,
        });
        return latestAccount.access_token;
      }

      const reason = error.message || "Rotación OAuth incierta";
      await markRotationUncertain(supabaseAdmin, {
        tenantId,
        accountId,
        expectedVersion: initialVersion,
        reason,
      });
      logger.error({
        event: "MELI_TOKEN_ROTATION_UNCERTAIN",
        tenantId,
        accountId,
        error: reason,
      });
      throw error;
    }

    const classification: TokenRefreshClassification =
      error?.classification || classifyTokenRefreshError(error?.status, null, error, null);
    const reason = classification.reason || error?.message || String(error);

    if (classification.isPermanentAuth) {
      const { data: latestAcc } = await supabaseAdmin
        .from("meli_accounts")
        .select("last_failure_category, status, access_token")
        .eq("id", accountId)
        .maybeSingle();

      const wasUncertain =
        initialAccount.last_failure_category === "rotation_uncertain" ||
        latestAcc?.last_failure_category === "rotation_uncertain";

      if (wasUncertain) {
        logger.warn({
          event: "MELI_PERMANENT_AUTH_BLOCKED_POST_UNCERTAIN",
          tenantId,
          accountId,
          reason,
        });
        throw new UncertainMeliTokenRotationError(
          `La cuenta está en estado incierto de rotación y Mercado Libre rechazó la credencial (${reason}). No se alteró el estado ni se eliminaron tokens para evitar desconexión destructiva.`
        );
      }

      await supabaseAdmin
        .from("meli_accounts")
        .update({
          status: "error",
          sync_error: reason,
          last_failure_category: "permanent_auth",
          last_failure_reason: reason,
          next_retry_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", accountId)
        .eq("token_version", initialVersion);

      try {
        const { upsertStateAlert } = await import("@/services/notifications/notificationService");
        await upsertStateAlert({
          tenantId,
          type: "integration_disconnected",
          severity: "danger",
          title: "Mercado Libre necesita ser reconectado",
          body: "Mercado Libre confirmó que la autorización ya no es válida. Reconectá la cuenta desde Integraciones.",
          actionUrl: "/dashboard/integrations",
          actionLabel: "Revisar integración",
          entityType: "integration",
          entityId: accountId,
          dedupeKey: `tenant:${tenantId}:state:integration_disconnected:mercadolibre`,
          count: 1,
        });
      } catch {}
      throw error;
    }

    const currentRetryCount = (initialAccount.retry_count || 0) + 1;
    const fallbackBackoffMs = Math.min(2 ** currentRetryCount * 15000, 300000);
    const retryAfterMs = classification.retryAfterMs || error?.retryAfterMs || fallbackBackoffMs;
    await supabaseAdmin
      .from("meli_accounts")
      .update({
        sync_error: reason,
        retry_count: currentRetryCount,
        next_retry_at: new Date(Date.now() + retryAfterMs).toISOString(),
        last_failure_category: classification.category,
        last_failure_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq("id", accountId)
      .eq("token_version", initialVersion);

    throw new TransientMeliTokenError(reason, {
      retryAfterMs,
      statusCode: classification.statusCode || error?.statusCode || 503,
    });
  } finally {
    inFlightRefreshes.delete(accountId);
  }
}
