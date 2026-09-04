import "server-only";
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

    return data.id;
  } catch {
    return null;
  }
}

/**
 * Calculates duration in milliseconds between a database started_at timestamp and now.
 */
async function getDurationFromStartedAt(supabase: any, runId: string, nowIso: string): Promise<number | undefined> {
  try {
    const { data } = await supabase
      .from("operation_runs")
      .select("started_at")
      .eq("id", runId)
      .maybeSingle();

    if (data?.started_at) {
      const startMs = new Date(data.started_at).getTime();
      const endMs = new Date(nowIso).getTime();
      return Math.max(0, endMs - startMs);
    }
  } catch {
    // Non-blocking fallback
  }
  return undefined;
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
    const finishedAt = new Date().toISOString();
    const durationMs = await getDurationFromStartedAt(supabase, runId, finishedAt);
    const sanitizedMeta = params.metadata ? sanitizeLogData(params.metadata) : {};

    await supabase
      .from("operation_runs")
      .update({
        status: "completed",
        finished_at: finishedAt,
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
 * Marks an operation run as partial (e.g. some items succeeded and some failed).
 */
export async function partialOperationRun(
  runId: string | null | undefined,
  params: CompleteOperationParams = {},
  customClient?: any
): Promise<void> {
  if (!runId) return;

  try {
    const supabase = customClient || createAdminClient();
    const finishedAt = new Date().toISOString();
    const durationMs = await getDurationFromStartedAt(supabase, runId, finishedAt);
    const sanitizedMeta = params.metadata ? sanitizeLogData(params.metadata) : {};

    await supabase
      .from("operation_runs")
      .update({
        status: "partial",
        finished_at: finishedAt,
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
    const finishedAt = new Date().toISOString();
    const durationMs = await getDurationFromStartedAt(supabase, runId, finishedAt);
    const sanitizedMeta = params.metadata ? sanitizeLogData(params.metadata) : {};

    await supabase
      .from("operation_runs")
      .update({
        status: "failed",
        finished_at: finishedAt,
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
    const finishedAt = new Date().toISOString();
    const durationMs = await getDurationFromStartedAt(supabase, runId, finishedAt);

    const sanitizedMeta = {
      ...(params.metadata ? sanitizeLogData(params.metadata) : {}),
      skip_reason: params.reason || "Operation skipped",
    };

    await supabase
      .from("operation_runs")
      .update({
        status: "skipped",
        finished_at: finishedAt,
        duration_ms: durationMs,
        metadata: sanitizedMeta,
      })
      .eq("id", runId);
  } catch {
    // Best-effort
  }
}

/**
 * Cleans up zombie operations (stuck in 'started' state for more than maxAgeMinutes).
 */
export async function cleanupZombieOperationRuns(
  maxAgeMinutes: number = 60,
  customClient?: any
): Promise<number> {
  try {
    const supabase = customClient || createAdminClient();
    const threshold = new Date(Date.now() - maxAgeMinutes * 60 * 1000).toISOString();

    const { data } = await supabase
      .from("operation_runs")
      .update({
        status: "failed",
        finished_at: new Date().toISOString(),
        error_code: "ZOMBIE_OPERATION_TIMEOUT",
        error_message: `Operation was automatically marked as failed after remaining in started status for > ${maxAgeMinutes} minutes`,
      })
      .eq("status", "started")
      .lt("started_at", threshold)
      .select("id");

    return data?.length || 0;
  } catch {
    return 0;
  }
}
