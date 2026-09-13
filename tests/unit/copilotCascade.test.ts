import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { isRetryableCascadeError, GeminiCascadeProvider } from "../../src/services/ai/providers/geminiCascade";
import { ProviderRouter } from "../../src/services/ai/providers/providerRouter";
import { AIProvider, AIProviderInput, AgentResult } from "../../src/services/ai/providers/types";

describe("Gemini Model Cascade & Fallback Resilience Tests", () => {
  describe("isRetryableCascadeError", () => {
    test("identifies transient infrastructure errors correctly (429, 502, 503, timeout)", () => {
      assert.equal(isRetryableCascadeError({ status: 429, message: "Rate limit exceeded" }), true);
      assert.equal(isRetryableCascadeError({ status: 503, message: "Service Unavailable" }), true);
      assert.equal(isRetryableCascadeError({ status: 502, message: "Bad Gateway" }), true);
      assert.equal(isRetryableCascadeError({ name: "TimeoutError", message: "Request timed out" }), true);
      assert.equal(isRetryableCascadeError({ message: "RESOURCE_EXHAUSTED: Quota exceeded" }), true);
      assert.equal(isRetryableCascadeError({ message: "model temporarily unavailable" }), true);
      assert.equal(isRetryableCascadeError({ message: "deadline exceeded" }), true);
    });

    test("never retries on application bugs, schema errors, SQL errors, or tenant auth", () => {
      assert.equal(isRetryableCascadeError({ status: 400, message: "Invalid JSON body" }), false);
      assert.equal(isRetryableCascadeError({ status: 401, message: "Unauthorized" }), false);
      assert.equal(isRetryableCascadeError({ status: 403, message: "Forbidden tenant context" }), false);
      assert.equal(isRetryableCascadeError({ message: "SyntaxError: Unexpected token" }), false);
      assert.equal(isRetryableCascadeError({ message: "Postgres error: relation 'orders' does not exist" }), false);
      assert.equal(isRetryableCascadeError({ message: "Tool schema invalid property" }), false);
      assert.equal(isRetryableCascadeError(null), false);
      assert.equal(isRetryableCascadeError(undefined), false);
    });
  });

  describe("GeminiCascadeProvider flow", () => {
    const dummyInput: AIProviderInput = {
      systemPrompt: "system",
      userMessage: "¿Cuánto gané hoy?",
      tools: [],
      tenantId: "tenant-123",
    };

    test("Primary model succeeds on first attempt (0 fallbacks)", async () => {
      const mockProvider: AIProvider = {
        name: "mock-primary",
        runAgent: async () => ({
          response: "Hoy ganaste $100.000",
          metadata: {
            provider: "gemini",
            model: "gemini-3.7-flash",
            toolsUsed: ["getProfitSummary"],
            fallbackCount: 0,
          },
        }),
      };

      const cascade = new GeminiCascadeProvider({
        models: ["gemini-3.7-flash", "gemini-3.6-flash"],
        providerFactory: () => mockProvider,
      });

      const result = await cascade.runAgent(dummyInput);
      assert.equal(result.response, "Hoy ganaste $100.000");
      assert.equal(result.metadata.fallbackCount, 0);
      assert.equal(result.metadata.model, "gemini-3.7-flash");
    });

    test("Primary fails with 429, Fallback 1 succeeds (fallbackCount = 1)", async () => {
      let attempts = 0;
      const providerFactory = (model: string): AIProvider => ({
        name: `mock-${model}`,
        runAgent: async () => {
          attempts++;
          if (model === "gemini-3.7-flash") {
            const err: any = new Error("Resource exhausted: rate limit 429");
            err.status = 429;
            throw err;
          }
          return {
            response: "Respuesta desde fallback 1",
            metadata: {
              provider: "gemini",
              model,
              toolsUsed: ["getSalesSummary"],
              fallbackCount: 0,
            },
          };
        },
      });

      const cascade = new GeminiCascadeProvider({
        models: ["gemini-3.7-flash", "gemini-3.6-flash", "gemini-3.5-flash-lite"],
        providerFactory,
      });

      const result = await cascade.runAgent(dummyInput);
      assert.equal(result.response, "Respuesta desde fallback 1");
      assert.equal(result.metadata.fallbackCount, 1);
      assert.equal(result.metadata.model, "gemini-3.6-flash");
      assert.equal(attempts, 2);
    });

    test("Primary timeout -> Fallback 1 503 -> Fallback 2 succeeds (fallbackCount = 2)", async () => {
      let attempts = 0;
      const providerFactory = (model: string): AIProvider => ({
        name: `mock-${model}`,
        runAgent: async () => {
          attempts++;
          if (model === "gemini-3.7-flash") {
            const err: any = new Error("Request timeout");
            err.name = "TimeoutError";
            throw err;
          }
          if (model === "gemini-3.6-flash") {
            const err: any = new Error("Service Unavailable");
            err.status = 503;
            throw err;
          }
          return {
            response: "Respuesta desde fallback 2",
            metadata: {
              provider: "gemini",
              model,
              toolsUsed: [],
              fallbackCount: 0,
            },
          };
        },
      });

      const cascade = new GeminiCascadeProvider({
        models: ["gemini-3.7-flash", "gemini-3.6-flash", "gemini-3.5-flash-lite"],
        providerFactory,
      });

      const result = await cascade.runAgent(dummyInput);
      assert.equal(result.response, "Respuesta desde fallback 2");
      assert.equal(result.metadata.fallbackCount, 2);
      assert.equal(result.metadata.model, "gemini-3.5-flash-lite");
      assert.equal(attempts, 3);
    });

    test("Fails fast on logical / schema bugs without masking error through cascade", async () => {
      let attempts = 0;
      const providerFactory = (): AIProvider => ({
        name: "mock-buggy",
        runAgent: async () => {
          attempts++;
          throw new TypeError("Cannot read properties of undefined (reading 'parameters')");
        },
      });

      const cascade = new GeminiCascadeProvider({
        models: ["gemini-3.7-flash", "gemini-3.6-flash", "gemini-3.5-flash-lite"],
        providerFactory,
      });

      await assert.rejects(
        async () => cascade.runAgent(dummyInput),
        (err: any) => err instanceof TypeError && err.message.includes("Cannot read properties")
      );
      // Fails on attempt 1, does NOT retry across fallbacks
      assert.equal(attempts, 1);
    });
  });

  describe("ProviderRouter cross-provider fallback", () => {
    const dummyInput: AIProviderInput = {
      systemPrompt: "system",
      userMessage: "Test",
      tools: [],
      tenantId: "tenant-123",
    };

    test("Falls back to OpenAI only when AI_PROVIDER_FALLBACK_ENABLED=true", async () => {
      process.env.AI_PROVIDER_FALLBACK_ENABLED = "true";
      process.env.OPENAI_API_KEY = "test-key";

      const mockCascade: AIProvider = {
        name: "gemini_cascade",
        runAgent: async () => {
          const err: any = new Error("All Gemini models 503 unavailable");
          err.status = 503;
          throw err;
        },
      };

      const mockOpenAI: AIProvider = {
        name: "openai",
        runAgent: async () => ({
          response: "Respuesta de respaldo OpenAI",
          metadata: {
            provider: "openai",
            model: "gpt-4o-mini",
            toolsUsed: [],
            fallbackCount: 0,
          },
        }),
      };

      const router = new ProviderRouter({
        cascadeProvider: mockCascade,
        openaiProvider: mockOpenAI,
      });

      const result = await router.run(dummyInput);
      assert.equal(result.response, "Respuesta de respaldo OpenAI");
      assert.equal(result.metadata.provider, "openai");
      assert.equal(result.metadata.fallbackCount, 1);
    });
  });
});
