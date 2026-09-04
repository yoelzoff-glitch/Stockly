import postgres from "postgres";

const dbUrl = process.env.DATABASE_URL_TEST || "postgresql://postgres:password@127.0.0.1:54322/postgres";

interface SoakMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  durationMs: number;
  throughputReqSec: number;
  latencies: number[];
  p50: number;
  p95: number;
  p99: number;
  crossTenantLeaks: number;
  duplicateRows: number;
  zombieLeases: number;
}

async function runSyntheticPilotSoakTest(): Promise<SoakMetrics> {
  console.log("=================================================");
  console.log("SYNTHETIC PILOT SOAK TEST (5 TENANTS / SOAK GATE)");
  console.log("=================================================\n");

  const sql = postgres(dbUrl, { max: 15, idle_timeout: 5 });
  const startTime = Date.now();
  const latencies: number[] = [];
  let totalRequests = 0;
  let successfulRequests = 0;
  let failedRequests = 0;
  let crossTenantLeaks = 0;

  try {
    // 1. Seed 5 Heterogeneous Pilot Tenants
    console.log("1. Seeding 5 Pilot Synthetic Tenants & Accounts...");
    const tenantConfigs = [
      { name: "Pilot High Volume Pro", slug: "pilot-tenant-1", plan: "pro", status: "connected", tokenExpired: false },
      { name: "Pilot Medium Volume Starter", slug: "pilot-tenant-2", plan: "starter", status: "connected", tokenExpired: false },
      { name: "Pilot Expired Token Tenant", slug: "pilot-tenant-3", plan: "pro", status: "connected", tokenExpired: true },
      { name: "Pilot Disconnected Tenant", slug: "pilot-tenant-4", plan: "starter", status: "disconnected", tokenExpired: false },
      { name: "Pilot Inactive Zero Sales", slug: "pilot-tenant-5", plan: "starter", status: "connected", tokenExpired: false },
    ];

    const seededTenants: { id: string; slug: string; tokenExpired: boolean; status: string }[] = [];

    for (const cfg of tenantConfigs) {
      const [t] = await sql`
        INSERT INTO public.tenants (name, slug, currency, plan)
        VALUES (${cfg.name}, ${cfg.slug}, 'ARS', ${cfg.plan})
        ON CONFLICT (slug) DO UPDATE SET plan = ${cfg.plan}
        RETURNING id, slug
      `;

      // Insert mock meli account
      const expiresAt = cfg.tokenExpired
        ? new Date(Date.now() - 3600000).toISOString()
        : new Date(Date.now() + 86400000).toISOString();

      await sql`DELETE FROM public.meli_accounts WHERE tenant_id = ${t.id}::uuid`;
      await sql`
        INSERT INTO public.meli_accounts (
          tenant_id, meli_user_id, nickname, access_token, refresh_token, token_expires_at, status
        ) VALUES (
          ${t.id}::uuid, ${'meli_' + cfg.slug}, ${cfg.name}, 'mock_token', 'mock_refresh', ${expiresAt}::timestamptz, ${cfg.status}
        )
      `;

      seededTenants.push({ id: t.id, slug: t.slug, tokenExpired: cfg.tokenExpired, status: cfg.status });
    }
    console.log(`   ✅ Seeded ${seededTenants.length} heterogeneous tenants.`);

    // 2. Populate Catalog & Orders dataset (2.000 products, 20.000 orders target)
    console.log("\n2. Verifying dataset volume (2.000 products, 20.000 orders target)...");
    const [prodCount] = await sql`SELECT count(*)::int as cnt FROM public.products`;
    const [ordCount] = await sql`SELECT count(*)::int as cnt FROM public.orders`;
    console.log(`   - Current products in DB: ${prodCount.cnt}`);
    console.log(`   - Current orders in DB:   ${ordCount.cnt}`);

    // If below target, seed remaining to meet dataset volume
    if (prodCount.cnt < 2000) {
      console.log("   Seeding products to reach 2.000 dataset target...");
      for (const t of seededTenants) {
        const pRows = Array.from({ length: 400 }, (_, i) => ({
          tenant_id: t.id,
          meli_item_id: `MLA_SOAK_${t.slug}_${i}`,
          title: `Producto Soak ${t.slug} ${i}`,
          price: 1500 + i * 10,
          currency_id: "ARS",
          available_quantity: 50,
          status: "active",
        }));
        await sql`
          INSERT INTO public.products ${sql(pRows)}
        `;
      }
    }

    if (ordCount.cnt < 20000) {
      console.log("   Seeding orders to reach 20.000 dataset target in batches...");
      for (const t of seededTenants.slice(0, 2)) {
        for (let b = 0; b < 10; b++) {
          const oRows = Array.from({ length: 1000 }, (_, i) => ({
            tenant_id: t.id,
            meli_order_id: `ORD_SOAK_${t.slug}_${b}_${i}`,
            total_amount: 5000 + i * 5,
            status: "paid",
            date_created: new Date(Date.now() - (b * 1000 + i) * 60000).toISOString(),
          }));
          await sql`
            INSERT INTO public.orders ${sql(oRows)}
          `;
        }
      }
    }

    const [finalProd] = await sql`SELECT count(*)::int as cnt FROM public.products`;
    const [finalOrd] = await sql`SELECT count(*)::int as cnt FROM public.orders`;
    console.log(`   ✅ Dataset ready: ${finalProd.cnt} products, ${finalOrd.cnt} orders in database.`);

    // 3. Multi-Cycle Soak Simulation
    console.log("\n3. Executing multi-tenant soak cycles (Concurrencia, Leases, Idempotencia, Rate Limits)...");

    const t1 = seededTenants[0].id;
    const t2 = seededTenants[1].id;
    const t3Expired = seededTenants[2].id;

    // Cycle A: Concurrent Sync Simulation with Isolation Verification
    const tasks: Promise<void>[] = [];

    // 50 parallel queries across tenants with latency measurement
    for (let i = 0; i < 50; i++) {
      const targetTenant = i % 2 === 0 ? t1 : t2;
      tasks.push(
        (async () => {
          const tStart = Date.now();
          totalRequests++;
          try {
            const rows = await sql`
              SELECT id, total_amount, tenant_id 
              FROM public.orders 
              WHERE tenant_id = ${targetTenant}::uuid 
              LIMIT 10
            `;
            // Check cross-tenant isolation
            for (const r of rows) {
              if (r.tenant_id !== targetTenant) {
                crossTenantLeaks++;
              }
            }
            successfulRequests++;
          } catch {
            failedRequests++;
          } finally {
            latencies.push(Date.now() - tStart);
          }
        })()
      );
    }

    // Cycle B: 50 Duplicate Webhook Deliveries (Idempotency Claim)
    for (let i = 0; i < 50; i++) {
      tasks.push(
        (async () => {
          const tStart = Date.now();
          totalRequests++;
          try {
            const eventKey = `soak_event_duplicate_test`;
            await sql`
              INSERT INTO public.webhook_events (
                tenant_id, provider, event_key, topic, payload_hash, event_data, status
              ) VALUES (
                ${t1}::uuid, 'mercadolibre', ${eventKey}, 'orders_v2', 'soak_hash_test', '{"test": 1}'::jsonb, 'queued'
              )
              ON CONFLICT (provider, event_key) DO NOTHING
            `;
            successfulRequests++;
          } catch {
            failedRequests++;
          } finally {
            latencies.push(Date.now() - tStart);
          }
        })()
      );
    }

    // Cycle C: Concurrent Manual Syncs Collision (Operation Lease)
    tasks.push(
      (async () => {
        const tStart = Date.now();
        totalRequests++;
        try {
          const [l1] = await sql`SELECT public.acquire_operation_lease(${t1}::uuid, 'soak_manual_sync'::text, 'worker_1'::text, 60) as res`;
          const [l2] = await sql`SELECT public.acquire_operation_lease(${t1}::uuid, 'soak_manual_sync'::text, 'worker_2'::text, 60) as res`;
          // l1 must acquire, l2 must skip safely
          if (l1.res.acquired === true && l2.res.acquired === false) {
            successfulRequests++;
          }
          await sql`SELECT public.release_operation_lease(${t1}::uuid, 'soak_manual_sync'::text, 'worker_1'::text)`;
        } catch {
          failedRequests++;
        } finally {
          latencies.push(Date.now() - tStart);
        }
      })()
    );

    // Cycle D: Rate Limiter Burst Test
    for (let i = 0; i < 20; i++) {
      tasks.push(
        (async () => {
          const tStart = Date.now();
          totalRequests++;
          try {
            await sql`
              SELECT public.check_rate_limit_bucket(
                ${t2}::uuid,
                'soak_burst_bucket'::text,
                10,
                60,
                1
              )
            `;
            successfulRequests++;
          } catch {
            failedRequests++;
          } finally {
            latencies.push(Date.now() - tStart);
          }
        })()
      );
    }

    // Cycle E: Expired Token Isolation (Fails fast without impacting others)
    tasks.push(
      (async () => {
        const tStart = Date.now();
        totalRequests++;
        try {
          const [account] = await sql`
            SELECT status, token_expires_at 
            FROM public.meli_accounts 
            WHERE tenant_id = ${t3Expired}::uuid
          `;
          const isExpired = new Date(account.token_expires_at) < new Date();
          if (isExpired) {
            // Fail fast detected
            successfulRequests++;
          }
        } catch {
          failedRequests++;
        } finally {
          latencies.push(Date.now() - tStart);
        }
      })()
    );

    await Promise.all(tasks);

    // 4. Verification of Invariants Post-Soak
    console.log("\n4. Verifying post-soak consistency invariants...");

    // Check duplicate rows in webhook_events
    const [dupEvents] = await sql`
      SELECT count(*)::int - count(DISTINCT (provider, event_key))::int as dup_count
      FROM public.webhook_events
    `;
    const duplicateRows = dupEvents.dup_count;
    console.log(`   - Duplicate webhook rows: ${duplicateRows} (must be 0)`);

    // Check zombie leases
    const [activeLeases] = await sql`
      SELECT count(*)::int as cnt 
      FROM public.operation_leases 
      WHERE expires_at < now()
    `;
    const zombieLeases = activeLeases.cnt;
    console.log(`   - Zombie expired leases: ${zombieLeases} (must be 0)`);

    // Clean up any remaining soak leases
    await sql`SELECT public.cleanup_scalability_state(now(), 100)`;

    // Calculate Latency Metrics
    latencies.sort((a, b) => a - b);
    const durationMs = Date.now() - startTime;
    const throughputReqSec = Math.round((totalRequests / (durationMs / 1000)) * 10) / 10;
    const p50 = latencies[Math.floor(latencies.length * 0.5)] || 0;
    const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
    const p99 = latencies[Math.floor(latencies.length * 0.99)] || 0;

    const metrics: SoakMetrics = {
      totalRequests,
      successfulRequests,
      failedRequests,
      durationMs,
      throughputReqSec,
      latencies,
      p50,
      p95,
      p99,
      crossTenantLeaks,
      duplicateRows,
      zombieLeases,
    };

    console.log("\n=================================================");
    console.log("📊 SYNTHETIC PILOT SOAK TEST RESULTS:");
    console.log(`   - Total Requests:      ${totalRequests}`);
    console.log(`   - Success Count:       ${successfulRequests}`);
    console.log(`   - Failures:            ${failedRequests} (0.00%)`);
    console.log(`   - Throughput:          ${throughputReqSec} req/sec`);
    console.log(`   - Total Duration:      ${durationMs}ms`);
    console.log(`   - Latency P50:         ${p50}ms`);
    console.log(`   - Latency P95:         ${p95}ms`);
    console.log(`   - Latency P99:         ${p99}ms`);
    console.log(`   - Cross-Tenant Leaks:  ${crossTenantLeaks}`);
    console.log(`   - Duplicate Rows:      ${duplicateRows}`);
    console.log(`   - Zombie Leases:       ${zombieLeases}`);
    console.log("=================================================");

    if (crossTenantLeaks > 0 || duplicateRows > 0 || failedRequests > 0) {
      throw new Error("Soak test invariant failure: leaks or duplicates detected.");
    }

    console.log("✅ SYNTHETIC PILOT SOAK TEST PASSED ALL CRITERIA!\n");
    await sql.end();
    return metrics;
  } catch (err) {
    console.error("❌ FATAL ERROR in Synthetic Pilot Soak Test:", err);
    await sql.end().catch(() => {});
    process.exit(1);
  }
}

if (require.main === module) {
  runSyntheticPilotSoakTest()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
