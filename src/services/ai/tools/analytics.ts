import { createAdminClient } from "@/lib/supabase/admin";
import { resolveDateRange, resolveMonthToDateComparison } from "../dateRanges";
import { DEFAULT_TIMEZONE } from "@/lib/dates";

export interface SalesSummaryResult {
  revenue: number;
  orders: number;
  units: number;
  averageTicket: number;
  periodLabel: string;
}

export interface ProfitSummaryResult {
  revenue: number;
  productCosts: number;
  marketplaceFees: number;
  shippingCosts: number;
  promotionsAndCoupons: number;
  operationalCosts: number;
  netProfit: number;
  netMargin: number;
  unitsSold: number;
  unitsWithKnownCost: number;
  costCoveragePct: number;
  periodLabel: string;
}

export interface ProductFinancialStat {
  title: string;
  sku: string;
  units: number;
  revenue: number;
  netProfit: number;
  netMargin: number;
}

export interface SalesComparisonResult {
  current: SalesSummaryResult;
  previous: SalesSummaryResult;
  revenueChangePct: number;
  ordersChangePct: number;
  unitsChangePct: number;
}

export interface ProfitComparisonResult {
  current: ProfitSummaryResult;
  previous: ProfitSummaryResult;
  profitChangePct: number;
  marginDeltaPoints: number;
}

/**
 * Common financial calculator for an explicit date interval.
 * Reuses validated LibretaX financial rules:
 * - Excludes cancelled orders and ignored_order_ids
 * - Prioritizes unit_cost_snapshot from frozen orders
 * - Deducts shipping, fees, packaging, and coupons
 */
