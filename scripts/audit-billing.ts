import fs from "node:fs";
import path from "node:path";

interface Violation {
  file: string;
  category: string;
  message: string;
}

function runBillingAudit() {
  console.log("=================================================");
  console.log("KLYVO SPRINT 5: BILLING INTEGRITY & QUOTA AUDIT");
  console.log("=================================================");

  const rootDir = path.resolve(__dirname, "..");
  const srcDir = path.join(rootDir, "src");
  const pkgJsonPath = path.join(rootDir, "package.json");
  const violations: Violation[] = [];

  // 1. Verify package.json scripts
  const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, "utf-8"));
  if (!pkg.scripts?.["verify:sprint5"]?.includes("test:billing:integration")) {
    violations.push({
      file: "package.json",
      category: "RELEASE_GATE_MISSING_INTEGRATION_TEST",
      message: "package.json 'verify:sprint5' script MUST execute 'npm run test:billing:integration' as a mandatory pre-deploy gate.",
    });
  }

  // 2. Scan src/ for billing anti-patterns
  function scanDir(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(fullPath);
      } else if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))) {
        const content = fs.readFileSync(fullPath, "utf-8");
        const relPath = path.relative(rootDir, fullPath).replace(/\\/g, "/");

        // Anti-pattern 1: user_metadata for plan/authorization determination
        if (
          !relPath.includes("tests/") &&
          /user_metadata\.(?:plan|payment_status|role)/i.test(content) &&
          !relPath.includes("onboarding")
        ) {
          violations.push({
            file: relPath,
            category: "USER_METADATA_AUTHORIZATION_LEAK",
            message: "user_metadata must NOT be used for plan or authorization determination. Use subscriptions as single source of truth.",
          });
        }

        // Anti-pattern 2: Direct un-atomic update on subscription_usage (outside migrations / SQL RPC)
        if (
          !relPath.includes("tests/") &&
          relPath !== "src/lib/billing/quotaService.ts" &&
          relPath !== "src/services/billing/checkLimits.ts" &&
          /\.from\(["']subscription_usage["']\)\.update\(/i.test(content)
        ) {
          violations.push({
            file: relPath,
            category: "DIRECT_USAGE_UPDATE_PROHIBITED",
            message: "Direct update on subscription_usage is prohibited. Use atomic consumeQuota / consume_tenant_quota RPC.",
          });
        }
      }
    }
  }

  scanDir(srcDir);

  console.log(`Total Violations Detected: ${violations.length}\n`);

  if (violations.length > 0) {
    console.error("❌ BILLING AUDIT FAILED with the following violations:\n");
    for (const v of violations) {
      console.error(`- [${v.category}] ${v.file}: ${v.message}`);
    }
    process.exit(1);
  }

  console.log("✅ All files adhere to Sprint 5 atomic billing & entitlement integrity standards.\n");
}

runBillingAudit();
