"use server";

import { createClient } from "@/lib/supabase/server";
import { preparePriceUpdate, prepareMeliStockUpdate, prepareStatusChange } from "@/services/ai/tools";
import { confirmPendingAction, cancelPendingAction } from "@/services/ai/actions/confirm";
import { normalizeSku } from "@/lib/sku";

export async function preparePriceChangeAction(productId: string, sku: string | null, productTitle: string, newPrice: number) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.tenant_id) return { error: "No tenant" };

  // Note: preparePriceUpdate in tools.ts expects an array or query.
  // Actually, tools.ts `preparePriceUpdate` takes (tenantId, query, newPrice, percentageChange).
  // If we pass SKU it will resolve the product.
  // Wait, if SKU is null, we can pass productTitle.
  const query = sku || productTitle;

  return await preparePriceUpdate(profile.tenant_id, query, newPrice, undefined);
}

export async function prepareStockChangeAction(productId: string, sku: string | null, productTitle: string, newQuantity: number, operation: 'set' | 'add' | 'subtract' = 'set') {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.tenant_id) return { error: "No tenant" };

  const query = sku || productTitle;

  return await prepareMeliStockUpdate(profile.tenant_id, query, newQuantity, operation);
}

export async function prepareStatusChangeAction(productId: string, sku: string | null, productTitle: string, status: 'paused' | 'active') {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.tenant_id) return { error: "No tenant" };

  const query = sku || productTitle;
  return await prepareStatusChange(profile.tenant_id, query, status);
}

export async function getSiblingProducts(productId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "No autenticado", siblings: [] };

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.tenant_id) return { success: false, error: "No tenant", siblings: [] };

  const { data: currentProduct, error } = await supabase
    .from("products")
    .select("id, sku, meli_account_id")
    .eq("id", productId)
    .eq("tenant_id", profile.tenant_id)
    .single();

  if (error || !currentProduct) return { success: false, error: "Producto no encontrado", siblings: [] };

  const normalizedSku = normalizeSku(currentProduct.sku);
  if (!normalizedSku) return { success: true, siblings: [] };

  let query = supabase
    .from("products")
    .select("id, title, sku, meli_item_id, listing_type_id, status, price, thumbnail_url, permalink")
    .eq("tenant_id", profile.tenant_id)
    .neq("id", productId)
    .not("sku", "is", null);

  if (currentProduct.meli_account_id) {
    query = query.eq("meli_account_id", currentProduct.meli_account_id);
  }

  const { data: products } = await query;
  
  if (!products) return { success: true, siblings: [] };

  const siblings = products.filter(p => normalizeSku(p.sku) === normalizedSku && p.meli_item_id);

  return { success: true, siblings };
}

