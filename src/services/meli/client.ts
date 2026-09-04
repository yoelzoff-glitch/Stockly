import { createAdminClient } from "@/lib/supabase/admin";
import { refreshMeliToken } from "./refreshToken";
import { createAlert } from "../alerts/createAlert";
import { AppError } from "@/lib/errors/AppError";
import { isMeliWritesDisabled } from "@/lib/safety/killSwitches";
import { logger } from "@/lib/errors/logger";
import { classifyExternalError } from "@/lib/errors/externalErrorClassification";

export interface MeliFetchArgs {
  tenantId?: string;
  meliAccountId?: string;
  endpoint: string;
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  body?: any;
  timeoutMs?: number;
  maxRetries?: number;
}

const DEFAULT_TIMEOUT_MS = 15000;
const MAX_RETRY_ATTEMPTS = 3;
const MAX_RETRY_AFTER_MS = 30000;

function parseRetryAfter(headerValue: string | null): number | null {
  if (!headerValue) return null;
  const seconds = parseInt(headerValue, 10);
  if (!isNaN(seconds) && seconds > 0) {
    return Math.min(seconds * 1000, MAX_RETRY_AFTER_MS);
  }
  const dateParsed = Date.parse(headerValue);
  if (!isNaN(dateParsed)) {
    const diff = dateParsed - Date.now();
    return diff > 0 ? Math.min(diff, MAX_RETRY_AFTER_MS) : 1000;
  }
  return null;
}

function isTransientError(status: number): boolean {
  return status === 429 || status === 408 || status === 500 || status === 502 || status === 503 || status === 504;
}

