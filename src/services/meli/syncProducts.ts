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

  // 2. Fetch products from Meli API (passing tenantId)
  const rawProducts = await getProducts(tenantId, meli_user_id);

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
  const { getCampaigns } = await import("./getCampaigns");
  const { getPromotions } = await import("./getPromotions");
  const { calculateRealProfitability } = await import("../profitability/calculateRealProfitability");

  const productsToUpsert = [];
  const syncTimestamp = new Date().toISOString();

  for (const item of rawProducts) {
    const siteId = item.site_id || "MLA";
    const existingCost = costMap.get(item.id) || null;

    // Fetch Fees (passing tenantId)
    const feeData = await getListingFees(siteId, item.price, item.category_id, item.listing_type_id, tenantId);
    const estimatedFee = feeData?.sale_fee_amount ?? null;

    // Fetch Shipping (optimized: pass pre-fetched item details to avoid redundant API call)
    const shippingData = await getShippingCostEstimate(item.id, meliAccount.access_token, item.shipping, item.seller_id, item.currency_id);
    const estimatedShipping = shippingData.estimated_shipping_cost;

    // Fetch Campaigns and Promotions (passing tenantId)
    const campaigns = await getCampaigns(item.id, meli_user_id, tenantId);
    const promotions = await getPromotions(item.id, meli_user_id, tenantId);

    let extraFeeAmount = campaigns.reduce((acc: number, c: any) => acc + (c.fee_extra || 0), 0);
    
    // Fallback: Si el API de campañas devolvió 403 o no detectó nada, pero el item tiene Cuota Simple (pcj-co-funded)
    if (extraFeeAmount === 0 && item.tags && item.tags.includes("pcj-co-funded")) {
      extraFeeAmount = item.price * 0.05; // Cuota simple cobra exactamente 5%
    }

    const promoDiscountAmount = promotions.reduce((acc: number, p: any) => acc + (p.discount_amount || 0), 0);

    // Calculate profitability
    const profitResult = calculateRealProfitability({
      price: item.price,
      cost: existingCost,
      estimated_fee: estimatedFee,
      extra_fee_amount: extraFeeAmount,
      estimated_shipping_cost: estimatedShipping,
      promotion_discount_amount: promoDiscountAmount,
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
      profit_real_estimated: profitResult.real_margin_amount,
      profit_real_margin: profitResult.real_margin_percent,
      profitability_status: profitResult.profitability_status,
      campaign_data: campaigns,
      promotion_data: promotions,
      extra_fee_amount: extraFeeAmount,
      promotion_discount_amount: promoDiscountAmount,
      profit_last_calculated_at: new Date().toISOString(),
      last_synced_at: syncTimestamp,
      last_seen_at: syncTimestamp,
      updated_at: new Date().toISOString(),
    });
  }

  // 4. Upsert into Supabase `products` table
  const { data: upsertedData, error: upsertError } = await supabase
    .from("products")
    .upsert(productsToUpsert, {
      onConflict: "tenant_id, meli_item_id", 
    }).select("id, sku");

  if (upsertError) {
    console.error("Error upserting products to DB:", upsertError);
    throw new Error(`Failed to save synced products to database: ${upsertError.message}`);
  }

  // 4.1. Process and save SKU components
  if (upsertedData && upsertedData.length > 0) {
    const { parseCompositeSku } = await import("../products/sku/parseCompositeSku");
    const componentsToInsert: any[] = [];
    const productIdsToClear: string[] = [];

    for (const p of upsertedData) {
      if (!p.sku) continue;
      const parsed = parseCompositeSku(p.sku);
      if (parsed.components.length > 0) {
        productIdsToClear.push(p.id);
        for (const comp of parsed.components) {
          componentsToInsert.push({
            tenant_id: tenantId,
            product_id: p.id,
            component_sku: comp,
            component_normalized: comp
          });
        }
      }
    }

    if (productIdsToClear.length > 0) {
      const chunkSize = 100;
      for (let i = 0; i < productIdsToClear.length; i += chunkSize) {
        const chunk = productIdsToClear.slice(i, i + chunkSize);
        await supabase.from("product_sku_components").delete().in("product_id", chunk);
      }
      for (let i = 0; i < componentsToInsert.length; i += chunkSize) {
        const chunk = componentsToInsert.slice(i, i + chunkSize);
        const { error: compError } = await supabase.from("product_sku_components").insert(chunk);
        if (compError) console.error("Error inserting SKU components:", compError);
      }
    }
  }

  // 5. Mark local active products no longer present in Mercado Libre as deleted_from_meli
  const fewMinutesAgo = new Date(new Date(syncTimestamp).getTime() - 2 * 60 * 1000).toISOString();
  await supabase
    .from("products")
    .update({ status: "deleted_from_meli" })
    .eq("tenant_id", tenantId)
    .lt("last_seen_at", fewMinutesAgo);

  // Also update last_sync_at on meli_accounts
  await supabase
    .from("meli_accounts")
    .update({ last_sync_at: new Date().toISOString() })
    .eq("id", meli_account_id);

  return productsToUpsert.length;
}
