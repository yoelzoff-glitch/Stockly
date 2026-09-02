import { createAdminClient } from "@/lib/supabase/admin";
import { sanitizeLogData } from "@/lib/observability/sanitizer";

export type OperationRunStatus = "started" | "completed" | "partial" | "failed" | "skipped";

export interface StartOperationParams {
  tenantId?: string | null;
  operationType: string;
  source: string;
  correlationId?: string | null;
  metadata?: Record<string, any>;
}

export interface CompleteOperationParams {
  itemsProcessed?: number;
  metadata?: Record<string, any>;
}

export interface FailOperationParams {
  errorCode?: string;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

export interface SkipOperationParams {
  reason?: string;
  metadata?: Record<string, any>;
}

// In-memory tracking of start times to calculate duration_ms reliably
const operationStartTimes = new Map<string, number>();

/**
 * Records the start of an operation run in `operation_runs`.
 * Non-blocking: returns the created run ID or null on failure.
 */
export async function startOperationRun(
  params: StartOperationParams,
  customClient?: any
): Promise<string | null> {
  try {
    const supabase = customClient || createAdminClient();
    const sanitizedMeta = params.metadata ? sanitizeLogData(params.metadata) : {};

    const { data, error } = await supabase
      .from("operation_runs")
      .insert({
        tenant_id: params.tenantId || null,
        operation_type: params.operationType,
        source: params.source,
        status: "started",
        correlation_id: params.correlationId || null,
        started_at: new Date().toISOString(),
        metadata: sanitizedMeta,
      })
      .select("id")
      .single();

    if (error || !data?.id) {
      return null;
    }

    operationStartTimes.set(data.id, Date.now());
    return data.id;
  } catch {
    return null;
  }
}

/**
 * Marks an operation run as completed with items processed and total duration.
 */
export async function completeOperationRun(
  runId: string | null | undefined,
  params: CompleteOperationParams = {},
  customClient?: any
): Promise<void> {
  if (!runId) return;

  try {
    const supabase = customClient || createAdminClient();
    const startTime = operationStartTimes.get(runId);
    const durationMs = startTime ? Date.now() - startTime : undefined;
    operationStartTimes.delete(runId);

    const sanitizedMeta = params.metadata ? sanitizeLogData(params.metadata) : {};

    await supabase
      .from("operation_runs")
      .update({
        status: "completed",
        finished_at: new Date().toISOString(),
        duration_ms: durationMs,
        items_processed: params.itemsProcessed ?? 0,
        metadata: sanitizedMeta,
      })
      .eq("id", runId);
  } catch {
    // Best-effort
  }
}

/**
 * Marks an operation run as failed with error details.
 */
export async function failOperationRun(
  runId: string | null | undefined,
  params: FailOperationParams = {},
  customClient?: any
): Promise<void> {
  if (!runId) return;

  try {
    const supabase = customClient || createAdminClient();
    const startTime = operationStartTimes.get(runId);
    const durationMs = startTime ? Date.now() - startTime : undefined;
    operationStartTimes.delete(runId);

    const sanitizedMeta = params.metadata ? sanitizeLogData(params.metadata) : {};

    await supabase
      .from("operation_runs")
      .update({
        status: "failed",
        finished_at: new Date().toISOString(),
        duration_ms: durationMs,
        error_code: params.errorCode || "UNKNOWN_ERROR",
        error_message: params.errorMessage ? sanitizeLogData(params.errorMessage) : null,
        metadata: sanitizedMeta,
      })
      .eq("id", runId);
  } catch {
    // Best-effort
  }
}

/**
 * Marks an operation run as skipped (e.g. kill switch enabled or precondition not met).
 */
export async function skipOperationRun(
  runId: string | null | undefined,
  params: SkipOperationParams = {},
  customClient?: any
): Promise<void> {
  if (!runId) return;

  try {
    const supabase = customClient || createAdminClient();
    const startTime = operationStartTimes.get(runId);
    const durationMs = startTime ? Date.now() - startTime : undefined;
    operationStartTimes.delete(runId);

    const sanitizedMeta = {
      ...(params.metadata ? sanitizeLogData(params.metadata) : {}),
      skip_reason: params.reason || "Operation skipped",
    };

    await supabase
      .from("operation_runs")
      .update({
        status: "skipped",
        finished_at: new Date().toISOString(),
        duration_ms: durationMs,
        metadata: sanitizedMeta,
      })
      .eq("id", runId);
  } catch {
    // Best-effort
  }
}
