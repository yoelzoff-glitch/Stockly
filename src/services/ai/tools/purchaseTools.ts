// src/services/ai/tools/purchaseTools.ts
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeSku } from "@/services/products/sku/normalizeSku";

export interface PurchaseItemInput {
  sku: string;
  quantity: number;
  unit_cost?: number | null;
}

/**
 * Prepara un registro de compra interna a partir de lenguaje natural.
 * Inserta la acción en la tabla `ai_actions` en estado 'pending' para confirmación segura.
 * 
 * @param tenantId Identificador del comercio
 * @param items Lista de productos/componentes con cantidades y costos opcionales
 * @param supplierName Nombre opcional del proveedor
 * @param extraCosts Costos extra de la orden de compra
 */
export async function prepareRegisterPurchase(
  tenantId: string,
  items: PurchaseItemInput[],
  supplierName?: string,
  extraCosts?: number
) {
  const supabase = createAdminClient();

  if (!items || items.length === 0) {
    return { error: "No se especificaron productos para la compra." };
  }

  let previewList = "";
  let missingCosts = false;

  const processedItems = items.map(item => {
    const normSku = normalizeSku(item.sku);
    const costVal = item.unit_cost !== undefined && item.unit_cost !== null ? Number(item.unit_cost) : null;
    
    if (costVal === null) {
      missingCosts = true;
    }

    const costLabel = costVal !== null ? `$${costVal.toLocaleString()}` : "No especificado";
    previewList += `- **${normSku}**: +${item.quantity} unidades (Costo unitario: ${costLabel})\n`;

    return {
      sku: item.sku,
      sku_normalized: normSku,
      quantity: Math.max(1, Math.round(item.quantity)),
      unit_cost: costVal
    };
  });

  const supplierLabel = supplierName ? `\nProveedor: **${supplierName}**` : "";
  const extraCostsLabel = extraCosts && extraCosts > 0 ? `\nCostos Extra de Orden: **$${extraCosts.toLocaleString()}**` : "";

  // Crear la acción pendiente
  const { data: action, error } = await supabase.from("ai_actions").insert({
    tenant_id: tenantId,
    action_type: "register_purchase",
    title: "Registro de compra interna",
    payload: {
      items: processedItems,
      supplier_name: supplierName || null,
      extra_costs: extraCosts || 0,
      missing_costs: missingCosts
    },
    status: "pending"
  }).select("id").single();

  if (error) {
    console.error("Error preparing register_purchase action:", error.message);
    return { error: "No pude preparar la acción de compra en la base de datos." };
  }

  let promptMsg = `Voy a registrar esta compra en el depósito:${supplierLabel}${extraCostsLabel}\n\n**PREVISUALIZACIÓN DE COMPRA:**\n${previewList}`;
  
  if (missingCosts) {
    promptMsg += `\n⚠️ *Nota: No indicaste costo unitario para algunos componentes.*\n¿Confirmás registrar solo cantidades?\n`;
  } else {
    promptMsg += `\n¿Confirmás la carga de esta compra?\n`;
  }

  promptMsg += `\n**IMPORTANTE:** Para ejecutar esto, por favor responde únicamente con la palabra: **CONFIRMO**`;

  return {
    action_id: action.id,
    message: promptMsg,
    _session_state: {
      action_type: "register_purchase",
      missing_fields: [],
      context: {
        action_id: action.id,
        items: processedItems,
        supplier_name: supplierName || null,
        extra_costs: extraCosts || 0
      }
    }
  };
}
