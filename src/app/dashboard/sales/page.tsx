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
  const days = parseInt(searchParams.days || "30");
  
  const limit = 50;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const dateFrom = new Date();
  dateFrom.setDate(dateFrom.getDate() - days);

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
    query = query.or(`buyer_nickname.ilike.%${q}%,meli_order_id.ilike.%${q}%,product_title.ilike.%${q}%`);
  }

  const { data: orders, count, error } = await query;

  if (error) {
    console.error("Error fetching orders:", error);
  }

  // Also fetch ALL orders for the period for the KPIs to be accurate across pages?
  // Actually, KPIs should probably be calculated Server-Side too, but for MVP let's calculate them with a separate query or just use the current page data.
  // Wait, if we paginate, the Chart and KPIs will only reflect the current page (50 orders)!
  // We need a separate query for KPIs or calculate them server-side.
  const { data: allPeriodOrders } = await supabase
    .from("orders")
    .select("total_amount, date_created, product_title, status")
    .eq("tenant_id", profile.tenant_id)
    .gte("date_created", dateFrom.toISOString());

  return (
    <div className="flex-1 p-8 pt-6">
      <SalesClientPage 
        initialOrders={orders || []} 
        allPeriodOrders={allPeriodOrders || []}
        totalCount={count || 0}
        currentPage={page}
        searchQuery={q}
        currentStatus={status}
        currentDays={days}
      />
    </div>
  );
}
