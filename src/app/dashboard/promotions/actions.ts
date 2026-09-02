"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createCoupon } from "@/services/meli/promotions/createCoupon";
import { createItemPromotion } from "@/services/meli/promotions/createItemPromotion";
import { updatePrice } from "@/services/meli/actions/updatePrice";
import { revalidatePath } from "next/cache";

import { getCoupons } from "@/services/meli/promotions/getCoupons";

// ==========================================
// COUPON ACTIONS (MANTENIDOS)
// ==========================================

export async function getCouponsAction() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!profile?.tenant_id) return [];

  // Synchronize coupons & promotions from Mercado Libre live API via server-side admin client
  try {
    const adminSupabase = createAdminClient();
    const { data: account } = await adminSupabase
      .from("meli_accounts")
      .select("meli_user_id, access_token")
      .eq("tenant_id", profile.tenant_id)
      .maybeSingle();

    if (account?.meli_user_id && account?.access_token) {
      const res = await fetch(`https://api.mercadolibre.com/seller-promotions/users/${account.meli_user_id}?app_version=v2`, {
        headers: { 'Authorization': `Bearer ${account.access_token}` }
      });
      if (res.ok) {
        const mlData = await res.json();
        const results = mlData.results || [];
        const mlCoupons = results.filter((item: any) => item.type === "SELLER_COUPON_CAMPAIGN" || item.id?.startsWith("C-"));

        if (mlCoupons.length > 0) {
          const { data: dbCoupons } = await supabase
            .from("coupons")
            .select("*")
            .eq("tenant_id", profile.tenant_id);

          for (const item of mlCoupons) {
            const meliCouponId = item.id;
            if (!meliCouponId) continue;

            const existing = dbCoupons?.find(c => c.meli_coupon_id === meliCouponId);

            const startsAt = item.start_date || new Date().toISOString();
            const endsAt = item.finish_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

            const couponData = {
              tenant_id: profile.tenant_id,
              meli_coupon_id: meliCouponId,
              title: item.name || item.title || 'Cupón Mercado Libre',
              code: item.code || 'MELI-CUPON',
              coupon_type: item.sub_type || 'standard',
              discount_type: item.sub_type === 'FIXED_AMOUNT' ? 'amount' : 'percent',
              discount_value: Number(item.fixed_amount || item.discount_value || 4000),
              min_purchase_amount: item.min_purchase_amount ? Number(item.min_purchase_amount) : null,
              max_uses: item.max_uses ? Number(item.max_uses) : null,
              starts_at: startsAt,
              ends_at: endsAt,
              target_audience: 'followers',
              status: item.status === 'started' ? 'active' : item.status,
              raw_response: item,
              updated_at: new Date().toISOString()
            };

            if (existing) {
              await supabase.from("coupons").update(couponData).eq("id", existing.id);
            } else {
              await supabase.from("coupons").insert({ ...couponData, created_by: user.id });
            }
          }
        }
      }
    }
  } catch (error) {
    console.error("Error synchronizing coupons from Mercado Libre:", error);
  }

  const { data: coupons } = await supabase
    .from("coupons")
    .select("*")
    .eq("tenant_id", profile.tenant_id)
    .order("created_at", { ascending: false });

  return coupons || [];
}

