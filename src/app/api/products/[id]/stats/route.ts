import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { meliFetch } from "@/services/meli/client";
import { normalizeSku } from "@/lib/sku";
import { logEgressSample } from "@/lib/observability/egress";
import { requireTenantContext, toAuthErrorResponse } from "@/lib/security/tenantAuth";
import { CORRELATION_ID_HEADER } from "@/lib/observability/correlationId";

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

    // 1. Fetch the product details with explicit column projection (no select(*))
    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id, tenant_id, sku, meli_item_id, meli_account_id, title, listing_type_id, status, price, permalink, thumbnail_url")
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .single();

    logEgressSample({
      tenantId,
      operation: "productStats.product",
      table: "products",
      data: product,
    });

    if (productError || !product) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
    }

    // Find sibling products (sisters) matching the same normalized SKU
    const normSku = normalizeSku(product.sku);
    let familyProducts = [product];

    if (normSku) {
      let query = supabase
        .from("products")
        .select("id, tenant_id, sku, meli_item_id, meli_account_id, title, listing_type_id, status, price, permalink, thumbnail_url")
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

    // 3. Fetch real daily sales for the specified period filtered in PostgreSQL (no lifetime downloads)
    const familyProductIds = familyProducts.map(p => p.id);
    const salesMap: Record<string, Record<string, number>> = {}; // productId -> dateStr -> sales
    const totalSalesMap: Record<string, number> = {};

    familyProductIds.forEach(pid => {
      salesMap[pid] = {};
      totalSalesMap[pid] = 0;
    });

    // Fetch only active orders in the requested date window
    const { data: periodOrders } = await supabase
      .from("orders")
      .select("id, date_created")
      .eq("tenant_id", tenantId)
      .neq("status", "cancelled")
      .gte("date_created", filterDate.toISOString());

    const periodOrderIds = (periodOrders || []).map((o: any) => o.id);
    const orderDateMap = new Map<string, string>();
    periodOrders?.forEach((o: any) => orderDateMap.set(o.id, o.date_created));

    let orderItems: any[] = [];
    if (periodOrderIds.length > 0 && familyProductIds.length > 0) {
      const CHUNK_SIZE = 150;
      for (let i = 0; i < periodOrderIds.length; i += CHUNK_SIZE) {
        const chunk = periodOrderIds.slice(i, i + CHUNK_SIZE);
        const { data: itemsChunk } = await supabase
          .from("order_items")
          .select("order_id, product_id, quantity")
          .in("order_id", chunk)
          .in("product_id", familyProductIds)
          .eq("tenant_id", tenantId);

        if (itemsChunk && itemsChunk.length > 0) {
          orderItems = orderItems.concat(itemsChunk);
        }
      }
    }

    logEgressSample({
      tenantId,
      operation: "productStats.orderItems",
      table: "order_items",
      data: orderItems,
    });

    orderItems.forEach((item: any) => {
      const dateCreated = orderDateMap.get(item.order_id);
      if (!dateCreated || !item.product_id) return;
      const dateStr = new Date(dateCreated).toISOString().split("T")[0];
      salesMap[item.product_id][dateStr] = (salesMap[item.product_id][dateStr] || 0) + (item.quantity || 0);
      totalSalesMap[item.product_id] = (totalSalesMap[item.product_id] || 0) + (item.quantity || 0);
    });

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
