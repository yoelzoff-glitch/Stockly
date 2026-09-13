import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { getPublicKnowledge } from "../../src/services/ai/public/publicKnowledge";
import { buildPublicSystemPrompt } from "../../src/services/ai/public/publicSystemPrompt";
import {
  checkPublicRateLimit,
  resetPublicRateLimiterForTesting,
} from "../../src/services/ai/public/publicRateLimiter";
import { runPublicAssistant } from "../../src/services/ai/public/publicAgent";
import { defaultProviderRouter } from "../../src/services/ai/providers/providerRouter";
import { AIProvider } from "../../src/services/ai/providers/types";

describe("LibretaX Public Assistant Unit & Behavior Tests", () => {
  describe("Public Knowledge & System Prompt Grounding", () => {
    test("getPublicKnowledge includes canonical plans, pricing and core product modules", () => {
      const knowledge = getPublicKnowledge();
      assert.ok(knowledge.includes("Starter"), "Knowledge must include Starter plan");
      assert.ok(knowledge.includes("Pro"), "Knowledge must include Pro plan");
      assert.ok(knowledge.includes("Ultra"), "Knowledge must include Ultra plan");
      assert.ok(knowledge.includes("15 días de prueba gratis"), "Knowledge must include trial info");
      assert.ok(knowledge.includes("Ganancia Neta"), "Knowledge must include net profit formula");
      assert.ok(knowledge.toLowerCase().includes("stock dual"), "Knowledge must describe dual stock control");
      assert.ok(knowledge.includes("Mercado Ads"), "Knowledge must describe Mercado Ads integration");
    });

    test("buildPublicSystemPrompt enforces strict private data and prompt injection boundaries", () => {
      const prompt = buildPublicSystemPrompt("/precios");
      assert.ok(prompt.includes('página actual: "/precios"'));
      assert.ok(
        prompt.includes("Desde este chat público no tengo acceso a ninguna cuenta ni a datos privados"),
        "Must specify exact boundary answer for private data questions"
      );
      assert.ok(
        prompt.includes("No tengo acceso a cuentas, bases de datos ni información privada"),
        "Must specify exact defense answer for prompt injections"
      );
      assert.ok(
        prompt.includes("Estoy para ayudarte con consultas sobre LibretaX"),
        "Must specify redirection for off-topic queries"
      );
    });
  });

  describe("In-Memory Public Rate Limiter", () => {
    beforeEach(() => {
      resetPublicRateLimiterForTesting();
    });

    test("allows initial requests within limit", () => {
      const res = checkPublicRateLimit("test-ip-hash-1", "session-1");
      assert.equal(res.allowed, true);
      assert.ok(res.remaining > 0);
    });

    test("blocks requests exceeding per-session limit", () => {
      process.env.PUBLIC_AI_MAX_MESSAGES_PER_SESSION = "3";

      const r1 = checkPublicRateLimit("ip-a", "session-heavy");
      assert.equal(r1.allowed, true);
      const r2 = checkPublicRateLimit("ip-a", "session-heavy");
      assert.equal(r2.allowed, true);
      const r3 = checkPublicRateLimit("ip-a", "session-heavy");
      assert.equal(r3.allowed, true);

      // 4th request must be blocked
      const r4 = checkPublicRateLimit("ip-a", "session-heavy");
      assert.equal(r4.allowed, false);
      assert.equal(r4.reason, "session_limit_exceeded");
    });

    test("blocks requests exceeding per-IP limit", () => {
      process.env.PUBLIC_AI_MAX_MESSAGES_PER_IP_HOUR = "2";

      const r1 = checkPublicRateLimit("ip-heavy-1");
      assert.equal(r1.allowed, true);
      const r2 = checkPublicRateLimit("ip-heavy-1");
      assert.equal(r2.allowed, true);

      // 3rd request from same IP must be blocked
      const r3 = checkPublicRateLimit("ip-heavy-1");
      assert.equal(r3.allowed, false);
      assert.equal(r3.reason, "ip_limit_exceeded");
    });
  });

  describe("Public Agent Execution & Safety", () => {
    test("runPublicAssistant dispatches with zero tools and never accesses private DB", async () => {
      let dispatchedToolsCount = -1;
      let receivedSystemPrompt = "";

      const mockProvider: AIProvider = {
        name: "mock-gemini",
        runAgent: async (input) => {
          dispatchedToolsCount = input.tools.length;
          receivedSystemPrompt = input.systemPrompt;
          return {
            response: "LibretaX te ayuda a controlar rentabilidad y stock en Mercado Libre.",
            metadata: {
              provider: "gemini",
              model: "gemini-3.7-flash",
              toolsUsed: [],
              fallbackCount: 0,
            },
          };
        },
      };

      // Temporarily override cascade provider
      (defaultProviderRouter as any).cascadeProvider = mockProvider;

      const result = await runPublicAssistant({
        message: "¿Qué hace LibretaX?",
        page: "/",
        publicSessionId: "pub-test-123",
      });

      assert.equal(dispatchedToolsCount, 0, "Public agent must NOT provide any business tools");
      assert.ok(receivedSystemPrompt.includes("LibretaX Assistant"));
      assert.ok(result.response.includes("LibretaX"));
      assert.equal(result.metadata.provider, "gemini");
      assert.equal(result.metadata.model, "gemini-3.7-flash");
    });

    test("truncates messages exceeding MAX_PUBLIC_MESSAGE_LENGTH (1000 chars)", async () => {
      let receivedMessage = "";

      const mockProvider: AIProvider = {
        name: "mock-gemini",
        runAgent: async (input) => {
          receivedMessage = input.userMessage;
          return {
            response: "Respuesta",
            metadata: {
              provider: "gemini",
              model: "gemini-3.7-flash",
              toolsUsed: [],
              fallbackCount: 0,
            },
          };
        },
      };

      (defaultProviderRouter as any).cascadeProvider = mockProvider;

      const longMessage = "A".repeat(1500);
      await runPublicAssistant({
        message: longMessage,
      });

      assert.ok(receivedMessage.length <= 1000, `Message length should be <= 1000, was ${receivedMessage.length}`);
    });
  });
});
