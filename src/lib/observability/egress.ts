export interface EgressQuerySample {
  tenantId?: string;
  operation: string;
  table: string;
  rows: number;
  estimatedBytes: number;
  timestamp: string;
}

export type EgressBudgetStatus = "NORMAL" | "WARNING" | "CRITICAL";

export interface TenantEgressMetrics {
  tenantId: string;
  date: string;
  estimatedBytes: number;
  estimatedMb: number;
  queryCount: number;
  topOperation: string;
  topTable: string;
  budgetStatus: EgressBudgetStatus;
}

export const EGRESS_BUDGET_LIMITS = {
  NORMAL_MAX_BYTES: 50 * 1024 * 1024,   // 50 MB (Sprint 40 strict target)
  WARNING_MAX_BYTES: 100 * 1024 * 1024, // 100 MB
} as const;

export interface TenantHourlyDistribution {
  hour: number; // 0..23
  bytes: number;
  mb: number;
  queries: number;
  isActiveUserHour: boolean;
}

export interface TenantOperationBreakdown {
  operation: string;
  bytes: number;
  mb: number;
  queries: number;
}

export interface TenantTableBreakdown {
  table: string;
  bytes: number;
  mb: number;
  queries: number;
}

export interface TenantEgressMetricsDetailed extends TenantEgressMetrics {
  hourlyDistribution: TenantHourlyDistribution[];
  topOperations: TenantOperationBreakdown[];
  topTables: TenantTableBreakdown[];
  idleEgressBytes: number;
  idleEgressMb: number;
  idleHoursCount: number;
  idleRateMbPerHour: number;
}

// In-memory tenant daily aggregator for instant local telemetry
const tenantDailyAggregator = new Map<
  string,
  {
    bytes: number;
    queries: number;
    operations: Record<string, number>;
    tables: Record<string, number>;
  }
>();

// Buffer for low-overhead batched hourly persistence
const hourlyMetricsBuffer = new Map<
  string,
  {
    tenantId: string;
    bucketHour: string;
    operation: string;
    table: string;
    queryCount: number;
    rowsCount: number;
    estimatedBytes: number;
  }
>();

let flushTimeout: NodeJS.Timeout | null = null;

/**
 * Sprint 40 Phase 12: Flushes buffered egress metrics to egress_hourly_metrics table
 * in bulk without firing synchronous inserts for each individual query.
 */
export async function flushEgressHourlyMetrics(): Promise<void> {
  if (hourlyMetricsBuffer.size === 0) return;

  const items = Array.from(hourlyMetricsBuffer.values());
  hourlyMetricsBuffer.clear();

  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const supabase = createAdminClient();

    for (const item of items) {
      try {
        const { error: rpcErr } = await supabase.rpc("record_egress_metrics", {
          p_tenant_id: item.tenantId,
          p_bucket_hour: item.bucketHour,
          p_operation: item.operation,
          p_table_name: item.table,
          p_query_count: item.queryCount,
          p_rows_count: item.rowsCount,
          p_estimated_bytes: item.estimatedBytes,
        });

        if (rpcErr) {
          // Fallback to table upsert if RPC is unavailable
          await supabase.from("egress_hourly_metrics").upsert(
            {
              tenant_id: item.tenantId,
              bucket_hour: item.bucketHour,
              operation: item.operation,
              table_name: item.table,
              query_count: item.queryCount,
              rows_count: item.rowsCount,
              estimated_bytes: item.estimatedBytes,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "tenant_id,bucket_hour,operation,table_name" }
          );
        }
      } catch {
        // Non-blocking fallback
      }
    }
  } catch (err: any) {
    // Non-blocking telemetry log
    console.warn("Failed to flush egress hourly metrics:", err?.message);
  }
}

/**
 * Estimates the byte size of a PostgREST/Supabase query response payload.
 */
