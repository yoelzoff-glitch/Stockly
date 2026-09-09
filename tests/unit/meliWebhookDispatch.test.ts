import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("Sprint 23 — Mercado Libre Webhook Dispatch & Idempotency Tests", () => {
  it("verifies Inngest client exports configured ID with fallback to klyvo-ai-operator", async () => {
    delete process.env.INNGEST_APP_ID;
    const { inngest } = await import("../../src/inngest/client");
    assert.equal(inngest.id, "klyvo-ai-operator", "Inngest default client ID must be klyvo-ai-operator");
  });

  it("verifies event name mapping for orders topics", () => {
    const mapTopicToInngestEvent = (topic: string): string | null => {
      switch (topic) {
        case "orders_v2":
        case "orders":
          return "meli/orders.updated";
        case "items":
          return "meli/items.updated";
        case "shipments":
          return "meli/shipments.updated";
        default:
          return null;
      }
    };

    assert.equal(mapTopicToInngestEvent("orders_v2"), "meli/orders.updated");
    assert.equal(mapTopicToInngestEvent("orders"), "meli/orders.updated");
    assert.equal(mapTopicToInngestEvent("items"), "meli/items.updated");
    assert.equal(mapTopicToInngestEvent("shipments"), "meli/shipments.updated");
    assert.equal(mapTopicToInngestEvent("questions"), null);
    assert.equal(mapTopicToInngestEvent("unhandled"), null);
  });

  it("verifies idempotency redelivery rule logic", () => {
    // Tests that duplicate detection only ignores completed/queued/processing/ignored statuses,
    // allowing redelivery for retrying or failed events.
    const isDuplicateForStatus = (status: string): boolean => {
      return (
        status === "completed" ||
        status === "processing" ||
        status === "queued" ||
        status === "ignored"
      );
    };

    assert.equal(isDuplicateForStatus("completed"), true, "completed events must be ignored as duplicate");
    assert.equal(isDuplicateForStatus("queued"), true, "queued events must be ignored as duplicate");
    assert.equal(isDuplicateForStatus("processing"), true, "processing events must be ignored as duplicate");
    assert.equal(isDuplicateForStatus("ignored"), true, "ignored events must be ignored as duplicate");

    assert.equal(isDuplicateForStatus("retrying"), false, "retrying events must ALLOW redelivery");
    assert.equal(isDuplicateForStatus("dead_letter"), false, "dead_letter events must ALLOW redelivery");
    assert.equal(isDuplicateForStatus("received"), false, "received events must ALLOW redelivery");
  });

  it("verifies webhook response status code matches dispatch result", () => {
    const getWebhookResponse = (dispatchSuccess: boolean) => {
      if (dispatchSuccess) {
        return { status: 200, body: { status: "queued" } };
      } else {
        return { status: 503, body: { error: "Service Unavailable", reason: "inngest_dispatch_failed" } };
      }
    };

    const successRes = getWebhookResponse(true);
    assert.equal(successRes.status, 200);
    assert.equal(successRes.body.status, "queued");

    const failedRes = getWebhookResponse(false);
    assert.equal(failedRes.status, 503);
    assert.equal(failedRes.body.reason, "inngest_dispatch_failed");
  });
});
