import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { inngest } from "@/inngest/client";
import { logger } from "@/lib/errors/logger";
import { getOrCreateCorrelationId, CORRELATION_ID_HEADER } from "@/lib/observability/correlationId";
import { validateWhatsAppWebhookSignature } from "@/lib/security/webhookSignatures";
import { getWebhookSignatureConfig } from "@/lib/security/signatureConfig";
import { claimWebhookEvent, updateWebhookEventStatus } from "@/lib/security/idempotency";
import * as Sentry from "@sentry/nextjs";

const MAX_PAYLOAD_SIZE = 512 * 1024; // 512 KB

const WhatsAppWebhookSchema = z.object({
  object: z.string(),
  entry: z.array(
    z.object({
      id: z.string().optional(),
      changes: z.array(
        z.object({
          field: z.string(),
          value: z.object({
            messaging_product: z.string().optional(),
            metadata: z.object({
              display_phone_number: z.string().optional(),
              phone_number_id: z.string().optional(),
            }).optional(),
            contacts: z.array(z.any()).optional(),
            messages: z.array(
              z.object({
                id: z.string(),
                from: z.string(),
                timestamp: z.string().optional(),
                type: z.string(),
                text: z.object({ body: z.string() }).optional(),
                audio: z.object({ id: z.string() }).optional(),
              })
            ).optional(),
            statuses: z.array(z.any()).optional(),
          }),
        })
      ),
    })
  ),
});

// Meta Webhook Verification Endpoint
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;

  if (mode && token) {
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      return new NextResponse(challenge, { status: 200 });
    }
    return new NextResponse("Forbidden", { status: 403 });
  }
  return new NextResponse("Bad Request", { status: 400 });
}

