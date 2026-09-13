import { AIProvider, AIProviderInput, AgentResult } from "./types";
import { GeminiProvider } from "./gemini";
import { logger } from "@/lib/errors/logger";

export interface CascadeConfig {
  models?: string[];
  providerFactory?: (model: string) => AIProvider;
}

/**
 * Checks if an error qualifies as transient infrastructure failure
 * suitable for triggering model cascade fallback.
 */
export function isRetryableCascadeError(error: any): boolean {
  if (!error) return false;

  const status = Number(error?.status || error?.statusCode || error?.response?.status || 0);
  const msg = String(error?.message || "").toLowerCase();
  const code = String(error?.code || "").toLowerCase();

  // Rate limits / quota / resource exhaustion
  if (status === 429 || msg.includes("429") || msg.includes("rate limit") || msg.includes("quota") || msg.includes("resource_exhausted") || code.includes("resource_exhausted")) {
    return true;
  }

  // Upstream availability / service unavailable / bad gateway
  if (status === 502 || status === 503 || status === 504 || msg.includes("503") || msg.includes("502") || msg.includes("unavailable") || msg.includes("overloaded")) {
    return true;
  }

  // Timeouts
  if (status === 408 || error?.name === "TimeoutError" || error?.name === "AbortError" || msg.includes("timeout") || msg.includes("deadline exceeded")) {
    return true;
  }

  // Model not found or deprecated
  if (status === 404 && (msg.includes("model") || msg.includes("not found"))) {
    return true;
  }

  return false;
}

export class GeminiCascadeProvider implements AIProvider {
  public readonly name = "gemini_cascade";
  private models: string[];
  private providerFactory: (model: string) => AIProvider;

  constructor(config: CascadeConfig = {}) {
    const primary = process.env.GEMINI_MODEL_PRIMARY || "gemini-3.7-flash";
    const fb1 = process.env.GEMINI_MODEL_FALLBACK_1 || "gemini-3.6-flash";
    const fb2 = process.env.GEMINI_MODEL_FALLBACK_2 || "gemini-3.5-flash-lite";

    this.models = config.models && config.models.length > 0
      ? config.models
      : [primary, fb1, fb2];

    this.providerFactory = config.providerFactory || ((model: string) => new GeminiProvider());
  }

  async runAgent(input: AIProviderInput): Promise<AgentResult> {
    const startTime = Date.now();
    let fallbackCount = 0;
    let lastError: any = null;

    logger.info({
      event: "AI_COPILOT_REQUEST_STARTED",
      tenantId: input.tenantId,
      correlationId: input.correlationId,
      models: this.models,
    });

    for (let i = 0; i < this.models.length; i++) {
      const modelName = this.models[i];

      logger.info({
        event: "AI_MODEL_ATTEMPT",
        tenantId: input.tenantId,
        correlationId: input.correlationId,
        model: modelName,
        attempt: i + 1,
      });

      try {
        const provider = this.providerFactory(modelName);
        const result = await provider.runAgent({
          ...input,
          model: modelName,
        });

        const durationMs = Date.now() - startTime;

        logger.info({
          event: "AI_COPILOT_COMPLETED",
          tenantId: input.tenantId,
          correlationId: input.correlationId,
          provider: "gemini",
          model: modelName,
          durationMs,
          toolsUsed: result.metadata.toolsUsed,
          fallbackCount,
        });

        return {
          ...result,
          metadata: {
            ...result.metadata,
            fallbackCount,
            durationMs,
          },
        };
      } catch (err: any) {
        lastError = err;

        if (isRetryableCascadeError(err)) {
          fallbackCount++;

          logger.warn({
            event: "AI_MODEL_RATE_LIMITED",
            tenantId: input.tenantId,
            correlationId: input.correlationId,
            failedModel: modelName,
            error: err?.message,
          });

          if (i < this.models.length - 1) {
            const nextModel = this.models[i + 1];
            logger.warn({
              event: "AI_MODEL_FALLBACK",
              tenantId: input.tenantId,
              correlationId: input.correlationId,
              fromModel: modelName,
              toModel: nextModel,
              fallbackCount,
            });
            continue; // Proceed to next model in cascade
          }
        } else {
          // Non-retryable error (application bug, schema error, internal validation, permission issue)
          // DO NOT hide or retry on other models!
          logger.error({
            event: "AI_MODEL_NON_RETRYABLE_ERROR",
            tenantId: input.tenantId,
            correlationId: input.correlationId,
            model: modelName,
            error: err?.message,
          });
          throw err;
        }
      }
    }

    const durationMs = Date.now() - startTime;
    logger.error({
      event: "AI_COPILOT_FAILED",
      tenantId: input.tenantId,
      correlationId: input.correlationId,
      durationMs,
      fallbackCount,
      error: lastError?.message,
    });

    throw lastError || new Error("Gemini cascade failed on all models.");
  }
}
