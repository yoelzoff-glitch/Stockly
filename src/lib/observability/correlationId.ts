import { randomUUID } from "crypto";

export const CORRELATION_ID_HEADER = "x-request-id";
const MAX_ID_LENGTH = 64;
// Safe format: alphanumeric, dash, underscore, dot
const SAFE_ID_REGEX = /^[a-zA-Z0-9._-]+$/;

/**
 * Extracts correlation ID from request headers or generates a new secure UUID.
 * Validates format and prevents arbitrarily long or malformed input from clients.
 */
export function getOrCreateCorrelationId(
  headersOrRequest?: Headers | Request | Record<string, any> | string | null
): string {
  if (!headersOrRequest) {
    return randomUUID();
  }

  if (typeof headersOrRequest === "string") {
    const trimmed = headersOrRequest.trim();
    if (trimmed.length > 0 && trimmed.length <= MAX_ID_LENGTH && SAFE_ID_REGEX.test(trimmed)) {
      return trimmed;
    }
    return randomUUID();
  }

  let rawHeader: string | null | undefined;

  if (headersOrRequest instanceof Request) {
    rawHeader = headersOrRequest.headers.get(CORRELATION_ID_HEADER);
  } else if (headersOrRequest instanceof Headers) {
    rawHeader = headersOrRequest.get(CORRELATION_ID_HEADER);
  } else if (typeof headersOrRequest === "object") {
    rawHeader =
      headersOrRequest[CORRELATION_ID_HEADER] ||
      headersOrRequest["X-Request-Id"] ||
      headersOrRequest["x_request_id"];
  }

  if (typeof rawHeader === "string") {
    const trimmed = rawHeader.trim();
    if (trimmed.length > 0 && trimmed.length <= MAX_ID_LENGTH && SAFE_ID_REGEX.test(trimmed)) {
      return trimmed;
    }
  }

  return randomUUID();
}
