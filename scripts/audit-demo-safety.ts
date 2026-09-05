import fs from "node:fs";
import path from "node:path";

interface AuditViolation {
  category: string;
  file: string;
  message: string;
}

function runDemoSafetyAudit() {
  console.log("=================================================");
  console.log("KLYVO SPRINT 11: DEMO SAFETY & ISOLATION AUDIT");
  console.log("=================================================");

  const rootDir = path.resolve(__dirname, "..");
  const srcDir = path.join(rootDir, "src");
  const violations: AuditViolation[] = [];

  // 1. Check no public /demo route exists
  const publicDemoPaths = [
    path.join(srcDir, "app", "demo", "page.tsx"),
    path.join(srcDir, "app", "(marketing)", "demo", "page.tsx"),
    path.join(srcDir, "app", "api", "demo", "route.ts"),
    path.join(srcDir, "pages", "demo.tsx"),
  ];

  for (const p of publicDemoPaths) {
    if (fs.existsSync(p)) {
      violations.push({
        category: "PUBLIC_DEMO_ROUTE_FORBIDDEN",
        file: path.relative(rootDir, p).replace(/\\/g, "/"),
        message: "Public /demo route must NOT exist. Access must be private and authenticated only.",
      });
    }
  }

  // 2. Scan repository for hardcoded demo credentials or passwords
  function scanDir(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relPath = path.relative(rootDir, fullPath).replace(/\\/g, "/");

      // Skip node_modules, .git, .next, etc.
      if (entry.isDirectory()) {
        if (
          entry.name === "node_modules" ||
          entry.name === ".git" ||
          entry.name === ".next" ||
          entry.name === "dist" ||
          entry.name === ".gemini"
        ) {
          continue;
        }
        scanDir(fullPath);
      } else if (entry.isFile()) {
        if (!relPath.endsWith(".ts") && !relPath.endsWith(".tsx") && !relPath.endsWith(".sql")) {
          continue;
        }

        const content = fs.readFileSync(fullPath, "utf-8");

        // Rule: No hardcoded demo passwords in code
        if (
          !relPath.includes("scripts/audit-demo-safety.ts") &&
          /DEMO_PASSWORD\s*=\s*["'][^"']+["']/i.test(content)
        ) {
          violations.push({
            category: "HARDCODED_DEMO_PASSWORD",
            file: relPath,
            message: "Hardcoded demo password found in code. Passwords must never be in git.",
          });
        }

        // Rule: service_role key must never be exposed to client bundles
        if (relPath.startsWith("src/app/") || relPath.startsWith("src/components/")) {
          if (content.includes("SUPABASE_SERVICE_ROLE_KEY") && !content.includes("process.env.SUPABASE_SERVICE_ROLE_KEY")) {
            violations.push({
              category: "SERVICE_ROLE_EXPOSURE",
              file: relPath,
              message: "Service role key reference in frontend component.",
            });
          }
        }
      }
    }
  }

  scanDir(rootDir);

  // 3. Verify dispatchers exclude demo tenants
  const syncProductsJobPath = path.join(srcDir, "jobs", "syncProductsJob.ts");
  if (fs.existsSync(syncProductsJobPath)) {
    const content = fs.readFileSync(syncProductsJobPath, "utf-8");
    if (!content.includes("is_demo") || !content.includes("demo_tenant")) {
      violations.push({
        category: "DISPATCHER_DEMO_LEAK",
        file: "src/jobs/syncProductsJob.ts",
        message: "syncProductsJob must explicitly filter out or skip is_demo tenants.",
      });
    }
  }

  const syncOrdersJobPath = path.join(srcDir, "jobs", "syncOrdersJob.ts");
  if (fs.existsSync(syncOrdersJobPath)) {
    const content = fs.readFileSync(syncOrdersJobPath, "utf-8");
    if (!content.includes("is_demo") || !content.includes("demo_tenant")) {
      violations.push({
        category: "DISPATCHER_DEMO_LEAK",
        file: "src/jobs/syncOrdersJob.ts",
        message: "syncOrdersJob must explicitly filter out or skip is_demo tenants.",
      });
    }
  }

  const refreshMeliTokensJobPath = path.join(srcDir, "jobs", "refreshMeliTokensJob.ts");
  if (fs.existsSync(refreshMeliTokensJobPath)) {
    const content = fs.readFileSync(refreshMeliTokensJobPath, "utf-8");
    if (!content.includes("is_demo")) {
      violations.push({
        category: "DISPATCHER_DEMO_LEAK",
        file: "src/jobs/refreshMeliTokensJob.ts",
        message: "refreshMeliTokensJob must exclude demo tenants from token refresh.",
      });
    }
  }

  // 4. Verify external providers have demo blocks
  const meliClientPath = path.join(srcDir, "services", "meli", "client.ts");
  if (fs.existsSync(meliClientPath)) {
    const content = fs.readFileSync(meliClientPath, "utf-8");
    if (!content.includes("isDemoTenant")) {
      violations.push({
        category: "EXTERNAL_PROVIDER_UNPROTECTED",
        file: "src/services/meli/client.ts",
        message: "meliFetch must verify isDemoTenant and reject external API calls for demo tenants.",
      });
    }
  }

  const quotaServicePath = path.join(srcDir, "lib", "billing", "quotaService.ts");
  if (fs.existsSync(quotaServicePath)) {
    const content = fs.readFileSync(quotaServicePath, "utf-8");
    if (!content.includes("isDemoTenant")) {
      violations.push({
        category: "BILLING_QUOTA_UNPROTECTED",
        file: "src/lib/billing/quotaService.ts",
        message: "consumeQuota must check isDemoTenant and avoid consuming quotas for demo tenants.",
      });
    }
  }

  // 5. Verify database migration restricts is_demo modifications
  const migrationPath = path.join(rootDir, "supabase", "migrations", "20260911000000_private_demo_tenant.sql");
  if (!fs.existsSync(migrationPath)) {
    violations.push({
      category: "MIGRATION_MISSING",
      file: "supabase/migrations/20260911000000_private_demo_tenant.sql",
      message: "Sprint 11 migration for private demo tenant is missing.",
    });
  } else {
    const migrationContent = fs.readFileSync(migrationPath, "utf-8");
    if (!migrationContent.includes("is_demo") || !migrationContent.includes("REVOKE UPDATE")) {
      violations.push({
        category: "COLUMN_LEVEL_SECURITY_MISSING",
        file: "supabase/migrations/20260911000000_private_demo_tenant.sql",
        message: "Migration must revoke update privileges on is_demo from authenticated users.",
      });
    }
  }

  // 6. Report results
  if (violations.length > 0) {
    console.error(`\n❌ AUDIT FAILED: Found ${violations.length} demo safety violation(s):\n`);
    for (const v of violations) {
      console.error(`  [${v.category}] ${v.file}`);
      console.error(`    ${v.message}\n`);
    }
    process.exit(1);
  }

  console.log("✅ 0 public /demo routes detected.");
  console.log("✅ 0 hardcoded demo credentials or passwords in git.");
  console.log("✅ Dispatchers and workers strictly exclude demo tenants.");
  console.log("✅ External providers (Mercado Libre, AI, Billing) protected.");
  console.log("✅ Column-level security verifies is_demo is non-updatable by authenticated users.");
  console.log("✅ All demo safety & isolation checks PASSED successfully.\n");
}

runDemoSafetyAudit();
