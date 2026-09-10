export interface EgressQuerySample {
  tenantId?: string;
  operation: string;
  table: string;
  rows: number;
  estimatedBytes: number;
  timestamp: string;
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
 * Emits a structured telemetry log for an egress query sample without leaking sensitive payload data.
 */
export function logEgressSample(sample: {
  tenantId?: string;
  operation: string;
  table: string;
  data: unknown;
  rowCount?: number;
}): void {
  const rows = sample.rowCount ?? (Array.isArray(sample.data) ? sample.data.length : sample.data ? 1 : 0);
  const estimatedBytes = estimatePayloadBytes(sample.data);

  const payload: EgressQuerySample = {
    tenantId: sample.tenantId || "unknown",
    operation: sample.operation,
    table: sample.table,
    rows,
    estimatedBytes,
    timestamp: new Date().toISOString(),
  };

  console.log(
    JSON.stringify({
      event: "EGRESS_QUERY_SAMPLE",
      ...payload,
    })
  );
}
