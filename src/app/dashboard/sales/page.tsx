import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import SalesClientPage from "./client-page";
import { getPeriodRangeInTimezone } from "@/lib/dates";

export default async function SalesPage(props: { searchParams: Promise<{ q?: string, page?: string, status?: string, days?: string, from?: string, to?: string }> }) {
  const searchParams = await props.searchParams;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.tenant_id) redirect("/onboarding");

  // Fetch Tenant timezone and metadata
  const { data: tenant } = await supabase
    .from("tenants")
    .select("timezone, metadata")
    .eq("id", profile.tenant_id)
    .single();

  const timezone = tenant?.timezone || 'America/Argentina/Buenos_Aires';
  const ignoredOrderIds = (tenant?.metadata as any)?.ignored_order_ids || [];

  const q = searchParams.q || "";
  const page = parseInt(searchParams.page || "1");
  const status = searchParams.status || "all";
  const days = searchParams.days || "current_month";
  const fromParam = searchParams.from || "";
  const toParam = searchParams.to || "";

  const limit = 50;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { dateFrom, dateTo } = getPeriodRangeInTimezone(days, timezone, fromParam, toParam);

  // If search query is provided, find matching order_ids by title first
  let orderIdsMatched: string[] = [];
  if (q) {
    const { data: matchedItems } = await supabase
      .from("order_items")
      .select("order_id")
      .eq("tenant_id", profile.tenant_id)
      .ilike("title", `%${q}%`);
    if (matchedItems && matchedItems.length > 0) {
      orderIdsMatched = Array.from(new Set(matchedItems.map(item => item.order_id)));
    }
  }

  let query = supabase
    .from("orders")
    .select("id, meli_order_id, status, buyer_nickname, total_amount, paid_amount, currency_id, date_created, date_closed, meli_shipment_id, packaging_cost_snapshot, flex_cost_snapshot, cost_snapshot_status", { count: "exact" })
    .eq("tenant_id", profile.tenant_id)
    .gte("date_created", dateFrom.toISOString())
    .lte("date_created", dateTo.toISOString())
    .order("date_created", { ascending: false })
    .range(from, to);

  if (status !== "all") {
    query = query.eq("status", status);
  }

  if (q) {
    if (orderIdsMatched.length > 0) {
      const idsStr = orderIdsMatched.map(id => `id.eq.${id}`).join(",");
      query = query.or(`buyer_nickname.ilike.%${q}%,meli_order_id.ilike.%${q}%,${idsStr}`);
    } else {
      query = query.or(`buyer_nickname.ilike.%${q}%,meli_order_id.ilike.%${q}%`);
    }
  }

  const { data: orders, count, error } = await query;

  if (error) {
    console.error("[SalesPage] Error fetching orders:", error);
    throw new Error(`Error al cargar ventas: ${error.message}`);
  }

  // Sprint 32.1: Lightweight secondary query for order_items (no raw_data JSONB)
  const orderIds = (orders || []).map(o => o.id);
  let orderItems: any[] = [];
  if (orderIds.length > 0) {
    const { data: items, error: itemsError } = await supabase
      .from("order_items")
      .select("order_id,title,quantity,unit_cost,unit_cost_snapshot,cost_snapshot_frozen_at")
      .in("order_id", orderIds);

    if (itemsError) {
      console.error("[SalesPage] Error fetching order_items:", itemsError);
    }
    orderItems = items || [];
  }

  // Agrupar server-side por order_id
  const itemsByOrderId: Record<string, any[]> = {};
  for (const it of orderItems) {
    if (!itemsByOrderId[it.order_id]) {
      itemsByOrderId[it.order_id] = [];
    }
    itemsByOrderId[it.order_id].push(it);
  }

  // Sprint 32: Fetch KPI period aggregates with minimal lightweight columns (no raw_data JSONB)
  const { data: rawPeriodOrders } = await supabase
    .from("orders")
    .select("total_amount, date_created, status, meli_order_id")
    .eq("tenant_id", profile.tenant_id)
    .gte("date_created", dateFrom.toISOString())
    .lte("date_created", dateTo.toISOString());

  const allPeriodOrders = (rawPeriodOrders || []).map(o => ({
    total_amount: o.total_amount,
    date_created: o.date_created,
    status: o.status,
    meli_order_id: o.meli_order_id,
  }));

  const mappedOrders = (orders || []).map((o: any) => {
    const items = itemsByOrderId[o.id] || [];
    const totalQty = items.reduce((sum: number, it: any) => sum + (Number(it.quantity) || 1), 0) || 1;
    const firstTitle = items[0]?.title || "Varios productos";

    // Sprint 31/32.1: Resolver costo histórico: cost_snapshot_frozen_at ? unit_cost_snapshot : unit_cost
    // Si un snapshot congelado es NULL, no inventar costo actual
    const resolvedItems = items.map((it: any) => {
      const historicalCost = it.cost_snapshot_frozen_at ? it.unit_cost_snapshot : it.unit_cost;
      return {
        ...it,
        historical_cost: historicalCost,
      };
    });

    const totalHistoricalCost = items.reduce((sum: number, it: any) => {
      const itemCost = it.cost_snapshot_frozen_at ? it.unit_cost_snapshot : it.unit_cost;
      return sum + ((Number(itemCost) || 0) * (Number(it.quantity) || 1));
    }, 0);

    return {
      ...o,
      order_items: resolvedItems,
      product_title: firstTitle,
      total_quantity: totalQty,
      total_historical_cost: totalHistoricalCost,
    };
  });

  return (
    <div className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full">
      <SalesClientPage
        initialOrders={mappedOrders}
        allPeriodOrders={allPeriodOrders}
        totalCount={count || 0}
        currentPage={page}
        searchQuery={q}
        currentStatus={status}
        currentDays={days}
        fromDate={fromParam}
        toDate={toParam}
        ignoredOrderIds={ignoredOrderIds}
        timezone={timezone}
      />
    </div>
  );
}
