import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { meliFetch } from "@/services/meli/client";
import { normalizeSku } from "@/lib/sku";
import { syncOrders } from "@/services/meli/syncOrders";

import { requireTenantContext, toAuthErrorResponse } from "@/lib/security/tenantAuth";
import { CORRELATION_ID_HEADER } from "@/lib/observability/correlationId";

// Keep track of the last time we performed a historical orders sync for each tenant to avoid hitting rate limits
const lastSyncedHistory: Record<string, number> = {};

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  let correlationId: string | undefined;

  try {
    const authContext = await requireTenantContext(request);
    correlationId = authContext.correlationId;
    const tenantId = authContext.tenantId;

    const { id } = await props.params;
    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { error: "Product ID is required" },
        { status: 400, headers: { [CORRELATION_ID_HEADER]: correlationId } }
      );
    }
    const supabase = await createClient();

    const url = new URL(request.url);
    const daysParam = url.searchParams.get("days") || "7";
    const daysCount = parseInt(daysParam) || 7;
    const filterDate = new Date();
    filterDate.setDate(filterDate.getDate() - daysCount);

    // Dynamic historical orders sync if we might be missing data
    const nowMs = Date.now();
    const lastSync = lastSyncedHistory[tenantId] || 0;
    if (nowMs - lastSync > 10 * 60 * 1000) {
      try {
        // Find the oldest order we have in the database for this tenant
        const { data: oldestOrder } = await supabase
          .from("orders")
          .select("date_created")
          .eq("tenant_id", tenantId)
          .order("date_created", { ascending: true })
          .limit(1)
          .maybeSingle();

        const oldestOrderDate = oldestOrder?.date_created ? new Date(oldestOrder.date_created) : null;
        
        // If we have no orders at all, or if our oldest order is more recent than the filterDate, sync older history
        if (!oldestOrderDate || oldestOrderDate > filterDate) {
          await syncOrders(tenantId, undefined, filterDate.toISOString());
        }
        
        // Mark as synced for this session to throttle requests
        lastSyncedHistory[tenantId] = nowMs;
      } catch (err: any) {
        console.error("Error during dynamic historical order sync:", err.message);
      }
    }

    // 1. Fetch the product details
    const { data: product, error: productError } = await supabase
      .from("products")
      .select("*")
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .single();

    if (productError || !product) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
    }

    // Find sibling products (sisters) matching the same normalized SKU
    const normSku = normalizeSku(product.sku);
    let familyProducts = [product];

    if (normSku) {
      let query = supabase
        .from("products")
        .select("*")
        .eq("tenant_id", tenantId)
        .not("sku", "is", null);

      if (product.meli_account_id) {
        query = query.eq("meli_account_id", product.meli_account_id);
      }

      const { data: products } = await query;
      if (products) {
        const siblingCandidates = products.filter(
          p => normalizeSku(p.sku) === normSku && p.meli_item_id && p.id !== product.id
        );
        familyProducts = [product, ...siblingCandidates];
      }
    }

    // 2. Fetch real visits from Mercado Libre for all family products in parallel
    // Note: ML visits/time_window API has a limit of maximum 150 days.
    const visitsDaysCount = Math.min(daysCount, 150);
    const visitsPromises = familyProducts.map(async (p) => {
      if (!p.meli_item_id) return { productId: p.id, visitsData: null };
      try {
        const visitsData = await meliFetch({
          tenantId: tenantId,
          endpoint: `/items/${p.meli_item_id}/visits/time_window?last=${visitsDaysCount}&unit=day`
        });
        return { productId: p.id, visitsData };
      } catch (err: any) {
        console.error(`Error fetching ML visits for product ${p.meli_item_id}:`, err.message);
        return { productId: p.id, visitsData: null };
      }
    });

    const visitsResults = await Promise.all(visitsPromises);
    const visitsMap: Record<string, Record<string, number>> = {}; // productId -> dateStr -> visits
    const totalVisitsMap: Record<string, number> = {};

    visitsResults.forEach(({ productId, visitsData }) => {
      visitsMap[productId] = {};
      let total = 0;
      if (visitsData && visitsData.results) {
        visitsData.results.forEach((v: any) => {
          const dateStr = new Date(v.date).toISOString().split("T")[0];
          const val = v.total || v.quantity || 0;
          visitsMap[productId][dateStr] = val;
          total += val;
        });
      }
      totalVisitsMap[productId] = total;
    });

    // 3. Fetch real daily sales for the specified period from Supabase order_items for all family products
    const familyProductIds = familyProducts.map(p => p.id);
    const { data: orderItems, error: itemsError } = await supabase
      .from("order_items")
      .select(`
        product_id,
        quantity,
        orders (
          date_created
        )
      `)
      .in("product_id", familyProductIds)
      .eq("tenant_id", tenantId);

    const salesMap: Record<string, Record<string, number>> = {}; // productId -> dateStr -> sales
    const totalSalesMap: Record<string, number> = {};

    familyProductIds.forEach(pid => {
      salesMap[pid] = {};
      totalSalesMap[pid] = 0;
    });

    if (!itemsError && orderItems) {
      orderItems.forEach((item: any) => {
        if (!item.orders?.date_created || !item.product_id) return;
        const orderDate = new Date(item.orders.date_created);
        if (orderDate >= filterDate) {
          const dateStr = orderDate.toISOString().split("T")[0];
          salesMap[item.product_id][dateStr] = (salesMap[item.product_id][dateStr] || 0) + (item.quantity || 0);
          totalSalesMap[item.product_id] = (totalSalesMap[item.product_id] || 0) + (item.quantity || 0);
        }
      });
    }

    // 4. Map visits and sales into the specified period structure for the main product chart
    const days = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    const today = new Date();
    const chartData = [];

    const mainProductVisitsMap = visitsMap[id] || {};
    const mainProductSalesMap = salesMap[id] || {};

    for (let i = daysCount - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      
      const dayName = daysCount <= 7 
        ? days[d.getDay()] 
        : d.toLocaleDateString("es-ES", { day: "numeric", month: "numeric" });

      const dayVisits = mainProductVisitsMap[dateStr] !== undefined 
        ? mainProductVisitsMap[dateStr] 
        : 0; 
      const daySales = mainProductSalesMap[dateStr] || 0;

      chartData.push({
        name: dayName,
        Visitas: dayVisits,
        Ventas: daySales
      });
    }

    // 5. Calculate stats for each family product
    const siblingStats = familyProducts.map(p => {
      const pVisits = totalVisitsMap[p.id] || 0;
      const pSales = totalSalesMap[p.id] || 0;
      const pConversion = pVisits > 0 
        ? ((pSales / pVisits) * 100).toFixed(2) 
        : "0.00";

      return {
        id: p.id,
        title: p.title,
        sku: p.sku,
        meli_item_id: p.meli_item_id,
        listing_type_id: p.listing_type_id,
        status: p.status,
        price: p.price,
        permalink: p.permalink,
        thumbnail_url: p.thumbnail_url,
        visits: pVisits,
        sales: pSales,
        conversionRate: pConversion,
        isCurrent: p.id === id
      };
    });

    const mainTotalVisits = totalVisitsMap[id] || 0;
    const mainTotalSales = totalSalesMap[id] || 0;
    const mainConversionRate = mainTotalVisits > 0 
      ? ((mainTotalSales / mainTotalVisits) * 100).toFixed(2) 
      : "0.00";

    return NextResponse.json({
      success: true,
      totalVisits: mainTotalVisits,
      totalSales: mainTotalSales,
      conversionRate: mainConversionRate,
      chartData,
      siblingStats
    });
  } catch (error: any) {
    return toAuthErrorResponse(error, correlationId);
  }
}
