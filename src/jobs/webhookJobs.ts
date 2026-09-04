import { inngest } from "../inngest/client";
import { syncShipments } from "../services/meli/syncShipments";
import { updateWebhookEventStatus } from "@/lib/security/idempotency";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSubscription } from "@/integrations/mercadopago/client";
import { getMediaUrl, downloadMedia, sendText } from "@/integrations/whatsapp/client";
import { transcribeAudio } from "@/services/audio/transcribe";
import { runBusinessAgent } from "@/services/ai/agent";
import { incrementUsage, checkWhatsAppLimit } from "@/services/billing/checkLimits";
import { isWhatsappAgentDisabled } from "@/lib/safety/killSwitches";
import { logger } from "@/lib/errors/logger";

/**
 * Inngest Job: Process Mercado Libre Shipments Webhook
 */
export const meliShipmentsJob = inngest.createFunction(
  {
    id: "meli-shipments-webhook",
    triggers: [{ event: "meli/shipments.updated" as any }],
    retries: 3,
    concurrency: {
      limit: 2,
      key: "event.data.tenantId",
    },
    onFailure: async ({ event, error }: any) => {
      const originalData = event?.data?.event?.data || event?.data;
      const eventId = originalData?.eventId;
      if (eventId) {
        await updateWebhookEventStatus(eventId, "dead_letter", {
          lastErrorCode: error?.name || "MAX_RETRIES_EXCEEDED",
          lastErrorMessage: error?.message || "Exhausted all Inngest retries",
        });
      }
    },
  },
  async ({ event, step }: any) => {
    const { tenantId, resource, eventId } = event?.data || {};
    if (!tenantId) return { message: "No tenantId provided" };

    const shipmentId = resource ? resource.split("/").pop() : undefined;
    if (!shipmentId) return { message: "No shipmentId in resource" };

    if (eventId) {
      await updateWebhookEventStatus(eventId, "processing");
    }

    try {
      const syncedCount = await step.run("sync-shipments-step", async () => {
        return await syncShipments(tenantId, shipmentId);
      });

      if (eventId) {
        await updateWebhookEventStatus(eventId, "completed");
      }

      return { tenantId, shipmentId, syncedCount, status: "completed" };
    } catch (error: any) {
      if (eventId) {
        await updateWebhookEventStatus(eventId, "retrying", {
          lastErrorCode: "SYNC_SHIPMENT_ERROR",
          lastErrorMessage: error?.message,
          incrementAttempts: true,
        });
      }
      throw error;
    }
  }
);

/**
 * Inngest Job: Process Mercado Pago Subscription Webhook
 */