export async function createManualCouponAction(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!profile?.tenant_id) throw new Error("Usuario sin tenant");

  const title = formData.get("title") as string;
  const code = formData.get("code") as string;
  const discountType = formData.get("discountType") as string;
  const discountValue = Number(formData.get("discountValue"));
  const minPurchaseAmount = formData.get("minPurchaseAmount") ? Number(formData.get("minPurchaseAmount")) : undefined;
  const maxUses = formData.get("maxUses") ? Number(formData.get("maxUses")) : undefined;
  const startsAt = formData.get("startsAt") as string;
  const endsAt = formData.get("endsAt") as string;
  const targetAudience = formData.get("targetAudience") as string;

  if (!title) throw new Error("El título es obligatorio");
  if (!discountType || !["percent", "amount"].includes(discountType)) {
    throw new Error("El tipo de descuento es inválido");
  }
  if (!discountValue || discountValue <= 0) {
    throw new Error("El valor del descuento debe ser mayor a 0");
  }
  if (discountType === "percent" && discountValue > 100) {
    throw new Error("El descuento por porcentaje no puede ser mayor a 100");
  }
  if (minPurchaseAmount !== undefined && minPurchaseAmount < 0) {
    throw new Error("La compra mínima no puede ser negativa");
  }
  if (maxUses !== undefined && (maxUses <= 0 || !Number.isInteger(maxUses))) {
    throw new Error("El límite de usos debe ser un entero mayor a 0");
  }
  if (!startsAt) throw new Error("La fecha de inicio es obligatoria");
  if (!endsAt) throw new Error("La fecha de fin es obligatoria");
  if (new Date(endsAt) <= new Date(startsAt)) {
    throw new Error("La fecha de fin debe ser posterior a la fecha de inicio");
  }
  if (!targetAudience) throw new Error("La audiencia objetivo es obligatoria");

  const payload = {
    title,
    discount_type: discountType,
    discount_value: discountValue,
    target_audience: targetAudience === "general" ? undefined : targetAudience,
    max_uses: maxUses,
    min_purchase_amount: minPurchaseAmount,
    start_date: new Date(startsAt).toISOString(),
    finish_date: new Date(endsAt).toISOString(),
    code: code || undefined
  };

  let meliResponse;
  try {
    meliResponse = await createCoupon(profile.tenant_id, payload);
  } catch (error: any) {
    if (error.message.includes("No se encontró el ID de usuario")) {
      throw new Error("No tenés una cuenta de Mercado Libre conectada. Conectala desde Configuración.");
    }
    throw new Error(`Mercado Libre no permitió crear este cupón. Revisá los datos o las condiciones disponibles para tu cuenta. Detalles: ${error.message}`);
  }

  const { data: dbCoupon, error: dbError } = await supabase.from("coupons").insert({
    tenant_id: profile.tenant_id,
    meli_coupon_id: meliResponse?.id || meliResponse?.coupon_id || meliResponse?.meli_coupon_id || null,
    title: title,
    code: code || null,
    coupon_type: 'manual',
    discount_type: discountType,
    discount_value: discountValue,
    min_purchase_amount: minPurchaseAmount || null,
    max_uses: maxUses || null,
    starts_at: startsAt,
    ends_at: endsAt,
    target_audience: targetAudience,
    status: meliResponse?.status || 'active',
    raw_payload: payload,
    raw_response: meliResponse,
    created_by: user.id
  }).select().single();

  if (dbError) {
    console.error("Supabase Error:", dbError);
    throw new Error("El cupón se creó en Mercado Libre, pero no se pudo guardar localmente. Revisá logs.");
  }

  revalidatePath("/dashboard/promotions");
  return { success: true, coupon: dbCoupon };
}

// ==========================================
// SKU NORMALIZATION HELPERS
// ==========================================

function normalizeSkuForSearch(value: string): string {
  if (!value) return "";
  return value.toUpperCase().trim().replace(/[-_/,|]/g, " ").replace(/\s+/g, " ");
}

function splitSkuTokens(value: string): string[] {
  return normalizeSkuForSearch(value).split(" ").filter(Boolean);
}

function matchSkuToken(productSku: string, searchedSku: string): boolean {
  if (!productSku || !searchedSku) return false;
  const normalizedSearch = normalizeSkuForSearch(searchedSku);
  const searchTokens = normalizedSearch.split(" ").filter(Boolean);
  const productTokens = splitSkuTokens(productSku);

  // Para que el match sea valido, TODOS los tokens de la búsqueda deben estar en los tokens del producto
  return searchTokens.every(token => productTokens.includes(token));
}

// ==========================================
// PROMOTION ACTIONS
// ==========================================

