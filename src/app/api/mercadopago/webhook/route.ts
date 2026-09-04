import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { inngest } from "@/inngest/client";
import { logger } from "@/lib/errors/logger";
import { getOrCreateCorrelationId, CORRELATION_ID_HEADER } from "@/lib/observability/correlationId";
import { validateMercadoPagoWebhookSignature } from "@/lib/security/webhookSignatures";
import { getWebhookSignatureConfig } from "@/lib/security/signatureConfig";
import { claimWebhookEvent, updateWebhookEventStatus, hashWebhookPayload } from "@/lib/security/idempotency";
import * as Sentry from "@sentry/nextjs";

const MAX_PAYLOAD_SIZE = 512 * 1024; // 512 KB

const MercadoPagoWebhookSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  live_mode: z.boolean().optional(),
  type: z.string().optional(),
  action: z.string().optional(),
  data: z.object({
    id: z.union([z.string(), z.number()]).optional(),
  }).optional(),
  date_created: z.string().optional(),
  user_id: z.union([z.string(), z.number()]).optional(),
});

export async function POST(req: NextRequest) {
  const correlationId = getOrCreateCorrelationId(req);
  const signatureConfig = getWebhookSignatureConfig();

  try {
    const url = new URL(req.url);

    // 1. Read raw body with size limit
    const rawBody = await req.text();
    if (rawBody.length > MAX_PAYLOAD_SIZE) {
      logger.warn({
        event: "MP_WEBHOOK_PAYLOAD_TOO_LARGE",
        correlationId,
        size: rawBody.length,
      });
      return new NextResponse("Payload Too Large", {
        status: 413,
        headers: { [CORRELATION_ID_HEADER]: correlationId },
      });
    }

    let parsedJson: any = {};
    if (rawBody.trim().length > 0) {
      try {
        parsedJson = JSON.parse(rawBody);
      } catch {
        return new NextResponse("Invalid JSON", {
          status: 400,
          headers: { [CORRELATION_ID_HEADER]: correlationId },
        });
      }
    }

    const queryId = url.searchParams.get("id") || url.searchParams.get("data.id");
    const queryType = url.searchParams.get("type");
    const resourceId = parsedJson.data?.id ? String(parsedJson.data.id) : (queryId ? String(queryId) : undefined);
    const topic = parsedJson.type || parsedJson.action || queryType || "unknown";

    // 2. Cryptographic signature validation
    const signatureHeader = req.headers.get("x-signature");
    const xRequestIdHeader = req.headers.get("x-request-id");
    const mpSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET || process.env.MP_WEBHOOK_SECRET;

    const { isValid, reason } = validateMercadoPagoWebhookSignature({
      rawBody,
      signatureHeader,
      xRequestIdHeader,
      dataId: resourceId,
      secret: mpSecret,
    });

    // Fallback: Check query param secret during transitional observe mode
    const querySecret = url.searchParams.get("secret");
    const isQuerySecretValid = mpSecret && querySecret && querySecret === mpSecret;

    const isVerified = isValid || (signatureConfig.mercadopago === "observe" && isQuerySecretValid);

    if (!isVerified && signatureConfig.mercadopago === "enforce") {
      logger.warn({
        event: "MP_WEBHOOK_SIGNATURE_ENFORCE_REJECTED",
        correlationId,
        reason,
      });
      return new NextResponse("Forbidden", {
        status: 403,
        headers: { [CORRELATION_ID_HEADER]: correlationId },
      });
    } else if (!isVerified && signatureConfig.mercadopago === "observe") {
      logger.info({
        event: "MP_WEBHOOK_SIGNATURE_OBSERVE_UNVERIFIED",
        correlationId,
        reason,
      });
    }

    // 3. Validate schema
    const validation = MercadoPagoWebhookSchema.safeParse(parsedJson);
    if (!validation.success && Object.keys(parsedJson).length > 0) {
      logger.warn({
        event: "MP_WEBHOOK_SCHEMA_INVALID",
        correlationId,
      });
    }

    if (!resourceId) {
      return NextResponse.json(
        { status: "ignored", reason: "missing_resource_id" },
        { status: 200, headers: { [CORRELATION_ID_HEADER]: correlationId } }
      );
    }

    // 4. Atomic Idempotency Claim with Prioritized Notification ID
    let eventKey: string;
    const notificationId = parsedJson.id || parsedJson.notification_id;
    if (notificationId) {
      eventKey = `mp_${notificationId}`;
    } else {
      const action = parsedJson.action || "updated";
      const dateCreated = parsedJson.date_created || "nodate";
      const compositeHash = hashWebhookPayload({ topic, action, resourceId, dateCreated }).slice(0, 16);
      eventKey = `mp_${topic}_${action}_${resourceId}_${compositeHash}`;
    }

    const claim = await claimWebhookEvent({
      provider: "mercadopago",
      eventKey,
      topic,
      payload: parsedJson,
      correlationId,
      eventData: { resourceId, topic },
    });

    if (claim.isDuplicate) {
      logger.info({
        event: "MP_WEBHOOK_DUPLICATE_IGNORED",
        correlationId,
        eventKey,
      });
      return new NextResponse("OK", {
        status: 200,
        headers: { [CORRELATION_ID_HEADER]: correlationId },
      });
    }

    // 5. Asynchronous Inngest Dispatch
    await inngest.send({
      name: "mercadopago/subscription.updated" as any,
      data: {
        resourceId,
        topic,
        eventId: claim.eventId,
        correlationId,
      },
    });

    await updateWebhookEventStatus(claim.eventId, "queued");

    logger.info({
      event: "MP_WEBHOOK_QUEUED",
      correlationId,
      topic,
      eventId: claim.eventId,
    });

    return new NextResponse("OK", {
      status: 200,
      headers: { [CORRELATION_ID_HEADER]: correlationId },
    });
  } catch (error: any) {
    Sentry.captureException(error, { extra: { context: "MERCADOPAGO_WEBHOOK", correlationId } });
    logger.error({
      event: "MP_WEBHOOK_ERROR",
      correlationId,
      error,
      message: error?.message,
    });
    return new NextResponse("Error", {
      status: 500,
      headers: { [CORRELATION_ID_HEADER]: correlationId },
    });
  }
}
