import postgres from "postgres";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { seedPerformanceFixture } from "./seed-performance-fixture";

interface LatencyMetrics {
  count: number;
  p50: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
  avg: number;
}

function calculatePercentiles(latencies: number[]): LatencyMetrics {
  if (latencies.length === 0) {
    return { count: 0, p50: 0, p95: 0, p99: 0, min: 0, max: 0, avg: 0 };
  }
  const sorted = [...latencies].sort((a, b) => a - b);
  const count = sorted.length;
  const p50 = sorted[Math.floor(count * 0.50)];
  const p95 = sorted[Math.floor(count * 0.95)];
  const p99 = sorted[Math.min(count - 1, Math.floor(count * 0.99))];
  const min = sorted[0];
  const max = sorted[count - 1];
  const avg = Math.round((sorted.reduce((s, v) => s + v, 0) / count) * 100) / 100;

  return { count, p50, p95, p99, min, max, avg };
}

export async function runLoadTestSprint6() {
  console.log("=================================================");
  console.log("KLYVO SPRINT 6: MULTI-TENANT LOAD & SCALABILITY TEST");
  console.log("=================================================");

  const testDbUrl = process.env.DATABASE_URL_TEST || "postgres://postgres:postgres@127.0.0.1:54322/postgres";
  const fixturesDir = path.resolve(__dirname, "../tests/fixtures");
  const migrationsDir = path.resolve(__dirname, "../supabase/migrations");

  const migrationClient = postgres(testDbUrl, { max: 1 });
  const sql = postgres(testDbUrl, { max: 10 });

  try {
    // 1. Apply Schema and Migrations
    console.log("1. Applying canonical schema & Sprint 6 scalability migration...");
    const schemaSql = fs.readFileSync(path.join(fixturesDir, "testSchema.sql"), "utf-8");
    await migrationClient.unsafe(schemaSql);

    const migrationS6 = fs.readFileSync(
      path.join(migrationsDir, "20260906000000_sprint06_scalability.sql"),
      "utf-8"
    );
    await migrationClient.unsafe(migrationS6);
    await migrationClient.end();

    // 2. Seed Performance Scale Fixture
    const { tenantIds } = await seedPerformanceFixture({
      dbUrl: testDbUrl,
      tenantCount: 4,
      productsPerTenant: 500,
      ordersPerTenant: 5000,
    });

    assert.equal(tenantIds.length, 4, "Must have 4 seeded tenants");

    // 3. EXPLAIN (ANALYZE, BUFFERS) Index Verification
    console.log("2. Verifying Index Usage via EXPLAIN (ANALYZE, BUFFERS)...");
    const sampleTenant = tenantIds[0];

    const explainOrders = await sql`
      EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
      SELECT id, total_amount, date_created, status
      FROM public.orders
      WHERE tenant_id = ${sampleTenant}::uuid
        AND date_created >= now() - interval '30 days'
        AND status <> 'cancelled'
      ORDER BY date_created DESC
      LIMIT 100;
    `;
    const planOrders = explainOrders[0]["QUERY PLAN"][0];
    const nodeType = planOrders.Plan["Node Type"];
    console.log(`   - Orders 30-day query plan node: ${nodeType}`);
    console.log(`   - Execution time: ${planOrders["Execution Time"]}ms (Planning: ${planOrders["Planning Time"]}ms)`);

    // 4. Concurrent Load Test: 24 Concurrent Workers hitting 4 tenants
    console.log("\n3. Executing Concurrent Load Test: 24 workers, 4 tenants, 120 total requests...");
    const CONCURRENT_WORKERS = 24;
    const REQUESTS_PER_WORKER = 5;
    const totalRequests = CONCURRENT_WORKERS * REQUESTS_PER_WORKER;

    const latencies: number[] = [];
    let errorsCount = 0;
    let crossTenantViolations = 0;

    const workerClients = Array.from({ length: CONCURRENT_WORKERS }, () =>
      postgres(testDbUrl, { max: 1 })
    );

    // Warm up pool connections
    await Promise.all(workerClients.map((c) => c`SELECT 1;`));

    const initialMem = process.memoryUsage().heapUsed;
    let peakMem = initialMem;

    const startTime = Date.now();

    const workerPromises = workerClients.map(async (client, workerIdx) => {
      const assignedTenant = tenantIds[workerIdx % tenantIds.length];

      for (let r = 0; r < REQUESTS_PER_WORKER; r++) {
        const reqStart = performance.now();
        try {
          // Mix of operations: Dashboard aggregates RPC, 30-day orders, and rate limit check
          const opType = (workerIdx + r) % 3;

          if (opType === 0) {
            // Dashboard SQL Aggregates RPC
            const [agg] = await client`
              SELECT public.get_dashboard_aggregates_v2(${assignedTenant}::uuid, 30) as res;
            `;
            if (agg.res.tenant_id !== assignedTenant) {
              crossTenantViolations++;
            }
          } else if (opType === 1) {
            // Scoped orders query
            const rows = await client`
              SELECT id, total_amount, status, date_created, tenant_id
              FROM public.orders
              WHERE tenant_id = ${assignedTenant}::uuid
                AND date_created >= now() - interval '30 days'
              ORDER BY date_created DESC
              LIMIT 50;
            `;
            // Verify all returned rows strictly belong to assigned tenant
            for (const row of rows) {
              if (row.tenant_id !== assignedTenant) {
                crossTenantViolations++;
              }
            }
          } else {
            // Distributed Rate Limit Bucket Check
            const [rl] = await client`
              SELECT public.check_rate_limit_bucket(
                ${assignedTenant}::uuid,
                'ai_chat'::text,
                30::integer,
                60::integer,
                1::integer
              ) as res;
            `;
            if (rl.res.allowed !== true && rl.res.allowed !== false) {
              errorsCount++;
            }
          }

          const reqDuration = performance.now() - reqStart;
          latencies.push(reqDuration);

          const curMem = process.memoryUsage().heapUsed;
          if (curMem > peakMem) peakMem = curMem;
        } catch (err) {
          errorsCount++;
        }
      }
    });

    await Promise.all(workerPromises);
    await Promise.all(workerClients.map((c) => c.end()));

    const totalDurationMs = Date.now() - startTime;
    const metrics = calculatePercentiles(latencies);
    const errorRate = (errorsCount / totalRequests) * 100;
    const rps = Math.round((totalRequests / (totalDurationMs / 1000)) * 10) / 10;
    const peakMemMb = Math.round((peakMem / 1024 / 1024) * 100) / 100;

    console.log("\n📊 LOAD TEST RESULTS:");
    console.log(`   - Total Requests:      ${totalRequests}`);
    console.log(`   - Concurrency Level:   ${CONCURRENT_WORKERS} workers`);
    console.log(`   - Total Duration:      ${totalDurationMs}ms`);
    console.log(`   - Throughput:          ${rps} req/sec`);
    console.log(`   - Error Count:         ${errorsCount} (${errorRate.toFixed(2)}%)`);
    console.log(`   - Cross-Tenant Leaks:  ${crossTenantViolations}`);
    console.log(`   - Latency P50:         ${metrics.p50.toFixed(2)}ms`);
    console.log(`   - Latency P95:         ${metrics.p95.toFixed(2)}ms`);
    console.log(`   - Latency P99:         ${metrics.p99.toFixed(2)}ms`);
    console.log(`   - Latency Avg:         ${metrics.avg.toFixed(2)}ms`);
    console.log(`   - Peak Heap Memory:    ${peakMemMb} MB`);

    // 5. Distributed Lease Concurrency Verification
    console.log("\n4. Testing Distributed Lease Atomic Collision (2 concurrent workers on same tenant)...");
    const [lease1, lease2] = await Promise.all([
      sql`SELECT public.acquire_operation_lease(${tenantIds[0]}::uuid, 'sync_products'::text, 'worker-A'::text, 60) as res;`,
      sql`SELECT public.acquire_operation_lease(${tenantIds[0]}::uuid, 'sync_products'::text, 'worker-B'::text, 60) as res;`,
    ]);

    const res1 = lease1[0].res;
    const res2 = lease2[0].res;

    const acquiredCount = (res1.acquired ? 1 : 0) + (res2.acquired ? 1 : 0);
    assert.equal(acquiredCount, 1, "Exactly one worker MUST acquire the lease; the other must be rejected");

    // Release lease
    const winnerOwner = res1.acquired ? "worker-A" : "worker-B";
    const [releaseRes] = await sql`
      SELECT public.release_operation_lease(${tenantIds[0]}::uuid, 'sync_products'::text, ${winnerOwner}::text) as res;
    `;
    assert.equal(releaseRes.res.released, true, "Winner worker releases lease cleanly");

    // 6. Assertions
    assert.equal(crossTenantViolations, 0, "Zero cross-tenant data leaks allowed");
    assert.ok(errorRate <= 1.0, `Error rate must be <= 1.0%, got ${errorRate}%`);
    assert.ok(metrics.p95 < 250, `P95 latency must remain sub-250ms with indexes, got ${metrics.p95}ms`);

    console.log("\n✅ SPRINT 6 LOAD TEST PASSED ALL CRITERIA!\n");
  } finally {
    await sql.end();
  }
}

if (require.main === module) {
  runLoadTestSprint6()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("❌ Load test failed:", err);
      process.exit(1);
    });
}