export async function getPromotionsAction() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!profile?.tenant_id) return [];

  // Live Sync Mercado Libre Seller Promotions & Participating Items
  try {
    const adminSupabase = createAdminClient();
    const { data: account } = await adminSupabase
      .from("meli_accounts")
      .select("meli_user_id, access_token")
      .eq("tenant_id", profile.tenant_id)
      .maybeSingle();

    if (account?.meli_user_id && account?.access_token) {
      const res = await fetch(`https://api.mercadolibre.com/seller-promotions/users/${account.meli_user_id}?app_version=v2`, {
        headers: { 'Authorization': `Bearer ${account.access_token}` }
      });

      if (res.ok) {
        const mlData = await res.json();
        const results = mlData.results || [];
        const mlPromos = results.filter((item: any) => item.type !== "SELLER_COUPON_CAMPAIGN" && !item.id?.startsWith("C-"));

        const { data: dbPromos } = await supabase
          .from("promotions")
          .select("*")
          .eq("tenant_id", profile.tenant_id);

        const { data: dbProducts } = await supabase
          .from("products")
          .select("id, meli_item_id, title, sku, price")
          .eq("tenant_id", profile.tenant_id);

        for (const item of mlPromos) {
          const meliPromoId = item.id;
          if (!meliPromoId) continue;

          const existing = dbPromos?.find(p => p.meli_promotion_id === meliPromoId);

          const startsAt = item.start_date || new Date().toISOString();
          const endsAt = item.finish_date || new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString();
          const status = item.status === "started" ? "active" : (item.status === "pending" ? "pending" : item.status);

          const promoData = {
            tenant_id: profile.tenant_id,
            meli_promotion_id: meliPromoId,
            type: item.type?.toLowerCase() || 'custom',
            status,
            title: item.name || `Promoción Mercado Libre (${item.type})`,
            description: `Tipo: ${item.type} | Estado ML: ${item.status}`,
            discount_type: 'percent',
            discount_value: 15,
            starts_at: startsAt,
            ends_at: endsAt,
            raw_payload: item,
            updated_at: new Date().toISOString()
          };

          let promoRecordId = existing?.id;

          if (existing) {
            await supabase.from("promotions").update(promoData).eq("id", existing.id);
          } else {
            const { data: inserted } = await supabase.from("promotions").insert({ ...promoData, created_by: user.id }).select().single();
            promoRecordId = inserted?.id;
          }

          // Fetch participating items for this promotion from ML API
          if (promoRecordId) {
            try {
              const itemsRes = await fetch(`https://api.mercadolibre.com/seller-promotions/promotions/${meliPromoId}/items?promotion_type=${item.type}&app_version=v2`, {
                headers: { 'Authorization': `Bearer ${account.access_token}` }
              });

              if (itemsRes.ok) {
                const itemsData = await itemsRes.json();
                const promoItemsList = itemsData.results || [];

                for (const pItem of promoItemsList) {
                  const matchedProd = dbProducts?.find(p => p.meli_item_id === pItem.id);
                  const origPrice = Number(pItem.original_price || matchedProd?.price || 0);
                  const dealPrice = Number(pItem.price || origPrice);
                  const sellerPct = Number(pItem.seller_percentage || 0);
                  const meliPct = Number(pItem.meli_percentage || 0);
                  const totalPct = sellerPct + meliPct > 0 ? (sellerPct + meliPct) : (origPrice > 0 ? ((origPrice - dealPrice) / origPrice) * 100 : 0);

                  const itemStatus = pItem.status === 'started' ? 'active' : pItem.status;

                  const { data: existingItems } = await supabase
                    .from("promotion_items")
                    .select("id")
                    .eq("promotion_id", promoRecordId)
                    .eq("meli_item_id", pItem.id);

                  const promoItemRow = {
                    tenant_id: profile.tenant_id,
                    promotion_id: promoRecordId,
                    product_id: matchedProd?.id || pItem.id,
                    meli_item_id: pItem.id,
                    current_price: origPrice,
                    discount_price: dealPrice,
                    discount_percent: Number(totalPct.toFixed(1)),
                    status: itemStatus,
                    raw_response: pItem
                  };

                  if (existingItems && existingItems.length > 0) {
                    await supabase.from("promotion_items").update(promoItemRow).eq("id", existingItems[0].id);
                  } else {
                    await supabase.from("promotion_items").insert(promoItemRow);
                  }
                }
              }
            } catch (itemErr) {
              console.warn(`Could not fetch items for promotion ${meliPromoId}:`, itemErr);
            }
          }
        }
      }
    }
  } catch (error) {
    console.error("Error synchronizing promotions from Mercado Libre:", error);
  }

  const { data: promotions } = await supabase
    .from("promotions")
    .select(`
      *,
      promotion_items (
        id, product_id, meli_item_id, current_price, discount_price, discount_percent, status, raw_response
      )
    `)
    .eq("tenant_id", profile.tenant_id)
    .order("created_at", { ascending: false });

  return promotions || [];
}

