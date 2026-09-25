/**
 * OAuth Token Refresh Error Classification
 * Differentiates transient errors (429 rate limit, 408 timeout, 5xx server error, network drops)
 * from permanent authorization failures (invalid_grant, invalid_client, unauthorized_client).
 */

export type TokenRefreshCategory =
  | "rate_limit"
  | "network"
  | "timeout"
  | "server_error"
  | "rotation_uncertain"
  | "permanent_auth";

export interface TokenRefreshClassification {
  isTransient: boolean;
  isPermanentAuth: boolean;
  category: TokenRefreshCategory;
  statusCode?: number;
  retryAfterMs?: number;
  reason: string;
}

const MAX_RETRY_AFTER_MS = 60000; // 60s max wait for inline retries

export function parseRetryAfterHeader(headerValue: string | null | undefined): number | null {
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

export function isTransientErrorString(errorStr: string | null | undefined): boolean {
  if (!errorStr) return false;
  return /429|local_rate_limited|rate[_\s-]?limit|limitando temporalmente|too many requests|timeout|aborted|econnreset|econnrefused|etimedout|fetch failed|network|socket hang up|500|502|503|504/i.test(errorStr);
}

export function classifyTokenRefreshError(
  status: number | undefined,
  body: any,
  err?: any,
  retryAfterHeader?: string | null
): TokenRefreshClassification {
  const statusCode = status || body?.status || err?.status || err?.statusCode;
  const message = (
    (typeof body?.message === "string" ? body.message : "") ||
    (typeof err?.message === "string" ? err.message : "") ||
    ""
  ).toLowerCase();
  const errorCode = (
    (typeof body?.error === "string" ? body.error : "") ||
    (typeof err?.code === "string" ? err.code : "") ||
    ""
  ).toLowerCase();

  // 1. Permanent OAuth rejections (revocation, invalid grant, client credentials invalid)
  const permanentCodes = ["invalid_grant", "invalid_client", "unauthorized_client", "invalid_scope"];
  if (
    permanentCodes.includes(errorCode) ||
    /invalid_grant|grant.*revoked|grant.*expired|unauthorized_client|invalid_client/i.test(message)
  ) {
    return {
      isTransient: false,
      isPermanentAuth: true,
      category: "permanent_auth",
      statusCode: statusCode || 400,
      reason: body?.message || err?.message || errorCode || "Autorización revocada o credenciales inválidas (invalid_grant)",
    };
  }

  // 2. Explicit 401/403 (unauthorized) -> permanent auth failure
  if (statusCode === 401 || statusCode === 403) {
    return {
      isTransient: false,
      isPermanentAuth: true,
      category: "permanent_auth",
      statusCode,
      reason: body?.message || err?.message || `No autorizado (${statusCode})`,
    };
  }

  // 3. Rate Limiting (429, local_rate_limited)
  if (
    statusCode === 429 ||
    errorCode === "rate_limited" ||
    errorCode === "local_rate_limited" ||
    /local_rate_limited|rate[_\s-]?limit|too many requests/i.test(message)
  ) {
    const retryAfterMs = parseRetryAfterHeader(retryAfterHeader) || 5000;
    return {
      isTransient: true,
      isPermanentAuth: false,
      category: "rate_limit",
      statusCode: 429,
      retryAfterMs,
      reason: "Mercado Libre está limitando temporalmente las llamadas (rate limit). Reintentaremos automáticamente.",
    };
  }

  // 4. Timeouts & Aborts
  if (
    statusCode === 408 ||
    err?.name === "TimeoutError" ||
    err?.name === "AbortError" ||
    errorCode === "etimedout" ||
    /timeout|aborted|timed out|request timeout/i.test(message)
  ) {
    return {
      isTransient: true,
      isPermanentAuth: false,
      category: "timeout",
      statusCode: statusCode || 408,
      reason: "Tiempo de espera agotado al conectar con Mercado Libre (timeout).",
    };
  }

  // 5. Network errors (drops, connection resets, dns, fetch failed)
  if (
    errorCode === "econnreset" ||
    errorCode === "econnrefused" ||
    errorCode === "enotfound" ||
    /econnreset|econnrefused|enotfound|fetch failed|network error|socket hang up/i.test(message)
  ) {
    return {
      isTransient: true,
      isPermanentAuth: false,
      category: "network",
      statusCode: statusCode || 503,
      reason: "Fallo temporal de conexión o red con Mercado Libre.",
    };
  }

  // 6. Server Errors (5xx)
  if (statusCode && statusCode >= 500 && statusCode <= 599) {
    return {
      isTransient: true,
      isPermanentAuth: false,
      category: "server_error",
      statusCode,
      reason: `Error del servidor de Mercado Libre (${statusCode}). Reintentaremos en breve.`,
    };
  }

  // 7. Fallback: Check if transient string
  if (isTransientErrorString(message)) {
    return {
      isTransient: true,
      isPermanentAuth: false,
      category: "network",
      statusCode: statusCode || 503,
      reason: body?.message || err?.message || "Fallo transitorio de comunicación con Mercado Libre",
    };
  }

  return {
    isTransient: false,
    isPermanentAuth: true,
    category: "permanent_auth",
    statusCode: statusCode || 400,
    reason: body?.message || err?.message || "Error al procesar renovación de token",
  };
}
