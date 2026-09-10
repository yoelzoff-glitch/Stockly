import { createClient } from "@/lib/supabase/server";
import { ProductsClient } from "./client-page";

export default async function ProductsPage(props: { searchParams: Promise<{ q?: string, page?: string }> }) {
  const searchParams = await props.searchParams;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  const tenantId = profile?.tenant_id;

  const q = searchParams.q || "";
  const page = parseInt(searchParams.page || "1", 10) || 1;
  const limit = 50;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  // Sprint 32: Explicit column selection to prevent transferring heavy JSONBs (profit_raw_data, campaign_data, full raw_data)
  let query = supabase
    .from("products")
    .select(`
      id,
      tenant_id,
      meli_item_id,
      title,
      sku,
      permalink,
      thumbnail_url,
      status,
      price,
      cost,
      available_quantity,
      sold_quantity,
      margin_percent,
      margin_amount,
      profit_real_margin,
      profit_real_estimated,
      estimated_fee,
      estimated_shipping_cost,
      shipping:raw_data->shipping,
      product_sku_components(component_normalized),
      product_components(quantity, component_normalized, inventory_items(current_stock, average_cost))
    `, { count: "exact" })
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (q) {
    query = query.or(`title.ilike.%${q}%,sku.ilike.%${q}%,meli_item_id.ilike.%${q}%,status.ilike.%${q}%`);
  }

  const { data: rawProducts, count } = await query;

  const products = (rawProducts || []).map((p: any) => ({
    ...p,
    raw_data: {
      shipping: p.shipping,
    },
  }));

  return <ProductsClient
    initialProducts={products}
    totalCount={count || 0}
    currentPage={page}
    searchQuery={q}
  />;
}
