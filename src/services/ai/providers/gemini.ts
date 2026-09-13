import { GoogleGenAI, type Part } from "@google/genai";
import { AIProvider, AIProviderInput, AgentResult } from "./types";
import { logger } from "@/lib/errors/logger";
import {
  toGeminiFunctionDeclarations,
  toGeminiFunctionResponse,
} from "./geminiToolAdapter";

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

    // Format and validate tools for Gemini declarations using parametersJsonSchema
    let toolDeclarations;
    try {
      toolDeclarations = toGeminiFunctionDeclarations(input.tools);
      logger.info({
        event: "AI_GEMINI_TOOL_DECLARATIONS_BUILT",
        tenantId: input.tenantId,
        correlationId: input.correlationId,
        model,
        toolCount: toolDeclarations.length,
      });
    } catch (err: any) {
      logger.error({
        event: "AI_GEMINI_REQUEST_FAILED",
        status: 400,
        code: err?.code || "AI_TOOL_SCHEMA_INVALID",
        message: err?.message,
        model,
        round: 0,
        stage: "FUNCTION_DECLARATION",
        correlationId: input.correlationId,
        tenantId: input.tenantId,
      });
      throw err;
    }

    const toolsMap = new Map(input.tools.map((t) => [t.name, t]));

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

      let response;
      try {
        response = await this.client.models.generateContent({
          model,
          contents,
          config: {
            systemInstruction: input.systemPrompt,
            tools:
              toolDeclarations.length > 0
                ? [{ functionDeclarations: toolDeclarations }]
                : undefined,
          },
        });
      } catch (err: any) {
        const status = Number(err?.status || err?.statusCode || err?.response?.status || 500);
        logger.error({
          event: "AI_GEMINI_REQUEST_FAILED",
          status,
          code: err?.code || "GENERATE_CONTENT_ERROR",
          message: err?.message,
          model,
          round: rounds,
          stage: "GENERATE_CONTENT",
          correlationId: input.correlationId,
          tenantId: input.tenantId,
        });
        throw err;
      }

      const functionCalls = response.functionCalls || [];

      if (!functionCalls || functionCalls.length === 0) {
        finalResponseText = response.text || "";
        logger.info({
          event: "AI_GEMINI_FINAL_RESPONSE_RECEIVED",
          tenantId: input.tenantId,
          correlationId: input.correlationId,
          model,
          round: rounds,
          durationMs: Date.now() - startTime,
        });
        break;
      }

      // Record candidate content from model in history before appending function response
      const candidateContent = response.candidates?.[0]?.content;
      if (candidateContent) {
        contents.push(candidateContent);
      }

      // Execute each function call
      const functionResponseParts: Part[] = [];

      for (const call of functionCalls) {
        const toolName = call.name || "";
        if (!toolName) continue;
        const functionCallId = call.id;
        const toolArgs = call.args || {};
        toolsUsed.push(toolName);

        logger.info({
          event: "AI_GEMINI_FUNCTION_CALL_RECEIVED",
          tenantId: input.tenantId,
          correlationId: input.correlationId,
          model,
          toolName,
          functionCallId,
          round: rounds,
        });

        logger.info({
          event: "AI_GEMINI_TOOL_EXECUTION_STARTED",
          tenantId: input.tenantId,
          correlationId: input.correlationId,
          model,
          toolName,
          functionCallId,
          round: rounds,
        });

        const toolExecStartTime = Date.now();
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
              event: "AI_GEMINI_REQUEST_FAILED",
              status: 500,
              code: "TOOL_EXECUTION_ERROR",
              message: toolErr?.message,
              model,
              round: rounds,
              stage: "TOOL_EXECUTION",
              toolName,
              correlationId: input.correlationId,
              tenantId: input.tenantId,
            });
            toolResult = { error: `La herramienta ${toolName} falló: ${toolErr?.message}` };
          }
        } else {
          toolResult = { error: `Herramienta ${toolName} no disponible.` };
        }

        const toolDurationMs = Date.now() - toolExecStartTime;
        logger.info({
          event: "AI_GEMINI_TOOL_EXECUTION_COMPLETED",
          tenantId: input.tenantId,
          correlationId: input.correlationId,
          model,
          toolName,
          functionCallId,
          round: rounds,
          durationMs: toolDurationMs,
        });

        const responsePart = toGeminiFunctionResponse(call, toolResult);
        functionResponseParts.push(responsePart);

        logger.info({
          event: "AI_GEMINI_FUNCTION_RESPONSE_SENT",
          tenantId: input.tenantId,
          correlationId: input.correlationId,
          model,
          toolName,
          functionCallId,
          round: rounds,
        });
      }

      // Append function response back to Gemini with role user
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
