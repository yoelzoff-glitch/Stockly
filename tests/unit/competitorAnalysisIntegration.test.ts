import test, { describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { handleCompetitorAnalysis } from "../../src/app/api/ai/competitor-analysis/route";
import { clearCompetitorCache } from "../../src/services/meli/competitor/cache";

describe("Sprint: Competitor Analysis Route Integration Tests (Cases A - E)", () => {
  const originalFetch = global.fetch;

  const mockTestContext = {
    userId: "test-user-001",
    tenantId: "test-tenant-int",
    role: "owner",
    isActive: true,
    isDemo: false,
    correlationId: "corr-test-int-001",
  };

  const mockQuotaResult = {
    allowed: true,
    currentUsage: 1,
    limit: 100,
    remaining: 99,
    duplicate: false,
  };

  const createMockGemini = (onInvoke?: (prompt: string) => void) => ({
    generateContent: async ({ contents }: any) => {
      const prompt = contents?.[0]?.parts?.[0]?.text || "";
      if (onInvoke) onInvoke(prompt);
      return {
        response: {
          text: () =>
            JSON.stringify({
              title: "Producto de Prueba",
              price: 15000,
              listingType: "Premium",
              shipping: "Envío Gratis a cargo del vendedor",
              estimatedSales: "100+ ventas estimadas",
              reputation: "MercadoLíder Platinum",
              analysis: {
                strengths: ["Envío gratis full", "Reputación líder"],
                weaknesses: ["Precio ligeramente alto"],
                opportunities: ["Mejorar título"],
              },
              pricingStrategy: "Estrategia competitiva con financiamiento",
              actionPlan: ["Ajustar precio", "Optimizar fotos", "Activar Ads"],
            }),
        },
      };
    },
  });

  beforeEach(() => {
    clearCompetitorCache();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    clearCompetitorCache();
  });

  // =========================================================================
  // Caso A: Item completo -> 200, snapshot completo, Gemini invocado
  // =========================================================================
  test("Caso A: Full item resolution and analysis invokes Gemini and returns 200", async () => {
    global.fetch = async (url: any) => {
      const urlStr = String(url);
      if (urlStr.includes("/items/MLA111111/description")) {
        return { ok: true, status: 200, json: async () => ({ plain_text: "Excelente producto." }) } as any;
      }
      if (urlStr.includes("/users/888")) {
        return { ok: true, status: 200, json: async () => ({ id: 888, nickname: "SELLER_PRO", seller_reputation: { level_id: "5_green" } }) } as any;
      }
      if (urlStr.includes("/items/MLA111111")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: "MLA111111",
            title: "Smartwatch Deportivo Resistente al Agua",
            price: 45000,
            listing_type_id: "gold_pro",
            seller_id: 888,
            sold_quantity: 200,
            shipping: { free_shipping: true, logistic_type: "fulfillment" },
          }),
        } as any;
      }
      return { ok: false, status: 404, json: async () => ({}) } as any;
    };

    // 1. Action: resolve
    const resolveReq = new Request("http://localhost/api/ai/competitor-analysis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "resolve", url: "MLA111111" }),
    });

    const resolveRes = await handleCompetitorAnalysis(resolveReq, { testContext: mockTestContext });
    assert.equal(resolveRes.status, 200);
    const resolveBody = await resolveRes.json();
    assert.equal(resolveBody.success, true);
    assert.equal(resolveBody.data.snapshot.title, "Smartwatch Deportivo Resistente al Agua");
    assert.equal(resolveBody.data.snapshot.resolution.partial, false);

    // 2. Action: analyze
    let geminiInvoked = false;
    const analyzeReq = new Request("http://localhost/api/ai/competitor-analysis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "analyze",
        snapshot: resolveBody.data.snapshot,
        resolvedId: resolveBody.data.resolvedId,
      }),
    });

    const analyzeRes = await handleCompetitorAnalysis(analyzeReq, {
      testContext: mockTestContext,
      mockQuotaResult,
      mockGeminiModel: createMockGemini(() => {
        geminiInvoked = true;
      }),
    });

    assert.equal(analyzeRes.status, 200);
    const analyzeBody = await analyzeRes.json();
    assert.equal(analyzeBody.success, true);
    assert.equal(geminiInvoked, true);
    assert.ok(analyzeBody.data.analysis.strengths.length > 0);
  });

  // =========================================================================
  // Caso B: /items -> 403, /products -> info disponible -> 200, partial = true, Gemini invocado
  // =========================================================================
  test("Caso B: /items returns 403, fallback to /products provides data, analysis succeeds with partial=true", async () => {
    global.fetch = async (url: any) => {
      const urlStr = String(url);
      if (urlStr.includes("/items/")) {
        // All /items return 403
        return { ok: false, status: 403, json: async () => ({ message: "Access forbidden", error: "forbidden" }) } as any;
      }
      if (urlStr.includes("/products/MLA222222")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: "MLA222222",
            name: "Tablet 10 Pulgadas Full HD",
            buy_box_winner: {
              item_id: "MLA333333",
              price: 120000,
              currency_id: "ARS",
              shipping: { free_shipping: true },
            },
          }),
        } as any;
      }
      return { ok: false, status: 404, json: async () => ({}) } as any;
    };

    const resolveReq = new Request("http://localhost/api/ai/competitor-analysis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "resolve", url: "https://www.mercadolibre.com.ar/p/MLA222222" }),
    });

    const resolveRes = await handleCompetitorAnalysis(resolveReq, { testContext: mockTestContext });
    assert.equal(resolveRes.status, 200);
    const resolveBody = await resolveRes.json();
    assert.equal(resolveBody.success, true);
    assert.equal(resolveBody.data.snapshot.resolution.partial, true);

    let capturedPrompt = "";
    const analyzeReq = new Request("http://localhost/api/ai/competitor-analysis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "analyze",
        snapshot: resolveBody.data.snapshot,
      }),
    });

    const analyzeRes = await handleCompetitorAnalysis(analyzeReq, {
      testContext: mockTestContext,
      mockQuotaResult,
      mockGeminiModel: createMockGemini((prompt) => {
        capturedPrompt = prompt;
      }),
    });

    assert.equal(analyzeRes.status, 200);
    assert.ok(capturedPrompt.includes("Tablet 10 Pulgadas Full HD"));
  });

  // =========================================================================
  // Caso C: Descripción -> 403 -> 200, análisis continúa, description = null
  // =========================================================================
  test("Caso C: Description returns 403, analysis continues with description=null", async () => {
    global.fetch = async (url: any) => {
      const urlStr = String(url);
      if (urlStr.includes("/description")) {
        return { ok: false, status: 403, json: async () => ({ message: "Forbidden" }) } as any;
      }
      if (urlStr.includes("/items/MLA444444")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: "MLA444444",
            title: "Kit Teclado y Mouse Inalámbrico",
            price: 32000,
            sold_quantity: 60,
          }),
        } as any;
      }
      return { ok: false, status: 404, json: async () => ({}) } as any;
    };

    const resolveReq = new Request("http://localhost/api/ai/competitor-analysis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "resolve", url: "MLA444444" }),
    });

    const resolveRes = await handleCompetitorAnalysis(resolveReq, { testContext: mockTestContext });
    assert.equal(resolveRes.status, 200);
    const resolveBody = await resolveRes.json();
    assert.equal(resolveBody.data.snapshot.description, null);

    const analyzeReq = new Request("http://localhost/api/ai/competitor-analysis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "analyze", snapshot: resolveBody.data.snapshot }),
    });

    const analyzeRes = await handleCompetitorAnalysis(analyzeReq, {
      testContext: mockTestContext,
      mockQuotaResult,
      mockGeminiModel: createMockGemini(),
    });

    assert.equal(analyzeRes.status, 200);
  });

  // =========================================================================
  // Caso D: Seller -> 403 -> 200, seller parcial, análisis continúa
  // =========================================================================
  test("Caso D: Seller returns 403, seller fields null, analysis continues", async () => {
    global.fetch = async (url: any) => {
      const urlStr = String(url);
      if (urlStr.includes("/users/")) {
        return { ok: false, status: 403, json: async () => ({ message: "User profile forbidden" }) } as any;
      }
      if (urlStr.includes("/items/MLA555555")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: "MLA555555",
            title: "Cargador Rápido USB-C 65W",
            price: 28000,
            seller_id: 12345,
          }),
        } as any;
      }
      return { ok: false, status: 404, json: async () => ({}) } as any;
    };

    const resolveReq = new Request("http://localhost/api/ai/competitor-analysis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "resolve", url: "MLA555555" }),
    });

    const resolveRes = await handleCompetitorAnalysis(resolveReq, { testContext: mockTestContext });
    assert.equal(resolveRes.status, 200);
    const resolveBody = await resolveRes.json();
    assert.equal(resolveBody.data.snapshot.seller.nickname, null);

    const analyzeReq = new Request("http://localhost/api/ai/competitor-analysis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "analyze", snapshot: resolveBody.data.snapshot }),
    });

    const analyzeRes = await handleCompetitorAnalysis(analyzeReq, {
      testContext: mockTestContext,
      mockQuotaResult,
      mockGeminiModel: createMockGemini(),
    });

    assert.equal(analyzeRes.status, 200);
  });

  // =========================================================================
  // Caso E: Todas las fuentes -> 403 -> 422 controlado COMPETITOR_INSUFFICIENT_DATA, nunca 500
  // =========================================================================
  test("Caso E: All sources return 403 -> returns controlled 422 with business error, never 500", async () => {
    global.fetch = async () => {
      return {
        ok: false,
        status: 403,
        json: async () => ({ message: "Access to the requested resource is forbidden", error: "forbidden" }),
      } as any;
    };

    const resolveReq = new Request("http://localhost/api/ai/competitor-analysis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "resolve", url: "MLA3724535440" }),
    });

    const resolveRes = await handleCompetitorAnalysis(resolveReq, { testContext: mockTestContext });
    assert.equal(resolveRes.status, 422);

    const resolveBody = await resolveRes.json();
    assert.equal(resolveBody.code, "COMPETITOR_INSUFFICIENT_DATA");
    assert.match(resolveBody.error, /restringe algunos datos/i);
    assert.doesNotMatch(resolveBody.error, /Mercado Libre API Error/i);
    assert.doesNotMatch(resolveBody.error, /forbidden/i);
  });
});
