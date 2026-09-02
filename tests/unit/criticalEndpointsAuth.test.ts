import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Critical Endpoints Static & Integration Verification", () => {
  const rootDir = path.resolve(__dirname, "../..");

  const criticalEndpoints = [
    {
      name: "POST /api/ai/actions/confirm",
      file: "src/app/api/ai/actions/confirm/route.ts",
    },
    {
      name: "POST /api/ai/actions/cancel",
      file: "src/app/api/ai/actions/cancel/route.ts",
    },
    {
      name: "POST /api/pricing/simulate",
      file: "src/app/api/pricing/simulate/route.ts",
    },
    {
      name: "POST /api/pricing/create-workflow",
      file: "src/app/api/pricing/create-workflow/route.ts",
    },
  ];

  for (const ep of criticalEndpoints) {
    test(`${ep.name} strictly requires tenant context and asserts requested tenant`, () => {
      const content = fs.readFileSync(path.join(rootDir, ep.file), "utf-8");

      assert.ok(
        content.includes("requireTenantContext("),
        `${ep.file} must invoke requireTenantContext()`
      );
      assert.ok(
        content.includes("assertRequestedTenant("),
        `${ep.file} must invoke assertRequestedTenant()`
      );
      assert.ok(
        !content.includes("supabase.auth.getSession("),
        `${ep.file} must NOT use getSession()`
      );
    });
  }

  test("Exempt routes do not accidentally include session requirements", () => {
    const healthLive = fs.readFileSync(path.join(rootDir, "src/app/api/health/live/route.ts"), "utf-8");
    const healthReady = fs.readFileSync(path.join(rootDir, "src/app/api/health/ready/route.ts"), "utf-8");
    const meliWebhook = fs.readFileSync(path.join(rootDir, "src/app/api/meli/webhook/route.ts"), "utf-8");
    const mpWebhook = fs.readFileSync(path.join(rootDir, "src/app/api/mercadopago/webhook/route.ts"), "utf-8");

    assert.ok(!healthLive.includes("requireTenantContext"), "health/live must remain public");
    assert.ok(!healthReady.includes("requireTenantContext"), "health/ready uses HEALTHCHECK_TOKEN");
    assert.ok(!meliWebhook.includes("requireTenantContext"), "meli webhook uses external HMAC");
    assert.ok(!mpWebhook.includes("requireTenantContext"), "mp webhook uses secret");
  });
});
