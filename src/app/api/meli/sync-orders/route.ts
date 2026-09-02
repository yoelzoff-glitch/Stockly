import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { syncOrders } from "@/services/meli/syncOrders";
import { isManualSyncDisabled } from "@/lib/safety/killSwitches";
import { getOrCreateCorrelationId, CORRELATION_ID_HEADER } from "@/lib/observability/correlationId";
import { logger } from "@/lib/errors/logger";
import { startOperationRun, completeOperationRun, failOperationRun } from "@/lib/observability/operationRuns";

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
    const supabase = await createClient();

    // 1. Validate auth
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: { [CORRELATION_ID_HEADER]: correlationId } }
      );
    }

    // 2. Get profile and tenant_id
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.tenant_id) {
      return NextResponse.json(
        { error: "Tenant not found for user" },
        { status: 404, headers: { [CORRELATION_ID_HEADER]: correlationId } }
      );
    }

    tenantId = profile.tenant_id;

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
    const syncedCount = await syncOrders(profile.tenant_id);

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

    return NextResponse.json(
      { error: error?.message || "Failed to sync orders" },
      { status: 500, headers: { [CORRELATION_ID_HEADER]: correlationId } }
    );
  }
}
