import { GoogleGenAI } from "@google/genai";
import { AIProvider, AIProviderInput, AgentResult } from "./types";
import { logger } from "@/lib/errors/logger";

const MAX_TOOL_ROUNDS = 5;

export class GeminiProvider implements AIProvider {
  public readonly name = "gemini";
  private client: GoogleGenAI;

  constructor(apiKey?: string) {
    const key = apiKey || process.env.GEMINI_API_KEY || "";
    this.client = new GoogleGenAI({ apiKey: key });
  }

  async runAgent(input: AIProviderInput): Promise<AgentResult> {
    const startTime = Date.now();
    const model = input.model || process.env.GEMINI_MODEL_PRIMARY || "gemini-2.5-flash";
    const toolsUsed: string[] = [];
    let focusedProductId: string | null = null;

    logger.info({
      event: "AI_COPILOT_GEMINI_START",
      tenantId: input.tenantId,
      correlationId: input.correlationId,
      model,
    });

    // Format tools for Gemini declarations
    const toolDeclarations = input.tools.map(t => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    }));

    const toolsMap = new Map(input.tools.map(t => [t.name, t]));

    // Construct conversation contents
    const contents: any[] = [
      {
        role: "user",
        parts: [{ text: input.userMessage }],
      },
    ];

    let rounds = 0;
    let finalResponseText = "";

    while (rounds < MAX_TOOL_ROUNDS) {
      rounds++;

      const response = await this.client.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction: input.systemPrompt,
          tools: toolDeclarations.length > 0 ? [{ functionDeclarations: toolDeclarations as any }] : undefined,
        },
      });

      const functionCalls = response.functionCalls || [];

      if (!functionCalls || functionCalls.length === 0) {
        finalResponseText = response.text || "";
        break;
      }

      // Record candidate content from model
      const candidateContent = response.candidates?.[0]?.content;
      if (candidateContent) {
        contents.push(candidateContent);
      }

      // Execute each function call
      const functionResponseParts: any[] = [];

      for (const call of functionCalls) {
        const toolName = call.name || "";
        if (!toolName) continue;
        const toolArgs = call.args || {};
        toolsUsed.push(toolName);

        logger.info({
          event: "AI_TOOL_CALLED",
          tenantId: input.tenantId,
          correlationId: input.correlationId,
          toolName,
          round: rounds,
        });

        const tool = toolsMap.get(toolName);
        let toolResult: any;

        if (tool) {
          try {
            toolResult = await tool.execute(toolArgs);
            if (toolResult?.product_id) {
              focusedProductId = toolResult.product_id;
            }
          } catch (toolErr: any) {
            logger.error({
              event: "AI_TOOL_ERROR",
              tenantId: input.tenantId,
              correlationId: input.correlationId,
              toolName,
              error: toolErr?.message,
            });
            toolResult = { error: `La herramienta ${toolName} falló: ${toolErr?.message}` };
          }
        } else {
          toolResult = { error: `Herramienta ${toolName} no disponible.` };
        }

        logger.info({
          event: "AI_TOOL_COMPLETED",
          tenantId: input.tenantId,
          correlationId: input.correlationId,
          toolName,
        });

        functionResponseParts.push({
          functionResponse: {
            name: toolName,
            response: typeof toolResult === "object" && toolResult !== null ? toolResult : { result: toolResult },
          },
        });
      }

      // Append function response back to Gemini
      contents.push({
        role: "user",
        parts: functionResponseParts,
      });
    }

    const durationMs = Date.now() - startTime;

    return {
      response: finalResponseText || "No pude completar la consulta en este momento.",
      product_id: focusedProductId,
      metadata: {
        provider: "gemini",
        model,
        toolsUsed: Array.from(new Set(toolsUsed)),
        fallbackCount: 0,
        durationMs,
      },
    };
  }
}
