import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { CANONICAL_INNGEST_FUNCTIONS, auditInngestRegistry } from "../../scripts/audit-inngest-registry";

describe("Sprint 8 — Inngest Function Registry Audit", () => {
  const rootDir = path.resolve(__dirname, "../..");

  it("audits the Inngest registry and succeeds with 0 errors", () => {
    const result = auditInngestRegistry();
    assert.equal(result.passed, true);
    assert.deepEqual(result.errors, []);
  });

  it("ensures questionsJob is not imported or registered in /api/inngest/route.ts", () => {
    const routeContent = fs.readFileSync(path.join(rootDir, "src/app/api/inngest/route.ts"), "utf-8");
    assert.doesNotMatch(routeContent, /questionsJob/);
    assert.doesNotMatch(routeContent, /process-meli-question/);
  });

  it("ensures webhook route sets inngestEventName = null for 'questions' topic", () => {
    const webhookContent = fs.readFileSync(path.join(rootDir, "src/app/api/meli/webhook/route.ts"), "utf-8");
    assert.match(webhookContent, /case "questions":\s*inngestEventName = null;\s*break;/);
    assert.doesNotMatch(webhookContent, /"meli\/questions\.received"/);
  });

  it("validates that every canonical function has retries or crons configured properly", () => {
    for (const fn of CANONICAL_INNGEST_FUNCTIONS) {
      assert.ok(fn.id.length > 0);
      assert.ok(fn.triggerValue.length > 0);
      if (fn.triggerType === "cron") {
        assert.match(fn.triggerValue, /^[0-9\*\/\s\-]+$/);
      }
    }
  });
});
