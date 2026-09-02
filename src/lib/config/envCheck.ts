/**
 * Environment configuration audit module.
 * Safely inspects present and missing environment variables without exposing values.
 */

export interface EnvVariableSpec {
  name: string;
  category: "required" | "optional" | "future_sprints";
  description: string;
}

export const ENV_SPECS: EnvVariableSpec[] = [
  // App Core
  { name: "NEXT_PUBLIC_APP_NAME", category: "required", description: "Display name of the application" },
  { name: "NEXT_PUBLIC_APP_URL", category: "required", description: "Base public URL of the application" },

  // Supabase
  { name: "NEXT_PUBLIC_SUPABASE_URL", category: "required", description: "Supabase project API URL" },
  { name: "NEXT_PUBLIC_SUPABASE_ANON_KEY", category: "required", description: "Supabase public anonymous key" },
  { name: "SUPABASE_SERVICE_ROLE_KEY", category: "required", description: "Supabase backend administrative service key" },

  // Healthcheck & Safety (Sprint 1)
  { name: "HEALTHCHECK_TOKEN", category: "required", description: "Secret token to protect /api/health/ready" },
  { name: "KLYVO_DISABLE_MANUAL_SYNCS", category: "optional", description: "Kill switch for manual product/order syncs" },
  { name: "KLYVO_DISABLE_AI_WRITES", category: "optional", description: "Kill switch for AI write actions" },
  { name: "KLYVO_DISABLE_MELI_WRITES", category: "optional", description: "Kill switch for Mercado Libre price/stock writes" },
  { name: "KLYVO_DISABLE_WHATSAPP_AGENT", category: "optional", description: "Kill switch for WhatsApp auto-responder" },

  // Mercado Libre
  { name: "MELI_CLIENT_ID", category: "required", description: "Mercado Libre App ID" },
  { name: "MELI_CLIENT_SECRET", category: "required", description: "Mercado Libre Client Secret" },
  { name: "MELI_REDIRECT_URI", category: "required", description: "Mercado Libre OAuth Redirect URI" },

  // Mercado Pago
  { name: "MERCADOPAGO_ACCESS_TOKEN", category: "optional", description: "Mercado Pago Production Access Token" },
  { name: "MERCADOPAGO_WEBHOOK_SECRET", category: "optional", description: "Mercado Pago Webhook validation secret" },

  // WhatsApp Cloud API
  { name: "WHATSAPP_PHONE_NUMBER_ID", category: "optional", description: "Meta WhatsApp Business Phone Number ID" },
  { name: "WHATSAPP_ACCESS_TOKEN", category: "optional", description: "Meta WhatsApp Permanent Access Token" },
  { name: "WHATSAPP_VERIFY_TOKEN", category: "optional", description: "Meta Webhook Verification Token" },
  { name: "WHATSAPP_APP_SECRET", category: "optional", description: "Meta App Secret for HMAC validation" },

  // AI & LLM
  { name: "OPENAI_API_KEY", category: "required", description: "OpenAI API Key for business agent and audio" },
  { name: "GEMINI_API_KEY", category: "optional", description: "Google Gemini API Key for competitor analysis" },
  { name: "AI_MODEL", category: "optional", description: "Default AI model identifier" },

  // Sentry Observability
  { name: "NEXT_PUBLIC_SENTRY_DSN", category: "optional", description: "Sentry DSN for error monitoring" },

  // Inngest
  { name: "INNGEST_EVENT_KEY", category: "optional", description: "Inngest Event Key for publishing" },
  { name: "INNGEST_SIGNING_KEY", category: "optional", description: "Inngest Signing Key for webhook verification" },

  // Storage & Internal
  { name: "DEFAULT_CURRENCY", category: "optional", description: "Base currency (ARS)" },
  { name: "DEFAULT_TIMEZONE", category: "optional", description: "Default timezone (America/Argentina/Buenos_Aires)" },
];

export interface EnvAuditResult {
  variable: string;
  category: "required" | "optional" | "future_sprints";
  status: "configured" | "missing";
  description: string;
}

/**
 * Runs a non-leaking diagnostic of environment variables.
 */
export function auditEnvironment(strict = false): {
  results: EnvAuditResult[];
  allRequiredConfigured: boolean;
  summary: { total: number; configured: number; missingRequired: number; missingOptional: number };
} {
  const results: EnvAuditResult[] = [];
  let missingRequired = 0;
  let missingOptional = 0;
  let configured = 0;

  for (const spec of ENV_SPECS) {
    const val = process.env[spec.name];
    const isConfigured = typeof val === "string" && val.trim().length > 0;

    if (isConfigured) {
      configured++;
      results.push({
        variable: spec.name,
        category: spec.category,
        status: "configured",
        description: spec.description,
      });
    } else {
      if (spec.category === "required") {
        missingRequired++;
      } else {
        missingOptional++;
      }
      results.push({
        variable: spec.name,
        category: spec.category,
        status: "missing",
        description: spec.description,
      });
    }
  }

  const allRequiredConfigured = missingRequired === 0;

  return {
    results,
    allRequiredConfigured,
    summary: {
      total: ENV_SPECS.length,
      configured,
      missingRequired,
      missingOptional,
    },
  };
}