export function estimatePayloadBytes(data: unknown): number {
  if (data === undefined || data === null) {
    return 0;
  }
  try {
    return Buffer.byteLength(JSON.stringify(data), "utf8");
  } catch {
    return 0;
  }
}

/**
 * Emits a structured telemetry log for an egress query sample without leaking sensitive payload data,
 * and buffers the sample for atomic hourly database aggregation.
 */
export function logEgressSample(sample: {
  tenantId?: string;
  operation: string;
  table: string;
  data: unknown;
  rowCount?: number;
}): EgressQuerySample {
  const rows = sample.rowCount ?? (Array.isArray(sample.data) ? sample.data.length : sample.data ? 1 : 0);
  const estimatedBytes = estimatePayloadBytes(sample.data);
  const tenantId = sample.tenantId || "unknown";
  const now = new Date();
  const timestamp = now.toISOString();

  const payload: EgressQuerySample = {
    tenantId,
    operation: sample.operation,
    table: sample.table,
    rows,
    estimatedBytes,
    timestamp,
  };

  console.log(
    JSON.stringify({
      event: "EGRESS_QUERY_SAMPLE",
      ...payload,
    })
  );

  // In-memory tracking for fast local retrieval
  if (tenantId !== "unknown") {
    const dayKey = `${tenantId}:${timestamp.split("T")[0]}`;
    const current = tenantDailyAggregator.get(dayKey) || {
      bytes: 0,
      queries: 0,
      operations: {},
      tables: {},
    };

    current.bytes += estimatedBytes;
    current.queries += 1;
    current.operations[sample.operation] = (current.operations[sample.operation] || 0) + estimatedBytes;
    current.tables[sample.table] = (current.tables[sample.table] || 0) + estimatedBytes;

    tenantDailyAggregator.set(dayKey, current);

    // Buffer for hourly database aggregation (Sprint 40 Phase 12)
    const hourDate = new Date(now);
    hourDate.setMinutes(0, 0, 0);
    const bucketHour = hourDate.toISOString();

    const bufferKey = `${tenantId}:${bucketHour}:${sample.operation}:${sample.table}`;
    const existing = hourlyMetricsBuffer.get(bufferKey) || {
      tenantId,
      bucketHour,
      operation: sample.operation,
      table: sample.table,
      queryCount: 0,
      rowsCount: 0,
      estimatedBytes: 0,
    };

    existing.queryCount += 1;
    existing.rowsCount += rows;
    existing.estimatedBytes += estimatedBytes;
    hourlyMetricsBuffer.set(bufferKey, existing);

    // Debounced automatic flush
    if (hourlyMetricsBuffer.size >= 25) {
      flushEgressHourlyMetrics().catch(() => {});
    } else if (!flushTimeout) {
      flushTimeout = setTimeout(() => {
        flushTimeout = null;
        flushEgressHourlyMetrics().catch(() => {});
      }, 5000);
      flushTimeout.unref?.();
    }
  }

  return payload;
}

/**
 * Retrieves the daily egress summary and budget status for one or all tenants.
 */
export function getTenantEgressSummary(tenantId?: string, targetDate?: string): TenantEgressMetrics[] {
  const dateStr = targetDate || new Date().toISOString().split("T")[0];
  const results: TenantEgressMetrics[] = [];

  for (const [key, stats] of tenantDailyAggregator.entries()) {
    const [tId, d] = key.split(":");
    if (d !== dateStr) continue;
    if (tenantId && tId !== tenantId) continue;

    const topOp = Object.entries(stats.operations).sort((a, b) => b[1] - a[1])[0]?.[0] || "none";
    const topTab = Object.entries(stats.tables).sort((a, b) => b[1] - a[1])[0]?.[0] || "none";

    let budgetStatus: EgressBudgetStatus = "NORMAL";
    if (stats.bytes > EGRESS_BUDGET_LIMITS.WARNING_MAX_BYTES) {
      budgetStatus = "CRITICAL";
    } else if (stats.bytes > EGRESS_BUDGET_LIMITS.NORMAL_MAX_BYTES) {
      budgetStatus = "WARNING";
    }

    results.push({
      tenantId: tId,
      date: d,
      estimatedBytes: stats.bytes,
      estimatedMb: Number((stats.bytes / (1024 * 1024)).toFixed(2)),
      queryCount: stats.queries,
      topOperation: topOp,
      topTable: topTab,
      budgetStatus,
    });
  }

  return results.sort((a, b) => b.estimatedBytes - a.estimatedBytes);
}

