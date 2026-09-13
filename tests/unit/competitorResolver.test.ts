import test, { describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { resolveCompetitor } from "../../src/services/meli/competitor/resolver";
import { clearCompetitorCache } from "../../src/services/meli/competitor/cache";
import { CompetitorAnalysisError } from "../../src/services/meli/competitor/types";

describe("Sprint: Competitor Resolver & Resilience Unit Tests", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    clearCompetitorCache();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    clearCompetitorCache();
  });

  test("Strategy A: Resolves standard public item (200 OK)", async () => {
    global.fetch = async (url: any) => {
      const urlStr = String(url);
      if (urlStr.includes("/items/MLA100100/description")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ plain_text: "Descripción detallada del producto." }),
        } as any;
      }
      if (urlStr.includes("/users/555")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ id: 555, nickname: "VENDEDOR_EXCELENTE", seller_reputation: { level_id: "5_green" } }),
        } as any;
      }
      if (urlStr.includes("/items/MLA100100")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: "MLA100100",
            title: "Mouse Ergonómico Inalámbrico",
            price: 18500,
            seller_id: 555,
            sold_quantity: 45,
            shipping: { free_shipping: true, logistic_type: "fulfillment" },
          }),
        } as any;
      }
      return { ok: false, status: 404, json: async () => ({ message: "Not found" }) } as any;
    };

    const snapshot = await resolveCompetitor({
      url: "https://articulo.mercadolibre.com.ar/MLA-100100-mouse-ergonomico",
      tenantId: "test-tenant-1",
    });

    assert.equal(snapshot.sourceId, "MLA100100");
    assert.equal(snapshot.title, "Mouse Ergonómico Inalámbrico");
    assert.equal(snapshot.price, 18500);
    assert.equal(snapshot.seller.nickname, "VENDEDOR_EXCELENTE");
    assert.equal(snapshot.description, "Descripción detallada del producto.");
    assert.equal(snapshot.resolution.source, "server_public_item");
  });

  test("Strategy A: Resolves item when Description returns 403 Forbidden without throwing", async () => {
    global.fetch = async (url: any) => {
      const urlStr = String(url);
      if (urlStr.includes("/items/MLA200200/description")) {
        return {
          ok: false,
          status: 403,
          json: async () => ({ message: "Access forbidden to description" }),
        } as any;
      }
      if (urlStr.includes("/items/MLA200200")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: "MLA200200",
            title: "Teclado Mecánico RGB",
            price: 65000,
            sold_quantity: 80,
          }),
        } as any;
      }
      return { ok: false, status: 404, json: async () => ({}) } as any;
    };

    const snapshot = await resolveCompetitor({
      url: "MLA200200",
      tenantId: "test-tenant-1",
    });

    assert.equal(snapshot.sourceId, "MLA200200");
    assert.equal(snapshot.title, "Teclado Mecánico RGB");
    assert.equal(snapshot.price, 65000);
    assert.equal(snapshot.description, null);
    assert.ok(snapshot.resolution.unavailableFields.includes("description"));
  });

  test("Strategy A: Resolves item when Seller returns 403 Forbidden without throwing", async () => {
    global.fetch = async (url: any) => {
      const urlStr = String(url);
      if (urlStr.includes("/users/999")) {
        return {
          ok: false,
          status: 403,
          json: async () => ({ message: "Seller profile forbidden" }),
        } as any;
      }
      if (urlStr.includes("/items/MLA300300")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: "MLA300300",
            title: "Monitor 27 Pulgadas IPS 144Hz",
            price: 250000,
            seller_id: 999,
          }),
        } as any;
      }
      return { ok: false, status: 404, json: async () => ({}) } as any;
    };

    const snapshot = await resolveCompetitor({
      url: "MLA300300",
      tenantId: "test-tenant-1",
    });

    assert.equal(snapshot.sourceId, "MLA300300");
    assert.equal(snapshot.seller.nickname, null);
    assert.equal(snapshot.price, 250000);
    assert.ok(snapshot.resolution.unavailableFields.includes("seller"));
  });

  test("Strategy B: Catalog fallback creates partial snapshot if Buy Box item returns 403", async () => {
    global.fetch = async (url: any) => {
      const urlStr = String(url);
      if (urlStr.includes("/products/MLA151515")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: "MLA151515",
            name: "Silla Gamer Ergonómica Pro",
            buy_box_winner: {
              item_id: "MLA999999",
              price: 180000,
              currency_id: "ARS",
              shipping: { free_shipping: true },
            },
          }),
        } as any;
      }
      if (urlStr.includes("/items/MLA999999")) {
        // Simulates 403 Forbidden on the buy box winner item
        return {
          ok: false,
          status: 403,
          json: async () => ({ message: "Access forbidden" }),
        } as any;
      }
      return { ok: false, status: 404, json: async () => ({}) } as any;
    };

    const snapshot = await resolveCompetitor({
      url: "https://www.mercadolibre.com.ar/p/MLA151515",
      tenantId: "test-tenant-1",
    });

    assert.equal(snapshot.title, "Silla Gamer Ergonómica Pro");
    assert.equal(snapshot.price, 180000);
    assert.equal(snapshot.resolution.source, "server_catalog_partial");
    assert.equal(snapshot.resolution.partial, true);
  });

  test("REGRESSION FIXTURE: MLA3724535440 returns 403 on item and falls back gracefully", async () => {
    global.fetch = async (url: any) => {
      const urlStr = String(url);
      // Item MLA3724535440 is blocked with 403 Forbidden
      if (urlStr.includes("/items/MLA3724535440")) {
        return {
          ok: false,
          status: 403,
          json: async () => ({
            message: "Access to the requested resource is forbidden",
            error: "forbidden",
            status: 403,
          }),
        } as any;
      }
      return { ok: false, status: 404, json: async () => ({ message: "Not found" }) } as any;
    };

    // When all sources fail, it throws a clean typed CompetitorAnalysisError with 422
    // NEVER a 500 internal server error or unhandled 403
    await assert.rejects(
      async () => {
        await resolveCompetitor({
          url: "https://articulo.mercadolibre.com.ar/MLA-3724535440-soporte-celular",
          tenantId: "tenant-regression-fixture",
        });
      },
      (err: any) => {
        assert.ok(err instanceof CompetitorAnalysisError);
        assert.equal(err.competitorCode, "COMPETITOR_INSUFFICIENT_DATA");
        assert.equal(err.statusCode, 422);
        assert.doesNotMatch(err.message, /Mercado Libre API Error/i);
        assert.doesNotMatch(err.message, /forbidden/i);
        assert.match(err.message, /restringe algunos datos/i);
        return true;
      }
    );
  });

  test("Short-circuit: Cache hit prevents repeated external calls within TTL", async () => {
    let callCount = 0;
    global.fetch = async (url: any) => {
      callCount++;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          id: "MLA777777",
          title: "Lámpara de Escritorio LED",
          price: 22000,
        }),
      } as any;
    };

    // First call: executes fetch
    const snap1 = await resolveCompetitor({
      url: "MLA777777",
      tenantId: "tenant-cache-test",
    });
    const initialCalls = callCount;
    assert.ok(initialCalls > 0);

    // Second call with same identifier and tenant: hits cache, callCount does not increase
    const snap2 = await resolveCompetitor({
      url: "MLA777777",
      tenantId: "tenant-cache-test",
    });

    assert.equal(callCount, initialCalls, "Cache hit must not make additional network calls");
    assert.deepEqual(snap1, snap2);
  });
});
