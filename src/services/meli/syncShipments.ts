import { createAdminClient } from "@/lib/supabase/admin";
import { getShipment } from "./getShipment";
import { RetryAfterError } from "inngest";
import { logEgressSample } from "@/lib/observability/egress";
import { recordSyncExecution, SyncExecutionSource } from "@/lib/observability/operationRuns";

export async function syncShipments(
  tenantId: string,
  specificShipmentId?: string,
  options?: { source?: SyncExecutionSource; correlationId?: string; shipmentData?: any }
) {
  const executionSource: SyncExecutionSource =
    options?.source || (specificShipmentId ? "webhook" : "cron_incremental");
  const executionStartedAt = new Date().toISOString();
  const supabase = createAdminClient();

  // 1. Fetch recent orders (last 30 days) with a shipment ID
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  let query = supabase
    .from("orders")
    .select("id, meli_shipment_id, tenant_id")
    .eq("tenant_id", tenantId)
    .not("meli_shipment_id", "is", null);

  if (specificShipmentId) {
    query = query.eq("meli_shipment_id", specificShipmentId);
  } else {
    query = query.gte("date_created", thirtyDaysAgo.toISOString());
  }

  const { data: orders, error: ordersError } = await query;

  logEgressSample({
    tenantId,
    operation: "syncShipments.orders",
    table: "orders",
    data: orders,
  });

  if (ordersError) throw new Error(`Failed to read shipment orders: ${ordersError.message}`);
  if (!orders || orders.length === 0) {
    // A shipment notification can arrive before its order notification.
    if (specificShipmentId) throw new RetryAfterError("Shipment order is not synced yet", "30s");
    return 0;
  }

  // Filter out orders that already have a completed shipment status in our DB
  let ordersToSync = orders;
  if (!specificShipmentId) {
    const orderIds = orders.map(o => o.id);
    const { data: completedShipments, error: completedError } = await supabase
      .from("shipments")
      .select("order_id")
      .eq("tenant_id", tenantId)
      .in("order_id", orderIds)
      .in("status", ["delivered", "cancelled", "returned"]);

    logEgressSample({
      tenantId,
      operation: "syncShipments.completedShipments",
      table: "shipments",
      data: completedShipments,
    });

    if (completedError) throw new Error(`Failed to read existing shipments: ${completedError.message}`);
    const completedOrderIds = new Set(completedShipments?.map(s => s.order_id) || []);
    ordersToSync = orders.filter(o => !completedOrderIds.has(o.id));
  }

  if (ordersToSync.length === 0) {
    return 0;
  }

  // 1.5 Fetch tenant metadata for flex zones
  const { data: tenantData, error: tenantError } = await supabase
    .from("tenants")
    .select("metadata")
    .eq("id", tenantId)
    .single();

  if (tenantError) throw new Error(`Failed to read shipment settings: ${tenantError.message}`);
  const tenantMetadata = (tenantData?.metadata as any) || {};
  const flexZones = tenantMetadata.flex_zones || [];

  let syncedCount = 0;
  const shipmentsToUpsert: any[] = [];

  const fetchedShipments = new Map<string, any>();
  const failures: string[] = [];

  // 2. Fetch each shipment
  for (const order of ordersToSync) {
    try {
      // getShipment now accepts tenantId directly and uses meliFetch
      const shipmentId = String(order.meli_shipment_id);
      let shipment = fetchedShipments.get(shipmentId);
      if (!shipment) {
        shipment = options?.shipmentData?.id?.toString() === shipmentId
          ? options.shipmentData
          : await getShipment(tenantId, shipmentId);
        if (!shipment?.id) throw new RetryAfterError(`Shipment ${shipmentId} is not available yet`, "30s");
        fetchedShipments.set(shipmentId, shipment);
      }
      
      if (shipment) {
        let shippingCost = shipment.shipping_option?.list_cost ?? shipment.base_cost;
        if (shipment.logistic_type !== "self_service" &&
            (shippingCost == null || !Number.isFinite(Number(shippingCost)))) {
          throw new Error(`Shipping cost is not available for ${shipmentId}`);
        }

        if (shipment.logistic_type === "self_service") {
          const mlCost = shipment.base_cost || shipment.shipping_option?.list_cost || 0;
          let matchedZone = null;
          let minDiff = Infinity;

          for (const z of flexZones) {
            const configuredPays = Number(z.ml_pays) || 0;
            const candidates = [configuredPays];
            if (configuredPays < 1000) {
              candidates.push(configuredPays * 10);
            }
            for (const candidate of candidates) {
              const diff = Math.abs(candidate - mlCost);
              if (diff < minDiff) {
                minDiff = diff;
                matchedZone = z;
              }
            }
          }

          if (matchedZone) {
            let motoCost = Number(matchedZone.moto_costs) || 0;
            if (motoCost > 0 && motoCost < 1000) {
              motoCost = motoCost * 10;
            }
            shippingCost = motoCost;
          } else {
            shippingCost = flexZones.length > 0 ? (Number(flexZones[0].moto_costs) || 0) : 0;
            if (shippingCost > 0 && shippingCost < 1000) {
              shippingCost = shippingCost * 10;
            }
          }
        }

        shipmentsToUpsert.push({
          tenant_id: tenantId,
          order_id: order.id,
          meli_shipment_id: order.meli_shipment_id,
          status: shipment.status,
          substatus: shipment.substatus,
          logistic_type: shipment.logistic_type,
          mode: shipment.mode,
          tracking_number: shipment.tracking_number,
          tracking_method: shipment.tracking_method,
          shipping_cost: shippingCost,
          receiver_city: shipment.receiver_address?.city?.name,
          receiver_state: shipment.receiver_address?.state?.name,
          date_created: shipment.date_created,
          last_updated: shipment.last_updated,
          raw_data: shipment,
        });
      }
    } catch (e: any) {
      failures.push(`${order.meli_shipment_id}: ${e?.message || "shipment fetch failed"}`);
    }
  }

  // Serialize per order and persist in one database transaction. Never delete
  // a good shipment in a separate request before writing its replacement.
  for (const shipment of shipmentsToUpsert) {
    const { error } = await supabase.rpc("persist_meli_shipment", {
      p_tenant_id: tenantId,
      p_order_id: shipment.order_id,
      p_shipment: shipment,
    });
    if (error) failures.push(`${shipment.meli_shipment_id}: ${error.message}`);
    else syncedCount++;
  }

  if (failures.length) {
    await recordSyncExecution({
      tenantId, operationType: "sync_shipments", source: executionSource,
      status: "failed", startedAt: executionStartedAt, rowsWritten: syncedCount,
      errorCode: "SYNC_SHIPMENTS_FAILED", errorMessage: failures.join("; "),
      correlationId: options?.correlationId,
    });
    throw new RetryAfterError(`Incomplete shipment sync: ${failures.join("; ")}`, "30s");
  }

  try {
    const { revalidatePath, revalidateTag } = await import("next/cache");
    revalidatePath("/dashboard/sales", "layout");
    revalidatePath("/dashboard/shipments");
    revalidatePath("/dashboard/finance");
    revalidatePath("/dashboard");
    (revalidateTag as any)(`orders-${tenantId}`);
    (revalidateTag as any)(`tenant-${tenantId}`);
  } catch { /* Background/test contexts may not provide Next's cache store. */ }

  await recordSyncExecution({
    tenantId,
    operationType: "sync_shipments",
    source: executionSource,
    status: "completed",
    startedAt: executionStartedAt,
    finishedAt: new Date().toISOString(),
    rowsRead: orders?.length || 0,
    rowsWritten: syncedCount,
    estimatedBytes: Math.round(syncedCount * 300),
    itemsProcessed: syncedCount,
    correlationId: options?.correlationId,
  });

  return syncedCount;
}
