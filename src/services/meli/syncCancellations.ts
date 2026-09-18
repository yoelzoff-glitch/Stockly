import { createAdminClient } from "@/lib/supabase/admin";
import { refreshMeliToken } from "./refreshToken";
import { revertInternalStockFromCancelledOrder } from "../inventory/revertInternalStockFromCancelledOrder";
import { logEgressSample } from "@/lib/observability/egress";
import { recordSyncExecution, SyncExecutionSource } from "@/lib/observability/operationRuns";

export async function syncCancellations(
  tenantId: string,
  options?: { source?: SyncExecutionSource; correlationId?: string }
) {
  const executionSource: SyncExecutionSource = options?.source || "cron_incremental";
  const executionStartedAt = new Date().toISOString();
  const supabase = createAdminClient();

  // 1. Stage 1: Get lightweight cancelled orders without heavy raw_data
  const { data: cancelledOrders, error: ordersError } = await supabase
    .from("orders")
    .select("id, meli_order_id")
    .eq("tenant_id", tenantId)
    .eq("status", "cancelled");

  logEgressSample({
    tenantId,
    operation: "syncCancellations.cancelledOrders",
    table: "orders",
    data: cancelledOrders,
  });

  if (ordersError || !cancelledOrders || cancelledOrders.length === 0) {
    return 0;
  }

  // Optimize: Check existing cancellation records
  const orderIds = cancelledOrders.map(o => o.id);
  const { data: existingCancellations } = await supabase
    .from("order_cancellations")
    .select("order_id")
    .in("order_id", orderIds);

  const existingOrderIds = new Set((existingCancellations || []).map(c => c.order_id));
  const pendingCancellationOrderIds = cancelledOrders
    .filter(o => !existingOrderIds.has(o.id))
    .map(o => o.id);

  if (pendingCancellationOrderIds.length === 0) {
    return 0; // All cancellations already processed
  }

  // Stage 2: Only fetch full raw_data for orders with pending cancellations
  const { data: pendingOrders, error: pendingError } = await supabase
    .from("orders")
    .select("id, meli_order_id, raw_data, tenant_id")
    .in("id", pendingCancellationOrderIds);

  if (pendingError || !pendingOrders || pendingOrders.length === 0) {
    return 0;
  }

  const cancellationsToUpsert: any[] = [];

  for (const order of pendingOrders) {

    const raw = order.raw_data as any;
    // Meli orders usually have cancel_detail or similar info
    const cancelDetail = raw?.cancel_detail;
    
    const reason = cancelDetail?.description || "Cancelada";
    const cancelledBy = cancelDetail?.requested_by || "Desconocido";
    const refundAmount = raw?.total_amount || 0; // simplified
    const dateCancelled = cancelDetail?.date || raw?.last_updated || new Date().toISOString();

    cancellationsToUpsert.push({
      tenant_id: tenantId,
      order_id: order.id,
      meli_order_id: order.meli_order_id,
      reason: reason,
      cancelled_by: cancelledBy,
      refund_amount: refundAmount,
      date_cancelled: dateCancelled,
      raw_data: cancelDetail || {},
    });
  }

  if (cancellationsToUpsert.length > 0) {
    const { error: insertError } = await supabase
      .from("order_cancellations")
      .insert(cancellationsToUpsert);

    if (insertError) {
      console.error("Error inserting order cancellations:", insertError);
    } else {
      // --- SPRINT 35: Revertir stock interno ---
      for (const cancellation of cancellationsToUpsert) {
        await revertInternalStockFromCancelledOrder(tenantId, cancellation.order_id).catch(err => {
          console.error(`Error revirtiendo stock para orden cancelada ${cancellation.order_id}:`, err);
        });
      }

      await recordSyncExecution({
        tenantId,
        operationType: "sync_cancellations",
        source: executionSource,
        status: "completed",
        startedAt: executionStartedAt,
        finishedAt: new Date().toISOString(),
        rowsRead: cancelledOrders?.length || 0,
        rowsWritten: cancellationsToUpsert.length,
        estimatedBytes: Math.round(cancellationsToUpsert.length * 250),
        itemsProcessed: cancellationsToUpsert.length,
        correlationId: options?.correlationId,
      });

      return cancellationsToUpsert.length;
    }
  }

  await recordSyncExecution({
    tenantId,
    operationType: "sync_cancellations",
    source: executionSource,
    status: "completed",
    startedAt: executionStartedAt,
    finishedAt: new Date().toISOString(),
    rowsRead: cancelledOrders?.length || 0,
    rowsWritten: 0,
    estimatedBytes: 0,
    itemsProcessed: 0,
    correlationId: options?.correlationId,
  });

  return 0;
}

/**
 * Sprint 40 Phase 3: Targeted processing for a single order transitioning to cancelled.
 * Avoids global table scans and only acts on the specific order.
 */
export async function syncSingleOrderCancellation(
  tenantId: string,
  orderId: string,
  meliOrderId?: string,
  rawData?: any
): Promise<boolean> {
  const supabase = createAdminClient();

  // Check if cancellation already registered
  const { data: existing } = await supabase
    .from("order_cancellations")
    .select("id")
    .eq("order_id", orderId)
    .maybeSingle();

  if (existing) {
    return false; // Already processed
  }

  const cancelDetail = rawData?.cancel_detail;
  const reason = cancelDetail?.description || "Cancelada";
  const cancelledBy = cancelDetail?.requested_by || "Desconocido";
  const refundAmount = rawData?.total_amount || 0;
  const dateCancelled = cancelDetail?.date || rawData?.last_updated || new Date().toISOString();

  const { error: insertError } = await supabase.from("order_cancellations").insert({
    tenant_id: tenantId,
    order_id: orderId,
    meli_order_id: meliOrderId || rawData?.id?.toString() || "unknown",
    reason,
    cancelled_by: cancelledBy,
    refund_amount: refundAmount,
    date_cancelled: dateCancelled,
    raw_data: cancelDetail || {},
  });

  if (insertError) {
    console.error(`Error registering targeted cancellation for order ${orderId}:`, insertError);
    return false;
  }

  // Revert internal stock atomically
  await revertInternalStockFromCancelledOrder(tenantId, orderId).catch((err) => {
    console.error(`Error revirtiendo stock en cancelación específica ${orderId}:`, err);
  });

  await recordSyncExecution({
    tenantId,
    operationType: "sync_cancellations",
    source: "webhook",
    status: "completed",
    rowsRead: 1,
    rowsWritten: 1,
    estimatedBytes: 250,
    itemsProcessed: 1,
  });

  return true;
}

