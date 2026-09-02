import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Sprint 3 RLS Policies & Database Security Unit Tests", () => {
  const rootDir = path.resolve(__dirname, "../..");
  const migrationsDir = path.join(rootDir, "supabase/migrations");
  const rollbackFile = path.join(
    rootDir,
    "docs/security/rollback/SPRINT_03_EMERGENCY_ROLLBACK.sql"
  );

  const migrationA = fs.readFileSync(
    path.join(migrationsDir, "20260903000000_sprint03_a_foundations.sql"),
    "utf-8"
  );
  const migrationB = fs.readFileSync(
    path.join(migrationsDir, "20260903000001_sprint03_b_policies.sql"),
    "utf-8"
  );
  const migrationC = fs.readFileSync(
    path.join(migrationsDir, "20260903000002_sprint03_c_activation_and_hardening.sql"),
    "utf-8"
  );
  const migrationD = fs.readFileSync(
    path.join(migrationsDir, "20260903000003_sprint03_d_indices.sql"),
    "utf-8"
  );

  test("Migration A defines required private schema helper functions with SET search_path = '' and individual grants", () => {
    const requiredFunctions = [
      "private.current_tenant_id",
      "private.current_tenant_role",
      "private.current_profile_is_active",
      "private.belongs_to_tenant",
      "private.has_tenant_role",
    ];

    for (const fn of requiredFunctions) {
      assert.ok(
        migrationA.includes(fn),
        `Migration A must define function ${fn}`
      );
    }

    assert.ok(
      migrationA.includes("SET search_path = ''"),
      "Helper functions must fix search_path to empty string explicitly"
    );
    assert.ok(
      migrationA.includes("REVOKE ALL ON SCHEMA private FROM PUBLIC"),
      "Private schema must revoke public access"
    );
    assert.ok(
      !migrationA.includes("GRANT EXECUTE ON ALL FUNCTIONS"),
      "Must not use broad grant on all functions"
    );
  });

  test("Migration B creates idempotent RLS policies per table and drops legacy policies", () => {
    assert.ok(
      migrationB.includes("profiles_select_own_tenant"),
      "Must define profiles select policy"
    );
    assert.ok(
      migrationB.includes("profiles_update_own_row"),
      "Must define profiles update policy"
    );
    assert.ok(
      migrationB.includes("shipments_tenant_select"),
      "Must define shipments parent relationship policy"
    );
    assert.ok(
      migrationB.includes("subscriptions_tenant_select"),
      "Must define subscriptions select policy"
    );
    assert.ok(
      migrationB.includes("DROP POLICY IF EXISTS \"Users can read their tenant's monthly expenses\""),
      "Must explicitly drop insecure legacy monthly expenses policy"
    );
  });

  test("Migration C strictly blocks column escalation on profiles, tenants, and tokens", () => {
    assert.ok(
      migrationC.includes("REVOKE UPDATE ON public.profiles FROM authenticated, anon;"),
      "Must revoke general UPDATE on profiles"
    );
    assert.ok(
      migrationC.includes("GRANT UPDATE (full_name, avatar_url, updated_at) ON public.profiles TO authenticated;"),
      "Must only grant safe columns on profiles"
    );
    assert.ok(
      migrationC.includes("REVOKE UPDATE ON public.tenants FROM authenticated, anon;"),
      "Must revoke general UPDATE on tenants"
    );
    assert.ok(
      migrationC.includes("REVOKE SELECT ON public.meli_accounts FROM authenticated, anon;"),
      "Must revoke raw SELECT on meli_accounts"
    );
    assert.ok(
      migrationC.includes("REVOKE SELECT ON public.whatsapp_numbers FROM authenticated, anon;"),
      "Must revoke raw SELECT on whatsapp_numbers"
    );
    assert.ok(
      migrationC.includes("REVOKE ALL ON public.tenant_feature_flags FROM authenticated, anon, PUBLIC;"),
      "Must revoke all access from tenant_feature_flags"
    );
  });

  test("Migration D creates B-tree indices for foreign keys and tenant isolation", () => {
    assert.ok(
      migrationD.includes("idx_products_tenant_id"),
      "Must define index on products tenant_id"
    );
    assert.ok(
      migrationD.includes("idx_orders_tenant_date"),
      "Must define index on orders tenant_id and date"
    );
    assert.ok(
      migrationD.includes("idx_shipments_order_id"),
      "Must define index on shipments order_id"
    );
  });

  test("Rollback script is safely located in docs/security/rollback and does not drop schema private cascade", () => {
    assert.ok(
      fs.existsSync(rollbackFile),
      "Emergency rollback must be saved in docs/security/rollback/"
    );

    const rollbackContent = fs.readFileSync(rollbackFile, "utf-8");
    assert.ok(
      !rollbackContent.includes("DROP SCHEMA IF EXISTS private CASCADE;"),
      "Rollback must not perform broad DROP SCHEMA CASCADE"
    );
    assert.ok(
      rollbackContent.includes("DROP POLICY IF EXISTS \"profiles_select_own_tenant\""),
      "Rollback must drop Sprint 3 policies specifically"
    );
  });
});
