import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeSku } from "./sku/normalizeSku";

export type ResolvedProduct = {
  id: string;
  title: string;
  sku: string | null;
  price: number;
  available_quantity: number;
  status: string;
  meli_item_id: string;
  match_type?: 'sku_exact' | 'sku_component' | 'meli_item_id' | 'title';
};

export type ResolveResult =
  | { type: 'exact'; product: ResolvedProduct }
  | { type: 'multiple'; products: ResolvedProduct[] }
  | { type: 'not_found'; error: string };

export async function resolveProduct(tenantId: string, query: string): Promise<ResolveResult> {
  const supabase = createAdminClient();
  let safeQuery = query.trim();

  // Limpiar prefijos comunes que la IA podría mandar por error
  if (safeQuery.toLowerCase().startsWith('sku ')) {
    safeQuery = safeQuery.substring(4).trim();
  }
  if (safeQuery.toLowerCase().startsWith('id ')) {
    safeQuery = safeQuery.substring(3).trim();
  }

  // 0. Intentar match exacto por ID (UUID de supabase)
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(safeQuery)) {
    const { data: idMatches, error: idError } = await supabase
      .from("products")
      .select("id, title, sku, price, available_quantity, status, meli_item_id")
      .eq("tenant_id", tenantId)
      .eq("id", safeQuery);

    if (idMatches && idMatches.length === 1) {
      return { type: 'exact', product: { ...idMatches[0], match_type: 'sku_exact' } as ResolvedProduct };
    }
  }

  // 1. Intentar match exacto por SKU o meli_item_id
  let { data: exactMatches, error: exactError } = await supabase
    .from("products")
    .select("id, title, sku, price, available_quantity, status, meli_item_id")
    .eq("tenant_id", tenantId)
    .or(`sku.eq."${safeQuery}",meli_item_id.ilike."*${safeQuery}*"`);

  if (exactError) console.error("resolveProduct exact error:", exactError);

  // Fallback: Si no hay coincidencias exactas por SKU o ID, intentar buscar por SKU normalizado en memoria
  if ((!exactMatches || exactMatches.length === 0) && safeQuery) {
    const { data: allProducts, error: allProdsError } = await supabase
      .from("products")
      .select("id, title, sku, price, available_quantity, status, meli_item_id")
      .eq("tenant_id", tenantId);

    if (!allProdsError && allProducts) {
      const normQuery = normalizeSku(safeQuery);
      if (normQuery) {
        const matched = allProducts.filter(p => p.sku && normalizeSku(p.sku) === normQuery);
        if (matched.length > 0) {
          exactMatches = matched;
        }
      }
    }
  }

  if (exactMatches && exactMatches.length > 0) {
    const products = exactMatches.map(p => ({
      ...p,
      match_type: p.sku === safeQuery ? 'sku_exact' : 'meli_item_id'
    })) as ResolvedProduct[];
    if (products.length === 1) return { type: 'exact', product: products[0] };
    return { type: 'multiple', products };
  }

  // 2. Buscar por componente SKU exacto normalizado
  const normalizedQuery = normalizeSku(safeQuery);
  if (normalizedQuery) {
    const { data: compMatches, error: compError } = await supabase
      .from("product_sku_components")
      .select("product_id")
      .eq("tenant_id", tenantId)
      .eq("component_normalized", normalizedQuery);

    if (compError) console.error("resolveProduct component error:", compError);

    if (compMatches && compMatches.length > 0) {
      const productIds = Array.from(new Set(compMatches.map(c => c.product_id)));
      const { data: prodMatches, error: prodError } = await supabase
        .from("products")
        .select("id, title, sku, price, available_quantity, status, meli_item_id")
        .in("id", productIds);

      if (prodError) console.error("resolveProduct component products error:", prodError);

      if (prodMatches && prodMatches.length > 0) {
        const products = prodMatches.map(p => ({
          ...p,
          match_type: 'sku_component'
        })) as ResolvedProduct[];
        if (products.length === 1) return { type: 'exact', product: products[0] };
        return { type: 'multiple', products };
      }
    }
  }

  // 3. Buscar parcialmente por título
  const { data: titleMatches, error: titleError } = await supabase
    .from("products")
    .select("id, title, sku, price, available_quantity, status, meli_item_id")
    .eq("tenant_id", tenantId)
    .ilike("title", `%${safeQuery}%`)
    .limit(10);

  if (titleError) console.error("resolveProduct title error:", titleError);

  if (titleMatches && titleMatches.length > 0) {
    const products = titleMatches.map(p => ({
      ...p,
      match_type: 'title'
    })) as ResolvedProduct[];
    if (products.length === 1) return { type: 'exact', product: products[0] };
    return { type: 'multiple', products };
  }

  return { type: 'not_found', error: `No encontré ningún producto que coincida con "${query}".` };
}
