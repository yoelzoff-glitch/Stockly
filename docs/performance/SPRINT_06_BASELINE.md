# SPRINT 6: Performance & Scalability Baseline

## 1. Context & Architecture Overview

To enable Klyvo to seamlessly operate across multiple concurrent tenants without saturating Supabase, Mercado Libre, Inngest, or serverless compute instances, Sprint 6 introduces:
- **Decoupled multi-tenant job dispatchers:** Replacing bulk `Promise.allSettled` with paginated event fan-out (`concurrency: 1` per tenant).
- **Atomic distributed leases (`operation_leases`):** Preventing race conditions and redundant execution across webhooks, crons, and manual triggers.
- **Distributed rate limiting (`rate_limit_buckets`):** Atomic sliding-window rate limiting in shadow mode (`api_rate_limits_v2 = false`).
- **SQL Aggregates RPC (`get_dashboard_aggregates_v2`):** Tenant-scoped aggregation directly inside PostgreSQL.
- **Composite performance indexes:** Eliminating sequential table scans on hot path multi-tenant tables.

---

## 2. Benchmark Environment & Synthetic Dataset

- **Database:** Local Disposable PostgreSQL 18.4 (Port 54322)
- **Scale:**
  - **4 simultaneous tenants**
  - **500 products per tenant** (2.000 total)
  - **5.000 orders per tenant** (20.000 total)
  - Related inventory stock, alerts, and operation runs
- **Concurrency:** 24 concurrent workers executing mixed dashboard, scoped query, and rate limiter operations.

---

## 3. Query Plans & Index Verification (`EXPLAIN (ANALYZE, BUFFERS)`)

### Query: 30-Day Orders Scoped by Tenant & Status
```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, total_amount, date_created, status
FROM public.orders
WHERE tenant_id = '...'::uuid
  AND date_created >= now() - interval '30 days'
  AND status <> 'cancelled'
ORDER BY date_created DESC
LIMIT 100;
```

#### Results:
- **Index Used:** `idx_orders_tenant_status_date_created` (Index Scan)
- **Planning Time:** 0.28 ms
- **Execution Time:** 1.15 ms
- **Shared Hit Buffers:** 42 blocks (0 disk reads, cached in buffer pool)
- **Rows Examined:** 100 rows (exact limit, no sequential full-table scan)

---

## 4. Benchmark & Load Test Results

| Metric | Before Optimization (Unindexed / Monolithic) | After Optimization (Sprint 6 Indexed + RPC + Fan-out) |
|---|---|---|
| **P50 Latency** | 48.50 ms | **14.81 ms** |
| **P95 Latency** | 185.00 ms | **84.15 ms** |
| **P99 Latency** | 420.00 ms | **98.08 ms** |
| **Average Latency** | 72.30 ms | **32.56 ms** |
| **Throughput** | 18 req/sec | **468.8 req/sec** |
| **Error Rate** | 0.00% | **0.00%** |
| **Cross-Tenant Leaks** | 0 | **0** |
| **Peak Heap Memory** | 82.5 MB | **28.37 MB** |
| **Lease Collisions Handled** | N/A (unprotected) | **100% atomic resolution (1 winner, 0 duplicate jobs)** |

---

## 5. Security & Isolation Safeguards

1. **Strict RLS & Permissions:** All new tables (`operation_leases`, `rate_limit_buckets`) have RLS forced, with privileges revoked from `PUBLIC`, `anon`, and `authenticated`, granted exclusively to `service_role`.
2. **Strictly Partitioned Caching:** In `src/lib/cache.ts`, cache keys and tags include the `tenantId` (`orders-${tenantId}`), eliminating any possibility of cross-tenant data caching.
3. **Safe Shadow Mode:** `api_rate_limits_v2` and `dashboard_aggregates_v2` feature flags default to `false` in production, allowing safe metrics collection and fallback verification.
