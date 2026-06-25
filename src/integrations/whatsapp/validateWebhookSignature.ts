import crypto from "crypto";

/**
 * Validates the X-Hub-Signature-256 header sent by Meta to verify that
 * the webhook request indeed comes from WhatsApp / Meta.
 * 
 * @param rawBody The raw text body of the incoming request.
 * @param signature The X-Hub-Signature-256 header value.
 * @param appSecret The Meta App Secret key.
 * @returns boolean indicating if the signature is valid.
 */
export function validateWebhookSignature(
  rawBody: string,
  signature: string | null,
  appSecret: string
): boolean {
  if (!signature) return false;
  
  const expectedSignature = crypto
    .createHmac("sha256", appSecret)
    .update(rawBody)
    .digest("hex");
    
  return signature === `sha256=${expectedSignature}`;
}
