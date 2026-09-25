import { createAdminClient } from "@/lib/supabase/admin";
import { createAlert } from "../alerts/createAlert";
import { logger } from "@/lib/errors/logger";
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

// In-flight deduplication: ensures that multiple concurrent calls for the same account
// within the same process share the exact same refresh request and rotation.
const inFlightRefreshes = new Map<string, Promise<string>>();

export interface RefreshMeliTokenOptions {
  force?: boolean;
}

export async function refreshMeliToken(
  meliAccountIdOrTenantId: string,
  options?: RefreshMeliTokenOptions
): Promise<string> {
  const supabaseAdmin = createAdminClient();

  // 1. Fetch current token and refresh_token
  const { data: account, error } = await supabaseAdmin
    .from("meli_accounts")
    .select("id, tenant_id, access_token, refresh_token, token_expires_at, status, sync_error, last_success_refresh")
    .or(`id.eq."${meliAccountIdOrTenantId}",tenant_id.eq."${meliAccountIdOrTenantId}"`)
    .maybeSingle();

  if (error || !account) {
    throw new Error(`Meli account not found for reference: ${meliAccountIdOrTenantId}`);
  }

  const tenantId = account.tenant_id;
  const accountId = account.id;

  // Deduplication: if a refresh is already in-flight for this account, join it!
  const existingInFlight = inFlightRefreshes.get(accountId);
  if (existingInFlight) {
    logger.info({
      event: "MELI_TOKEN_REFRESH_CONCURRENT_JOINED",
      tenantId,
      accountId,
      message: "Reusing in-flight token refresh promise for account",
    });
    return await existingInFlight;
  }

  // 2. Fresh token guard: if already refreshed recently (valid for > 3 hours) and not forced, reuse it!
  if (!options?.force && account.access_token && account.token_expires_at) {
    const timeLeftMs = new Date(account.token_expires_at).getTime() - Date.now();
    if (timeLeftMs > 3 * 60 * 60 * 1000 && account.status === "connected") {
      logger.info({
        event: "MELI_TOKEN_REFRESH_REUSED_FRESH",
        tenantId,
        accountId,
        remainingMinutes: Math.round(timeLeftMs / 60000),
      });
      return account.access_token;
    }
  }

  // Launch deduplicated execution
  const refreshPromise = (async () => {
    const clientId = process.env.MELI_CLIENT_ID || process.env.NEXT_PUBLIC_MELI_APP_ID;
    const clientSecret = process.env.MELI_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error("Missing Mercado Libre App ID or Secret in environment variables");
    }

    if (!account.refresh_token) {
      const errMsg = `No hay un token de renovación disponible para: ${meliAccountIdOrTenantId}`;

      // Update status to error for missing refresh token (permanent failure)
      await supabaseAdmin
        .from("meli_accounts")
        .update({
          status: "error",
          sync_error: errMsg,
          updated_at: new Date().toISOString(),
        })
        .eq("id", account.id);

      await createAlert({
        tenantId,
        title: "Error de integración con Mercado Libre",
        body: "No hay un token de renovación (refresh token) disponible. Por favor, vuelve a conectar tu cuenta.",
        severity: "critical",
      });

      await supabaseAdmin.from("audit_logs").insert({
        tenant_id: tenantId,
        action: "token_refresh_failed",
        entity_type: "meli_account",
        entity_id: account.id,
        metadata: { error: errMsg, permanent: true },
      });

      throw new Error(errMsg);
    }

    const maxAttempts = 2;
    let attempt = 0;
    let lastErrorData: any = null;
    let lastStatus: number | undefined = undefined;
    let lastHeaders: Headers | undefined = undefined;

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

        lastStatus = response.status;
        lastHeaders = response.headers;

        if (!response.ok) {
          lastErrorData = await response.json().catch(() => null);
          const classification = classifyTokenRefreshError(
            response.status,
            lastErrorData,
            null,
            response.headers.get("retry-after")
          );

          // If transient and retryable within the inline budget, backoff and retry
          if (classification.isTransient && attempt < maxAttempts) {
            const backoffMs = classification.retryAfterMs || Math.min(attempt * 1500 + Math.random() * 500, 5000);
            logger.warn({
              event: "MELI_TOKEN_REFRESH_TRANSIENT_BACKOFF",
              tenantId,
              accountId,
              attempt,
              status: String(response.status),
              backoffMs,
            });
            await new Promise((resolve) => setTimeout(resolve, backoffMs));
            continue;
          }

          // Non-retryable or retries exhausted
          const errMsg = lastErrorData?.message || lastErrorData?.error || `Status ${response.statusText}`;
          const err: any = new Error(errMsg);
          err.classification = classification;
          err.status = response.status;
          throw err;
        }

        const data = await response.json();
        if (!data.access_token) {
          throw new Error("Respuesta inválida de Mercado Libre: falta access_token");
        }

        const newExpiresAt = new Date(Date.now() + (data.expires_in || 21600) * 1000).toISOString();

        // 3. Update DB and VERIFY write!
        const { error: updateError } = await supabaseAdmin
          .from("meli_accounts")
          .update({
            access_token: data.access_token,
            refresh_token: data.refresh_token || account.refresh_token,
            token_expires_at: newExpiresAt,
            status: "connected",
            sync_error: null,
            last_success_refresh: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", account.id);

        if (updateError) {
          logger.error({
            event: "MELI_TOKEN_PERSIST_FAILED",
            tenantId,
            accountId: account.id,
            error: updateError.message,
          });
          throw new Error(`Failed to persist refreshed tokens to database: ${updateError.message}`);
        }

        // Create Audit Log
        await supabaseAdmin.from("audit_logs").insert({
          tenant_id: tenantId,
          action: "token_refreshed",
          entity_type: "meli_account",
          entity_id: account.id,
          metadata: { expires_at: newExpiresAt },
        });

        logger.info({
          event: "MELI_TOKEN_REFRESH_SUCCESS",
          tenantId,
          accountId: account.id,
          expiresAt: newExpiresAt,
        });

        return data.access_token;
      } catch (err: any) {
        if (attempt >= maxAttempts || err?.classification?.isPermanentAuth) {
          throw err;
        }
        // Network timeout retry with jitter
        const backoffMs = Math.min(attempt * 1000 + Math.random() * 400, 3000);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }

    throw new Error("Unexpected end of token refresh retry loop");
  })();

  // Track in-flight map
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
      event: "MELI_TOKEN_REFRESH_FAILED",
      tenantId,
      accountId,
      isTransient: classification.isTransient,
      isPermanentAuth: classification.isPermanentAuth,
      category: classification.category,
      error: errMsg,
    });

    if (classification.isPermanentAuth) {
      // PERMANENT: Update status = error, alert user to reconnect
      await supabaseAdmin
        .from("meli_accounts")
        .update({
          status: "error",
          sync_error: errMsg,
          updated_at: new Date().toISOString(),
        })
        .eq("id", account.id);

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
          entityId: account.id,
          dedupeKey: `tenant:${tenantId}:state:integration_disconnected:mercadolibre`,
          count: 1,
          metadata: { error: errMsg },
        });
      } catch (alertErr: any) {
        console.error("Failed to upsert integration_disconnected alert:", alertErr.message);
      }

      await supabaseAdmin.from("audit_logs").insert({
        tenant_id: tenantId,
        action: "token_refresh_failed",
        entity_type: "meli_account",
        entity_id: account.id,
        metadata: { error: errMsg, isPermanent: true },
      });

      throw err;
    } else {
      // TRANSIENT: Do NOT mark status = 'error'! Keep status 'connected' (or preserve previous status)
      // and record the transient sync_error message.
      await supabaseAdmin
        .from("meli_accounts")
        .update({
          sync_error: errMsg,
          updated_at: new Date().toISOString(),
        })
        .eq("id", account.id);

      await supabaseAdmin.from("audit_logs").insert({
        tenant_id: tenantId,
        action: "token_refresh_transient_failure",
        entity_type: "meli_account",
        entity_id: account.id,
        metadata: { error: errMsg, isTransient: true },
      });

      throw new TransientMeliTokenError(errMsg, {
        retryAfterMs: classification.retryAfterMs,
        statusCode: classification.statusCode,
      });
    }
  } finally {
    inFlightRefreshes.delete(accountId);
  }
}