/**
 * Sprint 40 Phase 13, 14 & 15: Retrieves real, persistent tenant egress metrics
 * directly from egress_hourly_metrics, grouped by operation, table and hour,
 * with ZERO synthetic fixed estimates.
 */
export async function getPersistentTenantEgressSummary(
  adminDb: any,
  targetDate?: string
): Promise<TenantEgressMetricsDetailed[]> {
  // Ensure any buffered metrics are flushed
  await flushEgressHourlyMetrics();

  const dateStr = targetDate || new Date().toISOString().split("T")[0];
  const startOfDay = `${dateStr}T00:00:00.000Z`;
  const endOfDay = `${dateStr}T23:59:59.999Z`;

  // 1. Fetch tenants
  const { data: tenants } = await adminDb
    .from("tenants")
    .select("id, name, is_demo")
    .order("name", { ascending: true });

  if (!tenants || tenants.length === 0) return [];

  // 2. Fetch real recorded hourly metrics from database
  const { data: dbMetrics } = await adminDb
    .from("egress_hourly_metrics")
    .select("tenant_id, bucket_hour, operation, table_name, query_count, rows_count, estimated_bytes")
    .gte("bucket_hour", startOfDay)
    .lte("bucket_hour", endOfDay);

  // 3. Fetch active user human activity events to distinguish active vs idle hours
  const { data: userActivity } = await adminDb
    .from("platform_activity_events")
    .select("tenant_id, created_at")
    .gte("created_at", startOfDay)
    .lte("created_at", endOfDay);

  const activeHoursByTenant = new Map<string, Set<number>>();
  for (const act of userActivity || []) {
    const actHour = new Date(act.created_at).getUTCHours();
    const set = activeHoursByTenant.get(act.tenant_id) || new Set<number>();
    set.add(actHour);
    activeHoursByTenant.set(act.tenant_id, set);
  }

  // 4. Merge with in-memory samples
  const inMemorySamples = getTenantEgressSummary(undefined, dateStr);
  const inMemoryMap = new Map(inMemorySamples.map((s) => [s.tenantId, s]));

  const results: TenantEgressMetricsDetailed[] = [];

  for (const t of tenants) {
    const tenantDbRows = (dbMetrics || []).filter((m: any) => m.tenant_id === t.id);
    const mem = inMemoryMap.get(t.id);
    const activeHours = activeHoursByTenant.get(t.id) || new Set<number>();

    let totalBytes = 0;
    let queryCount = 0;

    const opMap = new Map<string, { bytes: number; queries: number }>();
    const tableMap = new Map<string, { bytes: number; queries: number }>();
    const hourlyBuckets: TenantHourlyDistribution[] = Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      bytes: 0,
      mb: 0,
      queries: 0,
      isActiveUserHour: activeHours.has(h),
    }));

    for (const row of tenantDbRows) {
      const b = Number(row.estimated_bytes || 0);
      const q = Number(row.query_count || 1);
      totalBytes += b;
      queryCount += q;

      // Group operations
      const op = row.operation || "unknown";
      const existingOp = opMap.get(op) || { bytes: 0, queries: 0 };
      existingOp.bytes += b;
      existingOp.queries += q;
      opMap.set(op, existingOp);

      // Group tables
      const tab = row.table_name || "unknown";
      const existingTab = tableMap.get(tab) || { bytes: 0, queries: 0 };
      existingTab.bytes += b;
      existingTab.queries += q;
      tableMap.set(tab, existingTab);

      // Hourly distribution
      const h = new Date(row.bucket_hour).getUTCHours();
      if (h >= 0 && h < 24) {
        hourlyBuckets[h].bytes += b;
        hourlyBuckets[h].mb = Number((hourlyBuckets[h].bytes / (1024 * 1024)).toFixed(2));
        hourlyBuckets[h].queries += q;
      }
    }

    // Merge in-memory samples if not yet flushed to DB
    if (mem && mem.estimatedBytes > totalBytes) {
      const deltaBytes = mem.estimatedBytes - totalBytes;
      const deltaQueries = Math.max(0, mem.queryCount - queryCount);
      totalBytes += deltaBytes;
      queryCount += deltaQueries;

      const currentHour = new Date().getUTCHours();
      hourlyBuckets[currentHour].bytes += deltaBytes;
      hourlyBuckets[currentHour].mb = Number((hourlyBuckets[currentHour].bytes / (1024 * 1024)).toFixed(2));
      hourlyBuckets[currentHour].queries += deltaQueries;
    }

    // Calculate idle egress (hours where no human activity occurred)
    let idleEgressBytes = 0;
    let idleHoursCount = 0;

    for (const hb of hourlyBuckets) {
      if (!hb.isActiveUserHour) {
        idleEgressBytes += hb.bytes;
        idleHoursCount += 1;
      }
    }

    const idleEgressMb = Number((idleEgressBytes / (1024 * 1024)).toFixed(2));
    const idleRateMbPerHour = idleHoursCount > 0 ? Number((idleEgressMb / idleHoursCount).toFixed(3)) : 0;

    const topOperations: TenantOperationBreakdown[] = Array.from(opMap.entries())
      .map(([operation, data]) => ({
        operation,
        bytes: data.bytes,
        mb: Number((data.bytes / (1024 * 1024)).toFixed(2)),
        queries: data.queries,
      }))
      .sort((a, b) => b.bytes - a.bytes);

    const topTables: TenantTableBreakdown[] = Array.from(tableMap.entries())
      .map(([table, data]) => ({
        table,
        bytes: data.bytes,
        mb: Number((data.bytes / (1024 * 1024)).toFixed(2)),
        queries: data.queries,
      }))
      .sort((a, b) => b.bytes - a.bytes);

    const topOperation = topOperations[0]?.operation || mem?.topOperation || "none";
    const topTable = topTables[0]?.table || mem?.topTable || "none";

    let budgetStatus: EgressBudgetStatus = "NORMAL";
    if (totalBytes > EGRESS_BUDGET_LIMITS.WARNING_MAX_BYTES) {
      budgetStatus = "CRITICAL";
    } else if (totalBytes > EGRESS_BUDGET_LIMITS.NORMAL_MAX_BYTES) {
      budgetStatus = "WARNING";
    }

    results.push({
      tenantId: t.id,
      date: dateStr,
      estimatedBytes: totalBytes,
      estimatedMb: Number((totalBytes / (1024 * 1024)).toFixed(2)),
      queryCount,
      topOperation,
      topTable,
      budgetStatus,
      hourlyDistribution: hourlyBuckets,
      topOperations,
      topTables,
      idleEgressBytes,
      idleEgressMb,
      idleHoursCount,
      idleRateMbPerHour,
    });
  }

  return results.sort((a, b) => b.estimatedBytes - a.estimatedBytes);
}

/**
 * Reset egress aggregation map (primarily for unit tests).
 */
export function resetEgressAggregator(): void {
  tenantDailyAggregator.clear();
  hourlyMetricsBuffer.clear();
  if (flushTimeout) {
    clearTimeout(flushTimeout);
    flushTimeout = null;
  }
}


