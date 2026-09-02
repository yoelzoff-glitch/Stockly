import { NextResponse } from "next/server";
import { syncProducts } from "@/services/meli/syncProducts";
import { isManualSyncDisabled } from "@/lib/safety/killSwitches";
import { getOrCreateCorrelationId, CORRELATION_ID_HEADER } from "@/lib/observability/correlationId";
import { logger } from "@/lib/errors/logger";
import { startOperationRun, completeOperationRun, failOperationRun } from "@/lib/observability/operationRuns";
import { requireTenantContext, toAuthErrorResponse } from "@/lib/security/tenantAuth";

export async function POST(request: Request) {
  const correlationId = getOrCreateCorrelationId(request);

  if (isManualSyncDisabled()) {
    logger.warn({
      event: "MANUAL_SYNC_DISABLED",
      correlationId,
      operation: "sync_products",
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

    logger.info({
      event: "SYNC_PRODUCTS_STARTED",
      tenantId,
      correlationId,
      operation: "sync_products",
      source: "manual_api",
    });

    runId = await startOperationRun({
      tenantId,
      operationType: "sync_products",
      source: "manual_api",
      correlationId,
    });

    // 3. Sync products
    const syncedCount = await syncProducts(tenantId);

    await completeOperationRun(runId, {
      itemsProcessed: typeof syncedCount === "number" ? syncedCount : 0,
    });

    logger.info({
      event: "SYNC_PRODUCTS_COMPLETED",
      tenantId,
      correlationId,
      operation: "sync_products",
      source: "manual_api",
      itemsProcessed: syncedCount,
    });

    return NextResponse.json(
      { success: true, syncedCount },
      { headers: { [CORRELATION_ID_HEADER]: correlationId } }
    );
  } catch (error: any) {
    logger.error({
      event: "SYNC_PRODUCTS_FAILED",
      tenantId,
      correlationId,
      operation: "sync_products",
      source: "manual_api",
      error,
      message: error?.message || "Failed to sync products",
    });

    if (runId) {
      await failOperationRun(runId, {
        errorCode: error?.code || "SYNC_PRODUCTS_ERROR",
        errorMessage: error?.message,
      });
    }

    if (error?.name === "TenantAuthError" || error?.statusCode === 401 || error?.statusCode === 403) {
      return toAuthErrorResponse(error, correlationId);
    }

    return NextResponse.json(
      { error: error?.message || "Failed to sync products" },
      { status: 500, headers: { [CORRELATION_ID_HEADER]: correlationId } }
    );
  }
}
