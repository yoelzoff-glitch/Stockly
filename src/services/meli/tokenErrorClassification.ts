/**
 * OAuth Token Refresh Error Classification
 * Differentiates transient errors (429 rate limit, 408 timeout, 5xx server error, network drops)
 * from permanent authorization failures (invalid_grant, invalid_client, unauthorized_client).
 */

export interface TokenRefreshClassification {
  isTransient: boolean;
  isPermanentAuth: boolean;
  category: "rate_limit" | "timeout" | "server_error" | "permanent_auth" | "unknown";
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
  return /429|local_rate_limited|rate[_\s-]?limit|limitando temporalmente|too many requests|timeout|econnreset|etimedout|500|502|503|504/i.test(errorStr);
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

  // 2. Rate Limiting (429, local_rate_limited)
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

  // 3. Network Timeouts & Aborts
  if (
    statusCode === 408 ||
    err?.name === "TimeoutError" ||
    err?.name === "AbortError" ||
    errorCode === "etimedout" ||
    errorCode === "econnreset" ||
    /timeout|aborted|econnreset|etimedout|fetch failed/i.test(message)
  ) {
    return {
      isTransient: true,
      isPermanentAuth: false,
      category: "timeout",
      statusCode: statusCode || 408,
      reason: "Fallo temporal de conexión o tiempo de espera con Mercado Libre.",
    };
  }

  // 4. Server Errors (5xx)
  if (statusCode && statusCode >= 500 && statusCode <= 599) {
    return {
      isTransient: true,
      isPermanentAuth: false,
      category: "server_error",
      statusCode,
      reason: `Error del servidor de Mercado Libre (${statusCode}). Reintentaremos en breve.`,
    };
  }

  // 5. Explicit 401/403 (unauthorized) -> permanent auth failure
  if (statusCode === 401 || statusCode === 403) {
    return {
      isTransient: false,
      isPermanentAuth: true,
      category: "permanent_auth",
      statusCode,
      reason: body?.message || err?.message || `No autorizado (${statusCode})`,
    };
  }

  // 6. Unknown fallback
  return {
    isTransient: false,
    isPermanentAuth: false,
    category: "unknown",
    statusCode,
    reason: body?.message || err?.message || "Error al procesar renovación de token",
  };
}
