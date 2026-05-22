import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMediaUrl, downloadMedia, sendText } from "@/integrations/whatsapp/client";
import { transcribeAudio } from "@/services/audio/transcribe";
import { runBusinessAgent } from "@/services/ai/agent";
import { logger } from "@/lib/errors/logger";

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
  try {
    const body = await req.json();

    if (body.object !== "whatsapp_business_account") {
      return new NextResponse("Not Found", { status: 404 });
    }

    // Process all entries
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

      // 1. Identify Tenant
      const supabase = createAdminClient();
      const { data: waAccount } = await supabase
        .from("whatsapp_numbers")
        .select("tenant_id, access_token")
        .eq("phone_number_id", phoneNumberId)
        .single();

      if (!waAccount?.tenant_id) {
        logger.error(`Unknown WhatsApp number: ${phoneNumberId}`, "WHATSAPP_WEBHOOK");
        continue;
      }

      const tenantId = waAccount.tenant_id;
      // Use DB token or fallback to ENV if it's the global one for testing
      const accessToken = waAccount.access_token || process.env.WHATSAPP_ACCESS_TOKEN!;

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
        } catch (error) {
          logger.error(error, "WHATSAPP_AUDIO_PROCESS");
          await sendText(from, "Lo siento, no pude procesar tu audio. ¿Podrías escribirlo?", phoneNumberId, accessToken);
          continue;
        }
      } else {
        await sendText(from, "Stockly solo entiende texto y audios por el momento.", phoneNumberId, accessToken);
        continue;
      }

      // 3. Save Inbound Message
      await supabase.from("messages").insert({
        tenant_id: tenantId,
        text: message.type === "audio" ? `🎙️ [Audio transcrito]: ${textMessage}` : textMessage,
        direction: "inbound",
      });

      // 4. Run AI Agent
      const responseText = await runBusinessAgent({
        tenantId, 
        userMessage: textMessage
      });

      // 5. Save Outbound Message
      await supabase.from("messages").insert({
        tenant_id: tenantId,
        text: responseText,
        direction: "outbound",
      });

      // 6. Send Response
      await sendText(from, responseText, phoneNumberId, accessToken);
    }

    return new NextResponse("OK", { status: 200 });
  } catch (error) {
    logger.error(error, "WHATSAPP_WEBHOOK");
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