export async function getManualPromotionProductsAction(filters: { search?: string; status?: string; minPrice?: string; maxPrice?: string }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("id", user.id).single();
  if (!profile?.tenant_id) throw new Error("Usuario sin tenant");

  let query = supabase.from("products").select("id, meli_item_id, title, sku, price, status, thumbnail_url, permalink").eq("tenant_id", profile.tenant_id);

  if (filters.status && filters.status !== 'all') {
    query = query.eq("status", filters.status);
  }
  if (filters.minPrice) {
    query = query.gte("price", parseFloat(filters.minPrice));
  }
  if (filters.maxPrice) {
    query = query.lte("price", parseFloat(filters.maxPrice));
  }
  if (filters.search) {
    query = query.or(`title.ilike.%${filters.search}%,sku.ilike.%${filters.search}%,meli_item_id.ilike.%${filters.search}%`);
  }

  const { data: products } = await query.order("title", { ascending: true }).limit(200);
  return products || [];
}

export async function searchProductsBySkuAction(sku: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("id", user.id).single();
  if (!profile?.tenant_id) throw new Error("Usuario sin tenant");

  if (!sku || sku.trim() === "") return [];

  // 1. Fetch all products to do in-memory accurate matching for products.sku
  const { data: products } = await supabase
    .from("products")
    .select("id, meli_item_id, title, sku, price, status, thumbnail_url, permalink")
    .eq("tenant_id", profile.tenant_id);

  if (!products) return [];

  // 2. Fetch all product_sku_components for the tenant
  const { data: components } = await supabase
    .from("product_sku_components")
    .select("product_id, component_sku, component_normalized")
    .eq("tenant_id", profile.tenant_id);

  const matchedProductIds = new Set<string>();

  // Helper for component match
  const searchTokens = splitSkuTokens(sku);

  // Match by product.sku
  for (const p of products) {
    if (p.sku && matchSkuToken(p.sku, sku)) {
      matchedProductIds.add(p.id);
    }
  }

  // Match by component
  if (components) {
    for (const c of components) {
      if (c.component_sku && matchSkuToken(c.component_sku, sku)) {
        matchedProductIds.add(c.product_id);
      } else if (c.component_normalized && matchSkuToken(c.component_normalized, sku)) {
        matchedProductIds.add(c.product_id);
      }
    }
  }

  // Filter products by matched IDs
  return products.filter(p => matchedProductIds.has(p.id));
}