export async function calculateFinancialRange(
  tenantId: string,
  fromDate: Date,
  toDate: Date,
  customClient?: any
) {
  const supabase = customClient || createAdminClient();

  const { data: tenant } = await supabase
    .from("tenants")
    .select("timezone, metadata")
    .eq("id", tenantId)
    .single();

  const tenantMetadata = (tenant?.metadata as any) || {};
  const packagingCostFallback = Number(tenantMetadata.packaging_cost) || 0;
  const ignoredOrderIds: string[] = tenantMetadata.ignored_order_ids || [];

  // 1. Fetch non-cancelled orders
  const { data: orders } = await supabase
    .from("orders")
    .select("id, total_amount, date_created, raw_data, packaging_cost_snapshot, cost_snapshot_frozen_at, meli_order_id")
    .eq("tenant_id", tenantId)
    .neq("status", "cancelled")
    .gte("date_created", fromDate.toISOString())
    .lte("date_created", toDate.toISOString());

  const filteredOrders = ((orders as any[]) || []).filter(
    (o: any) => !ignoredOrderIds.includes(o.meli_order_id) && !ignoredOrderIds.includes(o.id)
  );
  const orderIds = filteredOrders.map((o: any) => o.id);

  // 2. Fetch products
  const { data: products } = await supabase
    .from("products")
    .select("meli_item_id, sku, title, cost, estimated_fee, estimated_shipping_cost, extra_fee_amount, promotion_discount_amount")
    .eq("tenant_id", tenantId);

  // 3. Fetch order items
  let orderItems: any[] = [];
  if (orderIds.length > 0) {
    const { data: items } = await supabase
      .from("order_items")
      .select("order_id, meli_item_id, title, quantity, total_price, estimated_fee, estimated_shipping_cost, unit_cost, unit_cost_snapshot, cost_snapshot_frozen_at")
      .in("order_id", orderIds);
    if (items) {
      orderItems = items;
    }
  }

  let revenue = 0;
  let productCosts = 0;
  let marketplaceFees = 0;
  let shippingCosts = 0;
  let operationalCosts = 0;
  let promotionsAndCoupons = 0;
  let unitsSold = 0;
  let unitsWithKnownCost = 0;

  const productMap: Record<string, ProductFinancialStat> = {};

  filteredOrders.forEach((o: any) => {
    revenue += Number(o.total_amount) || 0;
    const raw = o.raw_data as any;

    let orderPackagingCost = 0;
    if (o.cost_snapshot_frozen_at && o.packaging_cost_snapshot !== null && o.packaging_cost_snapshot !== undefined) {
      orderPackagingCost = Number(o.packaging_cost_snapshot);
    } else if (raw?.libretax_operational_costs?.packaging_cost !== undefined && raw?.libretax_operational_costs?.packaging_cost !== null) {
      orderPackagingCost = Number(raw.libretax_operational_costs.packaging_cost);
    } else if (!o.cost_snapshot_frozen_at) {
      orderPackagingCost = packagingCostFallback;
    }
    operationalCosts += orderPackagingCost;

    const items = orderItems.filter((i: any) => i.order_id === o.id);
    if (items.length > 0) {
      items.forEach((item: any) => {
        const qty = Number(item.quantity) || 1;
        unitsSold += qty;

        const p = ((products as any[]) || []).find((prod: any) => prod.meli_item_id === item.meli_item_id || prod.title === item.title);
        const sku = p?.sku || item.meli_item_id || "S/SKU";
        const title = p?.title || item.title || "Producto";

        let cost = 0;
        let fee = 0;
        let shipping = 0;
        let promo = 0;

        const hasFrozen = (item.cost_snapshot_frozen_at !== null && item.cost_snapshot_frozen_at !== undefined) ||
                          (o.cost_snapshot_frozen_at !== null && o.cost_snapshot_frozen_at !== undefined);
        let resolvedCost: number | null = null;
        if (item.unit_cost_snapshot !== null && item.unit_cost_snapshot !== undefined) {
          resolvedCost = Number(item.unit_cost_snapshot);
        } else if (item.unit_cost && Number(item.unit_cost) > 0) {
          resolvedCost = Number(item.unit_cost);
        } else if (!hasFrozen && p?.cost) {
          resolvedCost = Number(p.cost);
        }

        if (resolvedCost !== null && resolvedCost > 0) {
          cost = resolvedCost * qty;
          unitsWithKnownCost += qty;
        }

        fee = (Number(item.estimated_fee) || Number(p?.estimated_fee) || 0) * qty;
        shipping = (Number(item.estimated_shipping_cost) || Number(p?.estimated_shipping_cost) || 0) * qty;
        promo = (Number(p?.extra_fee_amount || 0) + Number(p?.promotion_discount_amount || 0)) * qty;

        // Coupon allocation
        const couponAmount = Number(raw?.coupon?.amount) || (raw?.payments && raw.payments.length > 0 ? Number(raw.payments[0].coupon_amount) : 0) || 0;
        if (couponAmount > 0 && Number(o.total_amount) > 0) {
          const itemTotalOriginal = Number(item.total_price) || (Number(o.total_amount) / Math.max(1, items.length));
          const itemShare = itemTotalOriginal / Number(o.total_amount);
          promo += couponAmount * itemShare;
        }

        productCosts += cost;
        marketplaceFees += fee;
        shippingCosts += shipping;
        promotionsAndCoupons += promo;

        const itemRevenue = Number(item.total_price) || 0;
        const itemNet = itemRevenue - cost - fee - shipping - promo;

        if (!productMap[sku]) {
          productMap[sku] = {
            title,
            sku,
            units: 0,
            revenue: 0,
            netProfit: 0,
            netMargin: 0,
          };
        }
        productMap[sku].units += qty;
        productMap[sku].revenue += itemRevenue;
        productMap[sku].netProfit += itemNet;
      });
    } else {
      unitsSold += 1;
    }
  });

  // Calculate margins for product stats
  Object.values(productMap).forEach(stat => {
    stat.netMargin = stat.revenue > 0 ? Number(((stat.netProfit / stat.revenue) * 100).toFixed(2)) : 0;
    stat.netProfit = Number(stat.netProfit.toFixed(2));
    stat.revenue = Number(stat.revenue.toFixed(2));
  });

  const netProfit = revenue - productCosts - marketplaceFees - shippingCosts - operationalCosts - promotionsAndCoupons;
  const netMargin = revenue > 0 ? Number(((netProfit / revenue) * 100).toFixed(2)) : 0;
  const costCoveragePct = unitsSold > 0 ? Number(((unitsWithKnownCost / unitsSold) * 100).toFixed(1)) : 100;

  return {
    ordersCount: filteredOrders.length,
    revenue: Number(revenue.toFixed(2)),
    productCosts: Number(productCosts.toFixed(2)),
    marketplaceFees: Number(marketplaceFees.toFixed(2)),
    shippingCosts: Number(shippingCosts.toFixed(2)),
    operationalCosts: Number(operationalCosts.toFixed(2)),
    promotionsAndCoupons: Number(promotionsAndCoupons.toFixed(2)),
    netProfit: Number(netProfit.toFixed(2)),
    netMargin,
    unitsSold,
    unitsWithKnownCost,
    costCoveragePct,
    productStats: Object.values(productMap),
  };
}

