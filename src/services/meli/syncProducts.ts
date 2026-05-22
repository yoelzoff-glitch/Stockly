import { createAdminClient } from "@/lib/supabase/admin";
import { getProducts } from "./getProducts";

function extractSku(item: any): string | null {
  if (item.seller_custom_field) return item.seller_custom_field;
  
  if (item.attributes && Array.isArray(item.attributes)) {
    const skuAttr = item.attributes.find((a: any) => a.id === "SELLER_SKU");
    if (skuAttr && skuAttr.value_name) return skuAttr.value_name;
  }

  if (item.variations && Array.isArray(item.variations)) {
    for (const v of item.variations) {
      if (v.seller_custom_field) return v.seller_custom_field;
      if (v.attributes && Array.isArray(v.attributes)) {
        const vSkuAttr = v.attributes.find((a: any) => a.id === "SELLER_SKU");
        if (vSkuAttr && vSkuAttr.value_name) return vSkuAttr.value_name;
      }
    }
  }

  return null;
}

export async function syncProducts(tenantId: string) {
  const supabase = createAdminClient();

  // 1. Get the Meli account for this tenant
  const { data: meliAccount, error: accountError } = await supabase
    .from("meli_accounts")
    .select("id, access_token, meli_user_id")
    .eq("tenant_id", tenantId)
    .single();

  if (accountError || !meliAccount) {
    throw new Error("Mercado Libre account not connected for this tenant.");
  }

  const { access_token, meli_user_id, id: meli_account_id } = meliAccount;

  // 2. Fetch products from Meli API
  const rawProducts = await getProducts(access_token, meli_user_id);

  if (rawProducts.length === 0) {
    return 0; // No products to sync
  }

  // 3. Map products to DB schema
  const productsToUpsert = rawProducts.map((item: any) => ({
    tenant_id: tenantId,
    meli_account_id: meli_account_id,
    meli_item_id: item.id,
    sku: extractSku(item),
    title: item.title,
    price: item.price,
    base_price: item.base_price,
    original_price: item.original_price,
    available_quantity: item.available_quantity,
    sold_quantity: item.sold_quantity,
    status: item.status,
    listing_type_id: item.listing_type_id,
    category_id: item.category_id,
    permalink: item.permalink,
    thumbnail_url: item.thumbnail,
    raw_data: item,
    last_synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

  // 4. Upsert into Supabase `products` table
  const { error: upsertError } = await supabase
    .from("products")
    .upsert(productsToUpsert, {
      onConflict: "tenant_id, meli_item_id", 
    });

  if (upsertError) {
    console.error("Error upserting products to DB:", upsertError);
    throw new Error("Failed to save synced products to database.");
  }

  // Also update last_sync_at on meli_accounts
  await supabase
    .from("meli_accounts")
    .update({ last_sync_at: new Date().toISOString() })
    .eq("id", meli_account_id);

  return productsToUpsert.length;
}