export async function createManualPromotionAction(payload: {
  title: string;
  description?: string;
  discountType: string;
  discountValue: number;
  startsAt: string;
  endsAt: string;
  items: Array<{
    id: string;
    meli_item_id: string;
    price: number;
  }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("id", user.id).single();
  if (!profile?.tenant_id) throw new Error("Usuario sin tenant");

  // Validaciones
  if (!payload.title) throw new Error("El título es obligatorio");
  if (!payload.discountType || !["percentage_discount", "fixed_amount_discount"].includes(payload.discountType)) {
    throw new Error("El tipo de descuento es inválido");
  }
  if (!payload.discountValue || payload.discountValue <= 0) {
    throw new Error("El valor del descuento debe ser mayor a 0");
  }
  if (payload.discountType === "percentage_discount" && payload.discountValue > 80) {
    throw new Error("El descuento por porcentaje no puede ser mayor a 80%");
  }
  if (!payload.startsAt) throw new Error("La fecha de inicio es obligatoria");
  if (!payload.endsAt) throw new Error("La fecha de fin es obligatoria");
  if (new Date(payload.endsAt) <= new Date(payload.startsAt)) {
    throw new Error("La fecha de fin debe ser posterior a la fecha de inicio");
  }
  if (!payload.items || payload.items.length === 0) {
    throw new Error("Debe seleccionar al menos 1 publicación");
  }

  // Validar precio final en caso de monto fijo
  if (payload.discountType === "fixed_amount_discount") {
    for (const item of payload.items) {
      if (item.price - payload.discountValue <= 0) {
        throw new Error("El descuento fijo no puede ser mayor o igual al precio de las publicaciones seleccionadas");
      }
    }
  }

  // Crear la promoción localmente primero como "creating"
  const promoId = "PROMO-" + Math.floor(Math.random() * 1000000);

  const { data: dbPromo, error: promoError } = await supabase.from("promotions").insert({
    tenant_id: profile.tenant_id,
    meli_promotion_id: promoId, // Fake id as ML doesn't return one for item promotions usually in this api
    type: 'custom',
    status: 'creating',
    title: payload.title,
    description: payload.description || null,
    discount_type: payload.discountType === 'percentage_discount' ? 'percent' : 'amount',
    discount_value: payload.discountValue,
    starts_at: payload.startsAt,
    ends_at: payload.endsAt,
    target_audience: null,
    raw_payload: payload,
    created_by: user.id
  }).select().single();

  if (promoError) {
    console.error("Error creando promocion en DB", promoError);
    throw new Error("Error interno al preparar la promoción en la base de datos.");
  }

  let successCount = 0;
  const errors: string[] = [];

  // Iterar y crear promociones en ML
  for (const item of payload.items) {
    let discountPrice = 0;
    let discountPercent = 0;

    if (payload.discountType === "percentage_discount") {
      discountPrice = item.price - (item.price * payload.discountValue / 100);
      discountPercent = payload.discountValue;
    } else {
      discountPrice = item.price - payload.discountValue;
      discountPercent = (payload.discountValue / item.price) * 100;
    }

    // Redondear a 2 decimales
    discountPrice = Math.round(discountPrice * 100) / 100;
    discountPercent = Math.round(discountPercent * 100) / 100;

    let itemStatus = 'active';
    let rawResponse = null;

    try {
      if (!item.meli_item_id) {
        throw new Error("La publicación no tiene meli_item_id válido");
      }

      // Si tenemos endpoints para campañas personalizadas, usaríamos eso.
      // Como usamos el servicio existente (createItemPromotion/updatePrice fallback), hacemos eso.
      try {
        const resp = await createItemPromotion(profile.tenant_id, promoId, item.id, {
          deal_price: discountPrice,
          original_price: item.price,
          promotion_type: 'CUSTOM' // Mercado libre general custom type
        });
        rawResponse = resp;
      } catch (promoApiError: any) {
        // Fallback a cambio de precio normal si ML no permite
        console.warn(`Fallback a cambio de precio para ${item.id}`, promoApiError.message);
        await updatePrice(profile.tenant_id, item.id, discountPrice);
        rawResponse = { fallback: true, error: promoApiError.message };
      }

      successCount++;
    } catch (e: any) {
      itemStatus = 'failed';
      rawResponse = { error: e.message };
      errors.push(`Item ${item.meli_item_id}: ${e.message}`);
    }

    // Guardar item en promotion_items
    await supabase.from("promotion_items").insert({
      tenant_id: profile.tenant_id,
      promotion_id: dbPromo.id,
      product_id: item.id,
      meli_item_id: item.meli_item_id,
      current_price: item.price,
      discount_price: discountPrice,
      discount_percent: discountPercent,
      status: itemStatus,
      raw_response: rawResponse
    });
  }

  // Update promotion status based on success
  const finalStatus = successCount === payload.items.length ? 'active' : (successCount > 0 ? 'partially_active' : 'failed');
  await supabase.from("promotions").update({ status: finalStatus }).eq("id", dbPromo.id);

  revalidatePath("/dashboard/promotions");

  if (successCount === 0) {
    throw new Error(`Mercado Libre no permitió crear la promoción para ningún artículo. ${errors[0] || ''}`);
  }

  return { success: true, promotion: dbPromo, successCount, errors };
}
