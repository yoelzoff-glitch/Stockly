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
        message: "Invalid WhatsApp webhook signature received",
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

    // Process all entries
    for (const entry of body.entry) {
      const changes = entry.changes?.[0];
      if (changes?.field !== "messages") continue;

      const value = changes.value;
      const metadata = value.metadata;
      const displayPhoneNumber = metadata.display_phone_number;
      const phoneNumberId = metadata.phone_number_id;

      const messages = value.messages;
      if (!messages || messages.length === 0) continue;

      const message = messages[0];
      const from = message.from; // Sender number

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
        .select("tenant_id, access_token, status")
        .or(`phone_number.eq.${cleanedFrom},phone_number.eq.+${cleanedFrom},phone_number.eq.${alternativeFrom},phone_number.eq.+${alternativeFrom}`)
        .maybeSingle();

      let tenantId = waAccount?.tenant_id;
      let accessToken = process.env.WHATSAPP_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN || waAccount?.access_token;

      if (!tenantId && process.env.NODE_ENV !== 'production') {
        const { data: firstTenant } = await supabase.from("tenants").select("id").limit(1).single();
        if (firstTenant) {
          tenantId = firstTenant.id;
          accessToken = process.env.WHATSAPP_ACCESS_TOKEN!;
        }
      }

      if (!tenantId) {
        logger.warn({
          event: "WHATSAPP_UNRECOGNIZED_SENDER",
          correlationId,
          from,
          message: "Sender phone not linked to any active tenant",
        });
        continue;
      }

      // Check subscription limits
      const isAllowed = await checkWhatsAppLimit(tenantId);
      if (!isAllowed) {
        logger.warn({
          event: "WHATSAPP_LIMIT_REACHED",
          tenantId,
          correlationId,
          from,
          message: "Monthly WhatsApp message limit reached",
        });
        await sendText(
          from,
          "⚠️ Has alcanzado el límite mensual de mensajes de WhatsApp de tu plan. Por favor, actualiza tu suscripción en el panel.",
          phoneNumberId,
          accessToken
        );
        continue;
      }

      let textMessage = "";

      if (message.type === "text") {
        textMessage = message.text.body;
      } else if (message.type === "audio") {
        const audioId = message.audio.id;
        const mediaUrl = await getMediaUrl(audioId, accessToken);
        if (mediaUrl) {
          const audioBuffer = await downloadMedia(mediaUrl, accessToken);
          textMessage = await transcribeAudio(audioBuffer, message.audio.mime_type || "audio/ogg");
        }
      } else {
        await sendText(from, "Klyvo solo entiende texto y audios por el momento.", phoneNumberId, accessToken);
        await incrementUsage(tenantId, "whatsapp_messages_used");
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

      // Check kill switch
      if (isWhatsappAgentDisabled()) {
        logger.warn({
          event: "WHATSAPP_AGENT_DISABLED",
          tenantId,
          correlationId,
          message: "WhatsApp automated responses disabled via kill switch",
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
          message: error?.message,
        });
        await supabase.from("messages").insert({
          tenant_id: tenantId,
          text: `❌ Error enviando mensaje a WhatsApp: ${error?.message}`,
          direction: "outbound",
        });
      }
    }

    return new NextResponse("OK", {
      status: 200,
      headers: { [CORRELATION_ID_HEADER]: correlationId },
    });
  } catch (error: any) {
    captureException(error, { extra: { context: "WHATSAPP_WEBHOOK", correlationId } });
    logger.error({
      event: "WHATSAPP_WEBHOOK_PROCESSING_FAILED",
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
