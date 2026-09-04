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
 * Validates Mercado Libre Webhook signature if x-signature header is provided.
 */
export function validateMercadoLibreWebhookSignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  secret?: string
): { isValid: boolean; reason?: string } {
  if (!secret) {
    // If no secret configured, signature verification is not enabled on app
    return { isValid: true, reason: "signature_not_configured" };
  }
  if (!signatureHeader) {
    return { isValid: false, reason: "missing_signature_header" };
  }

  // Handle standard sha256 hex or prefix
  const cleanSignature = signatureHeader.replace(/^sha256=/i, "").trim().toLowerCase();
  const calculatedSignature = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf-8")
    .digest("hex")
    .toLowerCase();

  const matches = timingSafeStringCompare(cleanSignature, calculatedSignature);
  return { isValid: matches, reason: matches ? undefined : "signature_mismatch" };
}
