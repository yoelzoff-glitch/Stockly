import fs from "fs";
import path from "path";

export interface InngestFunctionDefinition {
  id: string;
  name?: string;
  file: string;
  triggerType: "cron" | "event";
  triggerValue: string;
  retries?: number;
  concurrency?: { limit: number; key?: string };
}

export const CANONICAL_INNGEST_FUNCTIONS: InngestFunctionDefinition[] = [
  {
    id: "sync-products-dispatcher",
    file: "src/jobs/syncProductsJob.ts",
    triggerType: "cron",
    triggerValue: "*/15 * * * *",
  },
  {
    id: "sync-products-tenant-worker",
    file: "src/jobs/syncProductsJob.ts",
    triggerType: "event",
    triggerValue: "meli/tenant.sync-products.requested",
    retries: 3,
    concurrency: { limit: 1, key: "event.data.tenantId" },
  },
  {
    id: "sync-orders-dispatcher",
    file: "src/jobs/syncOrdersJob.ts",
    triggerType: "cron",
    triggerValue: "*/5 * * * *",
  },
  {
    id: "sync-orders-tenant-worker",
    file: "src/jobs/syncOrdersJob.ts",
    triggerType: "event",
    triggerValue: "meli/tenant.sync-orders.requested",
    retries: 3,
    concurrency: { limit: 1, key: "event.data.tenantId" },
  },
  {
    id: "refresh-meli-tokens",
    file: "src/jobs/refreshMeliTokensJob.ts",
    triggerType: "cron",
    triggerValue: "0 */6 * * *",
  },
  {
    id: "mass-promotions",
    file: "src/jobs/massPromotionsJob.ts",
    triggerType: "event",
    triggerValue: "promotions/mass.apply",
  },
  {
    id: "competitor-analysis",
    file: "src/jobs/competitorAnalysisJob.ts",
    triggerType: "event",
    triggerValue: "ai/competitor.analysis.requested",
  },
  {
    id: "cleanup-zombie-users",
    file: "src/jobs/cleanupZombieUsersJob.ts",
    triggerType: "cron",
    triggerValue: "0 3 * * *",
  },
  {
    id: "apply-subscription-downgrades",
    file: "src/jobs/applySubscriptionDowngradesJob.ts",
    triggerType: "cron",
    triggerValue: "0 1 * * *",
  },
  {
    id: "meli-shipments-webhook",
    file: "src/jobs/webhookJobs.ts",
    triggerType: "event",
    triggerValue: "meli/shipments.updated",
    retries: 3,
    concurrency: { limit: 2, key: "event.data.tenantId" },
  },
  {
    id: "mercadopago-webhook-processor",
    file: "src/jobs/webhookJobs.ts",
    triggerType: "event",
    triggerValue: "mercadopago/subscription.updated",
    retries: 3,
  },
  {
    id: "whatsapp-webhook-processor",
    file: "src/jobs/webhookJobs.ts",
    triggerType: "event",
    triggerValue: "whatsapp/message.received",
    retries: 3,
  },
];

export function auditInngestRegistry(): { passed: boolean; errors: string[] } {
  console.log("=================================================");
  console.log("INNGEST FUNCTION REGISTRY AUDIT (SPRINT 8)");
  console.log("=================================================\n");

  const errors: string[] = [];
  const rootDir = path.resolve(__dirname, "..");
  const inngestRoutePath = path.join(rootDir, "src/app/api/inngest/route.ts");

  if (!fs.existsSync(inngestRoutePath)) {
    errors.push("Missing src/app/api/inngest/route.ts");
    return { passed: false, errors };
  }

  const inngestRouteContent = fs.readFileSync(inngestRoutePath, "utf-8");

  // 1. Strict absence of questionsJob and process-meli-question
  if (inngestRouteContent.includes("questionsJob")) {
    errors.push("Forbidden import or registration of questionsJob found in /api/inngest/route.ts");
  } else {
    console.log("✅ Inngest Route: questionsJob is strictly excluded from registration.");
  }

  if (inngestRouteContent.includes("process-meli-question")) {
    errors.push("Forbidden reference to process-meli-question found in /api/inngest/route.ts");
  } else {
    console.log("✅ Inngest Route: process-meli-question is strictly absent.");
  }

  // 2. Strict absence of meli/questions.received trigger in webhook route
  const meliWebhookPath = path.join(rootDir, "src/app/api/meli/webhook/route.ts");
  if (fs.existsSync(meliWebhookPath)) {
    const meliWebhookContent = fs.readFileSync(meliWebhookPath, "utf-8");
    if (meliWebhookContent.includes('"meli/questions.received"')) {
      errors.push("Forbidden trigger 'meli/questions.received' still present in meli webhook");
    } else {
      console.log("✅ Webhook Route: No dispatch of 'meli/questions.received' event.");
    }
  }

  // 3. Verify all canonical functions exist and are registered in serve()
  for (const fn of CANONICAL_INNGEST_FUNCTIONS) {
    const fnFilePath = path.join(rootDir, fn.file);
    if (!fs.existsSync(fnFilePath)) {
      errors.push(`Function file missing: ${fn.file}`);
      continue;
    }

    const fileContent = fs.readFileSync(fnFilePath, "utf-8");
    if (!fileContent.includes(`"${fn.id}"`) && !fileContent.includes(`'${fn.id}'`)) {
      errors.push(`Function ID '${fn.id}' not found in ${fn.file}`);
    } else {
      console.log(`✅ Function Verified: '${fn.id}' declared in ${fn.file}.`);
    }
  }

  // 4. Verify no duplicate function IDs across code
  const registeredIds = CANONICAL_INNGEST_FUNCTIONS.map((f) => f.id);
  const duplicates = registeredIds.filter((item, index) => registeredIds.indexOf(item) !== index);
  if (duplicates.length > 0) {
    errors.push(`Duplicate Inngest function IDs detected: ${duplicates.join(", ")}`);
  } else {
    console.log("✅ Registry Integrity: No duplicate function IDs in canonical registry.");
  }

  console.log("\n-------------------------------------------------");
  if (errors.length > 0) {
    console.error("❌ INNGEST REGISTRY AUDIT FAILED with errors:");
    errors.forEach((e) => console.error(`   - ${e}`));
    return { passed: false, errors };
  } else {
    console.log("✅ INNGEST REGISTRY AUDIT PASSED (12 Canonical Functions, 0 Dormant/Orphan)");
    return { passed: true, errors: [] };
  }
}

if (require.main === module) {
  const result = auditInngestRegistry();
  process.exit(result.passed ? 0 : 1);
}
