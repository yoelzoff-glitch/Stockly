import { SupabaseClient } from "@supabase/supabase-js";
import { normalizeSku } from "@/services/products/sku/normalizeSku";
import { getMidnightInTimezone } from "@/services/ai/tools/finance";

function getYearAndMonthInTimezone(date: Date, tz: string): { year: number; month: number } {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
  });
  const [year, month] = formatter.format(date).split('-').map(Number);
  return { year, month: month - 1 }; // month is 0-indexed internally
}


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
  totalCupones: number;
  totalPackaging: number;
  totalPromociones: number;
  descuentosYCupones: number;
  cancellationsAmount: number;
  gananciaNeta: number;
  margenNeto: number;
  totalUnitsSold: number;
  unitsWithCost: number;
  costAccuracyPercent: number;
  productAgg: Record<string, ProductFinancialRow>;
  tableData: ProductFinancialRow[];
  monthlyExpensesTotal: number;
  gananciaBolsilloLimpia: number;
  appliedExpensesBreakdown: { name: string; amount: number; type: string }[];
}

import { AnalyticsDataset } from "@/services/analytics/analyticsDataset";
import { logEgressSample } from "@/lib/observability/egress";

export async function getFinancialData(
  supabase: SupabaseClient,
  tenantId: string,
  dateFrom: Date,
  dateTo: Date,
  packagingCost: number,
  ignoredOrderIds: string[],
  disableProration = false,
  timezone = 'America/Argentina/Buenos_Aires',
  dataset?: AnalyticsDataset
): Promise<FinancialData> {
  let orders: any[];
  let cancellations: any[];
  let products: any[];
  let activeOrders: any[];
  let orderItems: any[];
  let shipments: any[];

  if (dataset && dataset.tenantId === tenantId) {
    // Phase 4: Shared Dataset Fast-Path
    orders = dataset.orders;
    cancellations = dataset.cancellations;
    products = dataset.products;
    activeOrders = dataset.activeOrders;
    orderItems = dataset.orderItems;
    shipments = dataset.shipments;
  } else {
    // 1. Fetch orders with explicit JSONB projections and stable ID tiebreaker pagination
    orders = [];
    let ordersOffset = 0;
    const ORDERS_CHUNK = 1000;
    let hasMoreOrders = true;

    while (hasMoreOrders) {
      let ordersQuery = supabase
        .from("orders")
        .select("id, total_amount, date_created, status, meli_order_id, meli_shipment_id, coupon:raw_data->coupon, payments:raw_data->payments, legacy_order_items:raw_data->order_items, libretax_operational_costs:raw_data->libretax_operational_costs, klyvo_operational_costs:raw_data->klyvo_operational_costs, packaging_cost_snapshot, flex_cost_snapshot, cost_snapshot_frozen_at, cost_snapshot_source, cost_snapshot_status")
        .eq("tenant_id", tenantId)
        .neq("status", "cancelled")
        .gte("date_created", dateFrom.toISOString())
        .lte("date_created", dateTo.toISOString());

      if (typeof (ordersQuery as any).order === "function") {
        ordersQuery = (ordersQuery as any)
          .order("date_created", { ascending: false })
          .order("id", { ascending: false });
      }

      const hasRangeSupport = typeof (ordersQuery as any).range === "function";
      if (hasRangeSupport) {
        ordersQuery = (ordersQuery as any).range(ordersOffset, ordersOffset + ORDERS_CHUNK - 1);
      }

      const { data: ordersData, error: ordersErr } = await ordersQuery;

      if (ordersErr) {
        throw new Error(`Error al consultar órdenes en Finanzas: ${ordersErr.message}`);
      }

      const batch = (ordersData || []).map((o: any) => {
        const raw = o.raw_data || {
          coupon: o.coupon,
          payments: o.payments,
          order_items: o.legacy_order_items,
          libretax_operational_costs: o.libretax_operational_costs,
          klyvo_operational_costs: o.klyvo_operational_costs,
        };
        return { ...o, raw_data: raw };
      });

      orders.push(...batch);

      if (!hasRangeSupport || batch.length < ORDERS_CHUNK) {
        hasMoreOrders = false;
      } else {
        ordersOffset += ORDERS_CHUNK;
      }
    }

    logEgressSample({
      tenantId,
      operation: "financial.orders",
      table: "orders",
      data: orders,
    });

    // 2. Fetch cancellations with JSONB projection on payments and stable tiebreaker pagination
    cancellations = [];
    let cancOffset = 0;
    const CANC_CHUNK = 1000;
    let hasMoreCanc = true;

    while (hasMoreCanc) {
      let cancQuery = supabase
        .from("order_cancellations")
        .select("id, refund_amount, orders(payments:raw_data->payments)")
        .eq("tenant_id", tenantId)
        .gte("date_cancelled", dateFrom.toISOString())
        .lte("date_cancelled", dateTo.toISOString());

      if (typeof (cancQuery as any).order === "function") {
        cancQuery = (cancQuery as any)
          .order("date_cancelled", { ascending: false })
          .order("id", { ascending: false });
      }

      const hasRangeSupport = typeof (cancQuery as any).range === "function";
      if (hasRangeSupport) {
        cancQuery = (cancQuery as any).range(cancOffset, cancOffset + CANC_CHUNK - 1);
      }

      const { data: cancellationsData, error: cancellationsErr } = await cancQuery;

      if (cancellationsErr) {
        throw new Error(`Error al consultar cancelaciones en Finanzas: ${cancellationsErr.message}`);
      }

      const batch = cancellationsData || [];
      cancellations.push(...batch);

      if (!hasRangeSupport || batch.length < CANC_CHUNK) {
        hasMoreCanc = false;
      } else {
        cancOffset += CANC_CHUNK;
      }
    }

    logEgressSample({
      tenantId,
      operation: "financial.cancellations",
      table: "order_cancellations",
      data: cancellations,
    });

    // 3. Fetch products with stable tiebreaker pagination
    products = [];
    let prodOffset = 0;
    const PROD_CHUNK = 1000;
    let hasMoreProd = true;

    while (hasMoreProd) {
      let prodQuery = supabase
        .from("products")
        .select("id, meli_item_id, title, sku, status, cost, estimated_fee, estimated_shipping_cost, extra_fee_amount, promotion_discount_amount")
        .eq("tenant_id", tenantId);

      if (typeof (prodQuery as any).order === "function") {
        prodQuery = (prodQuery as any)
          .order("id", { ascending: false });
      }

      const hasRangeSupport = typeof (prodQuery as any).range === "function";
      if (hasRangeSupport) {
        prodQuery = (prodQuery as any).range(prodOffset, prodOffset + PROD_CHUNK - 1);
      }

      const { data: productsData, error: productsErr } = await prodQuery;

      if (productsErr) {
        throw new Error(`Error al consultar productos en Finanzas: ${productsErr.message}`);
      }

      const batch = productsData || [];
      products.push(...batch);

      if (!hasRangeSupport || batch.length < PROD_CHUNK) {
        hasMoreProd = false;
      } else {
        prodOffset += PROD_CHUNK;
      }
    }

    logEgressSample({
      tenantId,
      operation: "financial.products",
      table: "products",
      data: products,
    });

    // Filter out ignored/test orders
    activeOrders = orders.filter(o => !ignoredOrderIds.includes(o.meli_order_id));

    // 4. Fetch order items for active orders in chunks of order IDs, with pagination per chunk
    const orderIds = activeOrders.map(o => o.id);
    orderItems = [];
    if (orderIds.length > 0) {
      const CHUNK_SIZE = 150;
      for (let i = 0; i < orderIds.length; i += CHUNK_SIZE) {
        const chunkIds = orderIds.slice(i, i + CHUNK_SIZE);
        let itemsOffset = 0;
        const ITEMS_CHUNK = 1000;
        let hasMoreItems = true;

        while (hasMoreItems) {
          let itemsQuery = supabase
            .from("order_items")
            .select("id, order_id, meli_item_id, title, quantity, total_price, estimated_fee, estimated_shipping_cost, sku, unit_cost, line_key, unit_cost_snapshot, cost_snapshot_frozen_at, cost_snapshot_source, cost_snapshot_version, estimated_fee_snapshot, estimated_shipping_cost_snapshot, extra_fee_amount_snapshot, promotion_discount_amount_snapshot, estimated_tax_snapshot")
            .in("order_id", chunkIds);

          if (typeof (itemsQuery as any).order === "function") {
            itemsQuery = (itemsQuery as any)
              .order("id", { ascending: false });
          }

          const hasRangeSupport = typeof (itemsQuery as any).range === "function";
          if (hasRangeSupport) {
            itemsQuery = (itemsQuery as any).range(itemsOffset, itemsOffset + ITEMS_CHUNK - 1);
          }

          const { data: itemsChunk, error: itemsChunkErr } = await itemsQuery;

          if (itemsChunkErr) {
            throw new Error(`Error al consultar ítems de órdenes en Finanzas: ${itemsChunkErr.message}`);
          }

          const batch = itemsChunk || [];
          orderItems.push(...batch);

          if (!hasRangeSupport || batch.length < ITEMS_CHUNK) {
            hasMoreItems = false;
          } else {
            itemsOffset += ITEMS_CHUNK;
          }
        }
      }
    }

    logEgressSample({
      tenantId,
      operation: "financial.orderItems",
      table: "order_items",
      data: orderItems,
    });

    // 5. Fetch shipments for fallbacks (Phase 3: bounded to activeOrders in chunks of 200 IDs, with pagination per chunk)
    const shipmentIds = Array.from(new Set(activeOrders.map(o => o.meli_shipment_id).filter(Boolean)));
    shipments = [];
    if (shipmentIds.length > 0) {
      const SHIPMENT_CHUNK = 200;
      for (let i = 0; i < shipmentIds.length; i += SHIPMENT_CHUNK) {
        const chunkIds = shipmentIds.slice(i, i + SHIPMENT_CHUNK);
        let shipOffset = 0;
        const SHIP_CHUNK = 1000;
        let hasMoreShip = true;

        while (hasMoreShip) {
          let shipQuery = supabase
            .from("shipments")
            .select("id, meli_shipment_id, shipping_cost")
            .eq("tenant_id", tenantId)
            .in("meli_shipment_id", chunkIds);

          if (typeof (shipQuery as any).order === "function") {
            shipQuery = (shipQuery as any)
              .order("id", { ascending: false });
          }

          const hasRangeSupport = typeof (shipQuery as any).range === "function";
          if (hasRangeSupport) {
            shipQuery = (shipQuery as any).range(shipOffset, shipOffset + SHIP_CHUNK - 1);
          }

          const { data: shipChunk, error: shipChunkErr } = await shipQuery;

          if (shipChunkErr) {
            throw new Error(`Error al consultar envíos en Finanzas: ${shipChunkErr.message}`);
          }

          const batch = shipChunk || [];
          shipments.push(...batch);

          if (!hasRangeSupport || batch.length < SHIP_CHUNK) {
            hasMoreShip = false;
          } else {
            shipOffset += SHIP_CHUNK;
          }
        }
      }
    }

    logEgressSample({
      tenantId,
      operation: "financial.shipments",
      table: "shipments",
      data: shipments,
    });
  }

  // Variables for aggregation
  let facturacionBruta = 0;
  let costosProductos = 0;
  let comisionesML = 0;
  let envios = 0;
  let promosCuotas = 0;
  let totalCupones = 0;
  let totalPackaging = 0;
  let totalPromociones = 0;
  let totalUnitsSold = 0;
  let unitsWithCost = 0;

  const productAggMap: Record<string, Omit<ProductFinancialRow, "neta" | "marg">> = {};

  activeOrders.forEach(o => {
    let dbItems = (orderItems || []).filter(item => item.order_id === o.id);

    // Deduplicate dbItems using raw_data.order_items as ground truth if available to prevent database duplication errors from skewing calculations
    const raw = o.raw_data as any;
    const rawItems = raw?.order_items;
    if (Array.isArray(rawItems) && dbItems.length > 0) {
      const deduplicatedItems: typeof dbItems = [];
      const dbItemsPool = [...dbItems];

      rawItems.forEach((rawItem: any) => {
        const meliItemId = rawItem.item?.id;
        const sku = rawItem.item?.seller_sku || null;
        const qty = Number(rawItem.quantity) || 1;

        // Priority 1: match meli_item_id, sku, and quantity
        let matchIndex = dbItemsPool.findIndex(item =>
          item.meli_item_id === meliItemId &&
          item.sku === sku &&
          Number(item.quantity) === qty
        );

        // Priority 2: match meli_item_id and quantity
        if (matchIndex === -1) {
          matchIndex = dbItemsPool.findIndex(item =>
            item.meli_item_id === meliItemId &&
            Number(item.quantity) === qty
          );
        }

        // Priority 3: match meli_item_id and sku
        if (matchIndex === -1) {
          matchIndex = dbItemsPool.findIndex(item =>
            item.meli_item_id === meliItemId &&
            item.sku === sku
          );
        }

        // Priority 4: match meli_item_id only
        if (matchIndex === -1) {
          matchIndex = dbItemsPool.findIndex(item =>
            item.meli_item_id === meliItemId
          );
        }

        if (matchIndex !== -1) {
          deduplicatedItems.push(dbItemsPool[matchIndex]);
          dbItemsPool.splice(matchIndex, 1);
        } else {
          // Fallback: build a virtual item from rawItem
          deduplicatedItems.push({
            order_id: o.id,
            meli_item_id: meliItemId,
            title: rawItem.item?.title || "Varios",
            sku: sku,
            quantity: qty,
            total_price: (Number(rawItem.unit_price) || 0) * qty,
            estimated_fee: (Number(rawItem.sale_fee) || 0) * qty,
            estimated_shipping_cost: null,
            unit_cost: null,
            line_key: null,
            unit_cost_snapshot: null,
            cost_snapshot_frozen_at: null,
            cost_snapshot_source: null,
            cost_snapshot_version: null,
            estimated_fee_snapshot: null,
            estimated_shipping_cost_snapshot: null,
            extra_fee_amount_snapshot: null,
            promotion_discount_amount_snapshot: null,
            estimated_tax_snapshot: null,
          });
        }
      });
      dbItems = deduplicatedItems;
    }

    const amount = Number(o.total_amount) || 0;
    facturacionBruta += amount;

    const couponAmount = Number(raw?.coupon?.amount) || (raw?.payments && raw.payments.length > 0 ? Number(raw.payments[0].coupon_amount) : 0) || 0;
    totalCupones += couponAmount;

    // Resolution order for packaging (Req 24):
    // 1. orders.packaging_cost_snapshot (if frozen)
    // 2. legacy raw_data.libretax_operational_costs.packaging_cost
    // 3. packagingCost fallback ONLY for legacy orders without frozen snapshot
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
    let orderExtra = 0;
    let orderQty = 0;

    const totalOrderQty = dbItems.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0) || 1;

    const shipment = o.meli_shipment_id ? (shipments || []).find(s => s.meli_shipment_id === o.meli_shipment_id) : undefined;
    const actualShippingCost = shipment && shipment.shipping_cost !== null && Number(shipment.shipping_cost) > 0
      ? Number(shipment.shipping_cost)
      : null;

    dbItems.forEach(item => {
      const qty = Number(item.quantity) || 1;
      orderQty += qty;
      const hasFrozenItemSnapshot = item.cost_snapshot_frozen_at != null;

      let p = item.meli_item_id ? (products || []).find(prod => prod.meli_item_id === item.meli_item_id) : undefined;
      
      // If matched by meli_item_id but product has no cost, find another product with same SKU that has cost
      if (p && (!p.cost || Number(p.cost) <= 0) && p.sku) {
        const normSku = normalizeSku(p.sku);
        if (normSku) {
          const alternativeProd = (products || []).find(prod => 
            prod.sku && 
            normalizeSku(prod.sku) === normSku && 
            prod.cost && 
            Number(prod.cost) > 0
          );
          if (alternativeProd) {
            p = alternativeProd;
          }
        }
      }

      if (!p && item.sku) {
        const normItemSku = normalizeSku(item.sku);
        if (normItemSku) {
          p = (products || []).find(prod => 
            prod.sku && 
            normalizeSku(prod.sku) === normItemSku && 
            prod.cost && 
            Number(prod.cost) > 0 &&
            prod.status === 'active'
          );
          if (!p) {
            p = (products || []).find(prod => 
              prod.sku && 
              normalizeSku(prod.sku) === normItemSku && 
              prod.cost && 
              Number(prod.cost) > 0
            );
          }
          if (!p) {
            p = (products || []).find(prod => 
              prod.sku && 
              normalizeSku(prod.sku) === normItemSku &&
              prod.status === 'active'
            );
          }
          if (!p) {
            p = (products || []).find(prod => prod.sku && normalizeSku(prod.sku) === normItemSku);
          }
        }
      }

      if (!p && item.title) {
        p = (products || []).find(prod => 
          prod.title === item.title && 
          prod.cost && 
          Number(prod.cost) > 0 &&
          prod.status === 'active'
        );
        if (!p) {
          p = (products || []).find(prod => 
            prod.title === item.title && 
            prod.cost && 
            Number(prod.cost) > 0
          );
        }
        if (!p) {
          p = (products || []).find(prod => 
            prod.title === item.title &&
            prod.status === 'active'
          );
        }
        if (!p) {
          p = (products || []).find(prod => prod.title === item.title);
        }
      }
      
      let itemCost = 0;
      let itemFee = 0;
      if (hasFrozenItemSnapshot && item.estimated_fee_snapshot != null) {
        itemFee = Number(item.estimated_fee_snapshot) * qty;
      } else {
        itemFee = (Number(item.estimated_fee) || 0) * qty;
      }

      let itemShipping = 0;
      if (actualShippingCost !== null) {
        itemShipping = actualShippingCost * (qty / totalOrderQty);
      } else if (hasFrozenItemSnapshot && item.estimated_shipping_cost_snapshot != null) {
        itemShipping = Number(item.estimated_shipping_cost_snapshot) * qty;
      } else {
        itemShipping = Number(item.estimated_shipping_cost) || 0;
      }

      const itemPackaging = orderPackagingCost * qty;
      totalPackaging += itemPackaging;
      let itemExtra = itemPackaging;

      if (couponAmount > 0 && amount > 0) {
        const itemTotalOriginal = Number(item.total_price) || 0;
        const itemShare = itemTotalOriginal / amount;
        itemExtra += couponAmount * itemShare;
      }

      // Resolution order for item cost (Req 22, 23):
      // 1. item.unit_cost_snapshot (if frozen snapshot exists)
      // 2. legacy item.unit_cost
      // 3. products.cost ONLY for legacy orders without snapshot
      // 4. null / 0
      let resolvedUnitCost: number | null = null;

      if (hasFrozenItemSnapshot && item.unit_cost_snapshot != null) {
        resolvedUnitCost = Number(item.unit_cost_snapshot);
      } else if (item.unit_cost != null && Number(item.unit_cost) > 0) {
        resolvedUnitCost = Number(item.unit_cost);
      } else if (!hasFrozenItemSnapshot && !o.cost_snapshot_frozen_at) {
        // ONLY for legacy orders without any snapshot, fall back to current product cost
        if (p && p.cost && Number(p.cost) > 0) {
          resolvedUnitCost = Number(p.cost);
        }
      }

      if (resolvedUnitCost !== null && resolvedUnitCost > 0) {
        itemCost = resolvedUnitCost * qty;
        unitsWithCost += qty;
      }

      // Extra fees and promotions
      if (hasFrozenItemSnapshot && (item.extra_fee_amount_snapshot != null || item.promotion_discount_amount_snapshot != null)) {
        const itemPromo = (Number(item.extra_fee_amount_snapshot || 0) + Number(item.promotion_discount_amount_snapshot || 0)) * qty;
        totalPromociones += itemPromo;
        itemExtra += itemPromo;
      } else if (p) {
        if (itemFee === 0) {
          itemFee = Number(p.estimated_fee || 0) * qty;
        }
        if (itemShipping === 0 && actualShippingCost === null) {
          itemShipping = Number(p.estimated_shipping_cost || 0) * qty;
        }
        const itemPromo = (Number(p.extra_fee_amount || 0) + Number(p.promotion_discount_amount || 0)) * qty;
        totalPromociones += itemPromo;
        itemExtra += itemPromo;
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
      
      const couponAmount = Number(raw?.coupon?.amount) || (raw?.payments && raw.payments.length > 0 ? Number(raw.payments[0].coupon_amount) : 0) || 0;
      const orderPkg = orderPackagingCost * rawQty;
      totalPackaging += orderPkg;
      let itemExtra = orderPkg + couponAmount;

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
        const itemPromo = (Number(p.extra_fee_amount || 0) + Number(p.promotion_discount_amount || 0)) * rawQty;
        totalPromociones += itemPromo;
        itemExtra += itemPromo;
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

  const validCancellations = (cancellations || []).filter((c: any) => {
    const order = c.orders;
    if (!order) return false;
    const payments = order.payments || order.raw_data?.payments || [];
    return payments.some((p: any) => p.status === 'approved' || p.status === 'refunded');
  });

  const cancellationsAmount = validCancellations.reduce((sum, c) => sum + (Number(c.refund_amount) || 0), 0);

  const gananciaNeta = facturacionBruta - costosProductos - comisionesML - envios - promosCuotas;
  const margenNeto = facturacionBruta > 0 ? (gananciaNeta / facturacionBruta) * 100 : 0;
  const costAccuracyPercent = totalUnitsSold > 0 ? (unitsWithCost / totalUnitsSold) * 100 : 100;

  // 6. Calcular Gastos Mensuales del período
  let monthlyExpensesTotal = 0;
  const appliedExpensesBreakdown: { name: string; amount: number; type: string }[] = [];

  try {
    let expenses: any[] = [];
    let expOffset = 0;
    const EXP_CHUNK = 1000;
    let hasMoreExp = true;

    while (hasMoreExp) {
      let expQuery = supabase
        .from("monthly_expenses")
        .select("*")
        .eq("tenant_id", tenantId);

      if (typeof (expQuery as any).order === "function") {
        expQuery = (expQuery as any)
          .order("id", { ascending: false });
      }

      const hasRangeSupport = typeof (expQuery as any).range === "function";
      if (hasRangeSupport) {
        expQuery = (expQuery as any).range(expOffset, expOffset + EXP_CHUNK - 1);
      }

      const { data: expBatch, error: expensesErr } = await expQuery;

      if (expensesErr) {
        throw new Error(`Error al consultar gastos mensuales en Finanzas: ${expensesErr.message}`);
      }

      const batch = expBatch || [];
      expenses.push(...batch);

      if (!hasRangeSupport || batch.length < EXP_CHUNK) {
        hasMoreExp = false;
      } else {
        expOffset += EXP_CHUNK;
      }
    }

    if (expenses && expenses.length > 0) {
      const orderDateFormatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
      });

      // Agrupar facturación de órdenes por mes (formato YYYY-MM)
      const monthlyRevenueMap: Record<string, number> = {};
      activeOrders.forEach(o => {
        const orderDate = new Date(o.date_created);
        const key = orderDateFormatter.format(orderDate); // "YYYY-MM"
        monthlyRevenueMap[key] = (monthlyRevenueMap[key] || 0) + (Number(o.total_amount) || 0);
      });

      // Encontrar todos los meses tocados por el rango de fechas [dateFrom, dateTo]
      const { year: startYear, month: startMonth } = getYearAndMonthInTimezone(dateFrom, timezone);
      const { year: endYear, month: endMonth } = getYearAndMonthInTimezone(dateTo, timezone);

      const monthsTouched: { key: string; proration: number; daysInMonth: number; daysInRange: number }[] = [];
      let currYear = startYear;
      let currMonth = startMonth;

      while (currYear < endYear || (currYear === endYear && currMonth <= endMonth)) {
        const key = `${currYear}-${String(currMonth + 1).padStart(2, '0')}`;
        
        // Días totales del mes
        const daysInMonth = new Date(currYear, currMonth + 1, 0).getDate();

        // Calcular superposición de días usando la zona horaria del tenant
        const monthStart = getMidnightInTimezone(new Date(Date.UTC(currYear, currMonth, 1, 12, 0, 0)), timezone);
        const nextMonthStart = getMidnightInTimezone(new Date(Date.UTC(currMonth === 11 ? currYear + 1 : currYear, currMonth === 11 ? 0 : currMonth + 1, 1, 12, 0, 0)), timezone);
        const monthEnd = new Date(nextMonthStart.getTime() - 1);

        const overlapStart = new Date(Math.max(monthStart.getTime(), dateFrom.getTime()));
        const overlapEnd = new Date(Math.min(monthEnd.getTime(), dateTo.getTime()));

        const overlapMs = Math.max(0, overlapEnd.getTime() - overlapStart.getTime());
        let daysInRange = overlapMs > 0 ? (overlapMs / (1000 * 60 * 60 * 24)) : 0;

        // Evitar errores de redondeo de milisegundos para meses completos
        if (daysInMonth - daysInRange < 0.02) {
          daysInRange = daysInMonth;
        }

        const proration = Math.min(1, daysInRange / daysInMonth);

        if (proration > 0) {
          monthsTouched.push({ key, proration, daysInMonth, daysInRange });
        }

        currMonth++;
        if (currMonth > 11) {
          currMonth = 0;
          currYear++;
        }
      }

      // Obtener la fecha actual del tenant para saber cuántos días han transcurrido en el mes en curso
      const tenantFullDateFormatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      const tenantTodayStr = tenantFullDateFormatter.format(new Date()); // "YYYY-MM-DD"
      const tenantCurrentMonthStr = tenantTodayStr.substring(0, 7); // "YYYY-MM"
      const tenantCurrentDay = parseInt(tenantTodayStr.substring(8, 10), 10);

      // Acumulador para agrupar gastos con el mismo nombre y tipo en el breakdown final
      const expenseAccumulator: Record<string, { name: string; amount: number; type: string }> = {};

      monthsTouched.forEach(m => {
        const monthRevenue = monthlyRevenueMap[m.key] || 0;

        expenses.forEach((e: any) => {
          let appliedAmount = 0;

          // Check if this expense is valid/active for month `m.key`
          let isValidForMonth = false;
          if (e.type === "fixed_one_off") {
            if (e.target_month && e.target_month.substring(0, 7) === m.key && (e.is_active || e.end_month)) {
              isValidForMonth = true;
            }
          } else {
            // For recurring/variable, check start_month and end_month
            const startMonthStr = e.start_month ? e.start_month.substring(0, 7) : null;
            const endMonthStr = e.end_month ? e.end_month.substring(0, 7) : null;

            // Fallback for start_month: if not present, use created_at month
            const fallbackStartMonth = startMonthStr || (e.created_at ? e.created_at.substring(0, 7) : "2000-01");

            const started = m.key >= fallbackStartMonth;
            const ended = endMonthStr ? m.key > endMonthStr : false;

            if (started && !ended) {
              // If it's currently active, or if it has end_month (archived/ended version)
              if (e.is_active || e.end_month) {
                isValidForMonth = true;
              }
            }
          }

          if (!isValidForMonth) return;

          if (e.is_daily) {
            const daysInMonth = m.daysInMonth;
            let expenseStartDay = 1;
            let expenseEndDay = daysInMonth;

            if (e.start_month) {
              const sMonth = e.start_month.substring(0, 7);
              if (sMonth === m.key) {
                expenseStartDay = parseInt(e.start_month.substring(8, 10), 10) || 1;
              } else if (sMonth > m.key) {
                expenseStartDay = daysInMonth + 1;
              }
            }
            if (e.end_month) {
              const eMonth = e.end_month.substring(0, 7);
              if (eMonth === m.key) {
                expenseEndDay = parseInt(e.end_month.substring(8, 10), 10) || daysInMonth;
              } else if (eMonth < m.key) {
                expenseEndDay = 0;
              }
            }

            if (disableProration) {
              let maxDayToCount = daysInMonth;
              if (m.key === tenantCurrentMonthStr) {
                maxDayToCount = Math.min(tenantCurrentDay, daysInMonth);
              } else if (m.key > tenantCurrentMonthStr) {
                maxDayToCount = 0;
              }
              const actualStart = Math.max(1, expenseStartDay);
              const actualEnd = Math.min(maxDayToCount, expenseEndDay);
              const daysToCount = actualEnd >= actualStart ? (actualEnd - actualStart + 1) : 0;
              appliedAmount = Number(e.amount) * daysToCount;
            } else {
              const actualStart = Math.max(1, expenseStartDay);
              const actualEnd = Math.min(daysInMonth, expenseEndDay);
              const expenseActiveDays = actualEnd >= actualStart ? (actualEnd - actualStart + 1) : 0;
              const ratio = daysInMonth > 0 ? (expenseActiveDays / daysInMonth) : 0;
              appliedAmount = Number(e.amount) * (m.daysInRange * ratio);
            }
          } else if (e.type === "fixed_recurring") {
            appliedAmount = Number(e.amount) * (disableProration ? 1 : m.proration);
          } else if (e.type === "fixed_one_off" && e.target_month) {
            appliedAmount = Number(e.amount) * (disableProration ? 1 : m.proration);
          } else if (e.type === "percent_variable") {
            // Se calcula directo sobre la facturación del mes
            appliedAmount = (Number(e.percentage) * monthRevenue) / 100;
          }

          if (e.has_iva && appliedAmount > 0) {
            appliedAmount = appliedAmount * 1.21;
          }

          if (appliedAmount > 0) {
            monthlyExpensesTotal += appliedAmount;

            const aggKey = `${e.name}-${e.type}`;
            if (!expenseAccumulator[aggKey]) {
              expenseAccumulator[aggKey] = {
                name: e.name,
                amount: 0,
                type: e.type
              };
            }
            expenseAccumulator[aggKey].amount += appliedAmount;
          }
        });
      });

      Object.values(expenseAccumulator).forEach(agg => {
        appliedExpensesBreakdown.push({
          name: agg.name,
          amount: Number(agg.amount.toFixed(2)),
          type: agg.type
        });
      });
    }
  } catch (err: any) {
    console.error("Error calculating monthly expenses in getFinancialData:", err.message);
    throw err;
  }

  const gananciaBolsilloLimpia = gananciaNeta - monthlyExpensesTotal;

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
    totalCupones,
    totalPackaging,
    totalPromociones,
    descuentosYCupones: totalCupones + totalPromociones,
    productAgg,
    tableData,
    monthlyExpensesTotal: Number(monthlyExpensesTotal.toFixed(2)),
    gananciaBolsilloLimpia: Number(gananciaBolsilloLimpia.toFixed(2)),
    appliedExpensesBreakdown
  };   
}
