/**
 * External Service Error Classification Utility (Sprint 8)
 * Classifies errors from external providers (OpenAI, Gemini, Mercado Libre, WhatsApp, Mercado Pago)
 * to ensure fail-fast on permanent credential errors and controlled backoff on transient errors.
 */

export interface ClassifiedError {
  isRetryable: boolean;
  isPermanentAuth: boolean;
  category: "auth" | "rate_limit" | "server_error" | "timeout" | "client_error" | "unknown";
  statusCode?: number;
  reason: string;
}

export function classifyExternalError(error: any): ClassifiedError {
  if (!error) {
    return {
      isRetryable: false,
      isPermanentAuth: false,
      category: "unknown",
      reason: "empty_error",
    };
  }

  const status = error?.status || error?.statusCode || error?.response?.status;
  const message = typeof error?.message === "string" ? error.message.toLowerCase() : "";
  const errorCode = typeof error?.code === "string" ? error.code.toLowerCase() : typeof error?.error === "string" ? error.error.toLowerCase() : "";

  // 1. Permanent Authentication / Authorization Errors (DO NOT RETRY - FAIL FAST)
  if (
    status === 401 ||
    status === 403 ||
    errorCode === "invalid_grant" ||
    errorCode === "unauthorized" ||
    errorCode === "forbidden" ||
    message.includes("invalid_grant") ||
    message.includes("invalid access token") ||
    message.includes("token expired and refresh failed") ||
    message.includes("api key invalid")
  ) {
    return {
      isRetryable: false,
      isPermanentAuth: true,
      category: "auth",
      statusCode: status || 401,
      reason: "permanent_auth_failure",
    };
  }

  // 2. Rate Limiting (RETRYABLE WITH BACKOFF)
  if (
    status === 429 ||
    errorCode === "rate_limit_exceeded" ||
    errorCode === "too_many_requests" ||
    message.includes("rate limit") ||
    message.includes("quota exceeded")
  ) {
    return {
      isRetryable: true,
      isPermanentAuth: false,
      category: "rate_limit",
      statusCode: 429,
      reason: "rate_limit_transient",
    };
  }

  // 3. Network Timeouts & Connection Aborts (RETRYABLE)
  if (
    errorCode === "etimedout" ||
    errorCode === "econnreset" ||
    errorCode === "econnrefused" ||
    error.name === "AbortError" ||
    message.includes("timeout") ||
    message.includes("aborted") ||
    message.includes("fetch failed")
  ) {
    return {
      isRetryable: true,
      isPermanentAuth: false,
      category: "timeout",
      reason: "network_or_timeout",
    };
  }

  // 4. Upstream Server Errors (RETRYABLE 5xx)
  if (status >= 500 && status <= 599) {
    return {
      isRetryable: true,
      isPermanentAuth: false,
      category: "server_error",
      statusCode: status,
      reason: "upstream_server_error",
    };
  }

  // 5. Client 4xx Errors (NON-RETRYABLE BAD REQUEST / NOT FOUND)
  if (status >= 400 && status < 500) {
    return {
      isRetryable: false,
      isPermanentAuth: false,
      category: "client_error",
      statusCode: status,
      reason: "client_request_error",
    };
  }

  // Default fallback
  return {
    isRetryable: false,
    isPermanentAuth: false,
    category: "unknown",
    statusCode: status,
    reason: "unclassified_error",
  };
}
