import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { inngest } from "@/inngest/client";
import { logger } from "@/lib/errors/logger";
import { getOrCreateCorrelationId, CORRELATION_ID_HEADER } from "@/lib/observability/correlationId";
import { validateMercadoLibreWebhookSignature } from "@/lib/security/webhookSignatures";
import { getWebhookSignatureConfig } from "@/lib/security/signatureConfig";
import { claimWebhookEvent, updateWebhookEventStatus } from "@/lib/security/idempotency";
import * as Sentry from "@sentry/nextjs";

const MAX_PAYLOAD_SIZE = 512 * 1024; // 512 KB

const MeliWebhookSchema = z.object({
  _id: z.string().optional(),
  topic: z.string().optional(),
  type: z.string().optional(),
  resource: z.string().min(1),
  user_id: z.union([z.string(), z.number()]),
  application_id: z.union([z.string(), z.number()]).optional(),
  attempts: z.number().optional(),
  sent: z.string().optional(),
  received: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const correlationId = getOrCreateCorrelationId(req);
  const signatureConfig = getWebhookSignatureConfig();

  try {
    // 1. Read raw body with size limit
    const rawBody = await req.text();
    if (rawBody.length > MAX_PAYLOAD_SIZE) {
      logger.warn({
        event: "MELI_WEBHOOK_PAYLOAD_TOO_LARGE",
        correlationId,
        size: rawBody.length,
      });
      return new NextResponse("Payload Too Large", {
        status: 413,
        headers: { [CORRELATION_ID_HEADER]: correlationId },
      });
    }

    // 2. Signature verification
    const signature = req.headers.get("x-signature") || req.headers.get("x-meli-signature");
    const secret = process.env.MELI_WEBHOOK_SECRET;
    const { isValid, reason } = validateMercadoLibreWebhookSignature(rawBody, signature, secret);

    if (!isValid && signatureConfig.meli === "enforce") {
      logger.warn({
        event: "MELI_WEBHOOK_SIGNATURE_ENFORCE_REJECTED",
        correlationId,
        reason,
      });
      return new NextResponse("Forbidden", {
        status: 403,
        headers: { [CORRELATION_ID_HEADER]: correlationId },
      });
    } else if (!isValid && signatureConfig.meli === "observe") {
      logger.info({
        event: "MELI_WEBHOOK_SIGNATURE_OBSERVE_UNVERIFIED",
        correlationId,
        reason,
      });
    }

    // 3. Parse JSON & Validate Schema with Zod
    let parsedJson: any;
    try {
      parsedJson = JSON.parse(rawBody);
    } catch {
      return new NextResponse("Invalid JSON", {
        status: 400,
        headers: { [CORRELATION_ID_HEADER]: correlationId },
      });
    }

    const validation = MeliWebhookSchema.safeParse(parsedJson);
    if (!validation.success) {
      logger.warn({
        event: "MELI_WEBHOOK_SCHEMA_INVALID",
        correlationId,
        errors: validation.error.format(),
      });
      return NextResponse.json(
        { status: "ignored", reason: "invalid_schema" },
        { status: 200, headers: { [CORRELATION_ID_HEADER]: correlationId } }
      );
    }

    const payload = validation.data;
    const topic = payload.topic || payload.type || "unknown";
    const resource = payload.resource;
    const userId = payload.user_id.toString();

    // 4. Resolve Tenant
    const supabase = createAdminClient();
    const { data: account } = await supabase
      .from("meli_accounts")
      .select("tenant_id")
      .eq("meli_user_id", userId)
      .maybeSingle();

    if (!account?.tenant_id) {
      logger.info({
        event: "MELI_WEBHOOK_UNKNOWN_USER",
        correlationId,
        userId,
      });
      return NextResponse.json(
        { status: "ignored", reason: "unknown_user" },
        { status: 200, headers: { [CORRELATION_ID_HEADER]: correlationId } }
      );
    }

    const tenantId = account.tenant_id;

    // 5. Atomic Idempotency Claim
    const eventKey = `meli_${topic}_${resource.replace(/\//g, "_")}_${payload.received || payload.sent || Date.now()}`;
    const claim = await claimWebhookEvent({
      provider: "mercadolibre",
      eventKey,
      tenantId,
      topic,
      payload: parsedJson,
      correlationId,
      eventData: { resource, userId },
    });

    if (claim.isDuplicate) {
      logger.info({
        event: "MELI_WEBHOOK_DUPLICATE_IGNORED",
        correlationId,
        tenantId,
        eventKey,
      });
      return NextResponse.json(
        { status: "duplicate_ignored", eventId: claim.eventId },
        { status: 200, headers: { [CORRELATION_ID_HEADER]: correlationId } }
      );
    }

    // 6. Asynchronous Dispatch to Inngest
    let inngestEventName: string | null = null;
    switch (topic) {
      case "orders_v2":
      case "orders":
        inngestEventName = "meli/orders.updated";
        break;
      case "items":
        inngestEventName = "meli/items.updated";
        break;
      case "questions":
        inngestEventName = "meli/questions.received";
        break;
      case "shipments":
        inngestEventName = "meli/shipments.updated";
        break;
      default:
        inngestEventName = null;
    }

    if (inngestEventName) {
      await inngest.send({
        name: inngestEventName as any,
        data: {
          tenantId,
          resource,
          eventId: claim.eventId,
          correlationId,
        },
      });
      await updateWebhookEventStatus(claim.eventId, "queued");
    } else {
      await updateWebhookEventStatus(claim.eventId, "ignored", {
        lastErrorCode: "UNHANDLED_TOPIC",
      });
    }

    // 7. Fast HTTP 200 Acknowledgment
    return NextResponse.json(
      { status: "received", eventId: claim.eventId },
      { status: 200, headers: { [CORRELATION_ID_HEADER]: correlationId } }
    );
  } catch (error: any) {
    Sentry.captureException(error, { extra: { context: "MELI_WEBHOOK", correlationId } });
    logger.error({
      event: "MELI_WEBHOOK_ERROR",
      correlationId,
      error,
      message: error?.message,
    });
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500, headers: { [CORRELATION_ID_HEADER]: correlationId } }
    );
  }
}
