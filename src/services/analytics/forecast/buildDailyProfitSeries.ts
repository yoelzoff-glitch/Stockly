// src/services/analytics/forecast/buildDailyProfitSeries.ts

import { SupabaseClient } from "@supabase/supabase-js";
import { DailyProfitPoint } from "./types";
import { normalizeSku } from "@/services/products/sku/normalizeSku";
import { getMidnightInTimezone, getTenantDateTimeParts } from "@/lib/dates";

/**
 * Builds the canonical daily net profit series for a tenant over the requested historical window (default 90 days).
 *
 * Rules:
 * 1. Reuses the exact same financial profit formula as getFinancialData:
 *    netProfit = revenue - productCosts - meliFees - shippingCosts - operationalPromos - verifiedCancellations
 * 2. Groups days strictly in tenant's timezone (no UTC leakage).
 * 3. Days with zero sales/profit are explicitly included as { netProfit: 0, orderCount: 0, revenue: 0 }.
 * 4. Single batch query for orders, products, cancellations and shipments to ensure fast performance.
 */
export async function buildDailyProfitSeries(
  supabase: SupabaseClient,
  tenantId: string,
  days = 90,
  timezone = "America/Argentina/Buenos_Aires",
  packagingCost = 0,
  ignoredOrderIds: string[] = []
): Promise<DailyProfitPoint[]> {
  const now = new Date();
  const { year: curY, month: curM, day: curD } = getTenantDateTimeParts(now, timezone);

  // Compute start date: `days` days ago in tenant timezone
  const startRef = new Date(Date.UTC(curY, curM - 1, curD, 12, 0, 0));
  startRef.setUTCDate(startRef.getUTCDate() - days + 1);
  const dateFrom = getMidnightInTimezone(startRef, timezone);

  // 1. Parallel fetch of required canonical data
  const [
    { data: orders },
    { data: cancellations },
    { data: products },
    { data: shipments },
  ] = await Promise.all([
    supabase
      .from("orders")
      .select("id, total_amount, date_created, status, meli_order_id, meli_shipment_id, raw_data, packaging_cost_snapshot, cost_snapshot_frozen_at")
      .eq("tenant_id", tenantId)
      .neq("status", "cancelled")
      .gte("date_created", dateFrom.toISOString())
      .lte("date_created", now.toISOString()),
    supabase
      .from("order_cancellations")
      .select("refund_amount, date_cancelled, orders(raw_data)")
      .eq("tenant_id", tenantId)
      .gte("date_cancelled", dateFrom.toISOString())
      .lte("date_cancelled", now.toISOString()),
    supabase
      .from("products")
      .select("id, meli_item_id, title, sku, cost, estimated_fee, estimated_shipping_cost, extra_fee_amount, promotion_discount_amount, status")
      .eq("tenant_id", tenantId),
    supabase
      .from("shipments")
      .select("meli_shipment_id, shipping_cost")
      .eq("tenant_id", tenantId)
      .gte("date_created", dateFrom.toISOString()),
  ]);

  const activeOrders = (orders || []).filter(
    (o) => !ignoredOrderIds.includes(o.meli_order_id)
  );

  const orderIds = activeOrders.map((o) => o.id);

  // Fetch order items
  const { data: orderItems } = orderIds.length > 0
    ? await supabase
        .from("order_items")
        .select("order_id, meli_item_id, title, quantity, total_price, estimated_fee, estimated_shipping_cost, sku, unit_cost, unit_cost_snapshot, cost_snapshot_frozen_at, estimated_fee_snapshot, estimated_shipping_cost_snapshot, extra_fee_amount_snapshot, promotion_discount_amount_snapshot")
        .in("order_id", orderIds)
    : { data: [] };

  const itemsByOrder = new Map<string, any[]>();
  orderItems?.forEach((item) => {
    const list = itemsByOrder.get(item.order_id) || [];
    list.push(item);
    itemsByOrder.set(item.order_id, list);
  });

  const shipmentCostMap = new Map<string, number>();
  shipments?.forEach((s) => {
    if (s.meli_shipment_id && s.shipping_cost !== null && Number(s.shipping_cost) > 0) {
      shipmentCostMap.set(s.meli_shipment_id.toString(), Number(s.shipping_cost));
    }
  });

  // Pre-index products by meli_item_id and normalized SKU for O(1) matching
  const productByMeliId = new Map<string, any>();
  const productBySkuWithCost = new Map<string, any>();
  const productBySkuAny = new Map<string, any>();

  products?.forEach((p) => {
    if (p.meli_item_id) productByMeliId.set(p.meli_item_id, p);
    if (p.sku) {
      const norm = normalizeSku(p.sku);
      if (norm) {
        if (!productBySkuAny.has(norm)) productBySkuAny.set(norm, p);
        if (p.cost && Number(p.cost) > 0) productBySkuWithCost.set(norm, p);
      }
    }
  });

  // Helper to resolve product metadata
  function resolveProduct(itemMeliId?: string | null, itemSku?: string | null) {
    let p = itemMeliId ? productByMeliId.get(itemMeliId) : undefined;
    if (p && (!p.cost || Number(p.cost) <= 0) && p.sku) {
      const norm = normalizeSku(p.sku);
      if (norm && productBySkuWithCost.has(norm)) {
        p = productBySkuWithCost.get(norm);
      }
    }
    if (!p && itemSku) {
      const norm = normalizeSku(itemSku);
      if (norm) {
        p = productBySkuWithCost.get(norm) || productBySkuAny.get(norm);
      }
    }
    return p;
  }

  // Map to accumulate daily financials
  // key: "YYYY-MM-DD"
  const dailyMap = new Map<
    string,
    {
      date: string;
      weekday: number;
      revenue: number;
      costs: number;
      fees: number;
      shipping: number;
      promos: number;
      cancellations: number;
      orderCount: number;
    }
  >();

  // Initialize all calendar days from dateFrom to today in tenant timezone
  const dateCursor = new Date(dateFrom.getTime());
  const todayTenantStr = `${curY}-${String(curM).padStart(2, "0")}-${String(curD).padStart(2, "0")}`;

  while (true) {
    const { year: dY, month: dM, day: dD } = getTenantDateTimeParts(dateCursor, timezone);
    const dateStr = `${dY}-${String(dM).padStart(2, "0")}-${String(dD).padStart(2, "0")}`;
    const weekday = new Date(Date.UTC(dY, dM - 1, dD, 12, 0, 0)).getUTCDay();

    dailyMap.set(dateStr, {
      date: dateStr,
      weekday,
      revenue: 0,
      costs: 0,
      fees: 0,
      shipping: 0,
      promos: 0,
      cancellations: 0,
      orderCount: 0,
    });

    if (dateStr >= todayTenantStr) break;
    dateCursor.setTime(dateCursor.getTime() + 24 * 60 * 60 * 1000);
  }

  // Aggregate orders into daily buckets
  activeOrders.forEach((o) => {
    const orderCreated = new Date(o.date_created);
    const { year: oY, month: oM, day: oD } = getTenantDateTimeParts(orderCreated, timezone);
    const dateStr = `${oY}-${String(oM).padStart(2, "0")}-${String(oD).padStart(2, "0")}`;

    const dayEntry = dailyMap.get(dateStr);
    if (!dayEntry) return;

    const amount = Number(o.total_amount) || 0;
    dayEntry.revenue += amount;
    dayEntry.orderCount += 1;

    const raw = o.raw_data as any;
    const dbItems = itemsByOrder.get(o.id) || [];
    const actualShipCost = o.meli_shipment_id
      ? shipmentCostMap.get(o.meli_shipment_id.toString()) ?? null
      : null;

    const couponAmount =
      Number(raw?.coupon?.amount) ||
      (raw?.payments && raw.payments.length > 0 ? Number(raw.payments[0].coupon_amount) : 0) ||
      0;

    let orderPackagingCost = 0;
    if (o.cost_snapshot_frozen_at && o.packaging_cost_snapshot !== null && o.packaging_cost_snapshot !== undefined) {
      orderPackagingCost = Number(o.packaging_cost_snapshot);
    } else if (raw?.libretax_operational_costs?.packaging_cost !== undefined && raw?.libretax_operational_costs?.packaging_cost !== null) {
      orderPackagingCost = Number(raw.libretax_operational_costs.packaging_cost);
    } else if (raw?.klyvo_operational_costs?.packaging_cost !== undefined && raw?.klyvo_operational_costs?.packaging_cost !== null) {
      orderPackagingCost = Number(raw.klyvo_operational_costs.packaging_cost);
    } else if (!o.cost_snapshot_frozen_at) {
      orderPackagingCost = packagingCost;
    }

    let orderCost = 0;
    let orderFees = 0;
    let orderShipping = 0;
    let orderPromo = 0;

    dbItems.forEach((item) => {
      const qty = Number(item.quantity) || 1;
      let itemCost = 0;
      let itemFee = item.estimated_fee_snapshot !== null && item.estimated_fee_snapshot !== undefined
        ? Number(item.estimated_fee_snapshot) * qty
        : Number(item.estimated_fee || 0) * qty;

      let itemShipping = 0;
      if (item.estimated_shipping_cost_snapshot !== null && item.estimated_shipping_cost_snapshot !== undefined) {
        itemShipping = Number(item.estimated_shipping_cost_snapshot) * qty;
      } else {
        itemShipping = Number(item.estimated_shipping_cost || 0) * qty;
      }

      const p = resolveProduct(item.meli_item_id, item.sku);

      // Resolution order for item cost:
      // 1. item.unit_cost_snapshot
      // 2. legacy item.unit_cost
      // 3. products.cost ONLY for legacy orders without snapshot
      const hasFrozenSnapshot = item.cost_snapshot_frozen_at !== null && item.cost_snapshot_frozen_at !== undefined;
      let resolvedUnitCost: number | null = null;

      if (hasFrozenSnapshot && item.unit_cost_snapshot !== null && item.unit_cost_snapshot !== undefined) {
        resolvedUnitCost = Number(item.unit_cost_snapshot);
      } else if (item.unit_cost && Number(item.unit_cost) > 0) {
        resolvedUnitCost = Number(item.unit_cost);
      } else if (!hasFrozenSnapshot && !o.cost_snapshot_frozen_at) {
        if (p && p.cost && Number(p.cost) > 0) {
          resolvedUnitCost = Number(p.cost);
        }
      }

      if (resolvedUnitCost !== null && resolvedUnitCost > 0) {
        itemCost = resolvedUnitCost * qty;
      }

      if (item.extra_fee_amount_snapshot !== null || item.promotion_discount_amount_snapshot !== null) {
        orderPromo += (Number(item.extra_fee_amount_snapshot || 0) + Number(item.promotion_discount_amount_snapshot || 0)) * qty;
      } else if (p) {
        if (itemFee === 0) {
          itemFee = Number(p.estimated_fee || 0) * qty;
        }
        if (itemShipping === 0 && actualShipCost === null) {
          itemShipping = Number(p.estimated_shipping_cost || 0) * qty;
        }
        const itemExtra = (Number(p.extra_fee_amount || 0) + Number(p.promotion_discount_amount || 0)) * qty;
        orderPromo += itemExtra;
      }

      orderCost += itemCost;
      orderFees += itemFee;
      orderShipping += itemShipping;
    });

    if (actualShipCost !== null) {
      orderShipping = actualShipCost;
    }

    const totalQty = dbItems.reduce((sum, it) => sum + (Number(it.quantity) || 1), 0) || 1;
    const orderPackaging = orderPackagingCost * totalQty;

    dayEntry.costs += orderCost;
    dayEntry.fees += orderFees;
    dayEntry.shipping += orderShipping;
    dayEntry.promos += (orderPromo + couponAmount + orderPackaging);
  });

  // Aggregate valid cancellations into the cancellation day
  cancellations?.forEach((c: any) => {
    const order = c.orders;
    if (!order) return;
    const payments = order.raw_data?.payments || [];
    const isValidPaidOrder = payments.some((p: any) => p.status === "approved" || p.status === "refunded");
    if (!isValidPaidOrder) return;

    const cancelDate = new Date(c.date_cancelled);
    const { year: cY, month: cM, day: cD } = getTenantDateTimeParts(cancelDate, timezone);
    const dateStr = `${cY}-${String(cM).padStart(2, "0")}-${String(cD).padStart(2, "0")}`;

    const dayEntry = dailyMap.get(dateStr);
    if (dayEntry) {
      dayEntry.cancellations += Number(c.refund_amount) || 0;
    }
  });

  // Convert to sorted DailyProfitPoint array
  const sortedDates = Array.from(dailyMap.keys()).sort();
  return sortedDates.map((dateKey) => {
    const e = dailyMap.get(dateKey)!;
    // Formula matching getFinancialData exactly:
    // gananciaNeta = facturacionBruta - costosProductos - comisionesML - envios - promosCuotas
    const netProfit = Math.round(e.revenue - e.costs - e.fees - e.shipping - e.promos - e.cancellations);
    return {
      date: e.date,
      weekday: e.weekday,
      netProfit,
      orderCount: e.orderCount,
      revenue: Math.round(e.revenue),
    };
  });
}
