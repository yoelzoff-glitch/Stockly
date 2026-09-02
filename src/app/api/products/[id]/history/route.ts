import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { requireTenantContext, toAuthErrorResponse } from "@/lib/security/tenantAuth";
import { CORRELATION_ID_HEADER } from "@/lib/observability/correlationId";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  let correlationId: string | undefined;

  try {
    const authContext = await requireTenantContext(request);
    correlationId = authContext.correlationId;
    const tenantId = authContext.tenantId;

    const params = await context.params;
    const productId = params.id;

    if (!productId || typeof productId !== "string") {
      return NextResponse.json(
        { error: "Product ID is required" },
        { status: 400, headers: { [CORRELATION_ID_HEADER]: correlationId } }
      );
    }

    const supabase = createAdminClient();

    // Validate product belongs to tenant (IDOR protection)
    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id, last_synced_at")
      .eq("id", productId.trim())
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (productError || !product) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404, headers: { [CORRELATION_ID_HEADER]: correlationId } }
      );
    }

    // Fetch histories in parallel strictly scoped to tenant
    const [priceHistory, stockHistory, aiActions, recentOrders] = await Promise.all([
      supabase.from("product_price_history").select("*").eq("product_id", productId.trim()).order("created_at", { ascending: false }).limit(20),
      supabase.from("stock_movements").select("*").eq("product_id", productId.trim()).order("created_at", { ascending: false }).limit(20),
      supabase.from("ai_actions").select("*").eq("tenant_id", tenantId).eq("status", "pending").order("created_at", { ascending: false }).limit(20),
      supabase.from("order_items").select("*, orders(date_created)").eq("tenant_id", tenantId).eq("item_id", productId.trim()).order("created_at", { ascending: false }).limit(20)
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
      try {
        const payload = typeof a.payload === 'string' ? JSON.parse(a.payload) : a.payload;
        if (payload?.product_id === productId.trim() || payload?.sku) {
          timeline.push({
            id: a.id,
            type: "ai",
            date: a.created_at,
            action: a.action_type,
            status: a.status,
            risk: a.risk_level || "low"
          });
        }
      } catch {}
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

    return NextResponse.json(
      { timeline },
      { status: 200, headers: { [CORRELATION_ID_HEADER]: correlationId } }
    );
  } catch (error: any) {
    return toAuthErrorResponse(error, correlationId);
  }
}