export async function meliFetch({
  tenantId,
  meliAccountId,
  endpoint,
  method = "GET",
  body,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxRetries = MAX_RETRY_ATTEMPTS,
}: MeliFetchArgs): Promise<any> {
  const startTime = Date.now();
  const isReadOperation = !method || method === "GET";

  // Remote write protection via kill switch (does NOT block GET, OAuth or refresh)
  if (method && method !== "GET" && isMeliWritesDisabled()) {
    logger.warn({
      event: "MELI_WRITES_DISABLED",
      tenantId,
      endpoint,
      method,
      message: "Mercado Libre remote write operations are temporarily disabled via kill switch",
    });
    throw new AppError(
      "OPERATION_BLOCKED",
      `Mercado Libre write operations are temporarily disabled by system administrator (${method} ${endpoint})`,
      403
    );
  }

  if (!meliAccountId && !tenantId) {
    throw new AppError("VALIDATION_ERROR", "meliFetch requires either tenantId or meliAccountId", 400);
  }

  const supabase = createAdminClient();

  // 1. Fetch current meli account
  let query = supabase
    .from("meli_accounts")
    .select("id, tenant_id, access_token, refresh_token, token_expires_at");

  if (meliAccountId) {
    query = query.eq("id", meliAccountId);
  } else {
    query = query.eq("tenant_id", tenantId!);
  }

  const { data: account, error } = await query.maybeSingle();

  if (error || !account) {
    throw new AppError("VALIDATION_ERROR", "No hay una cuenta de Mercado Libre conectada", 400);
  }

  const finalTenantId = account.tenant_id;
  let accessToken = account.access_token;

  // 2. Check if token expires in less than 10 minutes (or already expired)
  let needsRefresh = false;
  if (account.token_expires_at) {
    const expiresAt = new Date(account.token_expires_at).getTime();
    const tenMinutes = 10 * 60 * 1000;
    if (expiresAt - Date.now() < tenMinutes) {
      needsRefresh = true;
    }
  } else {
    needsRefresh = true;
  }

  if (needsRefresh) {
    try {
      accessToken = await refreshMeliToken(account.id);
    } catch (refreshErr: any) {
      throw new AppError("VALIDATION_ERROR", `Failed to auto-refresh Meli token: ${refreshErr.message}`, 401);
    }
  }

  const executeRequest = async (token: string) => {
    const url = `https://api.mercadolibre.com${endpoint}`;
    const options: RequestInit = {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(timeoutMs),
    };
    if (body) {
      options.body = JSON.stringify(body);
    }
    return await fetch(url, options);
  };

  // 3. Execution & Resilient Retry Loop
  let response: Response | null = null;
  let attempt = 0;
  let refreshedTokenOnce = false;

  const allowedAttempts = isReadOperation ? Math.max(1, maxRetries) : 1;

  while (attempt < allowedAttempts) {
    attempt++;
    try {
      response = await executeRequest(accessToken || "");

      const classification = classifyExternalError({
        status: response.status,
        headers: response.headers,
      });

      // Handle 401 Unauthorized with single controlled token refresh
      if (classification.isPermanentAuth && response.status === 401 && !refreshedTokenOnce) {
        refreshedTokenOnce = true;
        logger.warn({
          event: "MELI_FETCH_401_REFRESH",
          tenantId: finalTenantId,
          endpoint,
        });
        try {
          accessToken = await refreshMeliToken(account.id);
          response = await executeRequest(accessToken || "");
          if (response.ok) break;
          const postRefreshClassification = classifyExternalError({ status: response.status });
          if (!postRefreshClassification.isRetryable) {
            break; // Fail fast on permanent error after single refresh attempt
          }
        } catch (refreshErr) {
          logger.error({
            event: "MELI_FETCH_REFRESH_FAILED",
            tenantId: finalTenantId,
            error: refreshErr,
          });
          break; // Refresh failed, fail fast
        }
      }

      if (response.ok) {
        break;
      }

      // If retryable (408, 429, 500, 502, 503, 504) and read operation with remaining retries, backoff
      if (classification.isRetryable && isReadOperation && attempt < allowedAttempts) {
        const retryAfterMs = parseRetryAfter(response.headers.get("retry-after"));
        const jitter = Math.random() * 200;
        const backoffMs = retryAfterMs || Math.pow(2, attempt) * 400 + jitter;

        logger.warn({
          event: "MELI_FETCH_RATE_LIMIT_BACKOFF",
          tenantId: finalTenantId,
          endpoint,
          status: String(response.status),
          attempt,
          backoffMs,
        });

        await new Promise((resolve) => setTimeout(resolve, backoffMs));
        continue;
      }

      // Non-retryable (400, 403, validation) or max retries reached: break immediately (fail-fast)
      break;
    } catch (err: any) {
      const networkClassification = classifyExternalError(err);
      if (networkClassification.isRetryable && isReadOperation && attempt < allowedAttempts) {
        const backoffMs = Math.pow(2, attempt) * 400 + Math.random() * 200;
        logger.warn({
          event: "MELI_FETCH_NETWORK_RETRY",
          tenantId: finalTenantId,
          endpoint,
          attempt,
          error: err?.message,
        });
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
        continue;
      }
      throw new AppError("MELI_API_ERROR", `Mercado Libre network/timeout failure: ${err?.message}`, 504);
    }
  }

  const durationMs = Date.now() - startTime;

  // 4. Handle Final Failed Response
  if (!response || !response.ok) {
    const status = response ? response.status : 500;
    const errorText = response ? await response.text() : "No response";
    let errorData: any = null;
    try {
      errorData = JSON.parse(errorText);
    } catch (_) {}

    const errorMessage = errorData?.message || `Mercado Libre API failed with status ${status}`;

    logger.error({
      event: "MELI_FETCH_ERROR",
      tenantId: finalTenantId,
      endpoint,
      status,
      durationMs,
      errorMessage,
    });

    if (status === 401) {
      await supabase
        .from("meli_accounts")
        .update({
          status: "error",
          sync_error: errorMessage,
        })
        .eq("id", account.id);

      await createAlert({
        tenantId: finalTenantId,
        title: "Fallo de comunicación con Mercado Libre",
        body: `La sincronización ha fallado: ${errorMessage.substring(0, 100)}`,
        severity: "error",
      });
    }

    throw new AppError("VALIDATION_ERROR", `Mercado Libre API Error: ${errorMessage}`, status);
  }

  // 5. Parse and Return JSON
  const responseText = await response.text();
  if (!responseText) {
    return {};
  }
  try {
    return JSON.parse(responseText);
  } catch (e) {
    return responseText;
  }
}
