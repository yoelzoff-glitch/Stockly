import { SupabaseClient } from "@supabase/supabase-js";

export interface ProductFinancialRow {
  title: string;
  sku: string;
  qty: number;
  revenue: number;
  cost: number;
  fee: number;
  shipping: number;
  extra: number;
  neta: number;
  marg: number;
}

export interface FinancialData {
  facturacionBruta: number;
  costosProductos: number;
  comisionesML: number;
  envios: number;
  promosCuotas: number;
  cancellationsAmount: number;
  gananciaNeta: number;
  margenNeto: number;
  totalUnitsSold: number;
  unitsWithCost: number;
  costAccuracyPercent: number;
  productAgg: Record<string, ProductFinancialRow>;
  tableData: ProductFinancialRow[];
}

export async function getFinancialData(
  supabase: SupabaseClient,
  tenantId: string,
  dateFrom: Date,
  dateTo: Date,
  packagingCost: number,
  ignoredOrderIds: string[]
): Promise<FinancialData> {
  // 1. Fetch orders
  const { data: orders } = await supabase
    .from("orders")
    .select("id, total_amount, date_created, status, meli_order_id, meli_shipment_id, raw_data")
    .eq("tenant_id", tenantId)
    .neq("status", "cancelled")
    .gte("date_created", dateFrom.toISOString())
    .lte("date_created", dateTo.toISOString());

  // 2. Fetch cancellations
  const { data: cancellations } = await supabase
    .from("order_cancellations")
    .select("refund_amount")
    .eq("tenant_id", tenantId)
    .gte("created_at", dateFrom.toISOString())
    .lte("created_at", dateTo.toISOString());

  // 3. Fetch products (cost and extra info)
  const { data: products } = await supabase
    .from("products")
    .select("id, meli_item_id, title, sku, cost, estimated_fee, estimated_shipping_cost, extra_fee_amount, promotion_discount_amount")
    .eq("tenant_id", tenantId);

  // Filter out ignored/test orders
  const activeOrders = (orders || []).filter(o => !ignoredOrderIds.includes(o.meli_order_id));

  // 4. Fetch order items for active orders
  const orderIds = activeOrders.map(o => o.id);
  const { data: orderItems } = orderIds.length > 0
    ? await supabase
        .from("order_items")
        .select("order_id, meli_item_id, title, quantity, total_price, estimated_fee, estimated_shipping_cost, sku")
        .in("order_id", orderIds)
    : { data: [] };

  // 5. Fetch shipments for fallbacks
  const { data: shipments } = await supabase
    .from("shipments")
    .select("meli_shipment_id, shipping_cost")
    .eq("tenant_id", tenantId);

  // Variables for aggregation
  let facturacionBruta = 0;
  let costosProductos = 0;
  let comisionesML = 0;
  let envios = 0;
  let promosCuotas = 0;
  let totalUnitsSold = 0;
  let unitsWithCost = 0;

  const productAggMap: Record<string, Omit<ProductFinancialRow, "neta" | "marg">> = {};

  activeOrders.forEach(o => {
    const dbItems = (orderItems || []).filter(item => item.order_id === o.id);
    const amount = Number(o.total_amount) || 0;
    facturacionBruta += amount;

    const raw = o.raw_data as any;
    const orderPackagingCost = Number(raw?.klyvo_operational_costs?.packaging_cost || packagingCost);

    let orderCost = 0;
    let orderFees = 0;
    let orderShipping = 0;
    let orderExtra = 0;
    let orderQty = 0;

    const totalOrderQty = dbItems.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0) || 1;

    dbItems.forEach(item => {
      const qty = Number(item.quantity) || 1;
      orderQty += qty;

      let p = item.meli_item_id ? (products || []).find(prod => prod.meli_item_id === item.meli_item_id) : undefined;
      if (!p && item.title) {
        p = (products || []).find(prod => prod.title === item.title);
      }
      
      let itemCost = 0;
      let itemFee = Number(item.estimated_fee) || 0;
      let itemShipping = Number(item.estimated_shipping_cost) || 0;
      let itemExtra = orderPackagingCost * (qty / totalOrderQty);

      if (p) {
        if (p.cost) {
          itemCost = Number(p.cost) * qty;
          unitsWithCost += qty;
        }
        if (itemFee === 0) {
          itemFee = Number(p.estimated_fee || 0) * qty;
        }
        if (itemShipping === 0) {
          itemShipping = Number(p.estimated_shipping_cost || 0) * qty;
        }
        itemExtra += (Number(p.extra_fee_amount || 0) + Number(p.promotion_discount_amount || 0)) * qty;
      }

      orderCost += itemCost;
      orderFees += itemFee;
      orderShipping += itemShipping;
      orderExtra += itemExtra;

      // Product level aggregation
      const titleKey = p ? p.title : (item.title || "Varios");
      if (!productAggMap[titleKey]) {
        productAggMap[titleKey] = {
          title: titleKey,
          sku: p?.sku || item.sku || "-",
          qty: 0,
          revenue: 0,
          cost: 0,
          fee: 0,
          shipping: 0,
          extra: 0
        };
      }
      productAggMap[titleKey].qty += qty;
      productAggMap[titleKey].revenue += (Number(item.total_price) || (amount * (qty / Math.max(1, totalOrderQty))));
      productAggMap[titleKey].cost += itemCost;
      productAggMap[titleKey].fee += itemFee;
      productAggMap[titleKey].shipping += itemShipping;
      productAggMap[titleKey].extra += itemExtra;
    });

    // Fallback if order has no database order items (unlikely but safe)
    if (dbItems.length === 0) {
      const rawQty = raw?.order_items?.reduce((sum: number, item: any) => sum + (Number(item.quantity) || 1), 0) || 1;
      orderQty = rawQty;
      
      const rawFee = raw?.order_items?.reduce((sum: number, item: any) => sum + (Number(item.sale_fee) || 0) * (Number(item.quantity) || 1), 0) || 0;
      orderFees = rawFee;

      const shipment = (shipments || []).find(s => s.meli_shipment_id === o.meli_shipment_id);
      orderShipping = Number(shipment?.shipping_cost) || 0;

      const firstRawItem = raw?.order_items?.[0];
      const meliProductId = firstRawItem?.item?.id || null;
      const productTitle = firstRawItem?.item?.title || "Varios";
      
      let p = meliProductId ? (products || []).find(prod => prod.meli_item_id === meliProductId) : undefined;
      if (!p && productTitle) {
        p = (products || []).find(prod => prod.title === productTitle);
      }
      
      let itemExtra = orderPackagingCost;

      if (p) {
        if (p.cost) {
          orderCost = Number(p.cost) * rawQty;
          unitsWithCost += rawQty;
        }
        if (orderFees === 0) {
          orderFees = Number(p.estimated_fee || 0) * rawQty;
        }
        if (orderShipping === 0) {
          orderShipping = Number(p.estimated_shipping_cost || 0) * rawQty;
        }
        itemExtra += (Number(p.extra_fee_amount || 0) + Number(p.promotion_discount_amount || 0)) * rawQty;
      }

      orderExtra = itemExtra;

      const titleKey = p ? p.title : (productTitle || "Varios");
      if (!productAggMap[titleKey]) {
        productAggMap[titleKey] = {
          title: titleKey,
          sku: p?.sku || "-",
          qty: 0,
          revenue: 0,
          cost: 0,
          fee: 0,
          shipping: 0,
          extra: 0
        };
      }
      productAggMap[titleKey].qty += rawQty;
      productAggMap[titleKey].revenue += amount;
      productAggMap[titleKey].cost += orderCost;
      productAggMap[titleKey].fee += orderFees;
      productAggMap[titleKey].shipping += orderShipping;
      productAggMap[titleKey].extra += orderExtra;
    }

    costosProductos += orderCost;
    comisionesML += orderFees;
    
    if (orderShipping === 0) {
      const shipment = (shipments || []).find(s => s.meli_shipment_id === o.meli_shipment_id);
      orderShipping = Number(shipment?.shipping_cost) || 0;
    }
    envios += orderShipping;
    promosCuotas += orderExtra;
    totalUnitsSold += orderQty;
  });

  const cancellationsAmount = (cancellations || []).reduce((sum, c) => sum + (Number(c.refund_amount) || 0), 0);

  const gananciaNeta = facturacionBruta - costosProductos - comisionesML - envios - promosCuotas;
  const margenNeto = facturacionBruta > 0 ? (gananciaNeta / facturacionBruta) * 100 : 0;
  const costAccuracyPercent = totalUnitsSold > 0 ? (unitsWithCost / totalUnitsSold) * 100 : 100;

  // Calculate net profit and margins for each product row, and sort by revenue descending
  const tableData: ProductFinancialRow[] = Object.values(productAggMap).map(row => {
    const neta = row.revenue - row.cost - row.fee - row.shipping - row.extra;
    const marg = row.revenue > 0 ? (neta / row.revenue) * 100 : 0;
    return { ...row, neta, marg };
  }).sort((a, b) => b.revenue - a.revenue);

  const productAgg: Record<string, ProductFinancialRow> = {};
  tableData.forEach(row => {
    productAgg[row.title] = row;
  });

  return {
    facturacionBruta,
    costosProductos,
    comisionesML,
    envios,
    promosCuotas,
    cancellationsAmount,
    gananciaNeta,
    margenNeto,
    totalUnitsSold,
    unitsWithCost,
    costAccuracyPercent,
    productAgg,
    tableData
  };
}
