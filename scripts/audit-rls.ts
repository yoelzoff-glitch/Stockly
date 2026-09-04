import fs from "node:fs";
import path from "node:path";

interface Violation {
  file: string;
  category: string;
  message: string;
}

function runRlsAudit() {
  console.log("=================================================");
  console.log("KLYVO SPRINT 3.5: EXACT CANONICAL SCHEMA & RLS AUDIT");
  console.log("=================================================");

  const rootDir = path.resolve(__dirname, "..");
  const migrationsDir = path.join(rootDir, "supabase/migrations");
  const fixturesDir = path.join(rootDir, "tests/fixtures");
  const srcDir = path.join(rootDir, "src");
  const pkgJsonPath = path.join(rootDir, "package.json");

  const violations: Violation[] = [];

  // 0. Verify package.json release gate scripts
  const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, "utf-8"));
  if (!pkg.scripts?.["verify:sprint3"]?.includes("test:rls:integration")) {
    violations.push({
      file: "package.json",
      category: "RELEASE_GATE_MISSING_INTEGRATION_TEST",
      message: "package.json 'verify:sprint3' script MUST execute 'npm run test:rls:integration' as a mandatory pre-deploy gate.",
    });
  }

  if (!fs.existsSync(migrationsDir)) {
    console.error("Migrations directory not found.");
    process.exit(1);
  }

  const migrationFiles = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .map((f) => ({
      name: f,
      content: fs.readFileSync(path.join(migrationsDir, f), "utf-8"),
    }));

  const allSqlContent = migrationFiles.map((m) => m.content).join("\n\n");

  // 1. Check that NO invalid 'CREATE OR REPLACE POLICY' is used
  if (/CREATE\s+OR\s+REPLACE\s+POLICY/i.test(allSqlContent)) {
    violations.push({
      file: "supabase/migrations/*",
      category: "INVALID_POLICY_SYNTAX",
      message: "PostgreSQL does NOT support 'CREATE OR REPLACE POLICY'. Use DROP POLICY IF EXISTS + CREATE POLICY or ALTER POLICY.",
    });
  }

  // 2. Check that NO rollback file is located inside supabase/migrations
  for (const m of migrationFiles) {
    if (/rollback/i.test(m.name)) {
      violations.push({
        file: `supabase/migrations/${m.name}`,
        category: "ROLLBACK_IN_MIGRATIONS",
        message: "Emergency rollback scripts must NOT reside in supabase/migrations/ where they could be auto-executed by supabase db push.",
      });
    }
  }

  // 3. Check for specific nonexistent canonical columns:
  // - coupons.meli_account_id
  // - meli_accounts.seller_id
  // - whatsapp_numbers.display_name
  if (/coupons\s*\.\s*meli_account_id/i.test(allSqlContent) || /coupons[^\(]*\([^)]*meli_account_id/i.test(allSqlContent)) {
    violations.push({
      file: "supabase/migrations/*",
      category: "NONEXISTENT_CANONICAL_COLUMN",
      message: "Table 'coupons' does NOT have column 'meli_account_id'. Use 'tenant_id' for direct isolation.",
    });
  }

  if (/meli_accounts[^\(]*\([^)]*seller_id/i.test(allSqlContent)) {
    violations.push({
      file: "supabase/migrations/20260903000002_sprint03_c_activation_and_hardening.sql",
      category: "NONEXISTENT_CANONICAL_COLUMN",
      message: "Table 'meli_accounts' does NOT have column 'seller_id'. Use 'meli_user_id' instead.",
    });
  }

  if (/whatsapp_numbers[^\(]*\([^)]*display_name/i.test(allSqlContent)) {
    violations.push({
      file: "supabase/migrations/20260903000002_sprint03_c_activation_and_hardening.sql",
      category: "NONEXISTENT_CANONICAL_COLUMN",
      message: "Table 'whatsapp_numbers' does NOT have column 'display_name'.",
    });
  }

  // Check that single joint mega loop is NOT used in Migration C
  const sprint3CMigration = migrationFiles.find((m) => m.name.includes("sprint03_c_activation"))?.content || "";
  if (/batch_1\s*\|\|\s*batch_2/i.test(sprint3CMigration)) {
    violations.push({
      file: "supabase/migrations/20260903000002_sprint03_c_activation_and_hardening.sql",
      category: "SINGLE_JOINT_MEGA_LOOP_ACTIVATION",
      message: "Migration C must NOT activate all batches in a single joint loop (batch_1 || batch_2...). Use independent per-lote executions.",
    });
  }

  // 4. Check that SECURITY DEFINER functions use strictly SET search_path = ''
  const securityDefinerRegex = /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+([a-zA-Z0-9_\.]+)\s*\([^)]*\)[\s\S]*?SECURITY\s+DEFINER[\s\S]*?AS\s+\$\$/gi;
  let match: RegExpExecArray | null;
  while ((match = securityDefinerRegex.exec(allSqlContent)) !== null) {
    const fnBlock = match[0];
    if (/SET\s+search_path\s*=\s*['"]?(?:public|pg_temp)/i.test(fnBlock) || !fnBlock.includes("SET search_path = ''")) {
      violations.push({
        file: "supabase/migrations/20260903000000_sprint03_a_foundations.sql",
        category: "INSECURE_SEARCH_PATH",
        message: `SECURITY DEFINER function ${match[1]} must use strictly SET search_path = '' without public or pg_temp.`,
      });
    }
  }

  // 5. Check for column protection on profiles
  const hasProfilesUpdateRevoke = /REVOKE\s+UPDATE\s+ON\s+public\.profiles\s+FROM\s+authenticated/i.test(allSqlContent);
  const hasProfilesColumnGrant = /GRANT\s+UPDATE\s+\(full_name,\s*avatar_url,\s*updated_at\)\s+ON\s+public\.profiles\s+TO\s+authenticated/i.test(allSqlContent);

  if (!hasProfilesUpdateRevoke || !hasProfilesColumnGrant) {
    violations.push({
      file: "supabase/migrations/20260903000002_sprint03_c_activation_and_hardening.sql",
      category: "PROFILES_PRIVILEGE_ESCALATION",
      message: "Profiles table must strictly revoke general UPDATE and grant only safe columns (full_name, avatar_url, updated_at).",
    });
  }

  // 6. Check that tenants.metadata is NOT broadly granted for UPDATE
  if (/GRANT\s+UPDATE\s+\([^)]*metadata[^)]*\)\s+ON\s+public\.tenants\s+TO\s+authenticated/i.test(allSqlContent)) {
    violations.push({
      file: "supabase/migrations/20260903000002_sprint03_c_activation_and_hardening.sql",
      category: "TENANTS_METADATA_EXPOSURE",
      message: "tenants.metadata must NOT be granted for raw direct UPDATE to authenticated.",
    });
  }

  // 7. Check for token protection on meli_accounts and whatsapp_numbers
  const hasMeliTokenRevoke = /REVOKE\s+SELECT\s+ON\s+public\.meli_accounts\s+FROM\s+authenticated/i.test(allSqlContent);
  const hasMeliSafeGrant = /GRANT\s+SELECT\s+\(id,\s*tenant_id,\s*meli_user_id/i.test(allSqlContent);
  const hasWhatsappTokenRevoke = /REVOKE\s+SELECT\s+ON\s+public\.whatsapp_numbers\s+FROM\s+authenticated/i.test(allSqlContent);
  const hasWhatsappSafeGrant = /GRANT\s+SELECT\s+\(id,\s*tenant_id,\s*phone_number/i.test(allSqlContent);

  if (!hasMeliTokenRevoke || !hasMeliSafeGrant || !hasWhatsappTokenRevoke || !hasWhatsappSafeGrant) {
    violations.push({
      file: "supabase/migrations/20260903000002_sprint03_c_activation_and_hardening.sql",
      category: "INTEGRATION_TOKEN_EXPOSURE",
      message: "Integration tables (meli_accounts, whatsapp_numbers) must revoke broad SELECT and grant only safe non-token columns.",
    });
  }

  // 8. Check for backend-only tables isolation
  const hasFeatureFlagsRevoke = /REVOKE\s+ALL(?:\s+PRIVILEGES)?\s+ON\s+(?:TABLE\s+)?public\.tenant_feature_flags\s+FROM\s+authenticated/i.test(allSqlContent);
  const hasOperationRunsRevoke = /REVOKE\s+ALL(?:\s+PRIVILEGES)?\s+ON\s+(?:TABLE\s+)?public\.operation_runs\s+FROM\s+authenticated/i.test(allSqlContent);
  const hasWebhookEventsRevoke = /REVOKE\s+ALL(?:\s+PRIVILEGES)?\s+ON\s+(?:TABLE\s+)?public\.webhook_events\s+FROM\s+authenticated/i.test(allSqlContent);
  const hasUsageEventsRevoke = /REVOKE\s+ALL(?:\s+PRIVILEGES)?\s+ON\s+(?:TABLE\s+)?public\.usage_events\s+FROM\s+authenticated/i.test(allSqlContent);
  const hasOperationLeasesRevoke = /REVOKE\s+ALL(?:\s+PRIVILEGES)?\s+ON\s+(?:TABLE\s+)?public\.operation_leases\s+FROM\s+authenticated/i.test(allSqlContent);
  const hasRateLimitBucketsRevoke = /REVOKE\s+ALL(?:\s+PRIVILEGES)?\s+ON\s+(?:TABLE\s+)?public\.rate_limit_buckets\s+FROM\s+authenticated/i.test(allSqlContent);

  if (!hasFeatureFlagsRevoke || !hasOperationRunsRevoke || !hasWebhookEventsRevoke || !hasUsageEventsRevoke || !hasOperationLeasesRevoke || !hasRateLimitBucketsRevoke) {
    violations.push({
      file: "supabase/migrations/*",
      category: "BACKEND_ONLY_EXPOSURE",
      message: "Backend-only tables (tenant_feature_flags, operation_runs, webhook_events, usage_events, operation_leases, rate_limit_buckets) must revoke ALL permissions from authenticated and anon.",
    });
  }

  // 9. COVERAGE AUDIT: All 38 tables in Migration C + 6 backend tables = 44 tables
  const canonical44Tables = [
    "tenants", "profiles", "meli_accounts", "products", "orders", "order_items",
    "whatsapp_numbers", "messages", "ai_actions", "product_price_history",
    "stock_movements", "alert_rules", "alerts", "audit_logs", "tenant_preferences",
    "tenant_progress", "shipments", "order_cancellations", "product_sku_components",
    "promotions", "promotion_items", "coupons", "conversation_sessions",
    "subscription_usage", "inventory_items", "purchase_orders", "purchase_order_items",
    "inventory_movements", "product_components", "product_extra_costs", "subscriptions",
    "monthly_expenses", "plans_config", "competition_snapshots", "action_workflows",
    "workflow_steps", "price_adjustment_workflows", "price_adjustment_details",
    "tenant_feature_flags", "operation_runs", "webhook_events", "usage_events",
    "operation_leases", "rate_limit_buckets"
  ];

  const sprint3BMigration = migrationFiles.find((m) => m.name.includes("sprint03_b_policies"))?.content || "";
  const testSchemaContent = fs.readFileSync(path.join(fixturesDir, "testSchema.sql"), "utf-8");

  for (const tbl of canonical44Tables) {
    // Must have definition in testSchema.sql fixture
    const hasDefinitionInFixture = new RegExp(`CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?public\\.${tbl}\\b`, "i").test(testSchemaContent);
    if (!hasDefinitionInFixture) {
      violations.push({
        file: "tests/fixtures/testSchema.sql",
        category: "MISSING_FIXTURE_TABLE_DEFINITION",
        message: `Canonical table '${tbl}' is missing from tests/fixtures/testSchema.sql fixture!`,
      });
    }

    // Authenticated tables must have explicit RLS policies in Migration B
    const backendOnlyTables = ["tenant_feature_flags", "operation_runs", "webhook_events", "usage_events", "operation_leases", "rate_limit_buckets"];
    if (!backendOnlyTables.includes(tbl)) {
      const hasPolicyInB = new RegExp(`CREATE\\s+POLICY\\s+["'][^"']+["']\\s+ON\\s+public\\.${tbl}`, "i").test(sprint3BMigration);
      if (!hasPolicyInB) {
        violations.push({
          file: "supabase/migrations/20260903000001_sprint03_b_policies.sql",
          category: "MISSING_RLS_POLICY_FOR_ACTIVATED_TABLE",
          message: `Table '${tbl}' is activated in Sprint 3 but lacks an explicit RLS policy in Migration B!`,
        });
      }
    }
  }
  console.log(`Coverage Audit: Verified explicit RLS policies & canonical fixture definitions for all ${canonical44Tables.length} tables.`);

  // 10. Codebase Schema and Write Audit: scan src/
  function scanDirForTablesAndWrites(dir: string, tableSet: Set<string>) {
    const files = fs.readdirSync(dir, { withFileTypes: true });
    for (const f of files) {
      const fullPath = path.join(dir, f.name);
      const normalizedPath = fullPath.replace(/\\/g, "/");
      if (f.isDirectory()) {
        scanDirForTablesAndWrites(fullPath, tableSet);
      } else if (f.name.endsWith(".ts") || f.name.endsWith(".tsx")) {
        const content = fs.readFileSync(fullPath, "utf-8");
        const tableQueryRegex = /\.from\(\s*["']([a-zA-Z0-9_]+)["']\s*\)/g;
        let tMatch: RegExpExecArray | null;
        while ((tMatch = tableQueryRegex.exec(content)) !== null) {
          tableSet.add(tMatch[1]);
        }

        // Check for queries to nonexistent columns from meli_accounts
        if (/\.from\(\s*["']meli_accounts["']\s*\)\s*\.select\([^)]*seller_id/i.test(content)) {
          violations.push({
            file: fullPath,
            category: "NONEXISTENT_COLUMN_QUERIED",
            message: "Client queries 'seller_id' from 'meli_accounts', but this column does not exist in production schema. Use 'meli_user_id'.",
          });
        }

        // Check for unauthorized authenticated writes against read-only or backend tables
        const hasAuthClient = /createClient\(/i.test(content);
        const isClientFile =
          !normalizedPath.includes("/admin") &&
          !normalizedPath.includes("/api/inngest") &&
          !normalizedPath.includes("/api/meli/webhook") &&
          !normalizedPath.includes("/api/mercadopago/webhook") &&
          !normalizedPath.includes("/services/inventory/") &&
          !normalizedPath.includes("/services/meli/") &&
          !normalizedPath.includes("/services/billing/") &&
          !normalizedPath.includes("/lib/observability/") &&
          !normalizedPath.includes("/jobs/");

        if (isClientFile && hasAuthClient) {
          for (const roTable of ["subscriptions", "subscription_usage", "order_cancellations", "tenant_feature_flags", "operation_runs"]) {
            const directAuthWriteRegex = new RegExp(`(?<!admin(?:Supabase)?\\.)from\\(\\s*["']${roTable}["']\\s*\\)\\s*\\.(insert|update|delete|upsert)\\(`, "i");
            if (directAuthWriteRegex.test(content) && !content.includes(`createAdminClient`)) {
              violations.push({
                file: fullPath,
                category: "UNAUTHORIZED_READONLY_WRITE",
                message: `Client-facing code must NOT perform direct '${roTable}' writes via authenticated client. Must use server-side admin client with verified tenant context.`,
              });
            }
          }
        }
      }
    }
  }

  const queriedTables = new Set<string>();
  scanDirForTablesAndWrites(srcDir, queriedTables);
  console.log(`Codebase Query Audit: Scanned ${queriedTables.size} unique tables queried across src/`);

  // Verify all queried tables are in canonical table inventory
  const allKnownTables = new Set(canonical44Tables);

  for (const qTable of queriedTables) {
    if (!allKnownTables.has(qTable)) {
      violations.push({
        file: "src/**",
        category: "UNINVENTORIED_TABLE_ACCESSED",
        message: `Codebase queries table '${qTable}' which is NOT inventoried or protected in database migrations!`,
      });
    }
  }

  console.log(`Total Migrations Scanned: ${migrationFiles.length}`);
  console.log(`Violations Detected:      ${violations.length}\n`);

  if (violations.length > 0) {
    console.error("❌ RLS AUDIT FAILED with the following violations:\n");
    for (const v of violations) {
      console.error(`- [${v.category}] ${v.file}: ${v.message}`);
    }
    process.exit(1);
  }

  console.log("✅ All migrations and database schema policies adhere to Sprint 3.5 canonical production schema rules.\n");
}

runRlsAudit();
