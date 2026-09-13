import { openai } from "@/lib/ai/openai";
import { AIProvider, AIProviderInput, AgentResult } from "./types";
import { logger } from "@/lib/errors/logger";

export class OpenAIProvider implements AIProvider {
  public readonly name = "openai";

  async runAgent(input: AIProviderInput): Promise<AgentResult> {
    const startTime = Date.now();
    const model = input.model || process.env.AI_MODEL || "gpt-4o-mini";
    const toolsUsed: string[] = [];
    let focusedProductId: string | null = null;

    logger.info({
      event: "AI_COPILOT_OPENAI_START",
      tenantId: input.tenantId,
      correlationId: input.correlationId,
      model,
    });

    const openaiTools = input.tools.map(t => ({
      type: "function" as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
        function: async (args: any) => {
          toolsUsed.push(t.name);
          const result = await t.execute(args);
          if (result?.product_id) {
            focusedProductId = result.product_id;
          }
          return result;
        },
        parse: (input: string) => {
          try {
            return JSON.parse(input);
          } catch {
            return {};
          }
        },
      },
    }));

    const runner = openai.chat.completions.runTools({
      model,
      messages: [
        { role: "system", content: input.systemPrompt },
        { role: "user", content: input.userMessage },
      ],
      tools: openaiTools,
    });

    const finalContent = await runner.finalContent();
    const durationMs = Date.now() - startTime;

    return {
      response: finalContent || "No se pudo generar respuesta.",
      product_id: focusedProductId,
      metadata: {
        provider: "openai",
        model,
        toolsUsed: Array.from(new Set(toolsUsed)),
        fallbackCount: 0,
        durationMs,
      },
    };
  }
}
