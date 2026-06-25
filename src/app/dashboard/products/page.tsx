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
  const page = parseInt(searchParams.page || "1");
  const limit = 50;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from("products")
    .select("*, product_sku_components(component_normalized), product_components(quantity, component_normalized, inventory_items(current_stock, average_cost))", { count: "exact" })
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (q) {
    query = query.or(`title.ilike.%${q}%,sku.ilike.%${q}%,meli_item_id.ilike.%${q}%,status.ilike.%${q}%`);
  }

  const { data: products, count } = await query;

  return <ProductsClient
    initialProducts={products || []}
    totalCount={count || 0}
    currentPage={page}
    searchQuery={q}
  />;
}
