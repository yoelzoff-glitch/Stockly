import fs from "node:fs";
import path from "node:path";

interface Violation {
  file: string;
  category: string;
  message: string;
}

function runRlsAudit() {
  console.log("=================================================");
  console.log("KLYVO SPRINT 3: ADVANCED STATIC RLS & DATABASE AUDIT");
  console.log("=================================================");

  const migrationsDir = path.resolve(__dirname, "../supabase/migrations");
  const violations: Violation[] = [];

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

  // 1. Check that NO rollback file is located inside supabase/migrations
  for (const m of migrationFiles) {
    if (/rollback/i.test(m.name)) {
      violations.push({
        file: `supabase/migrations/${m.name}`,
        category: "ROLLBACK_IN_MIGRATIONS",
        message: "Emergency rollback scripts must NOT reside in supabase/migrations/ where they could be auto-executed by supabase db push.",
      });
    }
  }

  // 2. Check that policies do NOT use user_metadata or raw JWT claims
  if (/user_metadata/i.test(allSqlContent) || /auth\.jwt\(\)->>'tenant_id'/i.test(allSqlContent)) {
    violations.push({
      file: "supabase/migrations/*",
      category: "INSECURE_METADATA_AUTH",
      message: "SQL policies must NOT rely on user_metadata or raw JWT claims for tenant isolation.",
    });
  }

  // 3. Check that SECURITY DEFINER functions use strictly SET search_path = ''
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

  // 4. Check that NO broad 'GRANT EXECUTE ON ALL FUNCTIONS' is used
  if (/GRANT\s+EXECUTE\s+ON\s+ALL\s+FUNCTIONS/i.test(allSqlContent)) {
    violations.push({
      file: "supabase/migrations/*",
      category: "BROAD_FUNCTION_GRANT",
      message: "Do NOT use broad 'GRANT EXECUTE ON ALL FUNCTIONS'. Grant execution individually per function.",
    });
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
  const hasMeliSafeGrant = /GRANT\s+SELECT\s+\(id,\s*tenant_id,\s*status/i.test(allSqlContent);
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
  const hasFeatureFlagsRevoke = /REVOKE\s+ALL\s+ON\s+public\.tenant_feature_flags\s+FROM\s+authenticated/i.test(allSqlContent);
  const hasOperationRunsRevoke = /REVOKE\s+ALL\s+ON\s+public\.operation_runs\s+FROM\s+authenticated/i.test(allSqlContent);

  if (!hasFeatureFlagsRevoke || !hasOperationRunsRevoke) {
    violations.push({
      file: "supabase/migrations/20260903000002_sprint03_c_activation_and_hardening.sql",
      category: "BACKEND_ONLY_EXPOSURE",
      message: "Backend-only tables (tenant_feature_flags, operation_runs) must revoke ALL permissions from authenticated and anon.",
    });
  }

  // 9. Check that sensitive tables in Sprint 3 policies do NOT have generic CRUD or FOR ALL
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

  console.log(`Total Migrations Scanned: ${migrationFiles.length}`);
  console.log(`Violations Detected:      ${violations.length}\n`);

  if (violations.length > 0) {
    console.error("❌ RLS AUDIT FAILED with the following violations:\n");
    for (const v of violations) {
      console.error(`- [${v.category}] ${v.file}: ${v.message}`);
    }
    process.exit(1);
  }

  console.log("✅ All migrations and database schema policies adhere to Sprint 3.1 RLS & multi-tenant isolation rules.\n");
}

runRlsAudit();
