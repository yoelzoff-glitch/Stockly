import postgres from "postgres";

export interface SeedOptions {
  dbUrl: string;
  tenantCount?: number;
  productsPerTenant?: number;
  ordersPerTenant?: number;
}

export async function seedPerformanceFixture(options: SeedOptions) {
  const {
    dbUrl,
    tenantCount = 4,
    productsPerTenant = 500,
    ordersPerTenant = 5000,
  } = options;

  console.log(`\n🌱 Seeding performance fixture: ${tenantCount} tenants, ${productsPerTenant} products/tenant, ${ordersPerTenant} orders/tenant...`);

  const sql = postgres(dbUrl, { max: 5 });

  try {
    const tenantIds: string[] = [];

    // 1. Create Tenants & Connected Accounts
    for (let t = 1; t <= tenantCount; t++) {
      const slug = `perf-tenant-${t}`;
      const [tenant] = await sql`
        INSERT INTO public.tenants (name, slug, currency, plan, status)
        VALUES (${'Performance Tenant ' + t}, ${slug}, 'ARS', 'pro', 'active')
        ON CONFLICT (slug) DO UPDATE SET plan = 'pro', status = 'active'
        RETURNING id
      `;
      tenantIds.push(tenant.id);

      await sql`
        INSERT INTO public.meli_accounts (tenant_id, meli_user_id, status)
        VALUES (${tenant.id}, ${'meli-user-perf-' + t}, 'connected')
      `;
    }

    console.log(`✅ Created ${tenantIds.length} tenants with connected accounts`);

    // 2. Batch Insert Products for each tenant
    const now = new Date();
    for (let i = 0; i < tenantIds.length; i++) {
      const tenantId = tenantIds[i];
      const productRows = [];

      for (let p = 1; p <= productsPerTenant; p++) {
        productRows.push({
          tenant_id: tenantId,
          meli_item_id: `MLA-PERF-${i + 1}-${p}`,
          title: `Product ${p} Tenant ${i + 1}`,
          sku: `SKU-PERF-${i + 1}-${p}`,
          available_quantity: (p % 20 === 0) ? 2 : 50, // Some critical stock
          price: 1000 + (p * 10),
          cost: (p % 10 === 0) ? 0 : 600 + (p * 5), // Some missing cost
          status: 'active',
        });
      }

      await sql`
        INSERT INTO public.products ${sql(productRows, 'tenant_id', 'meli_item_id', 'title', 'sku', 'available_quantity', 'price', 'cost', 'status')}
      `;

      console.log(`   - Seeded ${productsPerTenant} products for Tenant ${i + 1}`);
    }

    // 3. Batch Insert Orders in chunks of 1000 for each tenant
    const CHUNK_SIZE = 1000;
    for (let i = 0; i < tenantIds.length; i++) {
      const tenantId = tenantIds[i];
      let ordersCreated = 0;

      while (ordersCreated < ordersPerTenant) {
        const orderRows = [];
        const batchSize = Math.min(CHUNK_SIZE, ordersPerTenant - ordersCreated);

        for (let o = 1; o <= batchSize; o++) {
          const globalOrderIndex = ordersCreated + o;
          // Distribute date over last 90 days
          const daysAgo = (globalOrderIndex % 90);
          const orderDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000 - (o * 1000));
          const totalAmount = 2500 + ((globalOrderIndex % 50) * 100);
          const status = (globalOrderIndex % 25 === 0) ? 'cancelled' : 'paid';

          orderRows.push({
            tenant_id: tenantId,
            meli_order_id: `ORD-PERF-${i + 1}-${globalOrderIndex}`,
            total_amount: totalAmount,
            status,
            date_created: orderDate.toISOString(),
            raw_data: { buyer: { id: `buyer-${o}` } },
          });
        }

        await sql`
          INSERT INTO public.orders ${sql(orderRows, 'tenant_id', 'meli_order_id', 'total_amount', 'status', 'date_created', 'raw_data')}
        `;

        ordersCreated += batchSize;
      }

      console.log(`   - Seeded ${ordersPerTenant} orders for Tenant ${i + 1}`);
    }

    // 4. Seed Alerts & Stock Movements
    for (let i = 0; i < tenantIds.length; i++) {
      const tenantId = tenantIds[i];
      const alertRows = Array.from({ length: 50 }, (_, a) => ({
        tenant_id: tenantId,
        title: `Alert ${a + 1} for Tenant ${i + 1}`,
        is_read: a >= 15, // 15 unread alerts
        severity: 'warning',
      }));

      await sql`
        INSERT INTO public.alerts ${sql(alertRows, 'tenant_id', 'title', 'is_read', 'severity')}
      `;
    }

    console.log(`✅ Performance fixture seeding complete (${tenantCount * ordersPerTenant} total orders in DB).\n`);
    return { tenantIds };
  } finally {
    await sql.end();
  }
}

// Standalone execution support
if (require.main === module) {
  const dbUrl = process.env.DATABASE_URL_TEST || process.env.DATABASE_URL || "postgres://postgres:postgres@127.0.0.1:54322/postgres";
  seedPerformanceFixture({ dbUrl })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Seed error:", err);
      process.exit(1);
    });
}
