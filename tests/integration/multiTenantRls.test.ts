import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

describe("Sprint 3 Multi-Tenant PostgreSQL Real Integration Tests", () => {
  const testDbUrl = process.env.DATABASE_URL_TEST;
  const testSentinel = process.env.KLYVO_RLS_TEST_DB;

  if (!testDbUrl || testSentinel !== "1") {
    test("Enforces mandatory DATABASE_URL_TEST and KLYVO_RLS_TEST_DB=1 configuration", () => {
      console.error(
        "\n[GATE ERROR] DATABASE_URL_TEST and KLYVO_RLS_TEST_DB=1 are REQUIRED.\n" +
        "             A real isolated local PostgreSQL test database is mandatory for Sprint 3 release gate verification.\n" +
        "             Example: DATABASE_URL_TEST=postgresql://postgres:postgres@127.0.0.1:54322/postgres KLYVO_RLS_TEST_DB=1 npm run test:rls:integration\n"
      );
      assert.fail("RELEASE GATE BLOCKED: DATABASE_URL_TEST and KLYVO_RLS_TEST_DB=1 are mandatory for integration tests.");
    });
    return;
  }

  // Security Barrier: Strictly enforce localhost / 127.0.0.1 and reject all remote hosts
  try {
    const parsedUrl = new URL(testDbUrl.startsWith("postgres") ? testDbUrl.replace(/^postgresql?:\/\//, "http://") : testDbUrl);
    const hostname = parsedUrl.hostname.toLowerCase();
    const isLocal = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "0.0.0.0";
    if (!isLocal) {
      throw new Error(`CRITICAL SECURITY VIOLATION: DATABASE_URL_TEST host '${hostname}' is NOT a local address! Remote databases are strictly prohibited.`);
    }
  } catch (e: any) {
    if (e.message.includes("CRITICAL SECURITY VIOLATION")) throw e;
  }

  const sql = postgres(testDbUrl, { max: 1 });
  const migrationsDir = path.resolve(__dirname, "../../supabase/migrations");
  const fixturesDir = path.resolve(__dirname, "../fixtures");

  after(async () => {
    await sql.end();
  });

  test("Applies canonical test schema fixture and all Sprint 3 migrations", async () => {
    const schemaSql = fs.readFileSync(path.join(fixturesDir, "testSchema.sql"), "utf-8");
    await sql.unsafe(schemaSql);

    const migrationA = fs.readFileSync(path.join(migrationsDir, "20260903000000_sprint03_a_foundations.sql"), "utf-8");
    const migrationB = fs.readFileSync(path.join(migrationsDir, "20260903000001_sprint03_b_policies.sql"), "utf-8");
    const migrationC = fs.readFileSync(path.join(migrationsDir, "20260903000002_sprint03_c_activation_and_hardening.sql"), "utf-8");
    const migrationD = fs.readFileSync(path.join(migrationsDir, "20260903000003_sprint03_d_indices.sql"), "utf-8");

    await sql.unsafe(migrationA);
    await sql.unsafe(migrationB);
    await sql.unsafe(migrationC);
    await sql.unsafe(migrationD);

    assert.ok(true, "All migrations executed successfully");
  });

  test("Executes comprehensive multi-tenant isolation, child table RLS, token protection, and service_role tests", async () => {
    await sql.begin(async (tx) => {
      // 1. Setup Two Tenants
      const [tenantA] = await tx`
        INSERT INTO public.tenants (name, currency) VALUES ('Tenant A Corp', 'ARS') RETURNING id
      `;
      const [tenantB] = await tx`
        INSERT INTO public.tenants (name, currency) VALUES ('Tenant B Corp', 'ARS') RETURNING id
      `;

      // 2. Setup Users
      const userAId = "00000000-0000-0000-0000-000000000001";
      const userBId = "00000000-0000-0000-0000-000000000002";
      const userInactiveId = "00000000-0000-0000-0000-000000000003";

      await tx`INSERT INTO auth.users (id, email) VALUES (${userAId}, 'userA@test.com') ON CONFLICT (id) DO NOTHING`;
      await tx`INSERT INTO auth.users (id, email) VALUES (${userBId}, 'userB@test.com') ON CONFLICT (id) DO NOTHING`;
      await tx`INSERT INTO auth.users (id, email) VALUES (${userInactiveId}, 'inactive@test.com') ON CONFLICT (id) DO NOTHING`;

      await tx`
        INSERT INTO public.profiles (id, tenant_id, role, is_active, full_name)
        VALUES (${userAId}, ${tenantA.id}, 'owner', true, 'Owner Tenant A')
        ON CONFLICT (id) DO UPDATE SET tenant_id = ${tenantA.id}, role = 'owner', is_active = true
      `;
      await tx`
        INSERT INTO public.profiles (id, tenant_id, role, is_active, full_name)
        VALUES (${userBId}, ${tenantB.id}, 'owner', true, 'Owner Tenant B')
        ON CONFLICT (id) DO UPDATE SET tenant_id = ${tenantB.id}, role = 'owner', is_active = true
      `;
      await tx`
        INSERT INTO public.profiles (id, tenant_id, role, is_active, full_name)
        VALUES (${userInactiveId}, ${tenantA.id}, 'user', false, 'Inactive Member Tenant A')
        ON CONFLICT (id) DO UPDATE SET tenant_id = ${tenantA.id}, role = 'user', is_active = false
      `;

      // 3. Seed Direct, Child, Read-Only & Backend Data
      const [prodA] = await tx`
        INSERT INTO public.products (tenant_id, title, price, cost)
        VALUES (${tenantA.id}, 'Producto A', 1000, 500) RETURNING id
      `;
      const [prodB] = await tx`
        INSERT INTO public.products (tenant_id, title, price, cost)
        VALUES (${tenantB.id}, 'Producto B', 2000, 1000) RETURNING id
      `;

      const [orderA] = await tx`
        INSERT INTO public.orders (tenant_id, meli_order_id, total_amount)
        VALUES (${tenantA.id}, 'MELI-ORD-A', 1000) RETURNING id
      `;
      const [orderB] = await tx`
        INSERT INTO public.orders (tenant_id, meli_order_id, total_amount)
        VALUES (${tenantB.id}, 'MELI-ORD-B', 2000) RETURNING id
      `;

      const [shipmentA] = await tx`
        INSERT INTO public.shipments (order_id, status) VALUES (${orderA.id}, 'shipped') RETURNING id
      `;
      const [shipmentB] = await tx`
        INSERT INTO public.shipments (order_id, status) VALUES (${orderB.id}, 'shipped') RETURNING id
      `;

      const [wfA] = await tx`
        INSERT INTO public.action_workflows (tenant_id, title, summary, risk_score, status)
        VALUES (${tenantA.id}, 'Workflow A', 'Ajuste de margen', 'LOW', 'pending') RETURNING id
      `;
      const [wfB] = await tx`
        INSERT INTO public.action_workflows (tenant_id, title, summary, risk_score, status)
        VALUES (${tenantB.id}, 'Workflow B', 'Ajuste de stock', 'LOW', 'pending') RETURNING id
      `;

      const [actionA] = await tx`
        INSERT INTO public.ai_actions (tenant_id, action_type, title, workflow_id)
        VALUES (${tenantA.id}, 'update_price', 'Actualizar Precio A', ${wfA.id}) RETURNING id
      `;
      const [actionB] = await tx`
        INSERT INTO public.ai_actions (tenant_id, action_type, title, workflow_id)
        VALUES (${tenantB.id}, 'update_price', 'Actualizar Precio B', ${wfB.id}) RETURNING id
      `;

      const [stepA] = await tx`
        INSERT INTO public.workflow_steps (workflow_id, action_id, step_order)
        VALUES (${wfA.id}, ${actionA.id}, 1) RETURNING id
      `;
      const [stepB] = await tx`
        INSERT INTO public.workflow_steps (workflow_id, action_id, step_order)
        VALUES (${wfB.id}, ${actionB.id}, 1) RETURNING id
      `;

      const [meliAccA] = await tx`
        INSERT INTO public.meli_accounts (tenant_id, meli_user_id, nickname, seller_id, access_token, refresh_token, status)
        VALUES (${tenantA.id}, 'USR-A', 'Shop A', 'SELL-A', 'SECRET-TOKEN-A', 'REFRESH-A', 'connected') RETURNING id
      `;
      const [meliAccB] = await tx`
        INSERT INTO public.meli_accounts (tenant_id, meli_user_id, nickname, seller_id, access_token, refresh_token, status)
        VALUES (${tenantB.id}, 'USR-B', 'Shop B', 'SELL-B', 'SECRET-TOKEN-B', 'REFRESH-B', 'connected') RETURNING id
      `;

      await tx`
        INSERT INTO public.subscriptions (tenant_id, plan, status)
        VALUES (${tenantA.id}, 'pro', 'active')
      `;
      await tx`
        INSERT INTO public.tenant_feature_flags (tenant_id, flag_name, is_enabled)
        VALUES (${tenantA.id}, 'strict_tenant_authorization', false)
      `;

      // 4. Switch to Authenticated User A Context
      await tx`SET LOCAL ROLE authenticated`;
      await tx`SELECT set_config('request.jwt.claim.sub', ${userAId}, true)`;

      // Test 4.1: Direct Table Isolation (products)
      const productsUserA = await tx`SELECT id, tenant_id FROM public.products`;
      assert.equal(productsUserA.length, 1);
      assert.equal(productsUserA[0].id, prodA.id);

      // Test 4.2: Direct Table Isolation (orders)
      const ordersUserA = await tx`SELECT id, tenant_id FROM public.orders`;
      assert.equal(ordersUserA.length, 1);
      assert.equal(ordersUserA[0].id, orderA.id);

      // Test 4.3: Child Table Isolation via EXISTS (shipments -> orders)
      const shipmentsUserA = await tx`SELECT id, order_id FROM public.shipments`;
      assert.equal(shipmentsUserA.length, 1);
      assert.equal(shipmentsUserA[0].id, shipmentA.id);

      // Test 4.4: Child Table Isolation via EXISTS (workflow_steps -> action_workflows)
      const stepsUserA = await tx`SELECT id, workflow_id FROM public.workflow_steps`;
      assert.equal(stepsUserA.length, 1);
      assert.equal(stepsUserA[0].id, stepA.id);

      // Test 4.5: Integration Safe Column Access (meli_accounts safe columns only)
      const safeMeliA = await tx`
        SELECT id, tenant_id, meli_user_id, nickname, seller_id, status FROM public.meli_accounts
      `;
      assert.equal(safeMeliA.length, 1);
      assert.equal(safeMeliA[0].id, meliAccA.id);

      // Test 4.6: Read-Only Table (subscriptions) - Authenticated can SELECT
      const subsA = await tx`SELECT id, plan FROM public.subscriptions`;
      assert.equal(subsA.length, 1);
      assert.equal(subsA[0].plan, 'pro');

      // Test 4.7: Inactive user cannot read any rows
      await tx`SELECT set_config('request.jwt.claim.sub', ${userInactiveId}, true)`;
      const inactiveProducts = await tx`SELECT id FROM public.products`;
      assert.equal(inactiveProducts.length, 0);

      // Switch back to User A
      await tx`SELECT set_config('request.jwt.claim.sub', ${userAId}, true)`;

      // Test 4.8: Negative test - Cross-tenant INSERT into Tenant B rejected
      await assert.rejects(async () => {
        await tx.savepoint(async (sp) => {
          await sp`
            INSERT INTO public.products (tenant_id, title, price, cost)
            VALUES (${tenantB.id}, 'Injected Cross Product', 999, 100)
          `;
        });
      }, "Must reject cross-tenant insert");

      // Test 4.9: Negative test - Direct write to Read-Only table (subscriptions) rejected
      await assert.rejects(async () => {
        await tx.savepoint(async (sp) => {
          await sp`
            INSERT INTO public.subscriptions (tenant_id, plan, status)
            VALUES (${tenantA.id}, 'enterprise', 'active')
          `;
        });
      }, "Must reject direct insert into subscriptions for authenticated");

      // Test 4.10: Negative test - Column privilege escalation (profiles.role) rejected
      await assert.rejects(async () => {
        await tx.savepoint(async (sp) => {
          await sp`UPDATE public.profiles SET role = 'superadmin' WHERE id = ${userAId}`;
        });
      }, "Must reject update to revoked column 'role' on profiles");

      // Test 4.11: Negative test - Column privilege escalation (tenants.metadata) rejected
      await assert.rejects(async () => {
        await tx.savepoint(async (sp) => {
          await sp`UPDATE public.tenants SET metadata = '{"admin": true}'::jsonb WHERE id = ${tenantA.id}`;
        });
      }, "Must reject direct update to metadata on tenants");

      // Test 4.12: Negative test - Token column reading on meli_accounts rejected
      await assert.rejects(async () => {
        await tx.savepoint(async (sp) => {
          await sp`SELECT access_token FROM public.meli_accounts`;
        });
      }, "Must reject SELECT access_token from meli_accounts for authenticated");

      // Test 4.13: Negative test - Accessing backend-only table (tenant_feature_flags) rejected
      await assert.rejects(async () => {
        await tx.savepoint(async (sp) => {
          await sp`SELECT * FROM public.tenant_feature_flags`;
        });
      }, "Must reject SELECT from backend-only table tenant_feature_flags");

      // Test 4.14: Switch to service_role - Bypasses RLS and can access backend tables
      await tx`SET LOCAL ROLE service_role`;
      const flagsAdmin = await tx`SELECT id, flag_name FROM public.tenant_feature_flags`;
      assert.equal(flagsAdmin.length, 1);
      assert.equal(flagsAdmin[0].flag_name, 'strict_tenant_authorization');

      // Throw rollback so integration tests leave zero residue
      throw new Error("ROLLBACK_TEST_TRANSACTION");
    }).catch((err) => {
      if (err.message !== "ROLLBACK_TEST_TRANSACTION") {
        throw err;
      }
    });
  });
});
