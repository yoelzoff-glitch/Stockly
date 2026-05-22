import { logger } from "@/lib/errors/logger";
import { AppError } from "@/lib/errors/AppError";

const WA_API_VERSION = "v18.0";
const WA_BASE_URL = `https://graph.facebook.com/${WA_API_VERSION}`;

export async function sendText(to: string, text: string, phoneNumberId: string, token: string) {
  try {
    const response = await fetch(`${WA_BASE_URL}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: to,
        type: "text",
        text: {
          preview_url: false,
          body: text,
        },
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new AppError("WHATSAPP_SEND_ERROR", data.error?.message || "Error al enviar mensaje de WhatsApp", 500);
    }
    return data;
  } catch (error) {
    logger.error(error, "WHATSAPP_SEND");
    throw error;
  }
}

export async function getMediaUrl(mediaId: string, token: string) {
  try {
    const response = await fetch(`${WA_BASE_URL}/${mediaId}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
      },
    });

    const data = await response.json();
    if (!response.ok) {
      throw new AppError("WHATSAPP_MEDIA_ERROR", data.error?.message || "Error al obtener media url", 500);
    }
    return data.url;
  } catch (error) {
    logger.error(error, "WHATSAPP_MEDIA_URL");
    throw error;
  }
}

export async function downloadMedia(url: string, token: string): Promise<Buffer> {
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new AppError("WHATSAPP_DOWNLOAD_ERROR", "Error al descargar el archivo multimedia", 500);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    logger.error(error, "WHATSAPP_DOWNLOAD");
    throw error;
  }
}
