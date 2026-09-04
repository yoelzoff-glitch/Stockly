import crypto from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/errors/logger";

export type WebhookProvider = "mercadolibre" | "mercadopago" | "whatsapp";

export type WebhookEventStatus =
  | "received"
  | "queued"
  | "processing"
  | "completed"
  | "retrying"
  | "dead_letter"
  | "ignored";

export interface ClaimWebhookEventParams {
  provider: WebhookProvider;
  eventKey: string;
  tenantId?: string | null;
  topic: string;
  payload: any;
  correlationId?: string;
  eventData?: Record<string, any>;
}

export interface ClaimWebhookEventResult {
  isDuplicate: boolean;
  eventId: string;
  status: WebhookEventStatus;
  attempts: number;
}

/**
 * Computes deterministic SHA-256 hash of payload without exposing PII.
 */
export function hashWebhookPayload(payload: any): string {
  const content = typeof payload === "string" ? payload : JSON.stringify(payload || {});
  return crypto.createHash("sha256").update(content, "utf-8").digest("hex");
}

/**
 * Creates a deterministic, payload-bound idempotency key that binds tenant, user, prompt/payload
 * and an optional custom client key.
 * This guarantees that the same key cannot be reused with a different prompt/payload.
 */
export function createScopedIdempotencyKey(params: {
  prefix?: string;
  tenantId: string;
  userId?: string | null;
  payload: any;
  customKey?: string | null;
}): string {
  const { prefix = "ai_op", tenantId, userId, payload, customKey } = params;
  const content = typeof payload === "string" ? payload.trim().toLowerCase() : JSON.stringify(payload || {});
  const payloadHash = crypto
    .createHash("sha256")
    .update(`${tenantId}:${userId || ""}:${content}`, "utf-8")
    .digest("hex")
    .substring(0, 24);

  if (customKey && customKey.trim().length > 0) {
    return `${prefix}:${customKey.trim()}:${payloadHash}`;
  }
  return `${prefix}:${tenantId}:${payloadHash}`;
}

/**
 * Atomically records and claims a webhook event in the database.
 * If the event already exists and is completed or processing, marks it as duplicate.
 */
export async function claimWebhookEvent(
  params: ClaimWebhookEventParams
): Promise<ClaimWebhookEventResult> {
  const { provider, eventKey, tenantId, topic, payload, correlationId, eventData = {} } = params;
  const payloadHash = hashWebhookPayload(payload);
  const supabase = createAdminClient();

  // Attempt insert
  const { data: inserted, error: insertError } = await supabase
    .from("webhook_events")
    .insert({
      provider,
      event_key: eventKey,
      tenant_id: tenantId || null,
      topic,
      status: "received",
      attempts: 0,
      payload_hash: payloadHash,
      correlation_id: correlationId || null,
      event_data: eventData,
    })
    .select("id, status, attempts")
    .maybeSingle();

  if (!insertError && inserted) {
    return {
      isDuplicate: false,
      eventId: inserted.id,
      status: inserted.status as WebhookEventStatus,
      attempts: inserted.attempts || 0,
    };
  }

  // If duplicate key error (23505), fetch existing record
  const { data: existing } = await supabase
    .from("webhook_events")
    .select("id, status, attempts")
    .eq("provider", provider)
    .eq("event_key", eventKey)
    .maybeSingle();

  if (existing) {
    const isCompletedOrProcessing =
      existing.status === "completed" ||
      existing.status === "processing" ||
      existing.status === "queued" ||
      existing.status === "ignored";

    logger.info({
      event: "WEBHOOK_EVENT_DUPLICATE_DETECTED",
      provider,
      eventKey,
      existingStatus: existing.status,
      correlationId,
    });

    return {
      isDuplicate: isCompletedOrProcessing,
      eventId: existing.id,
      status: existing.status as WebhookEventStatus,
      attempts: existing.attempts || 0,
    };
  }

  // Fallback if unexpected error
  throw new Error(`Failed to claim webhook event: ${insertError?.message || "Unknown error"}`);
}

/**
 * Updates status of a webhook event in webhook_events table.
 */
export async function updateWebhookEventStatus(
  eventId: string,
  status: WebhookEventStatus,
  details?: {
    lastErrorCode?: string;
    lastErrorMessage?: string;
    incrementAttempts?: boolean;
    metadata?: Record<string, any>;
  }
): Promise<void> {
  const supabase = createAdminClient();
  const updatePayload: Record<string, any> = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (status === "completed" || status === "dead_letter") {
    updatePayload.processed_at = new Date().toISOString();
  }

  if (details?.lastErrorCode !== undefined) {
    updatePayload.last_error_code = details.lastErrorCode;
  }
  if (details?.lastErrorMessage !== undefined) {
    updatePayload.last_error_message = details.lastErrorMessage.substring(0, 500);
  }

  if (details?.incrementAttempts) {
    // Read and increment
    const { data: current } = await supabase
      .from("webhook_events")
      .select("attempts, event_data")
      .eq("id", eventId)
      .maybeSingle();

    if (current) {
      updatePayload.attempts = (current.attempts || 0) + 1;
      if (details?.metadata) {
        updatePayload.event_data = {
          ...(current.event_data || {}),
          ...details.metadata,
        };
      }
    }
  }

  await supabase.from("webhook_events").update(updatePayload).eq("id", eventId);
}
