import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  const tenantId = profile?.tenant_id;
  if (!tenantId) {
    return NextResponse.json({ error: "No tenant ID found" }, { status: 400 });
  }

  const params = await context.params;
  const productId = params.id;

  // Validate product belongs to tenant
  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id, last_synced_at")
    .eq("id", productId)
    .eq("tenant_id", tenantId)
    .single();

  if (productError || !product) {
    return NextResponse.json({ error: "Product not found or access denied" }, { status: 404 });
  }

  // Fetch histories in parallel
  const [priceHistory, stockHistory, aiActions, recentOrders] = await Promise.all([
    supabase.from("product_price_history").select("*").eq("product_id", productId).order("created_at", { ascending: false }).limit(20),
    supabase.from("stock_movements").select("*").eq("product_id", productId).order("created_at", { ascending: false }).limit(20),
    supabase.from("ai_actions").select("*").eq("tenant_id", tenantId).eq("status", "pending").order("created_at", { ascending: false }).limit(20), // We might need to filter by product somehow if ai_actions has context, otherwise just general ones. But ai_actions has product_id? Let's check below.
    supabase.from("order_items").select("*, orders(date_created)").eq("tenant_id", tenantId).eq("item_id", productId).order("created_at", { ascending: false }).limit(20)
  ]);

  // Normalize into a single timeline
  const timeline: any[] = [];

  // 1. Price Changes
  priceHistory.data?.forEach(p => {
    timeline.push({
      id: p.id,
      type: "price",
      date: p.created_at,
      old_value: p.old_price,
      new_value: p.new_price,
      source: p.source || "sync"
    });
  });

  // 2. Stock Changes
  stockHistory.data?.forEach(s => {
    timeline.push({
      id: s.id,
      type: "stock",
      date: s.created_at,
      old_value: s.old_quantity,
      new_value: s.new_quantity,
      difference: s.quantity_change,
      source: s.source || "sync"
    });
  });

  // 3. AI Actions
  aiActions.data?.forEach(a => {
    // If ai_action payload contains product_id or sku, we include it
    try {
      const payload = typeof a.payload === 'string' ? JSON.parse(a.payload) : a.payload;
      if (payload?.product_id === productId || payload?.sku) {
        timeline.push({
          id: a.id,
          type: "ai",
          date: a.created_at,
          action: a.action_type,
          status: a.status,
          risk: a.risk_level || "low"
        });
      }
    } catch(e) {}
  });

  // 4. Sales
  recentOrders.data?.forEach(o => {
    const orderDate = o.orders?.date_created || o.created_at;
    timeline.push({
      id: o.id,
      type: "sale",
      date: orderDate,
      quantity: o.quantity,
      total: o.unit_price * o.quantity
    });
  });

  // 5. Sync event (last_synced_at)
  if (product.last_synced_at) {
    timeline.push({
      id: "sync-" + product.last_synced_at,
      type: "sync",
      date: product.last_synced_at,
      source: "system"
    });
  }

  // Sort by date descending
  timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return NextResponse.json({ timeline });
}
