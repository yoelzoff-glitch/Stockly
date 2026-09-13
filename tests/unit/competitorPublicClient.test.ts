import test, { describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { meliPublicFetch } from "../../src/services/meli/competitor/publicClient";

describe("Sprint: Competitor Public Client Unit Tests", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test("handles 200 OK and parses JSON payload cleanly", async () => {
    global.fetch = async (url: any, options: any) => {
      // Assert no Authorization header
      assert.equal(options?.headers?.Authorization, undefined);
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: "MLA12345", title: "Producto Test", price: 5000 }),
      } as any;
    };

    const res = await meliPublicFetch("/items/MLA12345");
    assert.equal(res.ok, true);
    assert.equal(res.status, 200);
    assert.equal(res.data?.id, "MLA12345");
    assert.equal(res.data?.price, 5000);
  });

  test("returns safe typed result on 403 Forbidden without throwing", async () => {
    global.fetch = async () => {
      return {
        ok: false,
        status: 403,
        statusText: "Forbidden",
        json: async () => ({ message: "Access to the requested resource is forbidden", error: "forbidden", status: 403 }),
      } as any;
    };

    const res = await meliPublicFetch("/items/MLA3724535440");
    assert.equal(res.ok, false);
    assert.equal(res.status, 403);
    assert.match(res.error || "", /forbidden/i);
  });

  test("returns safe typed result on 404 Not Found without throwing", async () => {
    global.fetch = async () => {
      return {
        ok: false,
        status: 404,
        statusText: "Not Found",
        json: async () => ({ message: "Item not found" }),
      } as any;
    };

    const res = await meliPublicFetch("/items/MLA0000000000");
    assert.equal(res.ok, false);
    assert.equal(res.status, 404);
    assert.match(res.error || "", /not found/i);
  });

  test("returns safe typed result on 429 Rate Limited", async () => {
    global.fetch = async () => {
      return {
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
        json: async () => ({ message: "Too many requests" }),
      } as any;
    };

    const res = await meliPublicFetch("/items/MLA123");
    assert.equal(res.ok, false);
    assert.equal(res.status, 429);
  });

  test("handles fetch timeout and returns status 408", async () => {
    global.fetch = async () => {
      const err = new Error("The operation was aborted");
      err.name = "TimeoutError";
      throw err;
    };

    const res = await meliPublicFetch("/items/MLA123", { timeoutMs: 100 });
    assert.equal(res.ok, false);
    assert.equal(res.status, 408);
    assert.match(res.error || "", /timed out/i);
  });
});
