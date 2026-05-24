import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Identifica los productos con mayor volumen de ventas en el comercio.
 * 
 * @param tenantId Identificador del comercio
 * @returns Promesa con los productos con más ventas o un mensaje de estado
 */
export async function getGrowingProducts(tenantId: string) {
  const supabase = createAdminClient();
  const { data: products, error } = await supabase
    .from("products")
    .select("title, sku, sold_quantity")
    .eq("tenant_id", tenantId)
    .order("sold_quantity", { ascending: false })
    .limit(5);

  if (error || !products || products.length === 0) {
    return { status: "No se encontraron productos creciendo o ventas recientes." };
  }

  return {
    growing_products: products.map(p => ({
      product: p.title,
      sku: p.sku || 'N/A',
      sales_volume: p.sold_quantity
    }))
  };
}

/**
 * Identifica productos activos y con stock que históricamente no registran ventas (estancados).
 * 
 * @param tenantId Identificador del comercio
 * @returns Promesa con los productos estancados o un mensaje de estado
 */
export async function getFallingProducts(tenantId: string) {
  const supabase = createAdminClient();
  const { data: products, error } = await supabase
    .from("products")
    .select("title, sku, available_quantity, status")
    .eq("tenant_id", tenantId)
    .eq("sold_quantity", 0)
    .eq("status", "active")
    .gt("available_quantity", 0)
    .limit(5);

  if (error || !products || products.length === 0) {
    return { status: "No se encontraron productos con ventas estancadas." };
  }

  return {
    falling_products: products.map(p => ({
      product: p.title,
      sku: p.sku || 'N/A',
      stock: p.available_quantity,
      issue: "Cero ventas registradas históricamente."
    }))
  };
}

/**
 * Identifica productos que requieren atención urgente, combinando aquellos con 
 * márgenes de rentabilidad críticos o con riesgo de quiebre de stock.
 * 
 * @param tenantId Identificador del comercio
 * @returns Promesa con productos de bajo margen y productos con stock crítico
 */
export async function getProductsToReview(tenantId: string) {
  const supabase = createAdminClient();
  // We look for worst margins or critical stock
  const { data: marginIssues } = await supabase
    .from("products")
    .select("title, sku, margin_percent, price, cost")
    .eq("tenant_id", tenantId)
    .not("margin_percent", "is", null)
    .order("margin_percent", { ascending: true })
    .limit(3);

  const { data: stockIssues } = await supabase
    .from("products")
    .select("title, sku, available_quantity")
    .eq("tenant_id", tenantId)
    .lte("available_quantity", 5)
    .gt("available_quantity", 0)
    .order("available_quantity", { ascending: true })
    .limit(3);

  return {
    low_margin_products: marginIssues?.map(p => ({
      product: p.title,
      margin_percent: `${p.margin_percent}%`,
      price: p.price,
      cost: p.cost
    })) || [],
    critical_stock_products: stockIssues?.map(p => ({
      product: p.title,
      stock: p.available_quantity
    })) || []
  };
}