/**
 * 1. getSalesSummary: Total revenue, orders, units, and average ticket.
 */
export async function getSalesSummary(
  tenantId: string,
  params: { from?: string; to?: string; rangeType?: string } = {}
): Promise<SalesSummaryResult> {
  const range = resolveDateRange(params.rangeType || "hoy", DEFAULT_TIMEZONE);
  const fromDate = params.from ? new Date(params.from) : range.from;
  const toDate = params.to ? new Date(params.to) : range.to;

  const data = await calculateFinancialRange(tenantId, fromDate, toDate);
  const averageTicket = data.ordersCount > 0 ? Number((data.revenue / data.ordersCount).toFixed(2)) : 0;

  return {
    revenue: data.revenue,
    orders: data.ordersCount,
    units: data.unitsSold,
    averageTicket,
    periodLabel: range.label,
  };
}

/**
 * 2. getProfitSummary: Complete breakdown of net profit, margins, and cost coverage.
 */
export async function getProfitSummary(
  tenantId: string,
  params: { from?: string; to?: string; rangeType?: string } = {}
): Promise<ProfitSummaryResult> {
  const range = resolveDateRange(params.rangeType || "hoy", DEFAULT_TIMEZONE);
  const fromDate = params.from ? new Date(params.from) : range.from;
  const toDate = params.to ? new Date(params.to) : range.to;

  const data = await calculateFinancialRange(tenantId, fromDate, toDate);

  return {
    revenue: data.revenue,
    productCosts: data.productCosts,
    marketplaceFees: data.marketplaceFees,
    shippingCosts: data.shippingCosts,
    promotionsAndCoupons: data.promotionsAndCoupons,
    operationalCosts: data.operationalCosts,
    netProfit: data.netProfit,
    netMargin: data.netMargin,
    unitsSold: data.unitsSold,
    unitsWithKnownCost: data.unitsWithKnownCost,
    costCoveragePct: data.costCoveragePct,
    periodLabel: range.label,
  };
}

/**
 * 3. getTopProfitProducts: Products sorted by absolute net profit ($).
 */
export async function getTopProfitProducts(
  tenantId: string,
  params: { from?: string; to?: string; rangeType?: string; limit?: number } = {}
): Promise<ProductFinancialStat[]> {
  const range = resolveDateRange(params.rangeType || "hoy", DEFAULT_TIMEZONE);
  const fromDate = params.from ? new Date(params.from) : range.from;
  const toDate = params.to ? new Date(params.to) : range.to;
  const limit = params.limit || 5;

  const data = await calculateFinancialRange(tenantId, fromDate, toDate);
  return data.productStats.sort((a, b) => b.netProfit - a.netProfit).slice(0, limit);
}

/**
 * 4. getTopMarginProducts: Products sorted by percentage net margin (%).
 */
export async function getTopMarginProducts(
  tenantId: string,
  params: { from?: string; to?: string; rangeType?: string; limit?: number } = {}
): Promise<ProductFinancialStat[]> {
  const range = resolveDateRange(params.rangeType || "hoy", DEFAULT_TIMEZONE);
  const fromDate = params.from ? new Date(params.from) : range.from;
  const toDate = params.to ? new Date(params.to) : range.to;
  const limit = params.limit || 5;

  const data = await calculateFinancialRange(tenantId, fromDate, toDate);
  return data.productStats
    .filter(p => p.revenue > 0)
    .sort((a, b) => b.netMargin - a.netMargin)
    .slice(0, limit);
}

/**
 * 5. getTopSellingProducts: Products sorted by volume of units sold.
 */
