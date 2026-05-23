import { createAdminClient } from "@/lib/supabase/admin";
import { resolveProduct } from "@/services/products/resolveProduct";

/**
 * Consulta y devuelve el análisis de competencia para un producto específico del comercio.
 * Resuelve el producto utilizando el motor de resolución (SKU, ID o Título) y recupera 
 * el último snapshot de precios de competidores grabado en la base de datos, calculando 
 * desvíos y posicionamiento de precio (caro, en precio o barato).
 * 
 * @param tenantId Identificador del comercio
 * @param searchInput Término de búsqueda (SKU exacto, componente, ID de Mercado Libre o título)
 * @returns Promesa que resuelve en un objeto con el estado de precios del mercado, desvíos y detalles del producto
 */
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
