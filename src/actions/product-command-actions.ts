"use server";

import { createClient } from "@/lib/supabase/server";
import { preparePriceUpdate, prepareMeliStockUpdate, prepareStatusChange } from "@/services/ai/tools";
import { confirmPendingAction, cancelPendingAction } from "@/services/ai/actions/confirm";
import { normalizeSku } from "@/lib/sku";
import { requireTenantContext } from "@/lib/security/tenantAuth";
import { logger } from "@/lib/errors/logger";

export async function preparePriceChangeAction(productId: string, sku: string | null, productTitle: string, newPrice: number) {
  try {
    const context = await requireTenantContext();
    const query = productId;
    return await preparePriceUpdate(context.tenantId, query, newPrice, undefined);
  } catch (error: any) {
    logger.warn({ event: "AUTH_ACTION_FAILED", action: "preparePriceChangeAction", error: error.message });
    return { error: error.message || "No autenticado" };
  }
}

export async function prepareStockChangeAction(productId: string, sku: string | null, productTitle: string, newQuantity: number, operation: 'set' | 'add' | 'subtract' = 'set') {
  try {
    const context = await requireTenantContext();
    const query = productId;
    return await prepareMeliStockUpdate(context.tenantId, query, newQuantity, operation);
  } catch (error: any) {
    logger.warn({ event: "AUTH_ACTION_FAILED", action: "prepareStockChangeAction", error: error.message });
    return { error: error.message || "No autenticado" };
  }
}

export async function prepareStatusChangeAction(productId: string, sku: string | null, productTitle: string, status: 'paused' | 'active') {
  try {
    const context = await requireTenantContext();
    const query = productId;
    return await prepareStatusChange(context.tenantId, query, status);
  } catch (error: any) {
    logger.warn({ event: "AUTH_ACTION_FAILED", action: "prepareStatusChangeAction", error: error.message });
    return { error: error.message || "No autenticado" };
  }
}

export async function getSiblingProducts(productId: string) {
  try {
    const context = await requireTenantContext();
    const supabase = await createClient();

    const { data: currentProduct, error } = await supabase
      .from("products")
      .select("id, sku, meli_account_id")
      .eq("id", productId)
      .eq("tenant_id", context.tenantId)
      .maybeSingle();

    if (error || !currentProduct) return { success: false, error: "Producto no encontrado", siblings: [] };

    const normalizedSku = normalizeSku(currentProduct.sku);
    if (!normalizedSku) return { success: true, siblings: [] };

    let query = supabase
      .from("products")
      .select("id, title, sku, meli_item_id, listing_type_id, status, price, thumbnail_url, permalink")
      .eq("tenant_id", context.tenantId)
      .neq("id", productId)
      .not("sku", "is", null);

    if (currentProduct.meli_account_id) {
      query = query.eq("meli_account_id", currentProduct.meli_account_id);
    }

    const { data: products } = await query;
    
    if (!products) return { success: true, siblings: [] };

    const siblings = products.filter(p => normalizeSku(p.sku) === normalizedSku && p.meli_item_id);

    return { success: true, siblings };
  } catch (error: any) {
    return { success: false, error: error.message || "No autenticado", siblings: [] };
  }
}

export async function prepareTitleChangeAction(
  productId: string, 
  newTitle: string,
  options?: {
    applyToSiblings?: boolean;
    siblingProductIds?: string[];
  }
) {
  try {
    const context = await requireTenantContext();
    const supabase = await createClient();

    const { data: product, error } = await supabase
      .from("products")
      .select("id, meli_item_id, title, listing_type_id, sku")
      .eq("id", productId)
      .eq("tenant_id", context.tenantId)
      .maybeSingle();

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
          .eq("tenant_id", context.tenantId);
          
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
      tenant_id: context.tenantId,
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
      requested_by: context.userId
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
  } catch (error: any) {
    return { success: false, error: error.message || "Error al preparar acción" };
  }
}

import { formatCommandCenterActionResult, type CommandCenterActionResult } from "@/lib/ai/commandCenterResults";

export async function confirmCommandCenterAction(actionId: string): Promise<CommandCenterActionResult> {
  try {
    const context = await requireTenantContext();
    const res = await confirmPendingAction(context.tenantId, actionId);
    return formatCommandCenterActionResult(res);
  } catch (error: any) {
    return { success: false, error: error.message || "Error al confirmar acción" };
  }
}

export async function cancelCommandCenterAction(actionId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const context = await requireTenantContext();
    const res = await cancelPendingAction(context.tenantId, actionId);
    return res;
  } catch (error: any) {
    return { success: false, error: error.message || "Error al cancelar acción" };
  }
}
