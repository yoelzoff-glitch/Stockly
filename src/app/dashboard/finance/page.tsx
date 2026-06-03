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

  const orderIds = (orders || []).map(o => o.id);
  const { data: orderItems } = orderIds.length > 0
    ? await supabase
        .from("order_items")
        .select("order_id, meli_item_id, title, quantity, total_price, estimated_fee, estimated_shipping_cost")
        .in("order_id", orderIds)
    : { data: [] };

  const { data: shipments } = await supabase
    .from("shipments")
    .select("meli_shipment_id, shipping_cost")
    .eq("tenant_id", tenantId);

  const mappedOrders = (orders || []).map(o => {
    const raw = o.raw_data as any;
    const firstItem = raw?.order_items?.[0];
    
    // Find matching order items in the database to get exact fees and shipping
    const dbItems = (orderItems || []).filter(item => item.order_id === o.id);
    const totalFee = dbItems.reduce((sum, item) => sum + (Number(item.estimated_fee) || 0), 0);
    const totalShippingItems = dbItems.reduce((sum, item) => sum + (Number(item.estimated_shipping_cost) || 0), 0);
    const totalQty = dbItems.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);

    const shipment = (shipments || []).find(s => s.meli_shipment_id === o.meli_shipment_id);
    const totalShipping = totalShippingItems || Number(shipment?.shipping_cost) || 0;

    const rawFee = raw?.order_items?.reduce((sum: number, item: any) => sum + (Number(item.sale_fee) || 0), 0) || 0;
    const rawQty = raw?.order_items?.reduce((sum: number, item: any) => sum + (Number(item.quantity) || 1), 0) || 1;

    return {
      ...o,
      product_title: firstItem?.item?.title || "Varios",
      meli_product_id: firstItem?.item?.id || null,
      total_quantity: dbItems.length > 0 ? totalQty : rawQty,
      estimated_fee: dbItems.length > 0 ? totalFee : rawFee,
      estimated_shipping_cost: totalShipping
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
