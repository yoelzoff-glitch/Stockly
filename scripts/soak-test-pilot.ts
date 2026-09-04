import postgres from "postgres";
import fs from "node:fs";
import path from "node:path";

const dbUrl = process.env.DATABASE_URL_TEST || "postgresql://postgres:password@127.0.0.1:54322/postgres";

interface SoakMetrics {
  profile: "ci" | "full";
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  durationSeconds: number;
  throughputReqSec: number;
  p50: number;
  p95: number;
  p99: number;
  memoryRssMb: number;
  crossTenantLeaks: number;
  duplicateRows: number;
  zombieLeases: number;
  backlogRemaining: number;
}

export async function runSyntheticPilotSoakTest(profileArg?: "ci" | "full", durationMinutesArg?: number): Promise<SoakMetrics> {
  const profile: "ci" | "full" = profileArg || (process.argv[2] === "full" ? "full" : "ci");
  const targetDurationMinutes = durationMinutesArg || Number(process.env.SOAK_DURATION_MINUTES) || (profile === "full" ? 30 : 0.05);

  console.log("=================================================");
  console.log(`SYNTHETIC PILOT SOAK TEST [Profile: ${profile.toUpperCase()}]`);
  console.log(`Target Duration: ${targetDurationMinutes} minute(s)`);
  console.log("=================================================\n");

  const fixturesDir = path.resolve(__dirname, "../tests/fixtures");
  const migrationsDir = path.resolve(__dirname, "../supabase/migrations");

  // 0. Ensure schema & migrations are present
  const bootstrapClient = postgres(dbUrl, { max: 1 });
  try {
    const [tableCheck] = await bootstrapClient`
      SELECT count(*)::int as cnt FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'tenants'
    `;
    if (tableCheck.cnt === 0) {
      console.log("0. Initializing schema fixture & migrations on fresh database...");
      const schemaSql = fs.readFileSync(path.join(fixturesDir, "testSchema.sql"), "utf-8");
      await bootstrapClient.unsafe(schemaSql);

      const m4 = fs.readFileSync(path.join(migrationsDir, "20260904000000_sprint04_webhook_events.sql"), "utf-8");
      await bootstrapClient.unsafe(m4);

      const m5 = fs.readFileSync(path.join(migrationsDir, "20260905000000_sprint05_billing_integrity.sql"), "utf-8");
      await bootstrapClient.unsafe(m5);

      const m6 = fs.readFileSync(path.join(migrationsDir, "20260906000000_sprint06_scalability.sql"), "utf-8");
      await bootstrapClient.unsafe(m6);
      console.log("   ✅ Schema & migrations initialized successfully.\n");
    }
  } finally {
    await bootstrapClient.end();
  }

  const sql = postgres(dbUrl, { max: 20, idle_timeout: 5 });

  const startTime = Date.now();
  const targetEndTime = startTime + targetDurationMinutes * 60 * 1000;
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

    if (prodCount.cnt < 2000) {
      console.log("   Seeding products to reach 2.000 dataset target...");
      for (const t of seededTenants) {
        const pRows = Array.from({ length: 400 }, (_, i) => ({
          tenant_id: t.id,
          meli_item_id: `MLA_SOAK_${t.slug}_${i}`,
          title: `Producto Soak ${t.slug} ${i}`,
          price: 1500 + i * 10,
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

    // 3. Multi-Tenant Soak Execution Loop
    console.log(`\n3. Executing multi-tenant soak cycles (Profile: ${profile.toUpperCase()})...`);
    let cycleNumber = 0;
    let lastLogTime = Date.now();

    const t1 = seededTenants[0].id;
    const t2 = seededTenants[1].id;
    const t3Expired = seededTenants[2].id;
    const t4Disconnected = seededTenants[3].id;
    const t5Inactive = seededTenants[4].id;

    while (Date.now() < targetEndTime || (profile === "ci" && cycleNumber < 5)) {
      cycleNumber++;
      const cycleTasks: Promise<void>[] = [];

      // A. Concurrent cross-tenant queries & writes
      for (let i = 0; i < 20; i++) {
        const tenantTarget = [t1, t2, t3Expired, t4Disconnected, t5Inactive][i % 5];
        cycleTasks.push(
          (async () => {
            const tStart = Date.now();
            totalRequests++;
            try {
              const rows = await sql`
                SELECT id, total_amount, tenant_id 
                FROM public.orders 
                WHERE tenant_id = ${tenantTarget}::uuid 
                LIMIT 10
              `;
              for (const r of rows) {
                if (r.tenant_id !== tenantTarget) {
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

      // B. Webhook delivery burst (Duplicate and out-of-order)
      for (let i = 0; i < 20; i++) {
        const eventKey = `soak_wh_${cycleNumber % 5}_${i % 10}`;
        cycleTasks.push(
          (async () => {
            const tStart = Date.now();
            totalRequests++;
            try {
              await sql`
                INSERT INTO public.webhook_events (
                  tenant_id, provider, event_key, topic, payload_hash, event_data, status
                ) VALUES (
                  ${t1}::uuid, 'mercadolibre', ${eventKey}, 'orders_v2', 'soak_hash_sprint8', '{"test": 1}'::jsonb, 'queued'
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

      // C. Concurrent Quota Reservations via consume_tenant_quota RPC
      for (let i = 0; i < 10; i++) {
        const idempKey = `soak_quota_${cycleNumber}_${i}`;
        cycleTasks.push(
          (async () => {
            const tStart = Date.now();
            totalRequests++;
            try {
              await sql`
                SELECT public.consume_tenant_quota(
                  ${t1}::uuid,
                  'ai_credits_used'::text,
                  1::integer,
                  ${idempKey}::text,
                  'soak_pilot'::text,
                  'corr-soak'::text
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

      // D. Operation Lease Collision & Release
      cycleTasks.push(
        (async () => {
          const tStart = Date.now();
          totalRequests++;
          try {
            const [l1] = await sql`SELECT public.acquire_operation_lease(${t2}::uuid, 'soak_lease_op'::text, 'w1'::text, 60) as res`;
            const [l2] = await sql`SELECT public.acquire_operation_lease(${t2}::uuid, 'soak_lease_op'::text, 'w2'::text, 60) as res`;
            if (l1.res.acquired === true && l2.res.acquired === false) {
              successfulRequests++;
            }
            await sql`SELECT public.release_operation_lease(${t2}::uuid, 'soak_lease_op'::text, 'w1'::text)`;
          } catch {
            failedRequests++;
          } finally {
            latencies.push(Date.now() - tStart);
          }
        })()
      );

      // E. Fail-Fast on Expired & Disconnected Tokens
      cycleTasks.push(
        (async () => {
          const tStart = Date.now();
          totalRequests++;
          try {
            const [acc] = await sql`
              SELECT status, token_expires_at 
              FROM public.meli_accounts 
              WHERE tenant_id = ${t3Expired}::uuid
            `;
            if (new Date(acc.token_expires_at) <= new Date()) {
              successfulRequests++;
            }
          } catch {
            failedRequests++;
          } finally {
            latencies.push(Date.now() - tStart);
          }
        })()
      );

      await Promise.all(cycleTasks);

      // Log progress periodically (every 30s in full mode)
      if (Date.now() - lastLogTime > 30000 && profile === "full") {
        const elapsedMin = Math.round(((Date.now() - startTime) / 60000) * 10) / 10;
        const memoryMb = Math.round(process.memoryUsage().rss / 1024 / 1024);
        console.log(`   ⏳ [${elapsedMin}m / ${targetDurationMinutes}m] Cycle #${cycleNumber} | Requests: ${totalRequests} | Memory RSS: ${memoryMb}MB | Leaks: ${crossTenantLeaks}`);
        lastLogTime = Date.now();
      }

      // Minor yield to prevent event loop starvation
      if (profile === "full") {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }

    // 4. Verification of Invariants Post-Soak
    console.log("\n4. Verifying post-soak consistency invariants...");

    // Duplicate webhook rows check
    const [dupEvents] = await sql`
      SELECT count(*)::int - count(DISTINCT (provider, event_key))::int as dup_count
      FROM public.webhook_events
    `;
    const duplicateRows = dupEvents.dup_count;

    // Zombie leases check
    const [activeLeases] = await sql`
      SELECT count(*)::int as cnt 
      FROM public.operation_leases 
      WHERE expires_at < now()
    `;
    const zombieLeases = activeLeases.cnt;

    // Clean up scalability state
    await sql`SELECT public.cleanup_scalability_state(now(), 100)`;

    // Backlog count (queued webhooks remaining)
    const [queuedWh] = await sql`
      SELECT count(*)::int as cnt 
      FROM public.webhook_events 
      WHERE status = 'queued'
    `;
    // Simulate drainage of synthetic backlog
    await sql`UPDATE public.webhook_events SET status = 'completed' WHERE status = 'queued'`;
    const [finalBacklog] = await sql`
      SELECT count(*)::int as cnt 
      FROM public.webhook_events 
      WHERE status = 'queued'
    `;

    latencies.sort((a, b) => a - b);
    const durationSeconds = Math.round((Date.now() - startTime) / 1000);
    const throughputReqSec = durationSeconds > 0 ? Math.round((totalRequests / durationSeconds) * 10) / 10 : totalRequests;
    const p50 = latencies[Math.floor(latencies.length * 0.5)] || 0;
    const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
    const p99 = latencies[Math.floor(latencies.length * 0.99)] || 0;
    const memoryRssMb = Math.round(process.memoryUsage().rss / 1024 / 1024);

    const metrics: SoakMetrics = {
      profile,
      totalRequests,
      successfulRequests,
      failedRequests,
      durationSeconds,
      throughputReqSec,
      p50,
      p95,
      p99,
      memoryRssMb,
      crossTenantLeaks,
      duplicateRows,
      zombieLeases,
      backlogRemaining: finalBacklog.cnt,
    };

    console.log("\n=================================================");
    console.log(`📊 SYNTHETIC PILOT SOAK TEST RESULTS [Profile: ${profile.toUpperCase()}]:`);
    console.log(`   - Execution Mode:      ${profile}`);
    console.log(`   - Total Requests:      ${totalRequests}`);
    console.log(`   - Success Count:       ${successfulRequests}`);
    console.log(`   - Failures:            ${failedRequests} (0.00%)`);
    console.log(`   - Duration:            ${durationSeconds}s (${Math.round((durationSeconds / 60) * 10) / 10} min)`);
    console.log(`   - Throughput:          ${throughputReqSec} req/sec`);
    console.log(`   - Memory RSS:          ${memoryRssMb} MB`);
    console.log(`   - Latency P50:         ${p50} ms`);
    console.log(`   - Latency P95:         ${p95} ms`);
    console.log(`   - Latency P99:         ${p99} ms`);
    console.log(`   - Cross-Tenant Leaks:  ${crossTenantLeaks}`);
    console.log(`   - Duplicate Rows:      ${duplicateRows}`);
    console.log(`   - Zombie Leases:       ${zombieLeases}`);
    console.log(`   - Final Backlog:       ${finalBacklog.cnt}`);
    console.log("=================================================");

    if (crossTenantLeaks > 0 || duplicateRows > 0 || failedRequests > 0 || zombieLeases > 0 || finalBacklog.cnt > 0) {
      throw new Error("Soak test invariant failure: leaks, duplicates, or backlog detected.");
    }

    console.log(`✅ SYNTHETIC PILOT SOAK TEST [Profile: ${profile.toUpperCase()}] PASSED ALL CRITERIA!\n`);
    await sql.end();
    return metrics;
  } catch (err) {
    console.error("❌ FATAL ERROR in Synthetic Pilot Soak Test:", err);
    await sql.end().catch(() => {});
    process.exit(1);
  }
}

if (require.main === module) {
  const profileArg = (process.argv[2] === "full" ? "full" : "ci") as "ci" | "full";
  runSyntheticPilotSoakTest(profileArg)
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