export async function prepareTitleChangeAction(
  productId: string, 
  newTitle: string,
  options?: {
    applyToSiblings?: boolean;
    siblingProductIds?: string[];
  }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "No autenticado" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.tenant_id) return { success: false, error: "No tenant" };

  const { data: product, error } = await supabase
    .from("products")
    .select("id, meli_item_id, title, listing_type_id, sku")
    .eq("id", productId)
    .eq("tenant_id", profile.tenant_id)
    .single();

  if (error || !product) return { success: false, error: "Producto no encontrado" };
  if (!product.meli_item_id) return { success: false, error: "El producto no tiene un ID de Mercado Libre asociado" };
  
  if (!newTitle || newTitle.trim() === "") return { success: false, error: "El título no puede estar vacío" };
  if (newTitle.trim() === product.title) return { success: false, error: "El título es igual al actual" };
  if (newTitle.trim().length > 60) return { success: false, error: "El título no puede superar los 60 caracteres" };

  let affectedProducts = [{
    id: product.id,
    meli_item_id: product.meli_item_id,
    old_title: product.title,
    listing_type_id: product.listing_type_id || 'N/A',
    sku: product.sku
  }];

  if (options?.applyToSiblings && options.siblingProductIds && options.siblingProductIds.length > 0) {
    const normalizedSku = normalizeSku(product.sku);
    if (normalizedSku) {
      const { data: siblings } = await supabase
        .from("products")
        .select("id, meli_item_id, title, listing_type_id, sku")
        .in("id", options.siblingProductIds)
        .eq("tenant_id", profile.tenant_id);
        
      if (siblings) {
        for (const sibling of siblings) {
          if (
            normalizeSku(sibling.sku) === normalizedSku && 
            sibling.meli_item_id && 
            sibling.id !== product.id
          ) {
            affectedProducts.push({
              id: sibling.id,
              meli_item_id: sibling.meli_item_id,
              old_title: sibling.title,
              listing_type_id: sibling.listing_type_id || 'N/A',
              sku: sibling.sku
            });
          }
        }
      }
    }
  }

  const isMultiple = affectedProducts.length > 1;
  const description = isMultiple 
    ? `Cambiar título de la publicación actual y ${affectedProducts.length - 1} publicaciones hermanas con el mismo SKU.`
    : `Cambiar título de la publicación actual.`;

  const { data: action, error: actionError } = await supabase.from("ai_actions").insert({
    tenant_id: profile.tenant_id,
    action_type: "change_title",
    status: "pending",
    title: "Cambiar título de publicación",
    description,
    payload: {
      product_id: product.id,
      meli_item_id: product.meli_item_id,
      old_title: product.title,
      new_title: newTitle.trim(),
      apply_to_siblings: !!options?.applyToSiblings,
      affected_products: affectedProducts
    },
    requested_by: user.id
  }).select("id").single();

  if (actionError || !action) {
    return { success: false, error: "Error al preparar el cambio de título" };
  }

  let message = `**PREVISUALIZACIÓN DE CAMBIO DE TÍTULO**\n\n`;
  message += `**Nuevo título:** ${newTitle.trim()}\n\n`;
  message += `**Publicaciones afectadas:**\n`;
  
  affectedProducts.forEach((p, idx) => {
    message += `${idx + 1}. [${p.listing_type_id}] ${p.old_title}\n`;
  });

  message += `\n**IMPORTANTE:**\n`;
  if (isMultiple) {
    message += `Mercado Libre considera estas publicaciones como independientes.\n`;
    message += `Klyvo aplicará el cambio de título en cada publicación seleccionada.\n`;
  } else {
    message += `Esta acción modificará el título real de la publicación en Mercado Libre.\n`;
  }
  message += `Para confirmar la acción, por favor responde únicamente con la palabra: **CONFIRMO**`;

  return { success: true, action_id: action.id, message };
}


export async function confirmCommandCenterAction(actionId: string): Promise<{ success: boolean; error?: string; results?: any[]; partial?: boolean; message?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "No autenticado" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.tenant_id) return { success: false, error: "No tenant" };

  const res = await confirmPendingAction(profile.tenant_id, actionId);
  if (res.success && res.results && res.results.length > 0) {
    const failed = res.results.filter((r: any) => !r.success);
    const succeeded = res.results.filter((r: any) => r.success);

    if (succeeded.length > 0 && failed.length > 0) {
      const catalogFailedCount = failed.filter((f: any) => 
        f.error?.toLowerCase().includes("catálogo") || 
        f.error?.toLowerCase().includes("catalogo") || 
        f.error?.toLowerCase().includes("catalog") || 
        f.error?.toLowerCase().includes("cannot update item")
      ).length;

      let reason = "";
      if (catalogFailedCount > 0) {
        reason = ` (${catalogFailedCount} ${catalogFailedCount === 1 ? 'era de catálogo y no permite cambios' : 'eran de catálogo y no permiten cambios'})`;
      }

      return {
        success: true,
        partial: true,
        message: `${succeeded.length} ${succeeded.length === 1 ? 'publicación modificada' : 'publicaciones modificadas'} exitosamente y ${failed.length} ${failed.length === 1 ? 'falló' : 'fallaron'}${reason}.`
      };
    } else if (failed.length > 0 && succeeded.length === 0) {
      return { success: false, error: failed[0].error || "Error al modificar las publicaciones" };
    } else if (succeeded.length > 0 && failed.length === 0) {
      return {
        success: true,
        message: `${succeeded.length} ${succeeded.length === 1 ? 'publicación modificada' : 'publicaciones modificadas'} exitosamente.`
      };
    }
  }
  return res;
}

export async function cancelCommandCenterAction(actionId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "No autenticado" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.tenant_id) return { success: false, error: "No tenant" };

  return await cancelPendingAction(profile.tenant_id, actionId);
}
