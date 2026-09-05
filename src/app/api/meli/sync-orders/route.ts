import { NextResponse } from "next/server";
import { syncOrders } from "@/services/meli/syncOrders";
import { isManualSyncDisabled } from "@/lib/safety/killSwitches";
import { getOrCreateCorrelationId, CORRELATION_ID_HEADER } from "@/lib/observability/correlationId";
import { logger } from "@/lib/errors/logger";
import { startOperationRun, completeOperationRun, failOperationRun } from "@/lib/observability/operationRuns";
import { requireTenantContext, toAuthErrorResponse } from "@/lib/security/tenantAuth";
import { assertTenantWritable } from "@/lib/demo/assert-demo-write-allowed";

export async function POST(request: Request) {
  const correlationId = getOrCreateCorrelationId(request);

  if (isManualSyncDisabled()) {
    logger.warn({
      event: "MANUAL_SYNC_DISABLED",
      correlationId,
      operation: "sync_orders",
      source: "manual_api",
      message: "Manual syncs are temporarily disabled via kill switch.",
    });
    return NextResponse.json(
      { error: "Manual syncs are temporarily disabled by system administrator." },
      {
        status: 403,
        headers: { [CORRELATION_ID_HEADER]: correlationId },
      }
    );
  }

  let runId: string | null = null;
  let tenantId: string | undefined;

  try {
    const context = await requireTenantContext(request);
    tenantId = context.tenantId;
    await assertTenantWritable(tenantId);

    logger.info({
      event: "SYNC_ORDERS_STARTED",
      tenantId,
      correlationId,
      operation: "sync_orders",
      source: "manual_api",
    });

    runId = await startOperationRun({
      tenantId,
      operationType: "sync_orders",
      source: "manual_api",
      correlationId,
    });

    // 3. Sync orders
    const syncedCount = await syncOrders(tenantId);

    await completeOperationRun(runId, {
      itemsProcessed: typeof syncedCount === "number" ? syncedCount : 0,
    });

    logger.info({
      event: "SYNC_ORDERS_COMPLETED",
      tenantId,
      correlationId,
      operation: "sync_orders",
      source: "manual_api",
      itemsProcessed: syncedCount,
    });

    return NextResponse.json(
      { success: true, syncedCount },
      { headers: { [CORRELATION_ID_HEADER]: correlationId } }
    );
  } catch (error: any) {
    logger.error({
      event: "SYNC_ORDERS_FAILED",
      tenantId,
      correlationId,
      operation: "sync_orders",
      source: "manual_api",
      error,
      message: error?.message || "Failed to sync orders",
    });

    if (runId) {
      await failOperationRun(runId, {
        errorCode: error?.code || "SYNC_ORDERS_ERROR",
        errorMessage: error?.message,
      });
    }

    return toAuthErrorResponse(error, correlationId);
  }
}
