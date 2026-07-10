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

export async function getFinancialData(
  supabase: SupabaseClient,
  tenantId: string,
  dateFrom: Date,
  dateTo: Date,
  packagingCost: number,
  ignoredOrderIds: string[],
  disableProration = false,
  timezone = 'America/Argentina/Buenos_Aires'
): Promise<FinancialData> {
  // 1. Fetch orders
  const { data: orders } = await supabase
    .from("orders")
    .select("id, total_amount, date_created, status, meli_order_id, meli_shipment_id, raw_data")
    .eq("tenant_id", tenantId)
    .neq("status", "cancelled")
    .gte("date_created", dateFrom.toISOString())
    .lte("date_created", dateTo.toISOString());

  // 2. Fetch cancellations (only those that correspond to actual paid/refunded orders, not rejected/unpaid)
  const { data: cancellations } = await supabase
    .from("order_cancellations")
    .select("refund_amount, orders(raw_data)")
    .eq("tenant_id", tenantId)
    .gte("date_cancelled", dateFrom.toISOString())
    .lte("date_cancelled", dateTo.toISOString());

  // 3. Fetch products (cost and extra info)
  const { data: products } = await supabase
    .from("products")
    .select("id, meli_item_id, title, sku, status, cost, estimated_fee, estimated_shipping_cost, extra_fee_amount, promotion_discount_amount")
    .eq("tenant_id", tenantId);

  // Filter out ignored/test orders
  const activeOrders = (orders || []).filter(o => !ignoredOrderIds.includes(o.meli_order_id));

  // 4. Fetch order items for active orders
  const orderIds = activeOrders.map(o => o.id);
  const { data: orderItems } = orderIds.length > 0
    ? await supabase
        .from("order_items")
        .select("order_id, meli_item_id, title, quantity, total_price, estimated_fee, estimated_shipping_cost, sku, unit_cost")
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
  let totalCupones = 0;
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
            unit_cost: null
          });
        }
      });
      dbItems = deduplicatedItems;
    }

    const amount = Number(o.total_amount) || 0;
    facturacionBruta += amount;

    const couponAmount = Number(raw?.coupon?.amount) || (raw?.payments && raw.payments.length > 0 ? Number(raw.payments[0].coupon_amount) : 0) || 0;
    totalCupones += couponAmount;
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
      let itemFee = (Number(item.estimated_fee) || 0) * qty;
      let itemShipping = Number(item.estimated_shipping_cost) || 0;
      let itemExtra = orderPackagingCost * qty;

      if (couponAmount > 0 && amount > 0) {
        const itemTotalOriginal = Number(item.total_price) || 0;
        const itemShare = itemTotalOriginal / amount;
        itemExtra += couponAmount * itemShare;
      }

      if (item.unit_cost !== null && Number(item.unit_cost) > 0) {
        itemCost = Number(item.unit_cost) * qty;
        unitsWithCost += qty;
      }

      if (p) {
        if (itemCost === 0 && p.cost) {
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
      
      const couponAmount = Number(raw?.coupon?.amount) || (raw?.payments && raw.payments.length > 0 ? Number(raw.payments[0].coupon_amount) : 0) || 0;
      let itemExtra = (orderPackagingCost * rawQty) + couponAmount;

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

  const validCancellations = (cancellations || []).filter((c: any) => {
    const order = c.orders;
    if (!order) return false;
    const payments = order.raw_data?.payments || [];
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
    const { data: expenses } = await supabase
      .from("monthly_expenses")
      .select("*")
      .eq("tenant_id", tenantId);

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

      const monthsTouched: { key: string; proration: number }[] = [];
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
          monthsTouched.push({ key, proration });
        }

        currMonth++;
        if (currMonth > 11) {
          currMonth = 0;
          currYear++;
        }
      }

      // Acumulador para agrupar gastos con el mismo nombre y tipo en el breakdown final
      const expenseAccumulator: Record<string, { name: string; amount: number; type: string }> = {};

      monthsTouched.forEach(m => {
        const monthRevenue = monthlyRevenueMap[m.key] || 0;

        expenses.forEach((e: any) => {
          let appliedAmount = 0;

          // Check if this expense is valid/active for month `m.key`
          let isValidForMonth = false;
          if (e.type === "fixed_one_off") {
            if (e.target_month && e.target_month.substring(0, 7) === m.key && e.is_active) {
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

          if (e.type === "fixed_recurring") {
            appliedAmount = Number(e.amount) * (disableProration ? 1 : m.proration);
          } else if (e.type === "fixed_one_off" && e.target_month) {
            appliedAmount = Number(e.amount) * (disableProration ? 1 : m.proration);
          } else if (e.type === "percent_variable") {
            // Se calcula directo sobre la facturación del mes
            appliedAmount = (Number(e.percentage) * monthRevenue) / 100;
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
    productAgg,
    tableData,
    monthlyExpensesTotal: Number(monthlyExpensesTotal.toFixed(2)),
    gananciaBolsilloLimpia: Number(gananciaBolsilloLimpia.toFixed(2)),
    appliedExpensesBreakdown
  };
}
