import fs from "node:fs";
import path from "node:path";

interface Violation {
  file: string;
  category: string;
  message: string;
}

function runWebhookAudit() {
  console.log("=================================================");
  console.log("KLYVO SPRINT 4: STATIC WEBHOOK & RESILIENCE AUDIT");
  console.log("=================================================");

  const rootDir = path.resolve(__dirname, "..");
  const violations: Violation[] = [];

  const meliWebhookPath = path.join(rootDir, "src/app/api/meli/webhook/route.ts");
  const mpWebhookPath = path.join(rootDir, "src/app/api/mercadopago/webhook/route.ts");
  const waWebhookPath = path.join(rootDir, "src/app/api/whatsapp/webhook/route.ts");
  const meliClientPath = path.join(rootDir, "src/services/meli/client.ts");

  const files = [
    { name: "meli/webhook", path: meliWebhookPath },
    { name: "mercadopago/webhook", path: mpWebhookPath },
    { name: "whatsapp/webhook", path: waWebhookPath },
  ];

  for (const f of files) {
    if (!fs.existsSync(f.path)) {
      violations.push({
        file: f.path,
        category: "FILE_MISSING",
        message: `Webhook endpoint ${f.name} does not exist at ${f.path}`,
      });
      continue;
    }

    const content = fs.readFileSync(f.path, "utf-8");

    // Check payload size limit
    if (!content.includes("MAX_PAYLOAD_SIZE") && !content.includes(".length >")) {
      violations.push({
        file: f.path,
        category: "MISSING_PAYLOAD_SIZE_LIMIT",
        message: `Webhook ${f.name} does not enforce payload size limit before parsing.`,
      });
    }

    // Check idempotency claim
    if (!content.includes("claimWebhookEvent")) {
      violations.push({
        file: f.path,
        category: "MISSING_IDEMPOTENCY_CLAIM",
        message: `Webhook ${f.name} does not register or claim atomic idempotency via claimWebhookEvent.`,
      });
    }

    // Check Inngest dispatch
    if (!content.includes("inngest.send")) {
      violations.push({
        file: f.path,
        category: "MISSING_INNGEST_DISPATCH",
        message: `Webhook ${f.name} must enqueue events asynchronously via inngest.send.`,
      });
    }

    // Check fire-and-forget unhandled promises after response
    if (/processPromise\.catch|\.then\([^)]*\)\.catch\(\(\)\s*=>\s*\{\}\)/.test(content)) {
      violations.push({
        file: f.path,
        category: "FIRE_AND_FORGET_PROMISE",
        message: `Webhook ${f.name} contains unawaited background fire-and-forget promises.`,
      });
    }
  }

  // Mercado Libre specific checks
  if (fs.existsSync(meliWebhookPath)) {
    const content = fs.readFileSync(meliWebhookPath, "utf-8");
    if (content.includes("syncOrders(") || content.includes("syncProducts(") || content.includes("syncShipments(")) {
      violations.push({
        file: meliWebhookPath,
        category: "DIRECT_HEAVY_SYNC_IN_WEBHOOK",
        message: "Mercado Libre webhook must NOT invoke direct sync functions (syncOrders, syncProducts, syncShipments). Must dispatch to Inngest.",
      });
    }
  }

  // WhatsApp specific checks
  if (fs.existsSync(waWebhookPath)) {
    const content = fs.readFileSync(waWebhookPath, "utf-8");
    if (content.includes("runBusinessAgent(") || content.includes("transcribeAudio(")) {
      violations.push({
        file: waWebhookPath,
        category: "DIRECT_AI_EXECUTION_IN_WEBHOOK",
        message: "WhatsApp webhook must NOT run AI agent or transcription directly in webhook route. Must dispatch to Inngest.",
      });
    }
    if (/\.or\(`phone_number\.eq\./.test(content)) {
      violations.push({
        file: waWebhookPath,
        category: "RAW_FILTER_INTERPOLATION",
        message: "WhatsApp webhook must NOT construct dynamic .or() filter queries via unescaped string interpolation.",
      });
    }
  }

  // meliFetch client checks
  if (fs.existsSync(meliClientPath)) {
    const content = fs.readFileSync(meliClientPath, "utf-8");
    if (!content.includes("AbortSignal.timeout")) {
      violations.push({
        file: meliClientPath,
        category: "MISSING_TIMEOUT_PROTECTION",
        message: "meliFetch must enforce AbortSignal.timeout to prevent hung connections.",
      });
    }
    if (!content.includes("parseRetryAfter") && !content.includes("retry-after")) {
      violations.push({
        file: meliClientPath,
        category: "MISSING_RETRY_AFTER_SUPPORT",
        message: "meliFetch must safely parse and respect Retry-After header on 429 responses.",
      });
    }
  }

  console.log(`Total Webhook Routes Scanned: ${files.length}`);
  console.log(`Violations Detected:          ${violations.length}\n`);

  if (violations.length > 0) {
    console.error("❌ WEBHOOK AUDIT FAILED with the following violations:\n");
    for (const v of violations) {
      console.error(`- [${v.category}] ${v.file}: ${v.message}`);
    }
    process.exit(1);
  }

  console.log("✅ All webhook endpoints adhere to Sprint 4 lightweight, secure, and asynchronous standards.\n");
}

runWebhookAudit();
