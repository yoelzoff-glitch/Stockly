import { createAdminClient } from '@/lib/supabase/admin';
import { updatePrice } from '@/services/meli/actions/updatePrice';
import { updateStock } from '@/services/meli/actions/updateStock';
import { pauseProduct, activateProduct } from '@/services/meli/actions/statusProduct';
import { createItemPromotion } from '@/services/meli/promotions/createItemPromotion';
import { createCoupon } from '@/services/meli/promotions/createCoupon';
import { logger } from '@/lib/errors/logger';

/**
 * Confirma y ejecuta de forma definitiva una acción de actualización de producto pendiente.
 * Valida los límites físicos de seguridad, itera sobre los items de la acción y ejecuta 
 * las llamadas correspondientes al SDK/API de Mercado Libre (cambio de precio, stock, pausa 
 * o reactivación), actualizando finalmente el estado de la acción en la base de datos local
 * con el resultado pormenorizado de la ejecución.
 * 
 * @param tenantId Identificador único del comercio (tenant)
 * @param actionId Identificador de la acción individual a ejecutar
 * @returns Promesa con estado de éxito y los resultados individuales por producto
 */
export async function confirmPendingAction(tenantId: string, actionId: string) {
  const supabase = createAdminClient();

  const { data: action, error } = await supabase
    .from("ai_actions")
    .select("*")
    .eq("id", actionId)
    .eq("tenant_id", tenantId)
    .eq("status", "pending")
    .single();

  if (error || !action) {
    return { success: false, error: "Action not found or not pending" };
  }

  let payloadItems: any[] = [];
  if (Array.isArray(action.payload)) {
    payloadItems = action.payload;
  } else if (action.payload && typeof action.payload === 'object' && Array.isArray((action.payload as any).items)) {
    payloadItems = (action.payload as any).items;
  } else if (action.action_type === 'create_promotion' || action.action_type === 'create_coupon') {
    payloadItems = [action.payload];
  }

  if (payloadItems.length > 50) {
    return { success: false, error: "Límite de 50 productos excedido" };
  }

  const results = [];

  for (const item of payloadItems) {
    try {
      if (action.action_type === 'update_price') {
        await updatePrice(tenantId, item.product_id, item.new_value);
      } else if (action.action_type === 'update_stock') {
        await updateStock(tenantId, item.product_id, item.new_value);
      } else if (action.action_type === 'pause_product') {
        await pauseProduct(tenantId, item.product_id);
      } else if (action.action_type === 'activate_product') {
        await activateProduct(tenantId, item.product_id);
      } else if (action.action_type === 'create_promotion') {
        const promoId = "PROMO-" + Math.floor(Math.random() * 100000);
        await createItemPromotion(tenantId, promoId, item.product_id, {
          deal_price: item.simulation.discounted_price,
          original_price: item.simulation.current_price,
          promotion_type: item.type
        });
        const { data: promo } = await supabase.from("promotions").insert({
          tenant_id: tenantId,
          type: item.type,
          status: 'active',
          discount_type: item.discountPercent ? 'percent' : 'amount',
          discount_value: item.discountPercent || item.discountAmount,
          title: action.title
        }).select("id").single();
        if (promo) {
          await supabase.from("promotion_items").insert({
            tenant_id: tenantId,
            promotion_id: promo.id,
            product_id: item.product_id,
            current_price: item.simulation.current_price,
            discount_price: item.simulation.discounted_price,
            status: 'active'
          });
        }
      } else if (action.action_type === 'create_coupon') {
        await createCoupon(tenantId, item);
        await supabase.from("coupons").insert({
          tenant_id: tenantId,
          coupon_type: 'standard',
          discount_type: item.discountType,
          discount_value: item.discountValue,
          target_audience: item.targetAudience,
          status: 'active',
          title: action.title
        });
      }
      results.push({ product_id: item.product_id, success: true });
    } catch (err: any) {
      logger.error(`Error executing action ${action.id} for product ${item.product_id}: ${err.message}`, "AI_ACTIONS");
      results.push({ product_id: item.product_id, success: false, error: err.message });
    }
  }

  await supabase.from("ai_actions").update({
    status: "executed",
    executed_at: new Date().toISOString(),
    result: results
  }).eq("id", action.id);

  return { success: true, results };
}

/**
 * Cancela una acción pendiente de forma segura, marcando su estado como 'cancelled'
 * para evitar cualquier impacto en Mercado Libre o alertas adicionales en el panel.
 * 
 * @param tenantId Identificador único del comercio
 * @param actionId Identificador de la acción a cancelar
 * @returns Promesa con estado de éxito de la actualización de base de datos
 */
export async function cancelPendingAction(tenantId: string, actionId: string) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("ai_actions").update({
    status: "cancelled",
  }).eq("id", actionId).eq("tenant_id", tenantId);
  return { success: !error };
}
