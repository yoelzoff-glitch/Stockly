import { createAdminClient } from "@/lib/supabase/admin";
import { resolveProduct } from "@/services/products/resolveProduct";

export async function getCompetitionAnalysis(tenantId: string, searchInput: string) {
  const supabase = createAdminClient();
  const result = await resolveProduct(tenantId, searchInput);

  if (result.type !== "exact") {
    return { error: `No encontré exactamente un producto asociado a "${searchInput}". Por favor especifica más detalles o el SKU exacto.` };
  }

  const product = result.product;

  const { data: snapshot } = await supabase
    .from("competition_snapshots")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("product_id", product.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!snapshot) {
    return {
      message: "Todavía no analicé competencia para ese producto.",
      product_title: product.title,
      product_id: product.id
    };
  }

  const diffToAvg = snapshot.own_price - snapshot.avg_price;
  const diffPercent = (diffToAvg / snapshot.avg_price) * 100;

  return {
    product_title: product.title,
    my_price: snapshot.own_price,
    market_average: snapshot.avg_price,
    market_min: snapshot.min_price,
    market_max: snapshot.max_price,
    competitors_analyzed: snapshot.competitors_count,
    diff_percent: Number(diffPercent.toFixed(1)),
    status: diffPercent > 10 ? "caro" : (diffPercent < -10 ? "barato" : "en precio")
  };
}
