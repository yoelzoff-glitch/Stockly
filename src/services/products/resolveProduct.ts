import { createAdminClient } from "@/lib/supabase/admin";

export type ResolvedProduct = {
  id: string;
  title: string;
  sku: string | null;
  price: number;
  available_quantity: number;
  status: string;
  meli_item_id: string;
};

export type ResolveResult = 
  | { type: 'exact'; product: ResolvedProduct }
  | { type: 'multiple'; products: ResolvedProduct[] }
  | { type: 'not_found'; error: string };

export async function resolveProduct(tenantId: string, query: string): Promise<ResolveResult> {
  const supabase = createAdminClient();
  const safeQuery = query.trim();

  // 1. Intentar match exacto por SKU o meli_item_id
  const { data: exactMatches } = await supabase
    .from("products")
    .select("id, title, sku, price, available_quantity, status, meli_item_id")
    .eq("tenant_id", tenantId)
    .or(`sku.eq.${safeQuery},meli_item_id.eq.${safeQuery}`);

  if (exactMatches && exactMatches.length === 1) {
    return { type: 'exact', product: exactMatches[0] as ResolvedProduct };
  }

  if (exactMatches && exactMatches.length > 1) {
    return { type: 'multiple', products: exactMatches as ResolvedProduct[] };
  }

  // 2. Si no hay match exacto, buscar parcialmente por título (o sku parcial si queremos ser laxos)
  const { data: titleMatches } = await supabase
    .from("products")
    .select("id, title, sku, price, available_quantity, status, meli_item_id")
    .eq("tenant_id", tenantId)
    .ilike("title", `%${safeQuery}%`)
    .limit(10); // Traemos hasta 10 para mostrarle opciones al usuario

  if (titleMatches && titleMatches.length === 1) {
    return { type: 'exact', product: titleMatches[0] as ResolvedProduct };
  }

  if (titleMatches && titleMatches.length > 1) {
    return { type: 'multiple', products: titleMatches as ResolvedProduct[] };
  }

  return { type: 'not_found', error: `No encontré ningún producto que coincida con "${query}".` };
}
