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

  const { meli_user_id, id: meli_account_id } = meliAccount;
  
  // 1b. Validate and refresh token
  const { refreshMeliToken } = await import("./refreshToken");
  const access_token = await refreshMeliToken(tenantId);

  // 2. Fetch products from Meli API
  const rawProducts = await getProducts(access_token, meli_user_id);

  if (rawProducts.length === 0) {
    return 0; // No products to sync
  }

  // 3. Fetch existing products to preserve "cost"
  const { data: existingProducts } = await supabase
    .from("products")
    .select("meli_item_id, cost")
    .eq("tenant_id", tenantId);

  const costMap = new Map<string, number | null>();
  existingProducts?.forEach(p => costMap.set(p.meli_item_id, p.cost));

  // 4. Map products and fetch fees/shipping
  const { getListingFees } = await import("./getListingFees");
  const { getShippingCostEstimate } = await import("./getShippingCostEstimate");
  const { calculateProductProfitability } = await import("../profitability/calculateProductProfitability");

  const productsToUpsert = [];

  for (const item of rawProducts) {
    const siteId = item.site_id || "MLA";
    const existingCost = costMap.get(item.id) || null;

    // Fetch Fees
    const feeData = await getListingFees(siteId, item.price, item.category_id, item.listing_type_id, access_token);
    const estimatedFee = feeData?.sale_fee_amount ?? null;

    // Fetch Shipping
    const shippingData = await getShippingCostEstimate(item.id, access_token);
    const estimatedShipping = shippingData.estimated_shipping_cost;

    // Calculate profitability
    const profitResult = calculateProductProfitability({
      price: item.price,
      cost: existingCost,
      estimated_fee: estimatedFee,
      estimated_shipping_cost: estimatedShipping,
      estimated_tax: 0 // Simplification for now
    });

    const rawData = item;
    rawData.fees = feeData?.raw_response;
    rawData.shipping_estimate = shippingData.raw_response;

    productsToUpsert.push({
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
      raw_data: rawData,
      estimated_fee: estimatedFee,
      estimated_shipping_cost: estimatedShipping,
      estimated_tax: 0,
      margin_amount: profitResult.margin_amount,
      margin_percent: profitResult.margin_percent,
      profitability_status: profitResult.profitability_status,
      profit_last_calculated_at: new Date().toISOString(),
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  // 4. Upsert into Supabase `products` table
  const { error: upsertError } = await supabase
    .from("products")
    .upsert(productsToUpsert, {
      onConflict: "tenant_id, meli_item_id", 
    });

  if (upsertError) {
    console.error("Error upserting products to DB:", upsertError);
    throw new Error(`Failed to save synced products to database: ${upsertError.message}`);
  }

  // Also update last_sync_at on meli_accounts
  await supabase
    .from("meli_accounts")
    .update({ last_sync_at: new Date().toISOString() })
    .eq("id", meli_account_id);

  return productsToUpsert.length;
}
