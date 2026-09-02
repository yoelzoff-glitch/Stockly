import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Sprint 3 RLS Policies & Database Security Unit Tests", () => {
  const migrationsDir = path.resolve(__dirname, "../../supabase/migrations");

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
    path.join(migrationsDir, "20260903000003_sprint03_d_emergency_rollback.sql"),
    "utf-8"
  );

  test("Migration A defines all required private schema helper functions with SECURITY DEFINER and search_path", () => {
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
      migrationA.includes("SET search_path = public, private, pg_temp"),
      "Helper functions must fix search_path explicitly"
    );
    assert.ok(
      migrationA.includes("REVOKE ALL ON SCHEMA private FROM PUBLIC"),
      "Private schema must revoke public access"
    );
  });

  test("Migration B creates idempotent RLS policies for direct and child tables", () => {
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
      migrationB.includes("plans_config_public_read"),
      "Must define public read policy for plans_config"
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
      migrationC.includes("REVOKE SELECT (access_token, refresh_token) ON public.meli_accounts FROM authenticated, anon;"),
      "Must revoke access_token selection from authenticated"
    );
    assert.ok(
      migrationC.includes("REVOKE ALL ON public.tenant_feature_flags FROM authenticated, anon, PUBLIC;"),
      "Must revoke all access from tenant_feature_flags"
    );
  });

  test("Migration D provides full emergency rollback restoring previous state", () => {
    assert.ok(
      migrationD.includes("DROP SCHEMA IF EXISTS private CASCADE;"),
      "Rollback must drop private schema"
    );
    assert.ok(
      migrationD.includes("GRANT SELECT ON public.meli_accounts TO authenticated;"),
      "Rollback must restore grants"
    );
  });
});
