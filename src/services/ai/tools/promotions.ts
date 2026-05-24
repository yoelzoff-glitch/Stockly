import { createAdminClient } from "@/lib/supabase/admin";
import { resolveProduct } from "@/services/products/resolveProduct";
import { simulateDiscount } from "@/services/promotions/simulateDiscount";

export async function prepareCreatePromotion(
  tenantId: string, 
  query: string, 
  type: string, 
  discountPercent?: number, 
  discountAmount?: number, 
  duration?: string
) {
  const supabase = createAdminClient();
  const resolution = await resolveProduct(tenantId, query);

  if (resolution.type === 'not_found') {
    return { error: resolution.error };
  }

  let product;
  if (resolution.type === 'multiple') {
    // Para ofertas puntuales preferimos no hacer bulk automático sin confirmar SKU exacto
    const list = resolution.products.map(p => `- ${p.title} (SKU: ${p.sku || 'N/A'})`).join('\n');
    return { message: `Encontré varios productos. ¿A cuál le querés aplicar la oferta?\n\n${list}\n\nResponde con el SKU exacto.` };
  } else {
    product = resolution.product;
  }

  if (!duration) {
    return {
      _session_state: {
        action_type: 'create_promotion',
        missing_fields: ['duration'],
        context: { query, type, discountPercent, discountAmount }
      },
      message: "Para crear la oferta necesito saber la duración exacta (ej: 24 horas, 3 días). ¿Me decís por favor?"
    };
  }

  const simulation = await simulateDiscount({
    tenantId,
    productId: product.id,
    discountPercent,
    discountAmount,
    duration
  });

  if (simulation.new_margin_percent < 0) {
    return { 
      warning: `¡Cuidado! Crear esta promoción te dejará con un margen negativo de ${simulation.new_margin_percent}%. Esta acción requiere confirmación manual desde el panel de control.`, 
      simulation 
    };
  }

  const payload = {
    product_id: product.id,
    type,
    discountPercent,
    discountAmount,
    duration,
    simulation
  };

  const tenMinsAgo = new Date(Date.now() - 10 * 60000).toISOString();
  let actionId;

  const { data: existingAction } = await supabase
    .from("ai_actions")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("action_type", "create_promotion")
    .eq("status", "pending")
    .gte("created_at", tenMinsAgo)
    .contains("payload", { product_id: product.id })
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (existingAction) {
    const { error } = await supabase.from("ai_actions").update({
      title: `Crear promoción: ${type} - ${product.title}`,
      payload,
      updated_at: new Date().toISOString()
    }).eq("id", existingAction.id);
    if (error) return { error: "No pude actualizar la promoción en la base de datos." };
    actionId = existingAction.id;
  } else {
    const { data: newAction, error } = await supabase.from("ai_actions").insert({
      tenant_id: tenantId,
      action_type: "create_promotion",
      title: `Crear promoción: ${type} - ${product.title}`,
      payload,
      status: "pending"
    }).select("id").single();
    if (error) return { error: "No pude preparar la promoción en la base de datos." };
    actionId = newAction.id;
  }

  const preview = `Voy a crear una oferta para:

Producto: ${product.title}
Precio actual: $${simulation.current_price}
Descuento: ${discountPercent ? discountPercent + '%' : '$' + discountAmount}
Precio oferta: $${simulation.discounted_price}

Margen estimado actual: ${simulation.old_margin_percent}%
Margen estimado con oferta: ${simulation.new_margin_percent}%
${simulation.low_precision ? '*(Advertencia: Precisión baja por falta de costo)*' : ''}

Duración: ${duration || 'No especificada'}

**IMPORTANTE:** ¿Confirmás? (Respondé únicamente 'CONFIRMO')`;

  return {
    action_id: actionId,
    message: preview
  };
}

export async function prepareCreateCoupon(
  tenantId: string, 
  discountType: string, 
  discountValue: number, 
  targetAudience?: string, 
  maxUses?: number, 
  minPurchaseAmount?: number,
  duration?: string
) {
  const supabase = createAdminClient();

  if (!duration) {
    return {
      _session_state: {
        action_type: 'create_coupon',
        missing_fields: ['duration'],
        context: { discountType, discountValue, targetAudience, maxUses, minPurchaseAmount }
      },
      message: "Para crear el cupón necesito saber la vigencia o duración (ej: 1 semana, hasta fin de mes). ¿Me decís por favor?"
    };
  }

  const payload = {
    discountType,
    discountValue,
    targetAudience,
    maxUses,
    minPurchaseAmount,
    duration
  };

  const tenMinsAgo = new Date(Date.now() - 10 * 60000).toISOString();
  let actionId;

  const { data: existingAction } = await supabase
    .from("ai_actions")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("action_type", "create_coupon")
    .eq("status", "pending")
    .gte("created_at", tenMinsAgo)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (existingAction) {
    const { error } = await supabase.from("ai_actions").update({
      title: `Crear cupón ${discountType === 'percent' ? discountValue + '%' : '$' + discountValue} OFF`,
      payload,
      updated_at: new Date().toISOString()
    }).eq("id", existingAction.id);
    if (error) return { error: "No pude actualizar el cupón en la base de datos." };
    actionId = existingAction.id;
  } else {
    const { data: newAction, error } = await supabase.from("ai_actions").insert({
      tenant_id: tenantId,
      action_type: "create_coupon",
      title: `Crear cupón ${discountType === 'percent' ? discountValue + '%' : '$' + discountValue} OFF`,
      payload,
      status: "pending"
    }).select("id").single();
    if (error) return { error: "No pude preparar el cupón en la base de datos." };
    actionId = newAction.id;
  }

  const preview = `Voy a crear un cupón:

Descuento: ${discountType === 'percent' ? discountValue + '% OFF' : '$' + discountValue + ' OFF'}
Audiencia: ${targetAudience || 'General'}
Uso máximo: ${maxUses ? maxUses : 'Sin límite'}
Compra mínima: ${minPurchaseAmount ? '$' + minPurchaseAmount : 'Sin mínimo'}
Vigencia: ${duration || 'No especificada'}

**IMPORTANTE:** ¿Confirmás? (Respondé únicamente 'CONFIRMO')`;

  return {
    action_id: actionId,
    message: preview
  };
}