export async function getTopSellingProducts(
  tenantId: string,
  params: { from?: string; to?: string; rangeType?: string; limit?: number } = {}
): Promise<ProductFinancialStat[]> {
  const range = resolveDateRange(params.rangeType || "este_mes", DEFAULT_TIMEZONE);
  const fromDate = params.from ? new Date(params.from) : range.from;
  const toDate = params.to ? new Date(params.to) : range.to;
  const limit = params.limit || 5;

  const data = await calculateFinancialRange(tenantId, fromDate, toDate);
  return data.productStats.sort((a, b) => b.units - a.units).slice(0, limit);
}

/**
 * 6. compareSalesRanges: Compares revenue, orders and units between two periods.
 */
export async function compareSalesRanges(
  tenantId: string,
  params: {
    comparisonType?: "este_mes_vs_anterior_equivalente" | "custom";
    currentFrom?: string;
    currentTo?: string;
    previousFrom?: string;
    previousTo?: string;
  } = {}
): Promise<SalesComparisonResult> {
  let currFrom: Date;
  let currTo: Date;
  let prevFrom: Date;
  let prevTo: Date;
  let currentLabel = "Período actual";
  let previousLabel = "Período anterior";

  if (params.comparisonType === "este_mes_vs_anterior_equivalente" || !params.currentFrom) {
    const comparison = resolveMonthToDateComparison(DEFAULT_TIMEZONE);
    currFrom = comparison.current.from;
    currTo = comparison.current.to;
    prevFrom = comparison.previous.from;
    prevTo = comparison.previous.to;
    currentLabel = comparison.current.label;
    previousLabel = comparison.previous.label;
  } else {
    currFrom = new Date(params.currentFrom);
    currTo = params.currentTo ? new Date(params.currentTo) : new Date();
    prevFrom = new Date(params.previousFrom || currFrom.toISOString());
    prevTo = new Date(params.previousTo || currTo.toISOString());
  }

  const currData = await calculateFinancialRange(tenantId, currFrom, currTo);
  const prevData = await calculateFinancialRange(tenantId, prevFrom, prevTo);

  const revenueChangePct = prevData.revenue > 0
    ? Number((((currData.revenue - prevData.revenue) / prevData.revenue) * 100).toFixed(1))
    : (currData.revenue > 0 ? 100 : 0);

  const ordersChangePct = prevData.ordersCount > 0
    ? Number((((currData.ordersCount - prevData.ordersCount) / prevData.ordersCount) * 100).toFixed(1))
    : (currData.ordersCount > 0 ? 100 : 0);

  const unitsChangePct = prevData.unitsSold > 0
    ? Number((((currData.unitsSold - prevData.unitsSold) / prevData.unitsSold) * 100).toFixed(1))
    : (currData.unitsSold > 0 ? 100 : 0);

  return {
    current: {
      revenue: currData.revenue,
      orders: currData.ordersCount,
      units: currData.unitsSold,
      averageTicket: currData.ordersCount > 0 ? Number((currData.revenue / currData.ordersCount).toFixed(2)) : 0,
      periodLabel: currentLabel,
    },
    previous: {
      revenue: prevData.revenue,
      orders: prevData.ordersCount,
      units: prevData.unitsSold,
      averageTicket: prevData.ordersCount > 0 ? Number((prevData.revenue / prevData.ordersCount).toFixed(2)) : 0,
      periodLabel: previousLabel,
    },
    revenueChangePct,
    ordersChangePct,
    unitsChangePct,
  };
}

/**
 * 7. compareProfitRanges: Compares net profit and margin points between two periods.
 */
