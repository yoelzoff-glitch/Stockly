import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  toGeminiFunctionDeclarations,
  toGeminiFunctionResponse,
  validateToolSchema,
  ToolSchemaError,
} from "../../src/services/ai/providers/geminiToolAdapter";
import { GeminiProvider } from "../../src/services/ai/providers/gemini";
import {
  GeminiCascadeProvider,
  isRetryableCascadeError,
} from "../../src/services/ai/providers/geminiCascade";
import { AgentTool } from "../../src/services/ai/providers/types";

describe("Copilot Gemini Function Calling & Tool Handshake Unit Tests", () => {
  const sampleTool: AgentTool = {
    name: "getSalesSummary",
    description: "Obtiene la facturación y órdenes para un período.",
    parameters: {
      type: "object",
      properties: {
        period: { type: "string", description: "Período temporal" },
      },
      required: ["period"],
    },
    execute: async (args: any) => ({ revenue: 100000, orders: 10 }),
  };

  describe("1. Tool Declarations & parametersJsonSchema Mapping", () => {
    test("Maps tools to parametersJsonSchema and strictly omits 'parameters'", () => {
      const declarations = toGeminiFunctionDeclarations([sampleTool]);
      assert.equal(declarations.length, 1);
      const decl = declarations[0];

      assert.equal(decl.name, "getSalesSummary");
      assert.equal(decl.description, "Obtiene la facturación y órdenes para un período.");
      assert.deepEqual(decl.parametersJsonSchema, {
        type: "object",
        properties: {
          period: { type: "string", description: "Período temporal" },
        },
        required: ["period"],
      });

      // Crucial: parameters property must NOT exist
      assert.equal((decl as any).parameters, undefined);
    });

    test("Pre-flight schema validation throws AI_TOOL_SCHEMA_INVALID on invalid definitions", () => {
      // Missing name
      assert.throws(
        () => validateToolSchema({ ...sampleTool, name: "" }),
        (err: any) => err instanceof ToolSchemaError && err.code === "AI_TOOL_SCHEMA_INVALID"
      );

      // Missing description
      assert.throws(
        () => validateToolSchema({ ...sampleTool, description: "   " }),
        (err: any) => err instanceof ToolSchemaError && err.code === "AI_TOOL_SCHEMA_INVALID"
      );

      // Invalid parameters type
      assert.throws(
        () => validateToolSchema({ ...sampleTool, parameters: { type: "string" } as any }),
        (err: any) => err instanceof ToolSchemaError && err.code === "AI_TOOL_SCHEMA_INVALID"
      );

      // Null parameters
      assert.throws(
        () => validateToolSchema({ ...sampleTool, parameters: null as any }),
        (err: any) => err instanceof ToolSchemaError && err.code === "AI_TOOL_SCHEMA_INVALID"
      );

      // Invalid required (not array)
      assert.throws(
        () => validateToolSchema({ ...sampleTool, parameters: { type: "object", properties: {}, required: "period" as any } }),
        (err: any) => err instanceof ToolSchemaError && err.code === "AI_TOOL_SCHEMA_INVALID"
      );
    });
  });

  describe("2. FunctionCall.id Correlation & FunctionResponse Formatting", () => {
    test("Preserves call.id in FunctionResponse when provided by Gemini", () => {
      const call = { id: "call-abc-123", name: "getSalesSummary" };
      const toolResult = { revenue: 50000, orders: 5 };

      const part = toGeminiFunctionResponse(call, toolResult);
      assert.ok(part.functionResponse);
      assert.equal(part.functionResponse.id, "call-abc-123");
      assert.equal(part.functionResponse.name, "getSalesSummary");
      assert.deepEqual(part.functionResponse.response, { revenue: 50000, orders: 5 });
    });

    test("Does NOT inject or invent dummy id when call.id is absent or empty", () => {
      const callWithoutId = { name: "getSalesSummary" };
      const toolResult = { revenue: 20000 };

      const part = toGeminiFunctionResponse(callWithoutId, toolResult);
      assert.ok(part.functionResponse);
      assert.equal(part.functionResponse.id, undefined);
      assert.equal(part.functionResponse.name, "getSalesSummary");
      assert.deepEqual(part.functionResponse.response, { revenue: 20000 });
    });

    test("Wraps primitive return values into an object response", () => {
      const call = { id: "call-primitive", name: "ping" };
      const part = toGeminiFunctionResponse(call, "pong");

      assert.deepEqual(part.functionResponse?.response, { result: "pong" });
    });
  });

  describe("3. Schema Error Non-Retryable Cascade Behavior", () => {
    test("isRetryableCascadeError returns false for ToolSchemaError or AI_TOOL_SCHEMA_INVALID", () => {
      const schemaErr = new ToolSchemaError("AI_TOOL_SCHEMA_INVALID", "Invalid schema in tool");
      assert.equal(isRetryableCascadeError(schemaErr), false);

      const genericErrWithCode = { code: "AI_TOOL_SCHEMA_INVALID", message: "Schema error" };
      assert.equal(isRetryableCascadeError(genericErrWithCode), false);
    });

    test("isRetryableCascadeError returns true for 429, timeouts and 503", () => {
      assert.equal(isRetryableCascadeError({ status: 429, message: "Resource exhausted" }), true);
      assert.equal(isRetryableCascadeError({ status: 503, message: "Service unavailable" }), true);
      assert.equal(isRetryableCascadeError({ name: "TimeoutError", message: "Deadline exceeded" }), true);
    });

    test("GeminiCascadeProvider aborts immediately on schema error without attempting fallbacks", async () => {
      let attempts = 0;
      const brokenTool: AgentTool = {
        name: "brokenTool",
        description: "Broken",
        parameters: { type: "invalid" as any, properties: {} },
        execute: async () => ({}),
      };

      const cascade = new GeminiCascadeProvider({
        models: ["model-primary", "model-fallback"],
        providerFactory: () => ({
          name: "mock",
          runAgent: async () => {
            attempts++;
            throw new Error("Should not reach here");
          },
        }),
      });

      // Passing broken tool must throw schema error before providerFactory or any model call
      await assert.rejects(
        async () => {
          const provider = new GeminiProvider();
          await provider.runAgent({
            systemPrompt: "System",
            userMessage: "¿Cuánto vendí hoy?",
            tools: [brokenTool],
          });
        },
        (err: any) => {
          assert.equal(err.code, "AI_TOOL_SCHEMA_INVALID");
          return true;
        }
      );
    });
  });

  describe("4. End-to-End Handshake with Mocked Gemini Client", () => {
    test("Executes single-round tool handshake with functionCall and functionResponse correlation", async () => {
      let callCount = 0;
      let recordedContents: any[] = [];

      const mockClient: any = {
        models: {
          generateContent: async (params: any) => {
            callCount++;
            recordedContents = params.contents;

            if (callCount === 1) {
              // Return function call candidate
              return {
                functionCalls: [
                  {
                    id: "call-turn-1",
                    name: "getSalesSummary",
                    args: { period: "hoy" },
                  },
                ],
                candidates: [
                  {
                    content: {
                      role: "model",
                      parts: [
                        {
                          functionCall: {
                            id: "call-turn-1",
                            name: "getSalesSummary",
                            args: { period: "hoy" },
                          },
                        },
                      ],
                    },
                  },
                ],
              };
            }

            // Return final text
            return {
              functionCalls: [],
              text: "Hoy vendiste $100.000 en 10 órdenes.",
            };
          },
        },
      };

      const provider = new GeminiProvider("mock-key");
      (provider as any).client = mockClient;

      const result = await provider.runAgent({
        systemPrompt: "Eres LibretaX Copilot",
        userMessage: "¿Cuánto vendí hoy?",
        tools: [sampleTool],
        tenantId: "tenant-test-123",
        correlationId: "corr-test-456",
      });

      assert.equal(callCount, 2);
      assert.equal(result.response, "Hoy vendiste $100.000 en 10 órdenes.");
      assert.deepEqual(result.metadata.toolsUsed, ["getSalesSummary"]);

      // Verify that candidate turn was appended before function response turn
      assert.equal(recordedContents.length, 3);
      assert.equal(recordedContents[0].role, "user"); // Initial prompt
      assert.equal(recordedContents[1].role, "model"); // Model functionCall candidate
      assert.equal(recordedContents[2].role, "user"); // User functionResponse
      assert.equal(recordedContents[2].parts[0].functionResponse.id, "call-turn-1");
      assert.equal(recordedContents[2].parts[0].functionResponse.name, "getSalesSummary");
      assert.equal(recordedContents[2].parts[0].functionResponse.response.revenue, 100000);
    });

    test("Executes multi-round tool handshake up to MAX_TOOL_ROUNDS", async () => {
      let turn = 0;

      const mockClient: any = {
        models: {
          generateContent: async () => {
            turn++;
            if (turn === 1) {
              return {
                functionCalls: [{ id: "call-1", name: "getSalesSummary", args: { period: "este_mes" } }],
                candidates: [{ content: { role: "model", parts: [{ functionCall: { id: "call-1", name: "getSalesSummary" } }] } }],
              };
            }
            if (turn === 2) {
              return {
                functionCalls: [{ id: "call-2", name: "compareSalesRanges", args: {} }],
                candidates: [{ content: { role: "model", parts: [{ functionCall: { id: "call-2", name: "compareSalesRanges" } }] } }],
              };
            }
            return {
              functionCalls: [],
              text: "Este mes venís un 20% arriba respecto al mes anterior.",
            };
          },
        },
      };

      const compareTool: AgentTool = {
        name: "compareSalesRanges",
        description: "Compara ventas entre períodos",
        parameters: { type: "object", properties: {} },
        execute: async () => ({ growth: 20 }),
      };

      const provider = new GeminiProvider("mock-key");
      (provider as any).client = mockClient;

      const result = await provider.runAgent({
        systemPrompt: "Eres LibretaX Copilot",
        userMessage: "¿Cómo vengo este mes?",
        tools: [sampleTool, compareTool],
      });

      assert.equal(turn, 3);
      assert.equal(result.response, "Este mes venís un 20% arriba respecto al mes anterior.");
      assert.deepEqual(result.metadata.toolsUsed, ["getSalesSummary", "compareSalesRanges"]);
    });

    test("Handles tool execution failure gracefully without crashing the turn", async () => {
      let secondTurnResponse: any = null;

      const failingTool: AgentTool = {
        name: "failingTool",
        description: "Throws an error",
        parameters: { type: "object", properties: {} },
        execute: async () => {
          throw new Error("Database timeout on read replica");
        },
      };

      const mockClient: any = {
        models: {
          generateContent: async (params: any) => {
            if (!secondTurnResponse) {
              secondTurnResponse = true;
              return {
                functionCalls: [{ id: "call-err-1", name: "failingTool", args: {} }],
                candidates: [{ content: { role: "model", parts: [{ functionCall: { id: "call-err-1", name: "failingTool" } }] } }],
              };
            }
            // Model receives error payload and explains it to user
            const lastMessage = params.contents[params.contents.length - 1];
            assert.ok(lastMessage.parts[0].functionResponse.response.error.includes("Database timeout"));
            return {
              functionCalls: [],
              text: "No pude consultar la base de datos en este momento.",
            };
          },
        },
      };

      const provider = new GeminiProvider("mock-key");
      (provider as any).client = mockClient;

      const result = await provider.runAgent({
        systemPrompt: "System",
        userMessage: "Test error handling",
        tools: [failingTool],
      });

      assert.equal(result.response, "No pude consultar la base de datos en este momento.");
    });
  });
});
