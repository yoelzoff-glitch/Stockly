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
    test(`${ep.name} strictly requires tenant context/role and asserts requested tenant`, () => {
      const content = fs.readFileSync(path.join(rootDir, ep.file), "utf-8");

      const hasAuth =
        content.includes("requireTenantContext(") ||
        content.includes("requireTenantRole(");

      assert.ok(
        hasAuth,
        `${ep.file} must invoke requireTenantContext() or requireTenantRole()`
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

  test("Sales CSV Export functional schema matches 58211d3 baseline exactly", async () => {
    const routeContent = fs.readFileSync(path.join(rootDir, "src/app/api/sales/export/route.ts"), "utf-8");
    const { serializeSalesExportCsv, SALES_CSV_HEADERS } = await import("../../src/lib/export/salesCsvSerializer");

    assert.ok(
      routeContent.includes("serializeSalesExportCsv("),
      "Sales export route must invoke serializeSalesExportCsv"
    );
    assert.deepEqual(
      SALES_CSV_HEADERS,
      ["Fecha", "Nº Orden", "Comprador", "Producto", "Cantidad", "Total (ARS)", "Estado"],
      "Sales export CSV must retain exact 58211d3 headers in exact order"
    );
    assert.ok(
      routeContent.includes("klyvo_ventas_"),
      "Sales export CSV filename must start with klyvo_ventas_"
    );
  });

  test("Exempt routes do not accidentally include session requirements", () => {
    const healthLive = fs.readFileSync(path.join(rootDir, "src/app/api/health/live/route.ts"), "utf-8");
    const healthReady = fs.readFileSync(path.join(rootDir, "src/app/api/health/ready/route.ts"), "utf-8");
    const meliWebhook = fs.readFileSync(path.join(rootDir, "src/app/api/meli/webhook/route.ts"), "utf-8");
    const mpWebhook = fs.readFileSync(path.join(rootDir, "src/app/api/mercadopago/webhook/route.ts"), "utf-8");

    assert.ok(!healthLive.includes("requireTenantContext"), "health/live must remain public");
    assert.ok(!healthReady.includes("requireTenantContext"), "health/ready uses HEALTHCHECK_TOKEN");
    assert.ok(!meliWebhook.includes("requireTenantContext"), "meli webhook is external");
    assert.ok(!mpWebhook.includes("requireTenantContext"), "mp webhook is external");
  });

  test("Mercado Libre questions worker is fully deactivated in Inngest and Webhook", () => {
    const inngestRoute = fs.readFileSync(path.join(rootDir, "src/app/api/inngest/route.ts"), "utf-8");
    const meliWebhook = fs.readFileSync(path.join(rootDir, "src/app/api/meli/webhook/route.ts"), "utf-8");

    // 1. /api/inngest/route.ts must NOT contain questionsJob
    assert.ok(
      !inngestRoute.includes("questionsJob"),
      "/api/inngest/route.ts must not import or register questionsJob"
    );

    // 2. Webhook explicitly handles case "questions"
    assert.ok(
      meliWebhook.includes('case "questions":'),
      'src/app/api/meli/webhook/route.ts must explicitly handle case "questions":'
    );

    // 3. Must not assign inngestEventName = "meli/questions.received"
    assert.ok(
      !meliWebhook.includes('"meli/questions.received"'),
      'src/app/api/meli/webhook/route.ts must not assign inngestEventName = "meli/questions.received"'
    );
  });
});
