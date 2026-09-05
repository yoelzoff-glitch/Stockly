import postgres from "postgres";
import fs from "node:fs";
import path from "node:path";

try {
  const envLocal = path.resolve(process.cwd(), ".env.local");
  if (fs.existsSync(envLocal) && typeof (process as any).loadEnvFile === "function") {
    (process as any).loadEnvFile(envLocal);
  }
} catch (_) {}

import { seedPrivateDemo, DEMO_TENANT_SLUG } from "./seed-private-demo";

export interface ResetOptions {
  dbUrl?: string;
  tenantSlug?: string;
  anchorDate?: Date;
}

export async function resetPrivateDemo(options: ResetOptions = {}) {
  const expectedSlug = options.tenantSlug || process.env.DEMO_TENANT_SLUG || DEMO_TENANT_SLUG;
  const dbUrl =
    options.dbUrl ||
    process.env.DATABASE_URL_TEST ||
    process.env.DATABASE_URL ||
    "postgresql://postgres:password@127.0.0.1:54322/postgres";

  console.log(`\n=============================================================`);
  console.log(`🔄 SAFE RESET OF DEMO DATASET`);
  console.log(`=============================================================`);
  console.log(`Target slug: ${expectedSlug}`);

  const sql = postgres(dbUrl, { max: 5 });

  try {
    // 1. Resolve tenant
    const [tenant] = await sql`
      SELECT id, slug, name, is_demo FROM public.tenants WHERE slug = ${expectedSlug}
    `;

    // 2. Mandatory safety guards
    const tenantId = tenant?.id;
    if (!tenantId) {
      throw new Error(`Missing demo tenant with slug '${expectedSlug}'`);
    }

    if (!tenant.is_demo) {
      throw new Error(`Refusing to reset non-demo tenant: '${tenant.name}' (${tenant.slug}) has is_demo = false`);
    }

    if (tenant.slug !== expectedSlug) {
      throw new Error(`Unexpected tenant: expected '${expectedSlug}', found '${tenant.slug}'`);
    }

    console.log(`Verified demo tenant: id=${tenantId}, name='${tenant.name}', is_demo=${tenant.is_demo}`);

    // 3. Delete ONLY rows scoped by tenant_id respecting FK order
    console.log(`[RESET] Deleting existing records exclusively for tenant_id=${tenantId}...`);
    await sql`DELETE FROM public.competition_snapshots WHERE tenant_id = ${tenantId}`;
    await sql`DELETE FROM public.alerts WHERE tenant_id = ${tenantId}`;
    await sql`DELETE FROM public.alert_rules WHERE tenant_id = ${tenantId}`;
    await sql`DELETE FROM public.product_extra_costs WHERE tenant_id = ${tenantId}`;
    await sql`DELETE FROM public.purchase_order_items WHERE tenant_id = ${tenantId}`;
    await sql`DELETE FROM public.purchase_orders WHERE tenant_id = ${tenantId}`;
    await sql`DELETE FROM public.inventory_movements WHERE tenant_id = ${tenantId}`;
    await sql`DELETE FROM public.product_components WHERE tenant_id = ${tenantId}`;
    await sql`DELETE FROM public.product_sku_components WHERE tenant_id = ${tenantId}`;
    await sql`DELETE FROM public.inventory_items WHERE tenant_id = ${tenantId}`;
    await sql`DELETE FROM public.promotion_items WHERE tenant_id = ${tenantId}`;
    await sql`DELETE FROM public.promotions WHERE tenant_id = ${tenantId}`;
    await sql`DELETE FROM public.coupons WHERE tenant_id = ${tenantId}`;
    await sql`DELETE FROM public.order_cancellations WHERE tenant_id = ${tenantId}`;
    await sql`DELETE FROM public.shipments WHERE tenant_id = ${tenantId}`;
    await sql`DELETE FROM public.order_items WHERE tenant_id = ${tenantId}`;
    await sql`DELETE FROM public.orders WHERE tenant_id = ${tenantId}`;
    await sql`DELETE FROM public.stock_movements WHERE tenant_id = ${tenantId}`;
    await sql`DELETE FROM public.product_price_history WHERE tenant_id = ${tenantId}`;
    await sql`DELETE FROM public.products WHERE tenant_id = ${tenantId}`;
    await sql`DELETE FROM public.monthly_expenses WHERE tenant_id = ${tenantId}`;
    await sql`DELETE FROM public.subscription_usage WHERE tenant_id = ${tenantId}`;
    await sql`DELETE FROM public.meli_accounts WHERE tenant_id = ${tenantId}`;

    console.log(`[RESET] Tenant-scoped data successfully cleared. Profile and user preserved.`);

    // 4. Re-run deterministic seed
    console.log(`[RESET] Re-executing deterministic seed dataset...`);
    const seedResult = await seedPrivateDemo({
      dbUrl,
      tenantSlug: expectedSlug,
      anchorDate: options.anchorDate,
    });

    console.log(`[RESET_COMPLETED] Demo dataset successfully regenerated.`);
    console.log(`=============================================================\n`);

    return seedResult;
  } finally {
    await sql.end();
  }
}

if (require.main === module) {
  resetPrivateDemo()
    .then(() => process.exit(0))
    .catch(err => {
      console.error("Reset failed:", err);
      process.exit(1);
    });
}
