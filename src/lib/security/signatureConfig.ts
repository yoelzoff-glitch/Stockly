export type WebhookSignatureMode = "observe" | "enforce";

export interface WebhookSignatureConfig {
  meli: WebhookSignatureMode;
  mercadopago: WebhookSignatureMode;
  whatsapp: WebhookSignatureMode;
}

function parseSignatureMode(envValue?: string): WebhookSignatureMode {
  const normalized = envValue?.trim().toLowerCase();
  if (normalized === "enforce") {
    return "enforce";
  }
  return "observe";
}

export function getWebhookSignatureConfig(): WebhookSignatureConfig {
  return {
    meli: parseSignatureMode(process.env.MELI_WEBHOOK_SIGNATURE_MODE),
    mercadopago: parseSignatureMode(process.env.MP_WEBHOOK_SIGNATURE_MODE),
    whatsapp: parseSignatureMode(process.env.WHATSAPP_WEBHOOK_SIGNATURE_MODE),
  };
}
