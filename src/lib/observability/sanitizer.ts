/**
 * Recursive sanitizer for log payloads, metadata, and error details.
 * Prevents leaks of secrets, tokens, PII, and arbitrarily large payloads while preserving
 * technical identifiers (UUIDs, timestamps, order IDs, numeric metrics, correlation IDs).
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

const PRESERVED_ID_KEYS = new Set([
  "id",
  "correlationid",
  "correlation_id",
  "requestid",
  "request_id",
  "runid",
  "run_id",
  "userid",
  "user_id",
  "tenantid",
  "tenant_id",
  "productid",
  "product_id",
  "orderid",
  "order_id",
  "itemid",
  "item_id",
  "workflowid",
  "workflow_id",
  "actionid",
  "action_id",
  "meli_item_id",
  "meli_order_id",
  "timestamp",
  "created_at",
  "updated_at",
  "date",
]);

const PHONE_KEY_PATTERNS = [
  /phone/i,
  /celular/i,
  /telefono/i,
  /^from_phone$/i,
  /^to_phone$/i,
  /^phone_number$/i,
  /^customer_phone$/i,
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

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?$/;
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// Recognizes explicit phone patterns:
// 1. International E.164 (+54 9 11 1234-5678, +1 415 555 2671)
// 2. Argentine local phone formats with area code (011 15 1234-5678, 11-1234-5678, 5491112345678)
const PHONE_IN_STRING_REGEX = /(?:\+54\s?9?\s?\d{2,4}[-\s]?\d{3,4}[-\s]?\d{4}|\+1[-\s]?\d{3}[-\s]?\d{3}[-\s]?\d{4}|\b549\d{9,11}\b|\b0?\d{2,4}[-\s]15[-\s]?\d{3,4}[-\s]?\d{4}\b|\b\d{2,4}[-\s]\d{4}[-\s]\d{4}\b)/g;

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
  const start = phone.slice(0, Math.min(5, Math.floor(phone.length / 2)));
  const end = phone.slice(-4);
  return `${start}****${end}`;
}

/**
 * Replaces embedded emails and phone numbers inside free-form text.
 * Preserves UUIDs, timestamps, order IDs, and monetary values.
 */
export function sanitizeStringText(text: string): string {
  if (!text || typeof text !== "string") return text;

  // Short-circuit if string is exactly a UUID or ISO date
  if (UUID_REGEX.test(text.trim()) || ISO_DATE_REGEX.test(text.trim())) {
    return text;
  }

  // 1. Redact Bearer / OAuth tokens
  let result = text
    .replace(/bearer\s+[a-z0-9._-]+/gi, "[REDACTED_TOKEN]")
    .replace(/app_usr-[a-z0-9_-]+/gi, "[REDACTED_TOKEN]");

  // 2. Redact embedded emails
  result = result.replace(EMAIL_REGEX, (match) => maskEmail(match));

  // 3. Redact embedded phone numbers
  result = result.replace(PHONE_IN_STRING_REGEX, (match) => {
    // Check if match is surrounded by hex/UUID/date chars
    const digits = match.replace(/\D/g, "");
    if (digits.length >= 8 && digits.length <= 15) {
      return maskPhone(match);
    }
    return match;
  });

  return result;
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
    let sanitizedStr = sanitizeStringText(data);
    if (sanitizedStr.length > maxStringLength) {
      return `${sanitizedStr.slice(0, maxStringLength)}...[TRUNCATED ${sanitizedStr.length - maxStringLength} CHARS]` as unknown as T;
    }
    return sanitizedStr as unknown as T;
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
    const lowerKey = key.toLowerCase();

    // Check sensitive keys (tokens, secrets, passwords)
    const isSensitive = SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
    if (isSensitive) {
      sanitized[key] = "[REDACTED]";
      continue;
    }

    // Check raw payload keys
    if (RAW_PAYLOAD_KEYS.has(lowerKey)) {
      sanitized[key] = "[RAW_PAYLOAD_REDACTED]";
      continue;
    }

    // Check explicit preserved technical IDs
    if (PRESERVED_ID_KEYS.has(lowerKey)) {
      sanitized[key] = value;
      continue;
    }

    // Check emails
    if (/email/i.test(key) && typeof value === "string") {
      sanitized[key] = maskEmail(value);
      continue;
    }

    // Check phone keys (only mask if not a preserved ID key)
    const isPhoneKey = PHONE_KEY_PATTERNS.some((pattern) => pattern.test(key));
    if (isPhoneKey && typeof value === "string" && /\d{6,}/.test(value)) {
      sanitized[key] = maskPhone(value);
      continue;
    }

    sanitized[key] = sanitizeLogData(value, maxDepth - 1, maxStringLength, seen);
  }

  return sanitized as T;
}
