import fs from "node:fs";
import path from "node:path";

interface Violation {
  file: string;
  category: string;
  message: string;
}

function runRlsAudit() {
  console.log("=================================================");
  console.log("KLYVO SPRINT 3: STATIC RLS & DATABASE AUDIT");
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

  // 1. Check that policies do NOT use user_metadata or raw JWT claims
  if (/user_metadata/i.test(allSqlContent) || /auth\.jwt\(\)->>'tenant_id'/i.test(allSqlContent)) {
    violations.push({
      file: "supabase/migrations/*",
      category: "INSECURE_METADATA_AUTH",
      message: "SQL policies must NOT rely on user_metadata or raw JWT claims for tenant isolation.",
    });
  }

  // 2. Check that SECURITY DEFINER functions set search_path
  const securityDefinerRegex = /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+([a-zA-Z0-9_\.]+)[^;]+SECURITY\s+DEFINER/gi;
  let match: RegExpExecArray | null;
  while ((match = securityDefinerRegex.exec(allSqlContent)) !== null) {
    const fnBlock = match[0];
    if (!/SET\s+search_path\s*=/i.test(fnBlock) && !allSqlContent.includes("SET search_path = public, private, pg_temp")) {
      violations.push({
        file: "supabase/migrations/*",
        category: "MISSING_SEARCH_PATH",
        message: `SECURITY DEFINER function in ${fnBlock.substring(0, 50)} is missing explicit SET search_path.`,
      });
    }
  }

  // 3. Check for column protection on profiles
  const hasProfilesUpdateRevoke = /REVOKE\s+UPDATE\s+ON\s+public\.profiles\s+FROM\s+authenticated/i.test(allSqlContent);
  const hasProfilesColumnGrant = /GRANT\s+UPDATE\s+\(full_name,\s*avatar_url,\s*updated_at\)\s+ON\s+public\.profiles\s+TO\s+authenticated/i.test(allSqlContent);

  if (!hasProfilesUpdateRevoke || !hasProfilesColumnGrant) {
    violations.push({
      file: "supabase/migrations/20260903000002_sprint03_c_activation_and_hardening.sql",
      category: "PROFILES_PRIVILEGE_ESCALATION",
      message: "Profiles table must strictly revoke general UPDATE and grant only safe columns (full_name, avatar_url, updated_at).",
    });
  }

  // 4. Check for token protection on meli_accounts and whatsapp_numbers
  const hasMeliTokenRevoke = /REVOKE\s+SELECT\s+\(access_token,\s*refresh_token\)\s+ON\s+public\.meli_accounts\s+FROM\s+authenticated/i.test(allSqlContent);
  const hasWhatsappTokenRevoke = /REVOKE\s+SELECT\s+\(verify_token,\s*app_secret\)\s+ON\s+public\.whatsapp_numbers\s+FROM\s+authenticated/i.test(allSqlContent);

  if (!hasMeliTokenRevoke || !hasWhatsappTokenRevoke) {
    violations.push({
      file: "supabase/migrations/20260903000002_sprint03_c_activation_and_hardening.sql",
      category: "INTEGRATION_TOKEN_EXPOSURE",
      message: "Integration tables (meli_accounts, whatsapp_numbers) must revoke access_token/secrets from authenticated.",
    });
  }

  // 5. Check for backend-only tables isolation
  const hasFeatureFlagsRevoke = /REVOKE\s+ALL\s+ON\s+public\.tenant_feature_flags\s+FROM\s+authenticated/i.test(allSqlContent);
  const hasOperationRunsRevoke = /REVOKE\s+ALL\s+ON\s+public\.operation_runs\s+FROM\s+authenticated/i.test(allSqlContent);

  if (!hasFeatureFlagsRevoke || !hasOperationRunsRevoke) {
    violations.push({
      file: "supabase/migrations/20260903000002_sprint03_c_activation_and_hardening.sql",
      category: "BACKEND_ONLY_EXPOSURE",
      message: "Backend-only tables (tenant_feature_flags, operation_runs) must revoke ALL permissions from authenticated and anon.",
    });
  }

  // 6. Check that child tables use EXISTS subqueries
  const childTables = ["shipments", "price_adjustment_details", "product_price_history", "stock_movements", "purchase_order_items", "promotion_items", "coupons"];
  for (const child of childTables) {
    const childPolicyPattern = new RegExp(`CREATE\\s+POLICY\\s+["']${child}_[^"']+["']\\s+ON\\s+public\\.${child}[\\s\\S]*?EXISTS`, "i");
    if (!childPolicyPattern.test(allSqlContent)) {
      violations.push({
        file: "supabase/migrations/20260903000001_sprint03_b_policies.sql",
        category: "CHILD_RELATION_RLS",
        message: `Child table ${child} policy must use EXISTS subquery to validate parent tenant ownership.`,
      });
    }
  }

  // 7. Check for public write grants
  if (/GRANT\s+(?:INSERT|UPDATE|DELETE|ALL)\s+ON\s+ALL\s+TABLES\s+IN\s+SCHEMA\s+public\s+TO\s+public/i.test(allSqlContent)) {
    violations.push({
      file: "supabase/migrations/*",
      category: "PUBLIC_WRITE_GRANT",
      message: "Insecure broad public write grant detected.",
    });
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

  console.log("✅ All migrations and database schema policies adhere to Sprint 3 RLS & multi-tenant isolation rules.\n");
}

runRlsAudit();