export async function compareProfitRanges(
  tenantId: string,
  params: {
    comparisonType?: "este_mes_vs_anterior_equivalente" | "custom";
    currentFrom?: string;
    currentTo?: string;
    previousFrom?: string;
    previousTo?: string;
  } = {}
): Promise<ProfitComparisonResult> {
  let currFrom: Date;
  let currTo: Date;
  let prevFrom: Date;
  let prevTo: Date;
  let currentLabel = "Período actual";
  let previousLabel = "Período anterior";

  if (params.comparisonType === "este_mes_vs_anterior_equivalente" || !params.currentFrom) {
    const comparison = resolveMonthToDateComparison(DEFAULT_TIMEZONE);
    currFrom = comparison.current.from;
    currTo = comparison.current.to;
    prevFrom = comparison.previous.from;
    prevTo = comparison.previous.to;
    currentLabel = comparison.current.label;
    previousLabel = comparison.previous.label;
  } else {
    currFrom = new Date(params.currentFrom);
    currTo = params.currentTo ? new Date(params.currentTo) : new Date();
    prevFrom = new Date(params.previousFrom || currFrom.toISOString());
    prevTo = new Date(params.previousTo || currTo.toISOString());
  }

  const currData = await calculateFinancialRange(tenantId, currFrom, currTo);
  const prevData = await calculateFinancialRange(tenantId, prevFrom, prevTo);

  const profitChangePct = prevData.netProfit !== 0
    ? Number((((currData.netProfit - prevData.netProfit) / Math.abs(prevData.netProfit)) * 100).toFixed(1))
    : (currData.netProfit > 0 ? 100 : 0);

  const marginDeltaPoints = Number((currData.netMargin - prevData.netMargin).toFixed(2));

  return {
    current: {
      revenue: currData.revenue,
      productCosts: currData.productCosts,
      marketplaceFees: currData.marketplaceFees,
      shippingCosts: currData.shippingCosts,
      promotionsAndCoupons: currData.promotionsAndCoupons,
      operationalCosts: currData.operationalCosts,
      netProfit: currData.netProfit,
      netMargin: currData.netMargin,
      unitsSold: currData.unitsSold,
      unitsWithKnownCost: currData.unitsWithKnownCost,
      costCoveragePct: currData.costCoveragePct,
      periodLabel: currentLabel,
    },
    previous: {
      revenue: prevData.revenue,
      productCosts: prevData.productCosts,
      marketplaceFees: prevData.marketplaceFees,
      shippingCosts: prevData.shippingCosts,
      promotionsAndCoupons: prevData.promotionsAndCoupons,
      operationalCosts: prevData.operationalCosts,
      netProfit: prevData.netProfit,
      netMargin: prevData.netMargin,
      unitsSold: prevData.unitsSold,
      unitsWithKnownCost: prevData.unitsWithKnownCost,
      costCoveragePct: prevData.costCoveragePct,
      periodLabel: previousLabel,
    },
    profitChangePct,
    marginDeltaPoints,
  };
}

/**
 * 8. getStockSummary: Identifies out-of-stock and low-stock products.
 */
export async function getStockSummary(
  tenantId: string,
  params: { lowStockThreshold?: number } = {}
) {
  const supabase = createAdminClient();
  const threshold = params.lowStockThreshold || 5;

  const { data: products } = await supabase
    .from("products")
    .select("meli_item_id, sku, title, stock, status")
    .eq("tenant_id", tenantId);

  const all = products || [];
  const outOfStock = all.filter(p => (Number(p.stock) || 0) <= 0);
  const lowStock = all.filter(p => (Number(p.stock) || 0) > 0 && (Number(p.stock) || 0) <= threshold);

  return {
    totalProducts: all.length,
    outOfStockCount: outOfStock.length,
    lowStockCount: lowStock.length,
    criticalProducts: [...outOfStock, ...lowStock].slice(0, 10).map(p => ({
      title: p.title,
      sku: p.sku || p.meli_item_id,
      stock: p.stock,
      status: p.status,
    })),
  };
}

/**
 * 9. getProductPerformance: Financial & inventory metrics for a specific product query.
 */
export async function getProductPerformance(
  tenantId: string,
  params: { query: string; from?: string; to?: string; rangeType?: string }
) {
  const range = resolveDateRange(params.rangeType || "este_mes", DEFAULT_TIMEZONE);
  const fromDate = params.from ? new Date(params.from) : range.from;
  const toDate = params.to ? new Date(params.to) : range.to;

  const data = await calculateFinancialRange(tenantId, fromDate, toDate);
  const q = (params.query || "").trim().toLowerCase();

  const matched = data.productStats.find(
    p => p.sku.toLowerCase().includes(q) || p.title.toLowerCase().includes(q)
  );

  if (!matched) {
    return {
      found: false,
      message: `No se registraron ventas para "${params.query}" en el período (${range.label}).`,
    };
  }

  return {
    found: true,
    product: matched,
    periodLabel: range.label,
  };
}
