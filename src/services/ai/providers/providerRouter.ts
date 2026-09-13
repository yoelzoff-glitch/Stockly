import { AIProvider, AIProviderInput, AgentResult } from "./types";
import { GeminiCascadeProvider } from "./geminiCascade";
import { OpenAIProvider } from "./openai";
import { logger } from "@/lib/errors/logger";

export interface ProviderRouterConfig {
  cascadeProvider?: AIProvider;
  openaiProvider?: AIProvider;
}

export class ProviderRouter {
  private cascadeProvider: AIProvider;
  private openaiProvider: AIProvider;

  constructor(config: ProviderRouterConfig = {}) {
    this.cascadeProvider = config.cascadeProvider || new GeminiCascadeProvider();
    this.openaiProvider = config.openaiProvider || new OpenAIProvider();
  }

  async run(input: AIProviderInput): Promise<AgentResult> {
    const isFallbackEnabled = process.env.AI_PROVIDER_FALLBACK_ENABLED === "true";

    try {
      return await this.cascadeProvider.runAgent(input);
    } catch (cascadeError: any) {
      if (isFallbackEnabled && process.env.OPENAI_API_KEY) {
        logger.warn({
          event: "AI_PROVIDER_CROSS_FALLBACK_TO_OPENAI",
          tenantId: input.tenantId,
          correlationId: input.correlationId,
          error: cascadeError?.message,
        });

        try {
          const res = await this.openaiProvider.runAgent(input);
          return {
            ...res,
            metadata: {
              ...res.metadata,
              fallbackCount: (res.metadata.fallbackCount || 0) + 1,
            },
          };
        } catch (openaiError: any) {
          logger.error({
            event: "AI_PROVIDER_FALLBACK_OPENAI_FAILED",
            tenantId: input.tenantId,
            correlationId: input.correlationId,
            error: openaiError?.message,
          });
          throw cascadeError; // Re-throw primary error
        }
      }

      throw cascadeError;
    }
  }
}

export const defaultProviderRouter = new ProviderRouter();
