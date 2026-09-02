import { test, describe } from "node:test";
import assert from "node:assert/strict";
import postgres from "postgres";

describe("Sprint 3 Multi-Tenant PostgreSQL Real Integration Tests", () => {
  const testDbUrl = process.env.DATABASE_URL_TEST;

  if (!testDbUrl) {
    test("Live PostgreSQL RLS Integration Suite (Skipped when DATABASE_URL_TEST is not configured)", (t) => {
      console.log(
        "\n[INFO] DATABASE_URL_TEST not set. To run real PostgreSQL integration tests:\n" +
        "       1. Start local Supabase / PostgreSQL test container (e.g. postgresql://postgres:postgres@127.0.0.1:54322/postgres)\n" +
        "       2. Set DATABASE_URL_TEST in your environment\n" +
        "       3. Run 'npm run test:rls:integration'\n" +
        "       (Safety guarantee: Test runner will NEVER point to production automatically)\n"
      );
      assert.ok(true);
    });
    return;
  }

  // Ensure testDbUrl is strictly not pointing to production
  if (testDbUrl.includes("supabase.co") || testDbUrl.includes("pooler.supabase.com")) {
    throw new Error("SECURITY VIOLATION: DATABASE_URL_TEST must NEVER point to remote Supabase production!");
  }

  const sql = postgres(testDbUrl, { max: 1 });

  test("Real PostgreSQL RLS isolation between tenant_a and tenant_b with transaction rollback", async () => {
    await sql.begin(async (tx) => {
      // 1. Create two test tenants
      const [tenantA] = await tx`
        INSERT INTO public.tenants (name, currency) VALUES ('Tenant A Real Test', 'ARS') RETURNING id
      `;
      const [tenantB] = await tx`
        INSERT INTO public.tenants (name, currency) VALUES ('Tenant B Real Test', 'ARS') RETURNING id
      `;

      // 2. Create users and profiles
      const userAId = "00000000-0000-0000-0000-000000000001";
      const userBId = "00000000-0000-0000-0000-000000000002";

      await tx`
        INSERT INTO public.profiles (id, tenant_id, role, is_active, full_name)
        VALUES (${userAId}, ${tenantA.id}, 'owner', true, 'Owner Tenant A')
      `;
      await tx`
        INSERT INTO public.profiles (id, tenant_id, role, is_active, full_name)
        VALUES (${userBId}, ${tenantB.id}, 'owner', true, 'Owner Tenant B')
      `;

      // 3. Create products in each tenant
      const [prodA] = await tx`
        INSERT INTO public.products (tenant_id, title, price, cost)
        VALUES (${tenantA.id}, 'Producto Real Tenant A', 1000, 500)
        RETURNING id
      `;
      const [prodB] = await tx`
        INSERT INTO public.products (tenant_id, title, price, cost)
        VALUES (${tenantB.id}, 'Producto Real Tenant B', 2000, 1000)
        RETURNING id
      `;

      // 4. Switch context to User A (authenticated)
      await tx`SET LOCAL ROLE authenticated`;
      await tx`SELECT set_config('request.jwt.claim.sub', ${userAId}, true)`;

      // User A should see only prodA
      const visibleProductsUserA = await tx`
        SELECT id, title, tenant_id FROM public.products
      `;
      assert.equal(visibleProductsUserA.length, 1);
      assert.equal(visibleProductsUserA[0].id, prodA.id);

      // User A attempts to read prodB by direct ID
      const directReadProdB = await tx`
        SELECT id FROM public.products WHERE id = ${prodB.id}
      `;
      assert.equal(directReadProdB.length, 0);

      // User A attempts to UPDATE prodB
      const updateProdB = await tx`
        UPDATE public.products SET title = 'Hacked Title' WHERE id = ${prodB.id} RETURNING id
      `;
      assert.equal(updateProdB.length, 0);

      // User A attempts cross-tenant INSERT into tenant B
      await assert.rejects(async () => {
        await tx`
          INSERT INTO public.products (tenant_id, title, price, cost)
          VALUES (${tenantB.id}, 'Injected Item', 500, 200)
        `;
      });

      // User A attempts privilege escalation on profile
      await assert.rejects(async () => {
        await tx`
          UPDATE public.profiles SET role = 'superadmin' WHERE id = ${userAId}
        `;
      });

      // Rollback the transaction cleanly
      throw new Error("ROLLBACK_TEST_TRANSACTION");
    }).catch((err) => {
      if (err.message !== "ROLLBACK_TEST_TRANSACTION") {
        throw err;
      }
    });
  });
});
