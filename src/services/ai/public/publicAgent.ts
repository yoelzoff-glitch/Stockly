import { defaultProviderRouter } from "../providers/providerRouter";
import { buildPublicSystemPrompt } from "./publicSystemPrompt";
import { logger } from "@/lib/errors/logger";

export interface PublicChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface RunPublicAssistantParams {
  message: string;
  page?: string;
  history?: PublicChatMessage[];
  publicSessionId?: string;
  correlationId?: string;
}

export interface PublicAssistantResult {
  response: string;
  metadata: {
    provider: string;
    model: string;
    durationMs?: number;
    fallbackCount?: number;
  };
}

const MAX_PUBLIC_MESSAGE_LENGTH = 1000;
const MAX_HISTORY_MESSAGES = 10;

/**
 * Orquestador dedicado para el Asistente Público de LibretaX.
 * Estructuralmente desacoplado de tenants, bases de datos privadas y herramientas de negocio.
 * Utiliza Gemini Cascade para máxima disponibilidad sin acceso a infraestructura privada.
 */
export async function runPublicAssistant({
  message,
  page = "/",
  history = [],
  publicSessionId,
  correlationId,
}: RunPublicAssistantParams): Promise<PublicAssistantResult> {
  const startTime = Date.now();

  // 1. Sanitize & enforce max message length
  const trimmedMessage = message.trim().slice(0, MAX_PUBLIC_MESSAGE_LENGTH);

  logger.info({
    event: "PUBLIC_COPILOT_REQUEST_STARTED",
    correlationId,
    page,
    sessionPrefix: publicSessionId ? publicSessionId.slice(0, 8) : undefined,
    messageLength: trimmedMessage.length,
  });

  // 2. Build grounded public system prompt with context
  const systemPrompt = buildPublicSystemPrompt(page);

  // 3. Format limited recent chat history
  const safeHistory = Array.isArray(history)
    ? history
        .slice(-MAX_HISTORY_MESSAGES)
        .filter((m) => m && typeof m.content === "string" && (m.role === "user" || m.role === "assistant"))
        .map((m) => `${m.role === "user" ? "Visitante" : "LibretaX Assistant"}: ${m.content.trim().slice(0, 500)}`)
        .join("\n")
    : "";

  const finalUserPrompt = safeHistory
    ? `Historial de la conversación reciente:\n${safeHistory}\n\nNueva consulta del visitante:\n${trimmedMessage}`
    : trimmedMessage;

  try {
    // 4. Dispatch to Gemini Cascade via ProviderRouter with zero tools
    const result = await defaultProviderRouter.run({
      systemPrompt,
      userMessage: finalUserPrompt,
      tools: [], // Absolute zero business tools
      correlationId,
    });

    const durationMs = Date.now() - startTime;

    logger.info({
      event: "PUBLIC_COPILOT_COMPLETED",
      correlationId,
      provider: result.metadata.provider,
      model: result.metadata.model,
      durationMs,
      fallbackCount: result.metadata.fallbackCount,
    });

    return {
      response: result.response || "LibretaX te ayuda a gestionar ventas, costos y rentabilidad en Mercado Libre.",
      metadata: {
        provider: result.metadata.provider,
        model: result.metadata.model,
        durationMs,
        fallbackCount: result.metadata.fallbackCount,
      },
    };
  } catch (error: any) {
    logger.error({
      event: "PUBLIC_COPILOT_FAILED",
      correlationId,
      error: error?.message || error,
      durationMs: Date.now() - startTime,
    });

    throw error;
  }
}
