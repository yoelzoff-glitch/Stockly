import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { meliFetch } from "../../src/services/meli/client";

describe("Sprint 4: meliFetch Resilience & Safety Unit Tests", () => {
  test("throws validation error if neither tenantId nor meliAccountId is provided", async () => {
    await assert.rejects(
      async () => {
        await meliFetch({ endpoint: "/users/me" });
      },
      (err: any) => {
        assert.equal(err.name, "AppError");
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /requires either tenantId or meliAccountId/i);
        return true;
      }
    );
  });

  test("blocks write operations when KLYVO_DISABLE_MELI_WRITES is true", async () => {
    const originalEnv = process.env.KLYVO_DISABLE_MELI_WRITES;
    process.env.KLYVO_DISABLE_MELI_WRITES = "true";
    try {
      await assert.rejects(
        async () => {
          await meliFetch({
            tenantId: "00000000-0000-0000-0000-000000000001",
            endpoint: "/items/MLA123",
            method: "PUT",
            body: { price: 1000 },
          });
        },
        (err: any) => {
          assert.equal(err.name, "AppError");
          assert.equal(err.statusCode, 403);
          assert.equal(err.code, "OPERATION_BLOCKED");
          return true;
        }
      );
    } finally {
      process.env.KLYVO_DISABLE_MELI_WRITES = originalEnv;
    }
  });
});
