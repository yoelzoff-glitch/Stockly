import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import SalesClientPage from "./client-page";

export default async function SalesPage(props: { searchParams: Promise<{ q?: string, page?: string, status?: string, days?: string }> }) {
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

  const q = searchParams.q || "";
  const page = parseInt(searchParams.page || "1");
  const status = searchParams.status || "all";
  const days = searchParams.days || "30";
  
  const limit = 50;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let dateFrom = new Date();
  if (days === "current_month") {
    dateFrom = new Date(dateFrom.getFullYear(), dateFrom.getMonth(), 1, 0, 0, 0, 0);
  } else {
    const daysNum = parseInt(days) || 30;
    dateFrom.setDate(dateFrom.getDate() - daysNum);
  }

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
    .select("*", { count: "exact" })
    .eq("tenant_id", profile.tenant_id)
    .gte("date_created", dateFrom.toISOString())
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

  // Fetch Tenant metadata to get ignored_order_ids
  const { data: tenant } = await supabase
    .from("tenants")
    .select("metadata")
    .eq("id", profile.tenant_id)
    .single();
  const ignoredOrderIds = (tenant?.metadata as any)?.ignored_order_ids || [];

  const { data: orders, count, error } = await query;

  if (error) {
    console.error("Error fetching orders:", error);
  }

  // Also fetch ALL orders for the period for the KPIs to be accurate across pages
  const { data: rawPeriodOrders } = await supabase
    .from("orders")
    .select("total_amount, date_created, status, raw_data, meli_order_id")
    .eq("tenant_id", profile.tenant_id)
    .gte("date_created", dateFrom.toISOString());

  const allPeriodOrders = (rawPeriodOrders || []).map(o => ({
    total_amount: o.total_amount,
    date_created: o.date_created,
    status: o.status,
    meli_order_id: o.meli_order_id,
    product_title: (o.raw_data as any)?.order_items?.[0]?.item?.title || "Varios / Otros"
  }));

  const mappedOrders = (orders || []).map(o => {
    const raw = o.raw_data as any;
    const rawQty = raw?.order_items?.reduce((sum: number, item: any) => sum + (Number(item.quantity) || 1), 0) || 1;
    return {
      ...o,
      product_title: raw?.order_items?.[0]?.item?.title || "Varios productos",
      total_quantity: rawQty
    };
  });

  return (
    <div className="flex-1 p-8 pt-6">
      <SalesClientPage 
        initialOrders={mappedOrders} 
        allPeriodOrders={allPeriodOrders}
        totalCount={count || 0}
        currentPage={page}
        searchQuery={q}
        currentStatus={status}
        currentDays={days}
        ignoredOrderIds={ignoredOrderIds}
      />
    </div>
  );
}
