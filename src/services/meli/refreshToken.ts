import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { createAlert } from "../alerts/createAlert";
import { logger } from "@/lib/errors/logger";
import {
  acquireOperationLease,
  releaseOperationLease,
} from "@/lib/security/leases";
import {
  classifyTokenRefreshError,
  parseRetryAfterHeader,
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

// In-process promise cache (optimization for concurrent calls in the same Node/Vercel instance)
const inFlightRefreshes = new Map<string, Promise<string>>();

export interface RefreshMeliTokenOptions {
  force?: boolean;
}

export async function refreshMeliToken(
  meliAccountIdOrTenantId: string,
  options?: RefreshMeliTokenOptions
): Promise<string> {
  const supabaseAdmin = createAdminClient();

  // 1. Initial lookup to identify tenant_id and account_id
  const { data: initialAccount, error: lookupError } = await supabaseAdmin
    .from("meli_accounts")
    .select("id, tenant_id, access_token, refresh_token, token_expires_at, status, sync_error, last_success_refresh, next_retry_at, retry_count, token_version")
    .or(`id.eq."${meliAccountIdOrTenantId}",tenant_id.eq."${meliAccountIdOrTenantId}"`)
    .maybeSingle();

  if (lookupError || !initialAccount) {
    throw new Error(`Meli account not found for reference: ${meliAccountIdOrTenantId}`);
  }

  const tenantId = initialAccount.tenant_id;
  const accountId = initialAccount.id;

  // Local deduplication: if this process is already refreshing this account, await it
  const existingInFlight = inFlightRefreshes.get(accountId);
  if (existingInFlight) {
    logger.info({
      event: "MELI_TOKEN_REFRESH_CONCURRENT_JOINED",
      tenantId,
      accountId,
      message: "Reusing in-process in-flight token refresh promise for account",
    });
    return await existingInFlight;
  }

  // Pre-lease fast check: if token has > 3 hours remaining and status is connected, reuse it
  if (!options?.force && initialAccount.access_token && initialAccount.token_expires_at) {
    const timeLeftMs = new Date(initialAccount.token_expires_at).getTime() - Date.now();
    if (timeLeftMs > 3 * 60 * 60 * 1000 && initialAccount.status === "connected") {
      logger.info({
        event: "MELI_TOKEN_REFRESH_REUSED_FRESH",
        tenantId,
        accountId,
        remainingMinutes: Math.round(timeLeftMs / 60000),
      });
      return initialAccount.access_token;
    }
  }

  // Launch refresh with distributed lease & two-stage safety
  const refreshPromise = (async (): Promise<string> => {
    const workerId = `refresh-${accountId}-${randomUUID().slice(0, 8)}`;
    const leaseOperationType = `meli_token_refresh:${accountId}`;
    const leaseTtlSeconds = 60;

    let leaseAcquired = false;

    try {
      // 2. Acquire distributed lease across serverless instances
      const leaseResult = await acquireOperationLease(
        {
          tenantId,
          operationType: leaseOperationType,
          leaseOwner: workerId,
          ttlSeconds: leaseTtlSeconds,
        },
        supabaseAdmin
      );

      leaseAcquired = leaseResult.acquired;

      if (!leaseAcquired) {
        logger.info({
          event: "MELI_TOKEN_REFRESH_DISTRIBUTED_LOCK_HELD",
          tenantId,
          accountId,
          heldBy: leaseResult.currentOwner,
          expiresAt: leaseResult.expiresAt,
          message: "Distributed lease held by another instance. Polling for fresh token...",
        });

        // Another instance is actively rotating the token. Poll Supabase for up to 3 seconds.
        const pollStart = Date.now();
        while (Date.now() - pollStart < 3500) {
          await new Promise((r) => setTimeout(r, 600));

          const { data: polledAccount } = await supabaseAdmin
            .from("meli_accounts")
            .select("access_token, token_expires_at, status")
            .eq("id", accountId)
            .maybeSingle();

          if (polledAccount?.token_expires_at && polledAccount?.access_token) {
            const remainingMs = new Date(polledAccount.token_expires_at).getTime() - Date.now();
            if (remainingMs > 3 * 60 * 60 * 1000 && polledAccount.status === "connected") {
              logger.info({
                event: "MELI_TOKEN_REFRESH_ACQUIRED_BY_PEER",
                tenantId,
                accountId,
                message: "Peer instance completed token refresh successfully. Reusing refreshed token.",
              });
              return polledAccount.access_token;
            }
          }
        }

        // If polling finished and still expired, attempt one more atomic acquire
        const retryLease = await acquireOperationLease(
          {
            tenantId,
            operationType: leaseOperationType,
            leaseOwner: workerId,
            ttlSeconds: leaseTtlSeconds,
          },
          supabaseAdmin
        );

        if (!retryLease.acquired) {
          throw new TransientMeliTokenError(
            "Renovación de token en curso por otra instancia. Reintente en unos segundos.",
            { retryAfterMs: 3000, statusCode: 429 }
          );
        }
        leaseAcquired = true;
      }

      // 3. Re-read fresh state from Supabase post-lease acquisition
      const { data: account, error: freshError } = await supabaseAdmin
        .from("meli_accounts")
        .select("id, tenant_id, access_token, refresh_token, token_expires_at, status, sync_error, last_success_refresh, next_retry_at, retry_count, token_version")
        .eq("id", accountId)
        .single();

      if (freshError || !account) {
        throw new Error(`Failed to read fresh account state for: ${accountId}`);
      }

      // Re-verify if another process refreshed it before we locked
      if (!options?.force && account.access_token && account.token_expires_at) {
        const timeLeftMs = new Date(account.token_expires_at).getTime() - Date.now();
        if (timeLeftMs > 3 * 60 * 60 * 1000 && account.status === "connected") {
          logger.info({
            event: "MELI_TOKEN_REFRESH_REUSED_POST_LEASE",
            tenantId,
            accountId,
            remainingMinutes: Math.round(timeLeftMs / 60000),
          });
          return account.access_token;
        }
      }

      // Check scheduled backoff: if next_retry_at is in the future, respect it unless forced
      if (!options?.force && account.next_retry_at) {
        const retryWaitMs = new Date(account.next_retry_at).getTime() - Date.now();
        if (retryWaitMs > 0) {
          // If token is still valid, return it rather than failing
          if (account.token_expires_at && new Date(account.token_expires_at).getTime() > Date.now() && account.access_token) {
            return account.access_token;
          }
          throw new TransientMeliTokenError(
            `Mercado Libre en espera programada hasta ${account.next_retry_at}`,
            { retryAfterMs: retryWaitMs, statusCode: 429 }
          );
        }
      }

      const clientId = process.env.MELI_CLIENT_ID || process.env.NEXT_PUBLIC_MELI_APP_ID;
      const clientSecret = process.env.MELI_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
        throw new Error("Missing Mercado Libre App ID or Secret in environment variables");
      }

      if (!account.refresh_token) {
        const errMsg = `No hay un token de renovación disponible para: ${meliAccountIdOrTenantId}`;

        await supabaseAdmin
          .from("meli_accounts")
          .update({
            status: "error",
            sync_error: errMsg,
            last_failure_category: "permanent_auth",
            last_failure_reason: errMsg,
            updated_at: new Date().toISOString(),
          })
          .eq("id", account.id);

        await createAlert({
          tenantId,
          title: "Error de integración con Mercado Libre",
          body: "No hay un token de renovación disponible. Por favor, vuelve a conectar tu cuenta.",
          severity: "critical",
        });

        throw new Error(errMsg);
      }

      // =====================================================================
      // STAGE 1: CALL MERCADO LIBRE /oauth/token (Before Response Confirmed)
      // =====================================================================
      const maxAttempts = 2;
      let attempt = 0;
      let responseData: any = null;

      while (attempt < maxAttempts) {
        attempt++;
        try {
          const response = await fetch("https://api.mercadolibre.com/oauth/token", {
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

          if (!response.ok) {
            const errorJson = await response.json().catch(() => null);
            const classification = classifyTokenRefreshError(
              response.status,
              errorJson,
              null,
              response.headers.get("retry-after")
            );

            // If transient rate limit or 5xx and we have attempt budget, backoff
            if (classification.isTransient && attempt < maxAttempts) {
              const backoffMs = classification.retryAfterMs || Math.min(attempt * 1500 + Math.random() * 500, 4000);
              logger.warn({
                event: "MELI_TOKEN_REFRESH_TRANSIENT_BACKOFF",
                tenantId,
                accountId,
                attempt,
                status: String(response.status),
                backoffMs,
              });
              const sleepMs = process.env.NODE_ENV === "test" ? Math.min(backoffMs, 50) : backoffMs;
              await new Promise((r) => setTimeout(r, sleepMs));
              continue;
            }

            // Exhausted retries or non-retryable error
            const err: any = new Error(classification.reason);
            err.classification = classification;
            err.status = response.status;
            throw err;
          }

          responseData = await response.json();
          break; // Stage 1 succeeded!
        } catch (stage1Err: any) {
          if (attempt >= maxAttempts || stage1Err?.classification?.isPermanentAuth) {
            throw stage1Err;
          }
          const backoffMs = Math.min(attempt * 1000 + Math.random() * 300, 3000);
          await new Promise((r) => setTimeout(r, backoffMs));
        }
      }

      // =====================================================================
      // STAGE 2: VALIDATE & PERSIST TO SUPABASE (Post-Response Isolation)
      // Mercado Libre has already rotated the refresh token at this point.
      // If Supabase write fails, NEVER repeat the POST with the old token!
      // Instead, retry persisting the newly received token pair.
      // =====================================================================
      if (!responseData?.access_token || !responseData?.refresh_token) {
        throw new Error("Respuesta inválida de Mercado Libre: faltan tokens en la carga útil");
      }

      const newAccessToken: string = responseData.access_token;
      const newRefreshToken: string = responseData.refresh_token;
      const expiresInSec: number = Number(responseData.expires_in) || 21600;
      const newExpiresAt = new Date(Date.now() + expiresInSec * 1000).toISOString();

      const currentVersion = account.token_version ?? 1;

      // Persistence with optimistic locking (token_version) & retry loop
      let persistedSuccessfully = false;
      const maxDbRetries = 3;

      for (let dbAttempt = 1; dbAttempt <= maxDbRetries; dbAttempt++) {
        const updatePayload: Record<string, any> = {
          access_token: newAccessToken,
          refresh_token: newRefreshToken,
          token_expires_at: newExpiresAt,
          status: "connected",
          sync_error: null,
          retry_count: 0,
          next_retry_at: null,
          last_failure_reason: null,
          last_failure_category: null,
          last_success_refresh: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        // Try optimistic concurrency update if token_version is available
        let updateQuery = supabaseAdmin
          .from("meli_accounts")
          .update({
            ...updatePayload,
            token_version: currentVersion + 1,
          })
          .eq("id", account.id);

        if (currentVersion !== undefined && currentVersion !== null) {
          updateQuery = updateQuery.eq("token_version", currentVersion);
        }

        const { data: updatedRows, error: updateError } = await updateQuery.select("id");

        if (!updateError && updatedRows && updatedRows.length > 0) {
          persistedSuccessfully = true;
          break;
        }

        // If error was missing column during migration rollout, fallback gracefully
        if (updateError && updateError.message?.includes("token_version")) {
          const { error: fallbackError } = await supabaseAdmin
            .from("meli_accounts")
            .update(updatePayload)
            .eq("id", account.id);

          if (!fallbackError) {
            persistedSuccessfully = true;
            break;
          }
        }

        // If updatedRows.length === 0, optimistic concurrency detected collision
        if (!updateError && (!updatedRows || updatedRows.length === 0)) {
          logger.warn({
            event: "MELI_TOKEN_REFRESH_OPTIMISTIC_LOCK_COLLISION",
            tenantId,
            accountId,
            currentVersion,
            message: "Another process updated the token version. Stale worker prevented from overwriting newer tokens.",
          });
          // Read latest token from DB to return
          const { data: latestAcc } = await supabaseAdmin
            .from("meli_accounts")
            .select("access_token")
            .eq("id", account.id)
            .single();

          if (latestAcc?.access_token) {
            return latestAcc.access_token;
          }
        }

        logger.error({
          event: "MELI_TOKEN_PERSIST_DB_RETRY",
          tenantId,
          accountId,
          dbAttempt,
          error: updateError?.message,
        });

        if (dbAttempt < maxDbRetries) {
          await new Promise((r) => setTimeout(r, 500 * dbAttempt));
        }
      }

      if (!persistedSuccessfully) {
        // Critical: tokens rotated by ML but DB failed to persist after retries
        logger.error({
          event: "MELI_TOKEN_CRITICAL_PERSIST_FAILED",
          tenantId,
          accountId,
          message: "Tokens were rotated by Mercado Libre but Supabase persistence failed repeatedly.",
        });
        throw new Error("Fallo crítico al persistir los nuevos tokens de Mercado Libre en base de datos.");
      }

      // Record audit log
      try {
        await supabaseAdmin.from("audit_logs").insert({
          tenant_id: tenantId,
          action: "token_refreshed",
          entity_type: "meli_account",
          entity_id: account.id,
          metadata: { expires_at: newExpiresAt },
        });
      } catch (auditErr: any) {
        logger.warn({
          event: "MELI_TOKEN_AUDIT_LOG_FAILED",
          tenantId,
          accountId: account.id,
          error: auditErr?.message,
        });
      }

      logger.info({
        event: "MELI_TOKEN_REFRESH_SUCCESS",
        tenantId,
        accountId: account.id,
        expiresAt: newExpiresAt,
      });

      return newAccessToken;
    } finally {
      // 4. Release distributed lease
      if (leaseAcquired) {
        await releaseOperationLease(
          {
            tenantId,
            operationType: leaseOperationType,
            leaseOwner: workerId,
          },
          supabaseAdmin
        ).catch(() => {});
      }
    }
  })();

  // Track in local map for in-process deduplication
  inFlightRefreshes.set(accountId, refreshPromise);

  try {
    return await refreshPromise;
  } catch (err: any) {
    const classification: TokenRefreshClassification =
      err?.classification ||
      classifyTokenRefreshError(
        err?.status,
        null,
        err,
        null
      );

    const errMsg = classification.reason || err?.message || String(err);

    logger.error({
      event: "MELI_TOKEN_REFRESH_FINAL_ERROR",
      tenantId,
      accountId,
      isTransient: classification.isTransient,
      isPermanentAuth: classification.isPermanentAuth,
      category: classification.category,
      error: errMsg,
    });

    if (classification.isPermanentAuth) {
      // Permanent: mark status = error, alert user
      await supabaseAdmin
        .from("meli_accounts")
        .update({
          status: "error",
          sync_error: errMsg,
          last_failure_category: "permanent_auth",
          last_failure_reason: errMsg,
          updated_at: new Date().toISOString(),
        })
        .eq("id", accountId);

      try {
        const { upsertStateAlert } = await import("@/services/notifications/notificationService");
        await upsertStateAlert({
          tenantId,
          type: "integration_disconnected",
          severity: "danger",
          title: "Mercado Libre necesita ser reconectado",
          body: "No pudimos renovar el token de conexión (autorización inválida o revocada). Por favor, reconecta tu cuenta desde Integraciones.",
          actionUrl: "/dashboard/integrations",
          actionLabel: "Revisar integración",
          entityType: "integration",
          entityId: accountId,
          dedupeKey: `tenant:${tenantId}:state:integration_disconnected:mercadolibre`,
          count: 1,
          metadata: { error: errMsg },
        });
      } catch (alertErr: any) {
        console.error("Failed to upsert integration_disconnected alert:", alertErr.message);
      }

      throw err;
    } else {
      // Transient: calculate next_retry_at, increment retry_count, KEEP status = 'connected'!
      const currentRetryCount = (initialAccount.retry_count || 0) + 1;
      const backoffSeconds = Math.min(Math.pow(2, currentRetryCount) * 15, 300); // 30s, 60s, 120s... max 5m
      const nextRetryAt = new Date(Date.now() + (classification.retryAfterMs || backoffSeconds * 1000)).toISOString();

      await supabaseAdmin
        .from("meli_accounts")
        .update({
          sync_error: errMsg,
          retry_count: currentRetryCount,
          next_retry_at: nextRetryAt,
          last_failure_category: classification.category,
          last_failure_reason: errMsg,
          updated_at: new Date().toISOString(),
        })
        .eq("id", accountId);

      throw new TransientMeliTokenError(errMsg, {
        retryAfterMs: classification.retryAfterMs || backoffSeconds * 1000,
        statusCode: classification.statusCode || 429,
      });
    }
  } finally {
    inFlightRefreshes.delete(accountId);
  }
}
