/**
 * Recursive sanitizer for log payloads, metadata, and error details.
 * Prevents leaks of secrets, tokens, PII, and arbitrarily large payloads.
 */

const SENSITIVE_KEY_PATTERNS = [
  /token/i,
  /secret/i,
  /password/i,
  /authorization/i,
  /api_?key/i,
  /signature/i,
  /cookie/i,
  /key_id/i,
  /private/i,
  /credit_?card/i,
  /cvv/i,
];

const RAW_PAYLOAD_KEYS = new Set([
  "raw_payload",
  "raw_data",
  "raw_body",
  "raw_response",
  "rawpayload",
  "rawdata",
  "webhook_body",
]);

const DEFAULT_MAX_DEPTH = 6;
const DEFAULT_MAX_STRING_LENGTH = 500;
const DEFAULT_MAX_ARRAY_LENGTH = 50;

/**
 * Masks an email address: "user@domain.com" -> "u***@domain.com"
 */
export function maskEmail(email: string): string {
  const parts = email.split("@");
  if (parts.length !== 2) return "[REDACTED_EMAIL]";
  const [user, domain] = parts;
  if (user.length <= 1) return `*@${domain}`;
  return `${user[0]}***@${domain}`;
}

/**
 * Masks a phone number: "+5491112345678" -> "+54911****5678"
 */
export function maskPhone(phone: string): string {
  const digitsOnly = phone.replace(/\D/g, "");
  if (digitsOnly.length < 6) return "[REDACTED_PHONE]";
  const start = phone.slice(0, 5);
  const end = phone.slice(-4);
  return `${start}****${end}`;
}

/**
 * Deep sanitization function.
 * Clones and sanitizes objects, handling cycles, depth, and length bounds.
 */
export function sanitizeLogData<T = any>(
  data: T,
  maxDepth = DEFAULT_MAX_DEPTH,
  maxStringLength = DEFAULT_MAX_STRING_LENGTH,
  seen = new WeakSet<object>()
): T {
  if (data === null || data === undefined) {
    return data;
  }

  // Primitive types
  if (typeof data === "string") {
    // Check if looks like a token/bearer
    if (/^bearer\s+[a-z0-9._-]+$/i.test(data) || /^app_usr-[a-z0-9_-]+$/i.test(data)) {
      return "[REDACTED_TOKEN]" as unknown as T;
    }
    if (data.length > maxStringLength) {
      return `${data.slice(0, maxStringLength)}...[TRUNCATED ${data.length - maxStringLength} CHARS]` as unknown as T;
    }
    return data;
  }

  if (typeof data !== "object") {
    return data;
  }

  // Check circular reference
  if (seen.has(data as object)) {
    return "[CIRCULAR_REFERENCE]" as unknown as T;
  }

  if (maxDepth <= 0) {
    return "[MAX_DEPTH_EXCEEDED]" as unknown as T;
  }

  seen.add(data as object);

  // Handle Error instances
  if (data instanceof Error) {
    return {
      name: data.name,
      message: sanitizeLogData(data.message, maxDepth - 1, maxStringLength, seen),
      stack: data.stack ? sanitizeLogData(data.stack, maxDepth - 1, 2000, seen) : undefined,
    } as unknown as T;
  }

  // Handle Arrays
  if (Array.isArray(data)) {
    const arr = data.slice(0, DEFAULT_MAX_ARRAY_LENGTH).map((item) =>
      sanitizeLogData(item, maxDepth - 1, maxStringLength, seen)
    );
    if (data.length > DEFAULT_MAX_ARRAY_LENGTH) {
      arr.push(`...[TRUNCATED ${data.length - DEFAULT_MAX_ARRAY_LENGTH} ITEMS]` as any);
    }
    return arr as unknown as T;
  }

  // Handle plain objects
  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    const isSensitive = SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
    if (isSensitive) {
      sanitized[key] = "[REDACTED]";
      continue;
    }

    if (RAW_PAYLOAD_KEYS.has(key.toLowerCase())) {
      sanitized[key] = "[RAW_PAYLOAD_REDACTED]";
      continue;
    }

    if (/email/i.test(key) && typeof value === "string") {
      sanitized[key] = maskEmail(value);
      continue;
    }

    if (/phone|celular|telefono/i.test(key) && typeof value === "string") {
      sanitized[key] = maskPhone(value);
      continue;
    }

    sanitized[key] = sanitizeLogData(value, maxDepth - 1, maxStringLength, seen);
  }

  return sanitized as T;
}
