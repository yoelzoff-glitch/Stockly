import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createScopedIdempotencyKey } from "../../src/lib/security/idempotency";

describe("Sprint 8.1 — AI Idempotency & Provider Call Count Verification", () => {
  it("generates deterministic scoped idempotency keys for identical payloads", () => {
    const key1 = createScopedIdempotencyKey({
      prefix: "ai_chat",
      tenantId: "tenant-123",
      userId: "user-456",
      payload: "¿Cuál es el stock de las zapatillas?",
      customKey: "req-key-001",
    });

    const key2 = createScopedIdempotencyKey({
      prefix: "ai_chat",
      tenantId: "tenant-123",
      userId: "user-456",
      payload: "   ¿cuál es el stock de las zapatillas?  ",
      customKey: "req-key-001",
    });

    assert.equal(key1, key2, "Normalized identical prompts with same custom key must yield the same idempotency key");
  });

  it("prevents key reuse across different prompts by including normalized payload hash", () => {
    const keyPromptA = createScopedIdempotencyKey({
      prefix: "ai_chat",
      tenantId: "tenant-123",
      userId: "user-456",
      payload: "¿Cuál es mi facturación de este mes?",
      customKey: "shared-key",
    });

    const keyPromptB = createScopedIdempotencyKey({
      prefix: "ai_chat",
      tenantId: "tenant-123",
      userId: "user-456",
      payload: "Pausar todos los productos sin stock",
      customKey: "shared-key",
    });

    assert.notEqual(
      keyPromptA,
      keyPromptB,
      "A client attempting to reuse the same custom key with different prompts must be partitioned into different scoped keys"
    );
  });

  it("isolates idempotency keys across different tenants", () => {
    const keyTenantA = createScopedIdempotencyKey({
      prefix: "ai_chat",
      tenantId: "tenant-AAA",
      userId: "user-1",
      payload: "Consulta de stock",
      customKey: "key-1",
    });

    const keyTenantB = createScopedIdempotencyKey({
      prefix: "ai_chat",
      tenantId: "tenant-BBB",
      userId: "user-1",
      payload: "Consulta de stock",
      customKey: "key-1",
    });

    assert.notEqual(keyTenantA, keyTenantB, "Different tenants must never share the same idempotency key");
  });

  it("executes identical requests: 1st consumes quota & calls provider, 2nd receives duplicate: true without provider call", async () => {
    let mockProviderCallCount = 0;
    let mockQuotaConsumedCount = 0;
    const recordedEvents = new Set<string>();

    // Mock provider execution
    async function mockInvokeLLMProvider(prompt: string) {
      mockProviderCallCount++;
      return `Respuesta para: ${prompt}`;
    }

    // Mock atomic quota reservation (mirroring consume_tenant_quota)
    async function mockConsumeQuota(tenantId: string, idempKey: string) {
      if (recordedEvents.has(idempKey)) {
        return { allowed: true, duplicate: true };
      }
      recordedEvents.add(idempKey);
      mockQuotaConsumedCount++;
      return { allowed: true, duplicate: false };
    }

    // Simulate endpoint handler
    async function handleChatRequest(tenantId: string, message: string, customKey: string) {
      const idempotencyKey = createScopedIdempotencyKey({
        prefix: "ai_chat",
        tenantId,
        payload: message,
        customKey,
      });

      const quota = await mockConsumeQuota(tenantId, idempotencyKey);
      if (!quota.allowed) {
        return { error: "Quota exceeded", duplicate: false };
      }

      if (quota.duplicate) {
        return {
          response: "Solicitud duplicada: la consulta ya fue procesada anteriormente.",
          duplicate: true,
        };
      }

      const response = await mockInvokeLLMProvider(message);
      return { response, duplicate: false };
    }

    const tenantId = "tenant-test-idemp";
    const prompt = "¿Cómo optimizar mis publicaciones?";
    const customKey = "idemp-client-req-999";

    // 1st Request
    const res1 = await handleChatRequest(tenantId, prompt, customKey);
    assert.equal(res1.duplicate, false);
    assert.equal(res1.response, "Respuesta para: ¿Cómo optimizar mis publicaciones?");
    assert.equal(mockQuotaConsumedCount, 1, "Quota must be consumed exactly 1 time on first request");
    assert.equal(mockProviderCallCount, 1, "Provider must be invoked exactly 1 time on first request");

    // 2nd Request (Identical key & payload)
    const res2 = await handleChatRequest(tenantId, prompt, customKey);
    assert.equal(res2.duplicate, true, "Second identical request must return duplicate: true");
    assert.equal(mockQuotaConsumedCount, 1, "Quota must NOT be consumed again on duplicate request");
    assert.equal(mockProviderCallCount, 1, "Provider must NOT be invoked again on duplicate request (count remains 1)");
  });
});
