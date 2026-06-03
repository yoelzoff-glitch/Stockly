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

  // 1.5 Get tenant metadata for operational costs
  const { data: tenantData } = await supabase
    .from("tenants")
    .select("metadata")
    .eq("id", tenantId)
    .single();
  
  const tenantMetadata = (tenantData?.metadata as any) || {};
  const packagingCost = tenantMetadata.packaging_cost || 0;
  // const flexBaseCost = tenantMetadata.flex_base_cost || 0; // Not used at product level

  // 2. Fetch products from Meli API (passing tenantId)
  let rawProducts = await getProducts(tenantId, meli_user_id);

  if (rawProducts.length === 0) {
    return 0; // No products to sync
  }

  // Pre-process SKUs to resolve mirrored listings (Publicaciones Sincronizadas)
  const skuMap = new Map<string, string>();
  for (const item of rawProducts) {
    const sku = extractSku(item);
    if (sku) skuMap.set(item.id, sku);
  }

  for (const item of rawProducts) {
    if (!skuMap.has(item.id)) {
      let masterId = null;
      if (item.item_relations && item.item_relations.length > 0) {
        masterId = item.item_relations[0].id;
      } else if (item.variations && item.variations.length > 0) {
        for (const v of item.variations) {
          if (v.item_relations && v.item_relations.length > 0) {
            masterId = v.item_relations[0].id;
            break;
          }
        }
      }
      if (masterId && skuMap.has(masterId)) {
        skuMap.set(item.id, skuMap.get(masterId)!);
      }
    }
  }

  // 3. Fetch existing products to preserve "cost" and check existing active SKUs
  const { data: existingProducts } = await supabase
    .from("products")
    .select("meli_item_id, sku, cost, status")
    .eq("tenant_id", tenantId);

  const costMap = new Map<string, number | null>();
  const existingMeliIds = new Set<string>();
  const existingSkus = new Set<string>();

  existingProducts?.forEach(p => {
    costMap.set(p.meli_item_id, p.cost);
    if (p.status !== "deleted_from_meli") {
      existingMeliIds.add(p.meli_item_id);
      if (p.sku) {
        existingSkus.add(p.sku);
      } else {
        existingSkus.add(`no-sku-${p.meli_item_id}`);
      }
    }
  });

  const { getUsageStats } = await import("./../billing/checkLimits");
  const stats = await getUsageStats(tenantId);
  const maxSkus = (stats?.limits as any)?.pub || 100;

  // Filter rawProducts dynamically based on SKU limit
  const selectedSkus = new Set<string>();
  const productsToSync: typeof rawProducts = [];
  const excludedProducts: typeof rawProducts = [];

  // Group rawProducts into existing and new
  const existingRawProducts = rawProducts.filter(p => existingMeliIds.has(p.id));
  const newRawProducts = rawProducts.filter(p => !existingMeliIds.has(p.id));

  // Process existing products first (prioritize already-synced SKUs)
  for (const item of existingRawProducts) {
    const sku = skuMap.get(item.id) || null;
    const skuKey = sku ? sku : `no-sku-${item.id}`;

    if (selectedSkus.has(skuKey)) {
      productsToSync.push(item);
    } else if (selectedSkus.size < maxSkus) {
      selectedSkus.add(skuKey);
      productsToSync.push(item);
    } else {
      excludedProducts.push(item);
    }
  }

  // Process new products
  for (const item of newRawProducts) {
    const sku = skuMap.get(item.id) || null;
    const skuKey = sku ? sku : `no-sku-${item.id}`;

    if (selectedSkus.has(skuKey)) {
      productsToSync.push(item);
    } else if (selectedSkus.size < maxSkus) {
      selectedSkus.add(skuKey);
      productsToSync.push(item);
    } else {
      excludedProducts.push(item);
    }
  }

  if (excludedProducts.length > 0) {
    // Warn the user
    await supabase.from("alerts").insert({
      tenant_id: tenantId,
      type: "warning",
      title: "Límite de SKUs Alcanzado",
      message: `Tienes más SKUs únicos en Mercado Libre de los permitidos en tu plan. Solo se sincronizaron las publicaciones asociadas a los primeros ${maxSkus} SKUs.`,
      is_read: false
    });
  }

  // Reassign to rawProducts so the rest of the function operates on the filtered list
  rawProducts = productsToSync;

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
      estimated_tax: 0, // Simplification for now
      packaging_cost: packagingCost
    });

    const rawData = item;
    rawData.fees = feeData?.raw_response;
    rawData.shipping_estimate = shippingData.raw_response;

    productsToUpsert.push({
      tenant_id: tenantId,
      meli_account_id: meli_account_id,
      meli_item_id: item.id,
      sku: skuMap.get(item.id) || null,
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

  // 4.1. Process and save SKU components and bind to inventory items (Sprint 34)
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
      const uniqueCompNames = Array.from(new Set(componentsToInsert.map(c => c.component_normalized)));

      if (uniqueCompNames.length > 0) {
        // 1. Fetch existing inventory items
        const { data: existingItems, error: itemsError } = await supabase
          .from("inventory_items")
          .select("id, sku_normalized")
          .eq("tenant_id", tenantId)
          .in("sku_normalized", uniqueCompNames);

        if (itemsError) {
          console.error("Error fetching inventory items during sync:", itemsError);
        }

        const itemMap = new Map<string, string>();
        if (existingItems) {
          for (const item of existingItems) {
            itemMap.set(item.sku_normalized, item.id);
          }
        }

        // 2. Create missing inventory items
        const missingComps = uniqueCompNames.filter(name => !itemMap.has(name));
        if (missingComps.length > 0) {
          const itemsToInsert = missingComps.map(name => ({
            tenant_id: tenantId,
            sku: name,
            sku_normalized: name,
            current_stock: 0,
            unit_cost: null,
            average_cost: null,
            last_purchase_cost: null
          }));

          const { data: newInsertedItems, error: insertItemsError } = await supabase
            .from("inventory_items")
            .insert(itemsToInsert)
            .select("id, sku_normalized");

          if (insertItemsError) {
            console.error("Error creating missing inventory items:", insertItemsError);
          } else if (newInsertedItems) {
            for (const item of newInsertedItems) {
              itemMap.set(item.sku_normalized, item.id);
            }
          }
        }

        // 3. Build product_components payloads
        const prodComponentsToInsert: any[] = [];
        for (const p of upsertedData) {
          if (!p.sku) continue;
          const parsed = parseCompositeSku(p.sku);
          if (parsed.components.length > 0) {
            const compCounts: Record<string, number> = {};
            for (const comp of parsed.components) {
              compCounts[comp] = (compCounts[comp] || 0) + 1;
            }

            for (const [comp, qty] of Object.entries(compCounts)) {
              const itemId = itemMap.get(comp);
              if (itemId) {
                prodComponentsToInsert.push({
                  tenant_id: tenantId,
                  product_id: p.id,
                  inventory_item_id: itemId,
                  component_sku: comp,
                  component_normalized: comp,
                  quantity: qty,
                  unit_cost: null,
                  total_component_cost: null
                });
              }
            }
          }
        }

        // 4. Perform clear and insert in chunks
        const chunkSize = 100;
        for (let i = 0; i < productIdsToClear.length; i += chunkSize) {
          const chunk = productIdsToClear.slice(i, i + chunkSize);
          await supabase.from("product_sku_components").delete().in("product_id", chunk);
          await supabase.from("product_components").delete().in("product_id", chunk);
        }

        // Insert into legacy product_sku_components table
        for (let i = 0; i < componentsToInsert.length; i += chunkSize) {
          const chunk = componentsToInsert.slice(i, i + chunkSize);
          await supabase.from("product_sku_components").insert(chunk);
        }

        // Insert into new product_components table
        for (let i = 0; i < prodComponentsToInsert.length; i += chunkSize) {
          const chunk = prodComponentsToInsert.slice(i, i + chunkSize);
          const { error: pCompError } = await supabase.from("product_components").insert(chunk);
          if (pCompError) console.error("Error inserting product components:", pCompError);
        }

        // 5. Recalculate automatic costing for each modified product
        const { recalculateProductCostFromComponents } = await import("../inventory/recalculateProductCostFromComponents");
        for (const pId of productIdsToClear) {
          try {
            await recalculateProductCostFromComponents(tenantId, pId);
          } catch (costErr: any) {
            console.error(`Failed to recalculate cost for product ${pId} during sync:`, costErr.message);
          }
        }
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
