import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import FinanceClientPage from "./client-page";

export default async function FinancePage(props: { searchParams: Promise<{ period?: string }> }) {
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

  const tenantId = profile.tenant_id;
  const period = searchParams.period || "current_month";

  let dateFrom = new Date();
  let dateTo = new Date();

  if (period === "current_month") {
    dateFrom = new Date(dateTo.getFullYear(), dateTo.getMonth(), 1);
  } else if (period === "last_month") {
    dateFrom = new Date(dateTo.getFullYear(), dateTo.getMonth() - 1, 1);
    dateTo = new Date(dateTo.getFullYear(), dateTo.getMonth(), 0);
  } else if (period === "last_30") {
    dateFrom.setDate(dateFrom.getDate() - 30);
  } else if (period === "all") {
    dateFrom = new Date(2000, 0, 1);
  }

  // Fetch orders (only paid)
  const { data: orders } = await supabase
    .from("orders")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("status", "paid")
    .gte("date_created", dateFrom.toISOString())
    .lte("date_created", dateTo.toISOString());

  // Fetch cancellations
  const { data: cancellations } = await supabase
    .from("order_cancellations")
    .select("*")
    .eq("tenant_id", tenantId)
    .gte("created_at", dateFrom.toISOString())
    .lte("created_at", dateTo.toISOString());

  // Fetch products (to get cost and estimated fees)
  const { data: products } = await supabase
    .from("products")
    .select("id, meli_item_id, title, sku, cost, estimated_fee, estimated_shipping_cost, extra_fee_amount, promotion_discount_amount, profit_real_margin")
    .eq("tenant_id", tenantId);

  const mappedOrders = (orders || []).map(o => {
    const raw = o.raw_data as any;
    const firstItem = raw?.order_items?.[0];
    return {
      ...o,
      product_title: firstItem?.item?.title || "Varios",
      meli_product_id: firstItem?.item?.id || null,
      total_quantity: firstItem?.quantity || 1
    };
  });

  return (
    <div className="flex-1 p-8 pt-6">
      <FinanceClientPage 
        orders={mappedOrders} 
        cancellations={cancellations || []} 
        products={products || []}
        currentPeriod={period}
      />
    </div>
  );
}
