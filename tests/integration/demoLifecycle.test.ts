import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import postgres from "postgres";
import fs from "node:fs";
import path from "node:path";
import { provisionPrivateDemo } from "../../scripts/provision-private-demo";
import { resetPrivateDemo } from "../../scripts/reset-private-demo";
import { seedPrivateDemo, DEMO_TENANT_SLUG } from "../../scripts/seed-private-demo";

describe("Sprint 11: Demo Account Provisioning, Seed & Reset Lifecycle Tests", () => {
  const dbUrl = process.env.DATABASE_URL_TEST;
  if (!dbUrl) {
    // Only run when running inside disposable database integration suite
    return;
  }

  let sql: postgres.Sql;

  before(async () => {
    sql = postgres(dbUrl, { max: 5 });

    // Apply canonical test schema fixture
    const schemaSql = fs.readFileSync(path.resolve(__dirname, "../fixtures/testSchema.sql"), "utf-8");
    await sql.unsafe(schemaSql);

    // Apply Sprint 11 migration
    const migrationSql = fs.readFileSync(
      path.resolve(__dirname, "../../supabase/migrations/20260911000000_private_demo_tenant.sql"),
      "utf-8"
    );
    await sql.unsafe(migrationSql);
  });

  after(async () => {
    if (sql) await sql.end();
  });

  test("1. provisionPrivateDemo provisions user, tenant and seeds 120 products and 1000 orders", async () => {
    const result = await provisionPrivateDemo({
      dbUrl,
      email: "yoel.zoff+demo@gmail.com",
      tenantSlug: DEMO_TENANT_SLUG,
    });

    assert.ok(result.tenantId);
    assert.ok(result.userId);
    assert.equal(result.slug, DEMO_TENANT_SLUG);
    assert.equal(result.seedResult.productsCount, 120);
    assert.equal(result.seedResult.ordersCount, 1000);
    assert.ok(result.seedResult.grossRevenue > 0);

    // Verify in DB
    const [tenant] = await sql`SELECT id, is_demo, slug, name FROM public.tenants WHERE id = ${result.tenantId}`;
    assert.equal(tenant.is_demo, true);
    assert.equal(tenant.name, "Casa Norte");

    const [user] = await sql`SELECT id, email FROM auth.users WHERE id = ${result.userId}`;
    assert.equal(user.email, "yoel.zoff+demo@gmail.com");

    const [profile] = await sql`SELECT id, tenant_id, role FROM public.profiles WHERE id = ${result.userId}`;
    assert.equal(profile.tenant_id, result.tenantId);
    assert.equal(profile.role, "owner");

    const [{ count: pCount }] = await sql`SELECT count(*)::int FROM public.products WHERE tenant_id = ${result.tenantId}`;
    assert.equal(pCount, 120);

    const [{ count: oCount }] = await sql`SELECT count(*)::int FROM public.orders WHERE tenant_id = ${result.tenantId}`;
    assert.equal(oCount, 1000);
  });

  test("2. seedPrivateDemo is idempotent (re-executing yields same counts with zero duplicates)", async () => {
    const secondSeed = await seedPrivateDemo({
      dbUrl,
      tenantSlug: DEMO_TENANT_SLUG,
    });

    assert.equal(secondSeed.productsCount, 120);
    assert.equal(secondSeed.ordersCount, 1000);

    const [{ count: pCount }] = await sql`
      SELECT count(*)::int FROM public.products 
      WHERE tenant_id = (SELECT id FROM public.tenants WHERE slug = ${DEMO_TENANT_SLUG})
    `;
    assert.equal(pCount, 120, "Product count must remain exactly 120 after second seed");

    const [{ count: oCount }] = await sql`
      SELECT count(*)::int FROM public.orders 
      WHERE tenant_id = (SELECT id FROM public.tenants WHERE slug = ${DEMO_TENANT_SLUG})
    `;
    assert.equal(oCount, 1000, "Order count must remain exactly 1000 after second seed");
  });

  test("3. resetPrivateDemo refuses to reset a non-demo tenant", async () => {
    // Create a real/non-demo tenant
    const [realTenant] = await sql`
      INSERT INTO public.tenants (name, slug, is_demo)
      VALUES ('Real Store', 'real-production-seller', false)
      RETURNING id, slug
    `;

    await assert.rejects(
      async () => {
        await resetPrivateDemo({
          dbUrl,
          tenantSlug: "real-production-seller",
        });
      },
      (err: any) => {
        assert.match(err.message, /Refusing to reset non-demo tenant/i);
        return true;
      }
    );

    // Verify real tenant is untouched
    const [check] = await sql`SELECT id FROM public.tenants WHERE slug = 'real-production-seller'`;
    assert.equal(check.id, realTenant.id);
  });

  test("4. resetPrivateDemo safely resets demo tenant without touching other tenants", async () => {
    const resetResult = await resetPrivateDemo({
      dbUrl,
      tenantSlug: DEMO_TENANT_SLUG,
    });

    assert.equal(resetResult.productsCount, 120);
    assert.equal(resetResult.ordersCount, 1000);

    // Verify real tenant data remains intact
    const [realCheck] = await sql`SELECT count(*)::int FROM public.tenants WHERE slug = 'real-production-seller'`;
    assert.equal(realCheck.count, 1);
  });
});
