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
  NORMAL_MAX_BYTES: 100 * 1024 * 1024,   // 100 MB
  WARNING_MAX_BYTES: 200 * 1024 * 1024,  // 200 MB
} as const;

// In-memory tenant daily aggregator (tenantId:YYYY-MM-DD -> stats)
const tenantDailyAggregator = new Map<
  string,
  {
    bytes: number;
    queries: number;
    operations: Record<string, number>;
    tables: Record<string, number>;
  }
>();

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
 * Emits a structured telemetry log for an egress query sample without leaking sensitive payload data.
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

  // In-memory tracking for Phase 14 Egress Budget
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

    // Determine top operation & table by bytes
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

  // If a specific tenant has no recorded activity today, return a baseline NORMAL record
  if (tenantId && results.length === 0) {
    return [
      {
        tenantId,
        date: dateStr,
        estimatedBytes: 0,
        estimatedMb: 0,
        queryCount: 0,
        topOperation: "none",
        topTable: "none",
        budgetStatus: "NORMAL",
      },
    ];
  }

  return results.sort((a, b) => b.estimatedBytes - a.estimatedBytes);
}

/**
 * Reset egress aggregation map (primarily for unit tests).
 */
export function resetEgressAggregator(): void {
  tenantDailyAggregator.clear();
}
