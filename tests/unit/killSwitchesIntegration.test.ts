import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Kill Switches Static Integration Checks", () => {
  const rootDir = path.resolve(__dirname, "../..");

  test("KLYVO_DISABLE_MANUAL_SYNCS is integrated in manual sync routes", () => {
    const productsRoute = fs.readFileSync(
      path.join(rootDir, "src/app/api/meli/sync-products/route.ts"),
      "utf-8"
    );
    const ordersRoute = fs.readFileSync(
      path.join(rootDir, "src/app/api/meli/sync-orders/route.ts"),
      "utf-8"
    );

    assert.ok(
      productsRoute.includes("isManualSyncDisabled()"),
      "sync-products route must check isManualSyncDisabled()"
    );
    assert.ok(
      ordersRoute.includes("isManualSyncDisabled()"),
      "sync-orders route must check isManualSyncDisabled()"
    );
  });

  test("KLYVO_DISABLE_AI_WRITES is integrated in AI action confirmation & workflow creation", () => {
    const confirmAction = fs.readFileSync(
      path.join(rootDir, "src/services/ai/actions/confirm.ts"),
      "utf-8"
    );
    const priceAdjustmentWorkflow = fs.readFileSync(
      path.join(rootDir, "src/services/pricing/createPriceAdjustmentWorkflow.ts"),
      "utf-8"
    );

    assert.ok(
      confirmAction.includes("isAiWritesDisabled()"),
      "confirmPendingAction must check isAiWritesDisabled()"
    );
    assert.ok(
      priceAdjustmentWorkflow.includes("isAiWritesDisabled()"),
      "createPriceAdjustmentWorkflow must check isAiWritesDisabled()"
    );
  });

  test("KLYVO_DISABLE_MELI_WRITES is integrated in meliFetch remote writes boundary", () => {
    const meliClient = fs.readFileSync(
      path.join(rootDir, "src/services/meli/client.ts"),
      "utf-8"
    );

    assert.ok(
      meliClient.includes("isMeliWritesDisabled()"),
      "meliFetch must check isMeliWritesDisabled() for write operations"
    );
    assert.ok(
      meliClient.includes('method !== "GET"'),
      "meliFetch must protect all non-GET methods"
    );
  });

  test("KLYVO_DISABLE_WHATSAPP_AGENT is integrated in whatsapp webhook before AI agent execution", () => {
    const waWebhook = fs.readFileSync(
      path.join(rootDir, "src/app/api/whatsapp/webhook/route.ts"),
      "utf-8"
    );

    assert.ok(
      waWebhook.includes("isWhatsappAgentDisabled()"),
      "whatsapp webhook must check isWhatsappAgentDisabled()"
    );
    const killSwitchIndex = waWebhook.indexOf("isWhatsappAgentDisabled()");
    const agentIndex = waWebhook.indexOf("runBusinessAgent(");

    assert.ok(
      killSwitchIndex < agentIndex,
      "isWhatsappAgentDisabled check must occur BEFORE runBusinessAgent is executed"
    );
  });
});
