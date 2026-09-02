import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

describe("Sprint 3 Multi-Tenant PostgreSQL Real Integration Tests", () => {
  const testDbUrl = process.env.DATABASE_URL_TEST;

  if (!testDbUrl) {
    test("Live PostgreSQL RLS Integration Suite", () => {
      console.error(
        "\n[ERROR] DATABASE_URL_TEST environment variable is NOT defined.\n" +
        "        To run live PostgreSQL integration tests:\n" +
        "        1. Start local Supabase / PostgreSQL instance (e.g. postgresql://postgres:postgres@127.0.0.1:54322/postgres)\n" +
        "        2. Set DATABASE_URL_TEST in your environment\n" +
        "        3. Run 'npm run test:rls:integration'\n"
      );
      assert.fail("DATABASE_URL_TEST is required to execute live PostgreSQL RLS integration tests.");
    });
    return;
  }

  // Security barrier: Ensure testDbUrl is strictly local/isolated and never remote production
  if (testDbUrl.includes("supabase.co") || testDbUrl.includes("pooler.supabase.com")) {
    throw new Error("CRITICAL SECURITY VIOLATION: DATABASE_URL_TEST must NEVER point to remote production!");
  }

  const sql = postgres(testDbUrl, { max: 1 });
  const migrationsDir = path.resolve(__dirname, "../../supabase/migrations");
  const fixturesDir = path.resolve(__dirname, "../fixtures");

  test("Applies schema fixture and Sprint 3 migrations", async () => {
    // 1. Apply test schema fixture
    const schemaSql = fs.readFileSync(path.join(fixturesDir, "testSchema.sql"), "utf-8");
    await sql.unsafe(schemaSql);

    // 2. Apply Sprint 3 migrations in sequence
    const migrationA = fs.readFileSync(path.join(migrationsDir, "20260903000000_sprint03_a_foundations.sql"), "utf-8");
    const migrationB = fs.readFileSync(path.join(migrationsDir, "20260903000001_sprint03_b_policies.sql"), "utf-8");
    const migrationC = fs.readFileSync(path.join(migrationsDir, "20260903000002_sprint03_c_activation_and_hardening.sql"), "utf-8");
    const migrationD = fs.readFileSync(path.join(migrationsDir, "20260903000003_sprint03_d_indices.sql"), "utf-8");

    await sql.unsafe(migrationA);
    await sql.unsafe(migrationB);
    await sql.unsafe(migrationC);
    await sql.unsafe(migrationD);

    assert.ok(true, "All migrations executed cleanly on isolated test database");
  });

  test("Verifies multi-tenant isolation, cross-tenant blocking, and privilege security with transaction rollback", async () => {
    await sql.begin(async (tx) => {
      // 1. Seed two test tenants
      const [tenantA] = await tx`
        INSERT INTO public.tenants (name, currency) VALUES ('Tenant A Real Test', 'ARS') RETURNING id
      `;
      const [tenantB] = await tx`
        INSERT INTO public.tenants (name, currency) VALUES ('Tenant B Real Test', 'ARS') RETURNING id
      `;

      // 2. Seed users
      const userAId = "00000000-0000-0000-0000-000000000001";
      const userBId = "00000000-0000-0000-0000-000000000002";
      const userInactiveId = "00000000-0000-0000-0000-000000000003";

      await tx`INSERT INTO auth.users (id, email) VALUES (${userAId}, 'userA@test.com') ON CONFLICT DO NOTHING`;
      await tx`INSERT INTO auth.users (id, email) VALUES (${userBId}, 'userB@test.com') ON CONFLICT DO NOTHING`;
      await tx`INSERT INTO auth.users (id, email) VALUES (${userInactiveId}, 'inactive@test.com') ON CONFLICT DO NOTHING`;

      await tx`
        INSERT INTO public.profiles (id, tenant_id, role, is_active, full_name)
        VALUES (${userAId}, ${tenantA.id}, 'owner', true, 'Owner Tenant A')
      `;
      await tx`
        INSERT INTO public.profiles (id, tenant_id, role, is_active, full_name)
        VALUES (${userBId}, ${tenantB.id}, 'owner', true, 'Owner Tenant B')
      `;
      await tx`
        INSERT INTO public.profiles (id, tenant_id, role, is_active, full_name)
        VALUES (${userInactiveId}, ${tenantA.id}, 'user', false, 'Inactive User Tenant A')
      `;

      // 3. Seed operational and child data
      const [prodA] = await tx`
        INSERT INTO public.products (tenant_id, title, price, cost)
        VALUES (${tenantA.id}, 'Producto Tenant A', 1000, 500)
        RETURNING id
      `;
      const [prodB] = await tx`
        INSERT INTO public.products (tenant_id, title, price, cost)
        VALUES (${tenantB.id}, 'Producto Tenant B', 2000, 1000)
        RETURNING id
      `;

      const [orderA] = await tx`
        INSERT INTO public.orders (tenant_id, total_amount) VALUES (${tenantA.id}, 1000) RETURNING id
      `;
      const [orderB] = await tx`
        INSERT INTO public.orders (tenant_id, total_amount) VALUES (${tenantB.id}, 2000) RETURNING id
      `;

      const [shipmentA] = await tx`
        INSERT INTO public.shipments (order_id, status) VALUES (${orderA.id}, 'shipped') RETURNING id
      `;
      const [shipmentB] = await tx`
        INSERT INTO public.shipments (order_id, status) VALUES (${orderB.id}, 'shipped') RETURNING id
      `;

      // 4. Switch context to User A (authenticated)
      await tx`SET LOCAL ROLE authenticated`;
      await tx`SELECT set_config('request.jwt.claim.sub', ${userAId}, true)`;

      // Test 4.1: User A sees exclusively prodA
      const visibleProducts = await tx`SELECT id, tenant_id FROM public.products`;
      assert.equal(visibleProducts.length, 1);
      assert.equal(visibleProducts[0].id, prodA.id);

      // Test 4.2: Direct read of prodB by ID returns empty
      const directReadB = await tx`SELECT id FROM public.products WHERE id = ${prodB.id}`;
      assert.equal(directReadB.length, 0);

      // Test 4.3: Child table (shipments) isolation via parent EXISTS
      const visibleShipments = await tx`SELECT id, order_id FROM public.shipments`;
      assert.equal(visibleShipments.length, 1);
      assert.equal(visibleShipments[0].id, shipmentA.id);

      // Test 4.4: Inactive user cannot select rows
      await tx`SELECT set_config('request.jwt.claim.sub', ${userInactiveId}, true)`;
      const inactiveRead = await tx`SELECT id FROM public.products`;
      assert.equal(inactiveRead.length, 0);

      // Switch back to User A
      await tx`SELECT set_config('request.jwt.claim.sub', ${userAId}, true)`;

      // Test 4.5: Negative test using SAVEPOINT — cross-tenant insert
      await tx.savepoint(async (sp) => {
        let threw = false;
        try {
          await sp`
            INSERT INTO public.products (tenant_id, title, price, cost)
            VALUES (${tenantB.id}, 'Injected Item', 500, 200)
          `;
        } catch (e) {
          threw = true;
        }
        assert.equal(threw, true, "Must reject cross-tenant insert");
      });

      // Test 4.6: Negative test using SAVEPOINT — role escalation on profile
      await tx.savepoint(async (sp) => {
        let threw = false;
        try {
          await sp`UPDATE public.profiles SET role = 'superadmin' WHERE id = ${userAId}`;
        } catch (e) {
          threw = true;
        }
        assert.equal(threw, true, "Must reject profile role column update");
      });

      // Always rollback the integration test transaction
      throw new Error("ROLLBACK_TEST_TRANSACTION");
    }).catch((err) => {
      if (err.message !== "ROLLBACK_TEST_TRANSACTION") {
        throw err;
      }
    });
  });
});
