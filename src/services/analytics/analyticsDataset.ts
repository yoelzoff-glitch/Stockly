import { SupabaseClient } from "@supabase/supabase-js";
import { logEgressSample } from "@/lib/observability/egress";

export interface AnalyticsDataset {
  tenantId: string;
  dateFrom: Date;
  dateTo: Date;
  orders: any[];
  activeOrders: any[];
  orderItems: any[];
  products: any[];
  shipments: any[];
  cancellations: any[];
  fetchedAt: number;
}

export interface GetAnalyticsDatasetParams {
  supabase: SupabaseClient;
  tenantId: string;
  dateFrom: Date;
  dateTo?: Date;
  historicalDays?: number;
  ignoredOrderIds?: string[];
  forceRefresh?: boolean;
}

// In-memory tenant-scoped cache
// Key format: analytics-dataset:<tenantId>:<dateFromIso>:<dateToIso>
const datasetCache = new Map<string, { dataset: AnalyticsDataset; expiresAt: number }>();
const CACHE_TTL_MS = 35 * 1000; // 35 seconds short TTL

/**
 * Generates an isolated, tenant-scoped cache key.
 */
function buildCacheKey(tenantId: string, dateFrom: Date, dateTo: Date): string {
  return `analytics-dataset:${tenantId}:${dateFrom.toISOString()}:${dateTo.toISOString()}`;
}

/**
 * Invalidates cached analytics dataset for a specific tenant (or specific date window).
 */
export function invalidateAnalyticsDatasetCache(tenantId: string): void {
  for (const key of datasetCache.keys()) {
    if (key.startsWith(`analytics-dataset:${tenantId}:`)) {
      datasetCache.delete(key);
    }
  }
}

/**
 * Fetches a consolidated shared dataset for Analytics, Finance, Forecast, Pareto and Campaigns in a single pass.
 */
export async function getAnalyticsDataset(params: GetAnalyticsDatasetParams): Promise<AnalyticsDataset> {
  const {
    supabase,
    tenantId,
    dateFrom,
    dateTo = new Date(),
    ignoredOrderIds = [],
    forceRefresh = false,
  } = params;

  const cacheKey = buildCacheKey(tenantId, dateFrom, dateTo);
  const now = Date.now();

  if (!forceRefresh) {
    const cached = datasetCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return cached.dataset;
    }
  }

  // 1. Parallel fetch of foundational entities with lean column projections (avoiding full raw_data)
  const [
    { data: ordersData },
    { data: cancellationsData },
    { data: productsData },
  ] = await Promise.all([
    supabase
      .from("orders")
      .select("id, total_amount, date_created, status, meli_order_id, meli_shipment_id, coupon:raw_data->coupon, payments:raw_data->payments, legacy_order_items:raw_data->order_items, libretax_operational_costs:raw_data->libretax_operational_costs, klyvo_operational_costs:raw_data->klyvo_operational_costs, packaging_cost_snapshot, flex_cost_snapshot, operational_cost_snapshot_version, cost_snapshot_frozen_at, cost_snapshot_source, cost_snapshot_status")
      .eq("tenant_id", tenantId)
      .neq("status", "cancelled")
      .gte("date_created", dateFrom.toISOString())
      .lte("date_created", dateTo.toISOString())
      .order("date_created", { ascending: false }),

    supabase
      .from("order_cancellations")
      .select("refund_amount, date_cancelled, orders(payments:raw_data->payments)")
      .eq("tenant_id", tenantId)
      .gte("date_cancelled", dateFrom.toISOString())
      .lte("date_cancelled", dateTo.toISOString()),

    supabase
      .from("products")
      .select("id, tenant_id, meli_item_id, title, sku, cost, estimated_fee, estimated_shipping_cost, extra_fee_amount, promotion_discount_amount, status, sold_quantity, available_quantity, margin_percent, price, listing_type_id, permalink")
      .eq("tenant_id", tenantId),
  ]);

  const orders = (ordersData || []).map((o: any) => {
    // Reconstruct transparent raw object for downstream formula compatibility
    const raw = o.raw_data || {
      coupon: o.coupon,
      payments: o.payments,
      order_items: o.legacy_order_items,
      libretax_operational_costs: o.libretax_operational_costs,
      klyvo_operational_costs: o.klyvo_operational_costs,
    };
    return { ...o, raw_data: raw };
  });

  logEgressSample({
    tenantId,
    operation: "analytics.baseOrders",
    table: "orders",
    data: orders,
  });

  logEgressSample({
    tenantId,
    operation: "analytics.cancellations",
    table: "order_cancellations",
    data: cancellationsData,
  });

  logEgressSample({
    tenantId,
    operation: "analytics.products",
    table: "products",
    data: productsData,
  });

  const activeOrders = orders.filter((o: any) => !ignoredOrderIds.includes(o.meli_order_id));
  const activeOrderIds = activeOrders.map((o: any) => o.id);

  // 2. Fetch order_items for active orders
  let orderItems: any[] = [];
  if (activeOrderIds.length > 0) {
    const CHUNK_SIZE = 150;
    for (let i = 0; i < activeOrderIds.length; i += CHUNK_SIZE) {
      const chunkIds = activeOrderIds.slice(i, i + CHUNK_SIZE);
      const { data: itemsChunk } = await supabase
        .from("order_items")
        .select("order_id, product_id, meli_item_id, title, quantity, total_price, estimated_fee, estimated_shipping_cost, sku, unit_cost, line_key, unit_cost_snapshot, cost_snapshot_frozen_at, cost_snapshot_source, cost_snapshot_version, estimated_fee_snapshot, estimated_shipping_cost_snapshot, extra_fee_amount_snapshot, promotion_discount_amount_snapshot, estimated_tax_snapshot")
        .in("order_id", chunkIds);

      if (itemsChunk && itemsChunk.length > 0) {
        orderItems = orderItems.concat(itemsChunk);
      }
    }
  }

  // 3. Fetch shipments bounded to active orders in chunks of 200 IDs (Phase 3)
  const shipmentIds = Array.from(new Set(activeOrders.map((o: any) => o.meli_shipment_id).filter(Boolean)));
  let shipments: any[] = [];
  if (shipmentIds.length > 0) {
    const SHIPMENT_CHUNK = 200;
    for (let i = 0; i < shipmentIds.length; i += SHIPMENT_CHUNK) {
      const chunk = shipmentIds.slice(i, i + SHIPMENT_CHUNK);
      const { data: shipChunk } = await supabase
        .from("shipments")
        .select("meli_shipment_id, shipping_cost, substatus, receiver_state, date_created")
        .eq("tenant_id", tenantId)
        .in("meli_shipment_id", chunk);

      if (shipChunk && shipChunk.length > 0) {
        shipments = shipments.concat(shipChunk);
      }
    }
  }

  logEgressSample({
    tenantId,
    operation: "analytics.shipments",
    table: "shipments",
    data: shipments,
  });

  const dataset: AnalyticsDataset = {
    tenantId,
    dateFrom,
    dateTo,
    orders,
    activeOrders,
    orderItems,
    products: productsData || [],
    shipments,
    cancellations: cancellationsData || [],
    fetchedAt: now,
  };

  datasetCache.set(cacheKey, {
    dataset,
    expiresAt: now + CACHE_TTL_MS,
  });

  return dataset;
}
