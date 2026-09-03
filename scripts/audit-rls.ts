import fs from "node:fs";
import path from "node:path";

interface Violation {
  file: string;
  category: string;
  message: string;
}

function runRlsAudit() {
  console.log("=================================================");
  console.log("KLYVO SPRINT 3: ADVANCED STATIC RLS & REPRODUCIBLE GATE AUDIT");
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

  // 3. Check that policies do NOT use user_metadata or raw JWT claims
  if (/user_metadata/i.test(allSqlContent) || /auth\.jwt\(\)->>'tenant_id'/i.test(allSqlContent)) {
    violations.push({
      file: "supabase/migrations/*",
      category: "INSECURE_METADATA_AUTH",
      message: "SQL policies must NOT rely on user_metadata or raw JWT claims for tenant isolation.",
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

  // 5. Check that NO broad 'GRANT EXECUTE ON ALL FUNCTIONS' is used
  if (/GRANT\s+EXECUTE\s+ON\s+ALL\s+FUNCTIONS/i.test(allSqlContent)) {
    violations.push({
      file: "supabase/migrations/*",
      category: "BROAD_FUNCTION_GRANT",
      message: "Do NOT use broad 'GRANT EXECUTE ON ALL FUNCTIONS'. Grant execution individually per function.",
    });
  }

  // 6. Check for column protection on profiles
  const hasProfilesUpdateRevoke = /REVOKE\s+UPDATE\s+ON\s+public\.profiles\s+FROM\s+authenticated/i.test(allSqlContent);
  const hasProfilesColumnGrant = /GRANT\s+UPDATE\s+\(full_name,\s*avatar_url,\s*updated_at\)\s+ON\s+public\.profiles\s+TO\s+authenticated/i.test(allSqlContent);

  if (!hasProfilesUpdateRevoke || !hasProfilesColumnGrant) {
    violations.push({
      file: "supabase/migrations/20260903000002_sprint03_c_activation_and_hardening.sql",
      category: "PROFILES_PRIVILEGE_ESCALATION",
      message: "Profiles table must strictly revoke general UPDATE and grant only safe columns (full_name, avatar_url, updated_at).",
    });
  }

  // 7. Check that tenants.metadata is NOT broadly granted for UPDATE
  if (/GRANT\s+UPDATE\s+\([^)]*metadata[^)]*\)\s+ON\s+public\.tenants\s+TO\s+authenticated/i.test(allSqlContent)) {
    violations.push({
      file: "supabase/migrations/20260903000002_sprint03_c_activation_and_hardening.sql",
      category: "TENANTS_METADATA_EXPOSURE",
      message: "tenants.metadata must NOT be granted for raw direct UPDATE to authenticated.",
    });
  }

  // 8. Check for token protection on meli_accounts and whatsapp_numbers
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

  // 9. Check for backend-only tables isolation
  const hasFeatureFlagsRevoke = /REVOKE\s+ALL\s+ON\s+public\.tenant_feature_flags\s+FROM\s+authenticated/i.test(allSqlContent);
  const hasOperationRunsRevoke = /REVOKE\s+ALL\s+ON\s+public\.operation_runs\s+FROM\s+authenticated/i.test(allSqlContent);

  if (!hasFeatureFlagsRevoke || !hasOperationRunsRevoke) {
    violations.push({
      file: "supabase/migrations/20260903000002_sprint03_c_activation_and_hardening.sql",
      category: "BACKEND_ONLY_EXPOSURE",
      message: "Backend-only tables (tenant_feature_flags, operation_runs) must revoke ALL permissions from authenticated and anon.",
    });
  }

  // 10. Check that sensitive tables in Sprint 3 policies do NOT have generic CRUD or FOR ALL
  const sprint3BMigration = migrationFiles.find((m) => m.name.includes("sprint03_b_policies"))?.content || "";
  const sensitiveReadOnlyTables = ["subscriptions", "subscription_usage", "meli_accounts", "whatsapp_numbers", "orders", "order_items", "order_cancellations"];
  for (const t of sensitiveReadOnlyTables) {
    const forAllPattern = new RegExp(`CREATE\\s+POLICY\\s+["'][^"']+["']\\s+ON\\s+public\\.${t}[^;]*?FOR\\s+ALL`, "i");
    const insertPattern = new RegExp(`CREATE\\s+POLICY\\s+["'][^"']+["']\\s+ON\\s+public\\.${t}[^;]*?FOR\\s+INSERT`, "i");
    const updatePattern = new RegExp(`CREATE\\s+POLICY\\s+["'][^"']+["']\\s+ON\\s+public\\.${t}[^;]*?FOR\\s+UPDATE`, "i");
    const deletePattern = new RegExp(`CREATE\\s+POLICY\\s+["'][^"']+["']\\s+ON\\s+public\\.${t}[^;]*?FOR\\s+DELETE`, "i");

    if (forAllPattern.test(sprint3BMigration) || insertPattern.test(sprint3BMigration) || updatePattern.test(sprint3BMigration) || deletePattern.test(sprint3BMigration)) {
      violations.push({
        file: "supabase/migrations/20260903000001_sprint03_b_policies.sql",
        category: "SENSITIVE_TABLE_WRITE_EXPOSURE",
        message: `Sensitive table ${t} must NOT declare write policies for authenticated in Sprint 3. It must be restricted to SELECT only.`,
      });
    }
  }

  // 11. COVERAGE AUDIT: Activated Tables (Migration C) <==> Fixture (testSchema.sql) <==> Policies (Migration B)
  const sprint3CMigration = migrationFiles.find((m) => m.name.includes("sprint03_c_activation"))?.content || "";
  const batchMatches = [
    /batch_1\s+text\[\]\s*:=\s*ARRAY\[([\s\S]*?)\];/i.exec(sprint3CMigration),
    /batch_2\s+text\[\]\s*:=\s*ARRAY\[([\s\S]*?)\];/i.exec(sprint3CMigration),
    /batch_3\s+text\[\]\s*:=\s*ARRAY\[([\s\S]*?)\];/i.exec(sprint3CMigration),
    /batch_4\s+text\[\]\s*:=\s*ARRAY\[([\s\S]*?)\];/i.exec(sprint3CMigration),
  ];

  const testSchemaContent = fs.readFileSync(path.join(fixturesDir, "testSchema.sql"), "utf-8");
  const activatedTables: string[] = [];

  for (const bMatch of batchMatches) {
    if (bMatch) {
      const tables = bMatch[1]
        .split(",")
        .map((t) => t.trim().replace(/['"\r\n\s]/g, ""))
        .filter(Boolean);
      activatedTables.push(...tables);
    }
  }

  for (const tbl of activatedTables) {
    // Must have policy in Migration B
    const hasPolicyInB = new RegExp(`CREATE\\s+POLICY\\s+["'][^"']+["']\\s+ON\\s+public\\.${tbl}`, "i").test(sprint3BMigration);
    if (!hasPolicyInB) {
      violations.push({
        file: "supabase/migrations/20260903000001_sprint03_b_policies.sql",
        category: "MISSING_RLS_POLICY_FOR_ACTIVATED_TABLE",
        message: `Table '${tbl}' is enabled in Migration C but lacks an explicit RLS policy in Migration B!`,
      });
    }

    // Must be defined in testSchema.sql
    const hasDefinitionInFixture = new RegExp(`CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?public\\.${tbl}\\b`, "i").test(testSchemaContent);
    if (!hasDefinitionInFixture) {
      violations.push({
        file: "tests/fixtures/testSchema.sql",
        category: "MISSING_FIXTURE_TABLE_DEFINITION",
        message: `Table '${tbl}' is activated in Migration C but is missing from tests/fixtures/testSchema.sql fixture!`,
      });
    }
  }
  console.log(`Coverage Audit: Verified explicit RLS policies & canonical fixture definitions for all ${activatedTables.length} activated tables.`);

  // 12. Codebase Schema and Write Audit: scan src/
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
            // Check if authenticated supabase client is used for writing to read-only table
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

  // Verify all queried tables are in inventory
  const allKnownTables = new Set([
    ...activatedTables,
    "tenant_feature_flags",
    "operation_runs",
    "plans_config",
  ]);

  for (const qTable of queriedTables) {
    if (!allKnownTables.has(qTable)) {
      violations.push({
        file: "src/**",
        category: "UNINVENTORIED_TABLE_ACCESSED",
        message: `Codebase queries table '${qTable}' which is NOT inventoried or protected in Sprint 3 migrations!`,
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

  console.log("✅ All migrations and database schema policies adhere to Sprint 3.4 RLS & multi-tenant isolation rules.\n");
}

runRlsAudit();