// Handle Incoming WhatsApp Messages
export async function POST(req: NextRequest) {
  const correlationId = getOrCreateCorrelationId(req);
  const signatureConfig = getWebhookSignatureConfig();

  try {
    // 1. Read raw body with size limit
    const rawBody = await req.text();
    if (rawBody.length > MAX_PAYLOAD_SIZE) {
      logger.warn({
        event: "WHATSAPP_WEBHOOK_PAYLOAD_TOO_LARGE",
        correlationId,
        size: rawBody.length,
      });
      return new NextResponse("Payload Too Large", {
        status: 413,
        headers: { [CORRELATION_ID_HEADER]: correlationId },
      });
    }

    // 2. Validate X-Hub-Signature-256 before JSON parsing
    const signature = req.headers.get("X-Hub-Signature-256");
    const appSecret = process.env.WHATSAPP_APP_SECRET || "";
    const { isValid, reason } = validateWhatsAppWebhookSignature(rawBody, signature, appSecret);

    if (!isValid && signatureConfig.whatsapp === "enforce") {
      logger.warn({
        event: "WHATSAPP_SIGNATURE_ENFORCE_REJECTED",
        correlationId,
        reason,
      });
      return new NextResponse("Forbidden", {
        status: 403,
        headers: { [CORRELATION_ID_HEADER]: correlationId },
      });
    } else if (!isValid && signatureConfig.whatsapp === "observe") {
      logger.info({
        event: "WHATSAPP_SIGNATURE_OBSERVE_UNVERIFIED",
        correlationId,
        reason,
      });
    }

    // 3. Parse JSON & Validate Schema
    let parsedJson: any;
    try {
      parsedJson = JSON.parse(rawBody);
    } catch {
      return new NextResponse("Invalid JSON", {
        status: 400,
        headers: { [CORRELATION_ID_HEADER]: correlationId },
      });
    }

    const validation = WhatsAppWebhookSchema.safeParse(parsedJson);
    if (!validation.success) {
      logger.warn({
        event: "WHATSAPP_SCHEMA_INVALID",
        correlationId,
        errors: validation.error.format(),
      });
      return new NextResponse("OK", {
        status: 200,
        headers: { [CORRELATION_ID_HEADER]: correlationId },
      });
    }

    if (parsedJson.object !== "whatsapp_business_account") {
      return new NextResponse("Not Found", {
        status: 404,
        headers: { [CORRELATION_ID_HEADER]: correlationId },
      });
    }

    const supabase = createAdminClient();

    // 4. Process entries and dispatch to Inngest
    for (const entry of parsedJson.entry) {
      for (const change of entry.changes || []) {
        if (change.field !== "messages") continue;

        const value = change.value;
        const metadata = value.metadata || {};
        const displayPhoneNumber = metadata.display_phone_number;
        const phoneNumberId = metadata.phone_number_id;

        const messages = value.messages || [];
        if (messages.length === 0) continue;

        const message = messages[0];
        const from = message.from;

        // 5. Secure Tenant Resolution by Receiving Business Number (phone_number_id / displayPhoneNumber)
        // NOT by the untrusted sender number
        let tenantId: string | null = null;
        let accessToken = process.env.WHATSAPP_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN;

        if (phoneNumberId) {
          const { data: waAccount } = await supabase
            .from("whatsapp_numbers")
            .select("tenant_id, access_token")
            .eq("provider_phone_id", phoneNumberId)
            .maybeSingle();

          if (waAccount) {
            tenantId = waAccount.tenant_id;
            accessToken = waAccount.access_token || accessToken;
          }
        }

        if (!tenantId && displayPhoneNumber) {
          const cleanDisplay = displayPhoneNumber.replace(/[^0-9]/g, "");
          const { data: waAccount } = await supabase
            .from("whatsapp_numbers")
            .select("tenant_id, access_token")
            .eq("phone_number", cleanDisplay)
            .maybeSingle();

          if (waAccount) {
            tenantId = waAccount.tenant_id;
            accessToken = waAccount.access_token || accessToken;
          }
        }

        // Fallback for development/testing environments only
        if (!tenantId && process.env.NODE_ENV !== "production") {
          const { data: firstProfile } = await supabase
            .from("profiles")
            .select("tenant_id")
            .limit(1)
            .maybeSingle();
          if (firstProfile) {
            tenantId = firstProfile.tenant_id;
          }
        }

        if (!tenantId) {
          logger.warn({
            event: "WHATSAPP_UNKNOWN_RECIPIENT",
            correlationId,
            phoneNumberId,
            displayPhoneNumber,
          });
          continue;
        }

        // 6. Atomic Idempotency Claim per Message
        const eventKey = `wa_${message.id}`;
        const claim = await claimWebhookEvent({
          provider: "whatsapp",
          eventKey,
          tenantId,
          topic: "message",
          payload: message,
          correlationId,
          eventData: { messageId: message.id, from, phoneNumberId },
        });

        if (claim.isDuplicate) {
          logger.info({
            event: "WHATSAPP_MESSAGE_DUPLICATE_IGNORED",
            correlationId,
            tenantId,
            eventKey,
          });
          continue;
        }

        // 7. Enqueue Inngest Job
        await inngest.send({
          name: "whatsapp/message.received" as any,
          data: {
            tenantId,
            message,
            from,
            displayPhoneNumber,
            phoneNumberId,
            accessToken,
            eventId: claim.eventId,
            correlationId,
          },
        });

        await updateWebhookEventStatus(claim.eventId, "queued");
      }
    }

    return new NextResponse("OK", {
      status: 200,
      headers: { [CORRELATION_ID_HEADER]: correlationId },
    });
  } catch (error: any) {
    Sentry.captureException(error, { extra: { context: "WHATSAPP_WEBHOOK", correlationId } });
    logger.error({
      event: "WHATSAPP_WEBHOOK_ERROR",
      correlationId,
      error,
      message: error?.message,
    });
    return new NextResponse("Internal Server Error", {
      status: 500,
      headers: { [CORRELATION_ID_HEADER]: correlationId },
    });
  }
}