export const mercadopagoWebhookJob = inngest.createFunction(
  {
    id: "mercadopago-webhook-processor",
    triggers: [{ event: "mercadopago/subscription.updated" as any }],
    retries: 3,
    concurrency: {
      limit: 2,
      key: "event.data.tenantId",
    },
    onFailure: async ({ event, error }: any) => {
      const originalData = event?.data?.event?.data || event?.data;
      const eventId = originalData?.eventId;
      if (eventId) {
        await updateWebhookEventStatus(eventId, "dead_letter", {
          lastErrorCode: error?.name || "MAX_RETRIES_EXCEEDED",
          lastErrorMessage: error?.message || "Exhausted all Inngest retries",
        });
      }
    },
  },
  async ({ event, step }: any) => {
    const { resourceId, eventId } = event?.data || {};
    if (!resourceId) return { message: "No resourceId provided" };

    if (eventId) {
      await updateWebhookEventStatus(eventId, "processing");
    }

    try {
      await step.run("process-subscription-update", async () => {
        const subscription = await getSubscription(resourceId);
        const reason = subscription.reason || "";
        const externalReference = subscription.external_reference || "";
        const [refType, ...refIdParts] = externalReference.split("_");
        const refId = refIdParts.join("_");

        const status = subscription.status;
        const plan = reason.toLowerCase().includes("ultra")
          ? "ultra"
          : reason.toLowerCase().includes("pro")
          ? "pro"
          : "starter";

        if (!refType || !refId) return;

        const supabase = createAdminClient();
        let targetPlan = plan;
        let isExpired = false;

        let tenantId = refType === "user" ? null : refId;
        if (refType === "user") {
          const { data: profile } = await supabase
            .from("profiles")
            .select("tenant_id")
            .eq("id", refId)
            .single();
          tenantId = profile?.tenant_id;
        }

        let currentSub = null;
        if (tenantId) {
          const { data } = await supabase
            .from("subscriptions")
            .select("*")
            .eq("tenant_id", tenantId)
            .single();
          currentSub = data;
        }

        if (status === "authorized") {
          targetPlan = plan;
        } else if (status === "cancelled" || status === "canceled") {
          if (currentSub?.expires_at && new Date(currentSub.expires_at) > new Date()) {
            targetPlan = currentSub.plan;
          } else {
            targetPlan = "starter";
            isExpired = true;
          }
        }

        let expiresAt = currentSub?.expires_at || null;
        if (status === "authorized") {
          const expirationDate = new Date();
          expirationDate.setDate(expirationDate.getDate() + 30);
          expiresAt = expirationDate.toISOString();
        } else if (isExpired) {
          expiresAt = null;
        }

        if (refType === "user") {
          await supabase.auth.admin.updateUserById(refId, {
            user_metadata: {
              payment_status: status === "authorized" ? "paid" : "canceled",
              mp_sub_id: subscription.id,
            },
          });

          if (tenantId) {
            await supabase.from("subscriptions").upsert({
              tenant_id: tenantId,
              plan: targetPlan,
              status: status === "authorized" ? "active" : "canceled",
              mercadopago_subscription_id: subscription.id,
              expires_at: expiresAt,
            });

            await supabase
              .from("tenants")
              .update({ plan: targetPlan })
              .eq("id", tenantId);
          }
        } else if (refType === "tenant") {
          await supabase.from("subscriptions").upsert({
            tenant_id: refId,
            plan: targetPlan,
            status: status === "authorized" ? "active" : "canceled",
            mercadopago_subscription_id: subscription.id,
            expires_at: expiresAt,
          });

          await supabase
            .from("tenants")
            .update({ plan: targetPlan })
            .eq("id", refId);
        }
      });

      if (eventId) {
        await updateWebhookEventStatus(eventId, "completed");
      }

      return { status: "completed", resourceId };
    } catch (error: any) {
      if (eventId) {
        await updateWebhookEventStatus(eventId, "retrying", {
          lastErrorCode: "MP_SUBSCRIPTION_UPDATE_ERROR",
          lastErrorMessage: error?.message,
          incrementAttempts: true,
        });
      }
      throw error;
    }
  }
);

/**
 * Inngest Job: Process WhatsApp Inbound Message Webhook
 */
