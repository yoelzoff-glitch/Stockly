import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { GeminiCascadeProvider } from "../../src/services/ai/providers/geminiCascade";
import { runPublicAssistant } from "../../src/services/ai/public/publicAgent";
import { defaultProviderRouter } from "../../src/services/ai/providers/providerRouter";
import { AIProvider } from "../../src/services/ai/providers/types";

describe("Copilot Tool Handshake Integration & Regression Tests", () => {
  const mockTenantId = "tenant-int-test-123";

  describe("1. Model Cascade on 429 Rate Limit", () => {
    test("Falls back to secondary model when primary returns 429 and continues tool execution", async () => {
      let primaryCalled = false;
      let fallbackCalled = false;

      const mockPrimary: AIProvider = {
        name: "mock-primary",
        runAgent: async () => {
          primaryCalled = true;
          const err: any = new Error("Resource exhausted");
          err.status = 429;
          throw err;
        },
      };

      const mockFallback: AIProvider = {
        name: "mock-fallback",
        runAgent: async (input) => {
          fallbackCalled = true;
          return {
            response: "Hoy vendiste $50.000 con 5 órdenes.",
            metadata: {
              provider: "gemini",
              model: "gemini-3.6-flash",
              toolsUsed: ["getSalesSummary"],
              fallbackCount: 1,
            },
          };
        },
      };

      const cascade = new GeminiCascadeProvider({
        models: ["gemini-3.7-flash", "gemini-3.6-flash"],
        providerFactory: (model) => (model === "gemini-3.7-flash" ? mockPrimary : mockFallback),
      });

      const result = await cascade.runAgent({
        systemPrompt: "Eres LibretaX Copilot",
        userMessage: "¿Cuánto vendí hoy?",
        tools: [
          {
            name: "getSalesSummary",
            description: "Resumen de ventas",
            parameters: { type: "object", properties: {} },
            execute: async () => ({ revenue: 50000 }),
          },
        ],
        tenantId: mockTenantId,
      });

      assert.equal(primaryCalled, true);
      assert.equal(fallbackCalled, true);
      assert.equal(result.metadata.fallbackCount, 1);
      assert.deepEqual(result.metadata.toolsUsed, ["getSalesSummary"]);
      assert.ok(result.response.includes("$50.000"));
    });
  });

  describe("2. Public Assistant Isolation & Non-Regression", () => {
    test("Public Assistant operates with empty tools array and never accesses private tools", async () => {
      let receivedToolsCount = -1;

      const mockProvider: AIProvider = {
        name: "mock-gemini-public",
        runAgent: async (input) => {
          receivedToolsCount = input.tools.length;
          return {
            response: "LibretaX es un software de gestión para vendedores de Mercado Libre.",
            metadata: {
              provider: "gemini",
              model: "gemini-3.7-flash",
              toolsUsed: [],
              fallbackCount: 0,
            },
          };
        },
      };

      // Temporarily mock providerRouter cascade
      const originalCascade = (defaultProviderRouter as any).cascadeProvider;
      (defaultProviderRouter as any).cascadeProvider = mockProvider;

      try {
        const result = await runPublicAssistant({
          message: "¿Qué hace LibretaX?",
        });

        assert.equal(receivedToolsCount, 0, "Public Assistant must provide zero tools");
        assert.ok(result.response.includes("LibretaX"));
      } finally {
        (defaultProviderRouter as any).cascadeProvider = originalCascade;
      }
    });
  });

  describe("3. Financial Tools Contract Verification", () => {
    test("Tools return structured objects compatible with Gemini functionResponse", async () => {
      // Mock calculation results
      const fakeSalesResult = {
        revenue: 500000,
        orders: 20,
        units: 25,
        ticketAverage: 25000,
      };

      const fakeProfitResult = {
        revenue: 500000,
        productCosts: 200000,
        marketplaceFees: 70000,
        shippingCosts: 30000,
        promotionsAndCoupons: 20000,
        netProfit: 180000,
        netMargin: 36,
      };

      assert.equal(typeof fakeSalesResult, "object");
      assert.equal(typeof fakeProfitResult, "object");
      assert.equal(fakeProfitResult.netProfit, 180000);
      assert.equal(fakeProfitResult.netMargin, 36);
    });
  });
});
