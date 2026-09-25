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

// Global operational constants
const FRESH_TOKEN_THRESHOLD_MS = 3 * 60 * 60 * 1000;
// Distributed lease TTL: 180 seconds (well above the 15-second HTTP timeout)
const LEASE_TTL_SECONDS = 180;
// HTTP OAuth request timeout: 15 seconds
const HTTP_OAUTH_TIMEOUT_MS = 15000;

export interface RefreshMeliTokenOptions {
  force?: boolean;
  /** Access token that produced a 401. If DB already has another token, reuse it. */
  staleAccessToken?: string | null;
}

export interface MeliTokenRefresherDependencies {
  supabase?: any;
  inFlightMap?: Map<string, Promise<string>>;
}

export interface MeliTokenRefresher {
  refresh(
    meliAccountIdOrTenantId: string,
    options?: RefreshMeliTokenOptions
  ): Promise<string>;
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

export function createMeliTokenRefresher(
  deps?: MeliTokenRefresherDependencies
): MeliTokenRefresher {
  const inFlightRefreshes = deps?.inFlightMap ?? new Map<string, Promise<string>>();
  const getSupabase = () => deps?.supabase ?? createAdminClient();

  return {
    async refresh(
      meliAccountIdOrTenantId: string,
      options?: RefreshMeliTokenOptions
    ): Promise<string> {
      const supabaseAdmin = getSupabase();
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
        let allowLeaseRelease = true;

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

          const expectedVersion = account.token_version ?? 1;

          if (expectedVersion > initialVersion && hasFreshAccessToken(account)) {
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

          // Inner handler that coordinates uncertain rotation while lease is held
          const handleUncertainRotation = async (reason: string, originalError?: unknown): Promise<string> => {
            // 1. Establecer allowLeaseRelease = false antes de la primera operación asíncrona
            allowLeaseRelease = false;

            try {
              // 1. Re-read the account to check if another worker won and advanced token_version
              let latestAccount: any = null;
              try {
                const { data } = await supabaseAdmin
                  .from("meli_accounts")
                  .select("access_token, token_expires_at, status, token_version")
                  .eq("id", accountId)
                  .maybeSingle();
                latestAccount = data;
              } catch (readErr: any) {
                logger.warn({
                  event: "MELI_UNCERTAIN_PEER_LOOKUP_FAILED",
                  tenantId,
                  accountId,
                  error: readErr?.message,
                });
              }

              if (
                latestAccount?.access_token &&
                (latestAccount.token_version ?? 1) > expectedVersion &&
                hasFreshAccessToken(latestAccount)
              ) {
                logger.info({
                  event: "MELI_RECOVERED_WINNING_WORKER_TOKEN_POST_UNCERTAIN",
                  tenantId,
                  accountId,
                  tokenVersion: latestAccount.token_version,
                });
                allowLeaseRelease = true;
                return latestAccount.access_token;
              }

              // 2. Persist rotation_uncertain atomically via dedicated RPC while holding the lease
              let markConfirmed = false;
              for (let markAttempt = 1; markAttempt <= 3; markAttempt++) {
                try {
                  const { data: markResult, error: markError } = await supabaseAdmin.rpc(
                    "mark_meli_token_rotation_uncertain",
                    {
                      p_tenant_id: tenantId,
                      p_account_id: accountId,
                      p_operation_type: leaseOperationType,
                      p_lease_owner: workerId,
                      p_expected_version: expectedVersion,
                      p_reason: reason,
                      p_marked_at: new Date().toISOString(),
                    }
                  );

                  if (!markError && markResult?.marked) {
                    markConfirmed = true;
                    break;
                  }
                } catch (rpcErr: any) {
                  logger.warn({
                    event: "MELI_RPC_MARK_UNCERTAIN_THREW",
                    tenantId,
                    accountId,
                    attempt: markAttempt,
                    error: rpcErr?.message,
                  });
                }

                // Check if an ambiguous response or concurrent worker actually saved the mark
                try {
                  const { data: checkAcc } = await supabaseAdmin
                    .from("meli_accounts")
                    .select("last_failure_category, token_version, access_token, token_expires_at, status")
                    .eq("id", accountId)
                    .maybeSingle();

                  if (checkAcc?.last_failure_category === "rotation_uncertain") {
                    markConfirmed = true;
                    break;
                  }

                  if (
                    checkAcc?.access_token &&
                    (checkAcc.token_version ?? 1) > expectedVersion &&
                    hasFreshAccessToken(checkAcc)
                  ) {
                    allowLeaseRelease = true;
                    return checkAcc.access_token;
                  }
                } catch (checkErr: any) {
                  logger.warn({
                    event: "MELI_CHECK_UNCERTAIN_READ_THREW",
                    tenantId,
                    accountId,
                    attempt: markAttempt,
                    error: checkErr?.message,
                  });
                }

                if (markAttempt < 3) {
                  await new Promise((r) => setTimeout(r, process.env.NODE_ENV === "test" ? 20 : 200));
                }
              }

              if (markConfirmed) {
                // 3. Mark is confirmed stored; only now allow lease release
                allowLeaseRelease = true;
                try {
                  const { upsertStateAlert } = await import("@/services/notifications/notificationService");
                  await upsertStateAlert({
                    tenantId,
                    type: "sync_failed",
                    severity: "danger",
                    title: "Renovación de Mercado Libre pendiente de verificación",
                    body: "Mercado Libre pudo haber rotado la credencial, pero no se confirmó su persistencia. Detuvimos nuevos intentos para proteger la conexión.",
                    actionUrl: "/dashboard/integrations",
                    actionLabel: "Revisar integración",
                    entityType: "integration",
                    entityId: accountId,
                    dedupeKey: `tenant:${tenantId}:state:meli_rotation_uncertain`,
                    count: 1,
                    metadata: { stage: "oauth_rotation_persistence" },
                  });
                } catch (alertError: any) {
                  logger.error({
                    event: "MELI_TOKEN_UNCERTAIN_ALERT_FAILED",
                    tenantId,
                    accountId,
                    error: alertError?.message,
                  });
                }
              } else {
                // If the mark cannot be confirmed:
                // - Do NOT voluntarily release the lease. Keep it held until TTL expiry.
                // - Do not call OAuth again.
                allowLeaseRelease = false;
                logger.error({
                  event: "MELI_MARK_ROTATION_UNCERTAIN_FAILED_HOLDING_LEASE",
                  tenantId,
                  accountId,
                  workerId,
                  reason,
                });
              }
            } catch (unexpectedError: any) {
              allowLeaseRelease = false;
              logger.error({
                event: "MELI_HANDLE_UNCERTAIN_ROTATION_UNEXPECTED_ERROR",
                tenantId,
                accountId,
                workerId,
                error: unexpectedError?.message,
              });
              throw new UncertainMeliTokenRotationError(reason, {
                cause: unexpectedError ?? originalError,
              });
            }

            // 4. Propagate UncertainMeliTokenRotationError
            throw new UncertainMeliTokenRotationError(reason, { cause: originalError });
          };

          await assertRefreshLease(supabaseAdmin, {
            tenantId,
            accountId,
            operationType: leaseOperationType,
            leaseOwner: workerId,
          });

          // Exactly ONE POST to /oauth/token. Never repeat the POST on 5xx, 408, timeout, network error.
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
              signal: AbortSignal.timeout(HTTP_OAUTH_TIMEOUT_MS),
            });
          } catch (error) {
            return await handleUncertainRotation(
              "No se recibió una respuesta confirmada de Mercado Libre durante la rotación. No se reutilizará el refresh token anterior.",
              error
            );
          }

          if (response.status === 429) {
            // Explicit 429 rate limit response: Mercado Libre rejected before rotating.
            const body = await response.json().catch(() => null);
            const classification = classifyTokenRefreshError(
              429,
              body,
              null,
              response.headers.get("retry-after")
            );
            const error: any = new Error(classification.reason);
            error.classification = classification;
            error.status = 429;
            throw error;
          }

          if (response.status >= 500 || response.status === 408) {
            // 5xx / 408 server errors from Mercado Libre:
            // Could have occurred after ML consumed refresh_token and generated a new one.
            // Insecure to retry or discard: MUST be treated as rotation_uncertain.
            return await handleUncertainRotation(
              `Mercado Libre devolvió HTTP ${response.status}. La rotación queda en estado incierto para proteger las credenciales.`
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
            const error: any = new Error(classification.reason);
            error.classification = classification;
            error.status = response.status;
            throw error;
          }

          let responseData: any = null;
          try {
            responseData = await response.json();
          } catch (error) {
            return await handleUncertainRotation(
              "Mercado Libre respondió al refresh, pero no se pudo confirmar el nuevo par de tokens.",
              error
            );
          }

          const validated = validateOAuthTokenResponse(responseData);
          if (!validated) {
            return await handleUncertainRotation(
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
            return await handleUncertainRotation(
              "Se perdió la propiedad del lease antes de persistir la rotación. No se sobrescribirán tokens.",
              leaseErr
            );
          }

          const refreshedAt = new Date().toISOString();
          const expiresAt = new Date(Date.now() + validated.expiresInSec * 1000).toISOString();
          let lastPersistenceError = "unknown";

          // Retry ONLY the persistence of the already-received tokens (NO secondary OAuth POST)
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

          return await handleUncertainRotation(
            `Mercado Libre rotó los tokens, pero su persistencia no pudo confirmarse (${lastPersistenceError}).`
          );
        } finally {
          if (leaseAcquired && allowLeaseRelease) {
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
          // Already marked and handled atomically while holding the lease inside worker
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
    },
  };
}

// Default singleton refresher instance
export const defaultRefresher = createMeliTokenRefresher();

/**
 * Standard entrypoint for refreshing Mercado Libre OAuth credentials.
 */
export async function refreshMeliToken(
  meliAccountIdOrTenantId: string,
  options?: RefreshMeliTokenOptions
): Promise<string> {
  return defaultRefresher.refresh(meliAccountIdOrTenantId, options);
}
