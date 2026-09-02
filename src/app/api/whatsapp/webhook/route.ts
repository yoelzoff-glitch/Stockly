import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMediaUrl, downloadMedia, sendText } from "@/integrations/whatsapp/client";
import { transcribeAudio } from "@/services/audio/transcribe";
import { runBusinessAgent } from "@/services/ai/agent";
import { incrementUsage, checkWhatsAppLimit } from "@/services/billing/checkLimits";
import { logger } from "@/lib/errors/logger";
import { captureException } from "@sentry/nextjs";
import { validateWebhookSignature } from "@/integrations/whatsapp/validateWebhookSignature";
import { isWhatsappAgentDisabled } from "@/lib/safety/killSwitches";
import { getOrCreateCorrelationId, CORRELATION_ID_HEADER } from "@/lib/observability/correlationId";
import { startOperationRun, completeOperationRun, failOperationRun } from "@/lib/observability/operationRuns";

// Verify Webhook
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

// Handle Incoming Messages
export async function POST(req: Request) {
  const correlationId = getOrCreateCorrelationId(req);

  try {
    const rawBody = await req.text();
    const signature = req.headers.get("X-Hub-Signature-256");
    const appSecret = process.env.WHATSAPP_APP_SECRET;

    if (appSecret && !validateWebhookSignature(rawBody, signature, appSecret)) {
      logger.warn({
        event: "WHATSAPP_INVALID_SIGNATURE",
        correlationId,
        message: "Invalid webhook signature received",
      });
      return new NextResponse("Forbidden", {
        status: 403,
        headers: { [CORRELATION_ID_HEADER]: correlationId },
      });
    }

    const body = JSON.parse(rawBody);

    if (body.object !== "whatsapp_business_account") {
      return new NextResponse("Not Found", {
        status: 404,
        headers: { [CORRELATION_ID_HEADER]: correlationId },
      });
    }

    // Process all entries in background without blocking webhook acknowledgment
    const processPromise = (async () => {
      for (const entry of body.entry) {
        const changes = entry.changes?.[0];
        if (changes?.field !== "messages") continue;

        const value = changes.value;
        const metadata = value.metadata;
        // This is the number receiving the message
        const displayPhoneNumber = metadata.display_phone_number;
        // Or phone_number_id
        const phoneNumberId = metadata.phone_number_id;

        const messages = value.messages;
        if (!messages || messages.length === 0) continue;

        const message = messages[0];
        const from = message.from; // Sender number

        // 1. Identify Tenant by SENDER'S cell phone number (from) instead of global bot number
        const supabase = createAdminClient();

        let cleanedFrom = from.replace("+", "").trim();
        let alternativeFrom = cleanedFrom;
        if (cleanedFrom.startsWith("549") && cleanedFrom.length === 13) {
          alternativeFrom = "54" + cleanedFrom.substring(3);
        } else if (cleanedFrom.startsWith("54") && !cleanedFrom.startsWith("549") && cleanedFrom.length === 12) {
          alternativeFrom = "549" + cleanedFrom.substring(2);
        }

        const { data: waAccount } = await supabase
          .from("whatsapp_numbers")
          .select("tenant_id, access_token")
          .or(`phone_number.eq."${cleanedFrom}",phone_number.eq."${alternativeFrom}",phone_number.eq."+${cleanedFrom}",phone_number.eq."+${alternativeFrom}"`)
          .maybeSingle();

        let tenantId = waAccount?.tenant_id;
        // Use the global WHATSAPP_TOKEN as primary, falling back to the tenant's access_token
        let accessToken = process.env.WHATSAPP_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN || waAccount?.access_token;

        // Fallback para pruebas locales (solo en modo desarrollo)
        if (!tenantId && process.env.NODE_ENV !== 'production') {
          logger.info({
            event: "WHATSAPP_DEV_FALLBACK",
            correlationId,
            message: "Using fallback tenant for testing...",
          });
          const { data: firstProfile } = await supabase.from("profiles").select("tenant_id").limit(1).single();
          if (firstProfile) {
            tenantId = firstProfile.tenant_id;
            accessToken = process.env.WHATSAPP_ACCESS_TOKEN!;
          }
        }

        if (!tenantId) {
          logger.error({
            event: "WHATSAPP_UNKNOWN_SENDER",
            correlationId,
            from,
            phoneNumberId,
            message: `Unknown sender number: ${from} writing to ${phoneNumberId}`,
          });
          continue;
        }

        const runId = await startOperationRun({
          tenantId,
          operationType: "whatsapp_webhook_message",
          source: "whatsapp_webhook",
          correlationId,
          metadata: { from, displayPhoneNumber, messageType: message.type },
        });

        const hasWaLimit = await checkWhatsAppLimit(tenantId);
        if (!hasWaLimit) {
          await supabase.from("alerts").insert({
            tenant_id: tenantId,
            type: "warning",
            title: "Límite de WhatsApp Alcanzado",
            message: `Mensaje de ${from} ignorado porque has alcanzado el límite de mensajes de WhatsApp de tu plan.`,
            is_read: false
          });
          logger.warn({
            event: "WHATSAPP_LIMIT_REACHED",
            tenantId,
            correlationId,
            message: `WhatsApp limit reached for tenant ${tenantId}. Ignoring message.`,
          });
          await completeOperationRun(runId, {
            itemsProcessed: 0,
            metadata: { limitReached: true },
          });
          continue;
        }

        let textMessage = "";

        // 2. Extract Text or Audio
        if (message.type === "text") {
          textMessage = message.text.body;
        } else if (message.type === "audio") {
          try {
            const mediaId = message.audio.id;
            const mediaUrl = await getMediaUrl(mediaId, accessToken);
            const buffer = await downloadMedia(mediaUrl, accessToken);
            textMessage = await transcribeAudio(buffer, `${mediaId}.ogg`);
          } catch (error: any) {
            logger.error({
              event: "WHATSAPP_AUDIO_PROCESS_ERROR",
              tenantId,
              correlationId,
              error,
              message: error?.message || "Audio processing failed",
            });
            await sendText(from, "Lo siento, no pude procesar tu audio. ¿Podrías escribirlo?", phoneNumberId, accessToken);
            await incrementUsage(tenantId, "whatsapp_messages_used");
            await completeOperationRun(runId, {
              itemsProcessed: 1,
              metadata: { audioError: true },
            });
            continue;
          }
        } else {
          await sendText(from, "Klyvo solo entiende texto y audios por el momento.", phoneNumberId, accessToken);
          await incrementUsage(tenantId, "whatsapp_messages_used");
          await completeOperationRun(runId, {
            itemsProcessed: 1,
            metadata: { unsupportedType: message.type },
          });
          continue;
        }

        // 3. Save Inbound Message
        await supabase.from("messages").insert({
          tenant_id: tenantId,
          channel: "whatsapp",
          text: message.type === "audio" ? `🎙️ [Audio transcrito]: ${textMessage}` : textMessage,
          direction: "inbound",
          raw_payload: { from, to: displayPhoneNumber }
        });

        // Kill switch: Stops the agent before OpenAI and outbound sending, preserving the inbound message
        if (isWhatsappAgentDisabled()) {
          logger.warn({
            event: "WHATSAPP_AGENT_DISABLED",
            tenantId,
            correlationId,
            message: "WhatsApp automated agent responses disabled via kill switch",
          });
          await completeOperationRun(runId, {
            itemsProcessed: 1,
            metadata: { agentDisabled: true },
          });
          continue;
        }

        // 4. Run AI Agent
        const aiResult = await runBusinessAgent({
          tenantId,
          userMessage: textMessage,
          channel: "whatsapp",
          fromPhone: from
        });

        const responseText = typeof aiResult === "string" ? aiResult : aiResult.response;
        const productId = typeof aiResult === "string" ? null : aiResult.product_id;

        // 5. Save Outbound Message
        await supabase.from("messages").insert({
          tenant_id: tenantId,
          channel: "whatsapp",
          text: responseText,
          direction: "outbound",
          product_id: productId,
          raw_payload: { from: displayPhoneNumber, to: from }
        });

        // Fix para Argentina: Si Meta envía '54911...' pero verificó '5411...'
        let sendTo = from;
        if (sendTo.startsWith("549") && sendTo.length === 13) {
          sendTo = "54" + sendTo.substring(3);
        }

        // 6. Send Response
        try {
          await sendText(sendTo, responseText, phoneNumberId, accessToken);
          await incrementUsage(tenantId, "whatsapp_messages_used");
        } catch (error: any) {
          logger.error({
            event: "WHATSAPP_SEND_ERROR",
            tenantId,
            correlationId,
            error,
            message: `Error sending WA message to ${sendTo}: ${error.message}`,
          });
          // Save the error in the database to debug it easily
          await supabase.from("messages").insert({
            tenant_id: tenantId,
            text: `❌ Error enviando mensaje a WhatsApp: ${error.message}`,
            direction: "outbound",
          });
        }

        await completeOperationRun(runId, {
          itemsProcessed: 1,
        });
      }
    })();

    // Fire and monitor in background without blocking immediate HTTP 200 acknowledgment
    processPromise.catch((err) => {
      logger.error({
        event: "WHATSAPP_WEBHOOK_ASYNC_PROCESSING_FAILED",
        correlationId,
        error: err,
        message: err?.message,
      });
    });

    return new NextResponse("OK", {
      status: 200,
      headers: { [CORRELATION_ID_HEADER]: correlationId },
    });
  } catch (error: any) {
    captureException(error, { extra: { context: "WHATSAPP_WEBHOOK", correlationId } });
    logger.error({
      event: "WHATSAPP_WEBHOOK_FATAL_ERROR",
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
