import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { inngest } from "@/inngest/client";
import { logger } from "@/lib/errors/logger";
import { syncOrders } from "@/services/meli/syncOrders";
import { syncProducts } from "@/services/meli/syncProducts";
import { syncShipments } from "@/services/meli/syncShipments";
import { getOrCreateCorrelationId, CORRELATION_ID_HEADER } from "@/lib/observability/correlationId";

import * as Sentry from "@sentry/nextjs";

export async function POST(req: NextRequest) {
  const correlationId = getOrCreateCorrelationId(req);

  try {
    // Basic origin/header validation
    const userAgent = req.headers.get("user-agent") || "";
    const signature = req.headers.get("x-signature") || req.headers.get("x-meli-signature");

    logger.info({
      event: "MELI_WEBHOOK_RECEIVED",
      correlationId,
      source: "mercadolibre",
      userAgent,
      hasSignature: !!signature,
    });

    const payload = await req.json();

    // Estructura payload
    if (typeof payload !== "object" || payload === null) {
      return new NextResponse("Invalid Payload", {
        status: 400,
        headers: { [CORRELATION_ID_HEADER]: correlationId },
      });
    }

    const topic = payload.topic || payload.type;
    const resource = payload.resource;
    const userId = payload.user_id;

    if (!topic || !resource || !userId) {
      return NextResponse.json(
        { status: "ignored", reason: "missing_fields" },
        { status: 200, headers: { [CORRELATION_ID_HEADER]: correlationId } }
      );
    }

    const supabase = createAdminClient();

    // Find the tenant for this user_id
    const { data: account } = await supabase
      .from("meli_accounts")
      .select("tenant_id")
      .eq("meli_user_id", userId.toString())
      .single();

    if (!account) {
      return NextResponse.json(
        { status: "ignored", reason: "unknown_user" },
        { status: 200, headers: { [CORRELATION_ID_HEADER]: correlationId } }
      );
    }

    const tenantId = account.tenant_id;

    // Depending on the topic, we dispatch an inngest event or handle it directly
    switch (topic) {
      case "orders_v2":
      case "orders":
        const specificOrderId = resource ? resource.split("/").pop() : undefined;
        
        // Sincronizar la orden directamente de forma asíncrona en el fondo
        if (specificOrderId) {
          syncOrders(tenantId, specificOrderId).catch(err => {
            logger.error({
              event: "MELI_WEBHOOK_SYNC_ORDERS_ASYNC_FAILED",
              tenantId,
              correlationId,
              orderId: specificOrderId,
              error: err,
            });
          });
        }

        try {
          await inngest.send({
            name: "meli/orders.updated",
            data: { tenantId, resource, correlationId }
          });
        } catch (e: any) {
          logger.warn({
            event: "MELI_WEBHOOK_INNGEST_SEND_FAILED",
            tenantId,
            correlationId,
            message: e?.message,
          });
        }
        break;

      case "items":
        // Sync products directly in the background
        syncProducts(tenantId).catch(err => {
          logger.error({
            event: "MELI_WEBHOOK_SYNC_PRODUCTS_ASYNC_FAILED",
            tenantId,
            correlationId,
            error: err,
          });
        });

        try {
          await inngest.send({
            name: "meli/items.updated",
            data: { tenantId, resource, correlationId }
          });
        } catch (e: any) {
          logger.warn({
            event: "MELI_WEBHOOK_INNGEST_SEND_FAILED",
            tenantId,
            correlationId,
            message: e?.message,
          });
        }
        break;

      case "questions":
        try {
          await inngest.send({
            name: "meli/questions.received",
            data: { tenantId, resource, correlationId }
          });
        } catch (e: any) {
          logger.warn({
            event: "MELI_WEBHOOK_INNGEST_SEND_FAILED",
            tenantId,
            correlationId,
            message: e?.message,
          });
        }
        break;

      case "shipments":
        const specificShipmentId = resource ? resource.split("/").pop() : undefined;
        if (specificShipmentId) {
          syncShipments(tenantId, specificShipmentId).catch(err => {
            logger.error({
              event: "MELI_WEBHOOK_SYNC_SHIPMENTS_ASYNC_FAILED",
              tenantId,
              correlationId,
              shipmentId: specificShipmentId,
              error: err,
            });
          });
        }
        break;

      default:
        logger.info({
          event: "MELI_WEBHOOK_UNHANDLED_TOPIC",
          tenantId,
          correlationId,
          topic,
        });
    }

    // Save in audit logs (as requested previously, kept to not break logic)
    await supabase.from("ai_actions").insert({
      tenant_id: tenantId,
      action_type: `webhook_${topic}`,
      title: `Webhook recibido: ${topic}`,
      description: `Notificación para el recurso ${resource}`,
      status: "executed",
      payload: payload,
      executed_at: new Date().toISOString()
    });

    return NextResponse.json(
      { status: "received" },
      { status: 200, headers: { [CORRELATION_ID_HEADER]: correlationId } }
    );
  } catch (error: any) {
    Sentry.captureException(error, { extra: { context: "MELI_WEBHOOK", correlationId } });
    logger.error({
      event: "MELI_WEBHOOK_PROCESSING_FAILED",
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
