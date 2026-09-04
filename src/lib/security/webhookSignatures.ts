import crypto from "node:crypto";

/**
 * Timing-safe string comparison to prevent side-channel timing attacks.
 */
export function timingSafeStringCompare(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") {
    return false;
  }
  const bufA = Buffer.from(a, "utf-8");
  const bufB = Buffer.from(b, "utf-8");

  if (bufA.length !== bufB.length) {
    // Perform a dummy constant-time comparison to avoid short-circuit timing leak
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }

  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Validates WhatsApp Cloud API X-Hub-Signature-256 header.
 * Header format: sha256=<hex-digest>
 */
export function validateWhatsAppWebhookSignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  appSecret: string
): { isValid: boolean; reason?: string } {
  if (!signatureHeader) {
    return { isValid: false, reason: "missing_signature_header" };
  }
  if (!appSecret) {
    return { isValid: false, reason: "missing_app_secret" };
  }

  const parts = signatureHeader.split("=");
  if (parts.length !== 2 || parts[0] !== "sha256") {
    return { isValid: false, reason: "invalid_signature_format" };
  }

  const expectedSignature = parts[1].trim().toLowerCase();
  const calculatedSignature = crypto
    .createHmac("sha256", appSecret)
    .update(rawBody, "utf-8")
    .digest("hex")
    .toLowerCase();

  const matches = timingSafeStringCompare(expectedSignature, calculatedSignature);
  return { isValid: matches, reason: matches ? undefined : "signature_mismatch" };
}

/**
 * Validates Mercado Pago Webhook V2 x-signature header.
 * Official contract:
 * Header: x-signature -> ts=<timestamp>,v1=<hash>
 * Header: x-request-id -> <request_id>
 * Manifest template: id:[data.id_or_id];request-id:[x-request-id];ts:[ts];
 */
export function validateMercadoPagoWebhookSignature(params: {
  rawBody?: string;
  signatureHeader: string | null | undefined;
  xRequestIdHeader: string | null | undefined;
  dataId: string | null | undefined;
  secret: string | null | undefined;
}): { isValid: boolean; reason?: string } {
  const { signatureHeader, xRequestIdHeader, dataId, secret } = params;

  if (!signatureHeader) {
    return { isValid: false, reason: "missing_signature_header" };
  }
  if (!secret) {
    return { isValid: false, reason: "missing_webhook_secret" };
  }
  if (!xRequestIdHeader) {
    return { isValid: false, reason: "missing_request_id_header" };
  }
  if (!dataId) {
    return { isValid: false, reason: "missing_data_id" };
  }

  // Parse key-value pairs from x-signature: ts=...,v1=...
  const signatureParts = signatureHeader.split(",").reduce<Record<string, string>>((acc, part) => {
    const [k, ...v] = part.split("=");
    if (k && v.length > 0) {
      acc[k.trim()] = v.join("=").trim();
    }
    return acc;
  }, {});

  const ts = signatureParts["ts"];
  const v1Hash = signatureParts["v1"]?.toLowerCase();

  if (!ts || !v1Hash) {
    return { isValid: false, reason: "malformed_x_signature_header" };
  }

  // Construct manifest according to Mercado Pago official documentation
  const manifest = `id:${dataId};request-id:${xRequestIdHeader};ts:${ts};`;
  const calculatedHash = crypto
    .createHmac("sha256", secret)
    .update(manifest, "utf-8")
    .digest("hex")
    .toLowerCase();

  const matches = timingSafeStringCompare(v1Hash, calculatedHash);
  return { isValid: matches, reason: matches ? undefined : "signature_mismatch" };
}

/**
 * Mercado Libre Webhook Verification Contract:
 * 
 * Official Documentation: https://developers.mercadolibre.com.ar/es_ar/notificaciones
 * 
 * Technical Contract:
 * Mercado Libre delivers notification callbacks via HTTP POST with JSON body:
 * {
 *   "resource": "/orders/20000000000",
 *   "user_id": 123456789,
 *   "topic": "orders_v2",
 *   "application_id": 987654321,
 *   "attempts": 1,
 *   "sent": "2026-09-04T12:00:00.000Z",
 *   "received": "2026-09-04T12:00:00.050Z"
 * }
 * 
 * Signature Status:
 * Mercado Libre does NOT provide or document a cryptographic webhook HMAC signature header
 * for standard application notification callbacks.
 * 
 * Official Verification Mechanism:
 * To verify authenticity and prevent spoofed notifications:
 * 1. Webhook endpoint parses notification schema, creates idempotent event, and enqueues to Inngest.
 * 2. Background worker fetches official resource directly via `meliFetch(resource, { tenantId })` using tenant's OAuth access token.
 * 3. Worker verifies resource belongs to tenant's user_id before executing any domain updates.
 */
export function validateMercadoLibreWebhookSignature(
  rawBody: string,
  signatureHeader?: string | null,
  secret?: string
): { isValid: boolean; reason?: string; unsupported: boolean } {
  // Signature is not supported by Mercado Libre official API.
  // We do not invent an unofficial HMAC algorithm.
  return {
    isValid: true,
    reason: "unsupported_provider_signature_delegated_to_oauth_verification",
    unsupported: true,
  };
}

