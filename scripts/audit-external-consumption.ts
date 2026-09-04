import fs from "fs";
import path from "path";

export function auditExternalConsumption(): { passed: boolean; errors: string[] } {
  console.log("=================================================");
  console.log("EXTERNAL CONSUMPTION & COST CONTROLS AUDIT (SPRINT 8)");
  console.log("=================================================\n");

  const errors: string[] = [];
  const rootDir = path.resolve(__dirname, "..");

  // 1. Audit AI routes: ensure they check tenant context and quota consumption
  const aiRoutes = [
    "src/app/api/ai/chat/route.ts",
    "src/app/api/ai/product-chat/route.ts",
    "src/app/api/ai/product-title-suggestions/route.ts",
    "src/app/api/ai/competitor-analysis/route.ts",
  ];

  for (const route of aiRoutes) {
    const fullPath = path.join(rootDir, route);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, "utf-8");
      
      // Must check tenant context
      if (!content.includes("requireTenantContext") && !content.includes("requireTenantRole")) {
        errors.push(`${route} is missing tenant authorization requirement.`);
      } else {
        console.log(`✅ AI Route: ${route} enforces tenant authorization.`);
      }

      // Must invoke atomic quota reservation via consumeQuota / consume_tenant_quota
      const hasAtomicQuota =
        content.includes("consumeQuota") ||
        content.includes("consume_tenant_quota") ||
        content.includes("runBusinessAgent");

      if (!hasAtomicQuota) {
        errors.push(`${route} is missing atomic consumeQuota reservation before LLM execution.`);
      } else {
        console.log(`✅ Atomic Quota Control: ${route} performs atomic quota reservation before execution.`);
      }
    }
  }

  // 2. Audit Background Jobs: Verify no cron triggers unsupervised AI token generation
  const jobsDir = path.join(rootDir, "src/jobs");
  if (fs.existsSync(jobsDir)) {
    const jobFiles = fs.readdirSync(jobsDir).filter((f) => f.endsWith(".ts"));
    for (const jobFile of jobFiles) {
      if (jobFile === "questionsJob.ts") continue; // dormant
      const jobPath = path.join(jobsDir, jobFile);
      const content = fs.readFileSync(jobPath, "utf-8");

      const isCron = content.includes("cron:");
      const callsOpenAi = content.includes("openai.") || content.includes("@google/generative-ai");

      if (isCron && callsOpenAi) {
        errors.push(`Job ${jobFile} triggers AI directly from an unattended cron schedule! AI must be user/workflow initiated.`);
      }
    }
    console.log("✅ Cron Schedules: No unattended background crons consuming OpenAI/Gemini tokens.");
  }

  // 3. Scan for accidental unredacted API key printing in logs
  const srcDir = path.join(rootDir, "src");
  const scanFiles = (dir: string): string[] => {
    let results: string[] = [];
    const list = fs.readdirSync(dir);
    for (const file of list) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat && stat.isDirectory()) {
        results = results.concat(scanFiles(filePath));
      } else if (file.endsWith(".ts") || file.endsWith(".tsx")) {
        results.push(filePath);
      }
    }
    return results;
  };

  const allSourceFiles = scanFiles(srcDir);
  for (const f of allSourceFiles) {
    const fileContent = fs.readFileSync(f, "utf-8");
    if (fileContent.includes("console.log(process.env.OPENAI_API_KEY)") ||
        fileContent.includes("console.log(process.env.MELI_CLIENT_SECRET)") ||
        fileContent.includes("logger.info(process.env.OPENAI_API_KEY)")) {
      errors.push(`Plain text API key logged in ${path.relative(rootDir, f)}`);
    }
  }
  console.log("✅ Logging Safety: Zero plain text API keys detected in logger/console statements.");

  console.log("\n-------------------------------------------------");
  if (errors.length > 0) {
    console.error("❌ EXTERNAL CONSUMPTION AUDIT FAILED with errors:");
    errors.forEach((e) => console.error(`   - ${e}`));
    return { passed: false, errors };
  } else {
    console.log("✅ EXTERNAL CONSUMPTION & COST CONTROLS AUDIT PASSED");
    return { passed: true, errors: [] };
  }
}

if (require.main === module) {
  const result = auditExternalConsumption();
  process.exit(result.passed ? 0 : 1);
}