export const whatsappWebhookJob = inngest.createFunction(
  {
    id: "whatsapp-webhook-processor",
    triggers: [{ event: "whatsapp/message.received" as any }],
    retries: 3,
    concurrency: {
      limit: 2,
      key: "event.data.tenantId",
    },
    onFailure: async ({ event, error }: any) => {
      const originalData = event?.data?.event?.data || event?.data;
      const eventId = originalData?.eventId;
      if (eventId) {
        await updateWebhookEventStatus(eventId, "dead_letter", {
          lastErrorCode: error?.name || "MAX_RETRIES_EXCEEDED",
          lastErrorMessage: error?.message || "Exhausted all Inngest retries",
        });
      }
    },
  },
  async ({ event, step }: any) => {
    const {
      tenantId,
      message,
      from,
      displayPhoneNumber,
      phoneNumberId,
      accessToken,
      eventId,
      correlationId,
    } = event?.data || {};

    if (!tenantId || !from) {
      return { message: "Missing required WhatsApp event parameters" };
    }

    if (eventId) {
      await updateWebhookEventStatus(eventId, "processing");
    }

    try {
      await step.run("process-whatsapp-message", async () => {
        const supabase = createAdminClient();

        // 1. Check Usage Limits
        const hasWaLimit = await checkWhatsAppLimit(tenantId);
        if (!hasWaLimit) {
          await supabase.from("alerts").insert({
            tenant_id: tenantId,
            title: "Límite de WhatsApp Alcanzado",
            body: `Mensaje de ${from} ignorado porque has alcanzado el límite de mensajes de WhatsApp de tu plan.`,
            severity: "warning",
            is_read: false,
          });
          return { skipped: "limit_reached" };
        }

        // 2. Extract Message Text or Audio
        let textMessage = "";
        if (message.type === "text") {
          textMessage = message.text?.body || "";
        } else if (message.type === "audio") {
          try {
            const mediaId = message.audio?.id;
            const mediaUrl = await getMediaUrl(mediaId, accessToken);
            const buffer = await downloadMedia(mediaUrl, accessToken);
            textMessage = await transcribeAudio(buffer, `${mediaId}.ogg`);
          } catch (audioErr: any) {
            logger.error({
              event: "WHATSAPP_AUDIO_PROCESS_ERROR",
              tenantId,
              correlationId,
              error: audioErr,
            });
            await sendText(
              from,
              "Lo siento, no pude procesar tu audio. ¿Podrías escribirlo?",
              phoneNumberId,
              accessToken
            );
            await incrementUsage(tenantId, "whatsapp_messages_used");
            return { error: "audio_transcription_failed" };
          }
        } else {
          await sendText(
            from,
            "Klyvo solo entiende texto y audios por el momento.",
            phoneNumberId,
            accessToken
          );
          await incrementUsage(tenantId, "whatsapp_messages_used");
          return { error: "unsupported_message_type" };
        }

        // 3. Save Inbound Message
        await supabase.from("messages").insert({
          tenant_id: tenantId,
          channel: "whatsapp",
          text: message.type === "audio" ? `🎙️ [Audio transcrito]: ${textMessage}` : textMessage,
          direction: "inbound",
          raw_payload: { from, to: displayPhoneNumber },
        });

        // 4. Kill Switch check for Agent Responses
        if (isWhatsappAgentDisabled()) {
          logger.warn({
            event: "WHATSAPP_AGENT_DISABLED",
            tenantId,
            correlationId,
            message: "WhatsApp automated agent responses disabled via kill switch",
          });
          return { agentDisabled: true };
        }

        // 5. Run AI Agent
        const aiResult = await runBusinessAgent({
          tenantId,
          userMessage: textMessage,
          channel: "whatsapp",
          fromPhone: from,
        });

        const responseText = typeof aiResult === "string" ? aiResult : aiResult.response;
        const productId = typeof aiResult === "string" ? null : aiResult.product_id;

        // 6. Save Outbound Message
        await supabase.from("messages").insert({
          tenant_id: tenantId,
          channel: "whatsapp",
          text: responseText,
          direction: "outbound",
          product_id: productId,
          raw_payload: { from: displayPhoneNumber, to: from },
        });

        // 7. Send Response
        let sendTo = from;
        if (sendTo.startsWith("549") && sendTo.length === 13) {
          sendTo = "54" + sendTo.substring(3);
        }

        try {
          await sendText(sendTo, responseText, phoneNumberId, accessToken);
          await incrementUsage(tenantId, "whatsapp_messages_used");
        } catch (sendErr: any) {
          logger.error({
            event: "WHATSAPP_SEND_ERROR",
            tenantId,
            correlationId,
            error: sendErr,
            message: `Error sending WA message to ${sendTo}: ${sendErr.message}`,
          });
          await supabase.from("messages").insert({
            tenant_id: tenantId,
            text: `❌ Error enviando mensaje a WhatsApp: ${sendErr.message}`,
            direction: "outbound",
          });
        }
      });

      if (eventId) {
        await updateWebhookEventStatus(eventId, "completed");
      }

      return { status: "completed", tenantId };
    } catch (error: any) {
      if (eventId) {
        await updateWebhookEventStatus(eventId, "retrying", {
          lastErrorCode: "WHATSAPP_PROCESSING_ERROR",
          lastErrorMessage: error?.message,
          incrementAttempts: true,
        });
      }
      throw error;
    }
  }
);
