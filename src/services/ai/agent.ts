import { openai } from "@/lib/ai/openai";
import * as tools from "./tools";

import { checkAILimit, incrementAIUsage } from "../billing/checkLimits";
import { createAdminClient } from "@/lib/supabase/admin";

export async function runBusinessAgent({
  tenantId,
  userMessage,
}: {
  tenantId: string;
  userMessage: string;
}) {
  const isAllowed = await checkAILimit(tenantId);
  if (!isAllowed) {
    return "Alcanzaste el límite mensual de consultas de Inteligencia Artificial. Por favor, actualiza tu plan en la sección de Facturación para seguir operando.";
  }

  // SPRINT 11 & 12: Intercept Confirm/Cancel with strict rules
  const lowerMsg = userMessage.trim().toLowerCase();
  
  const validConfirms = ['confirmo', 'confirmar', 'sí, confirmo', 'si, confirmo', 'si confirmo'];
  const invalidConfirms = ['ok', 'dale', 'si', 'sí', 'bueno', 'perfecto', 'listo', 'avanza', 'hacelo'];

  if (validConfirms.includes(lowerMsg)) {
    const supabase = createAdminClient();

    // 1. Check for pending workflow
    const { data: pendingWorkflow } = await supabase
      .from("action_workflows")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (pendingWorkflow) {
      try {
        const { executeWorkflow } = await import('@/services/ai/workflows');
        const res = await executeWorkflow(tenantId, pendingWorkflow.id);
        if (res.success) {
          return "¡Plan de acción confirmado y ejecutado con éxito!";
        } else {
          return "Hubo errores al ejecutar algunas acciones del plan. Revisa el dashboard.";
        }
      } catch (e) {
        return "No pude confirmar el plan por un error interno.";
      }
    }

    // 2. Fallback to single pending action
    const { data: pendingAction } = await supabase
      .from("ai_actions")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (pendingAction) {
      try {
        const { confirmPendingAction } = await import('@/services/ai/actions/confirm');
        const res = await confirmPendingAction(tenantId, pendingAction.id);
        if (res.success) {
          return "¡Acción confirmada y ejecutada con éxito en Mercado Libre!";
        } else {
          return `Hubo un error al ejecutar la acción: ${res.error || "Revisa los logs"}.`;
        }
      } catch (e) {
        return "No pude confirmar la acción por un error interno.";
      }
    }
  }

  if (invalidConfirms.includes(lowerMsg)) {
    const supabase = createAdminClient();
    const { data: pendingAction } = await supabase
      .from("ai_actions")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (pendingAction) {
      return "⚠️ *Por seguridad*, debes escribir exactamente la palabra **'confirmo'** o **'confirmar'** para ejecutar esta acción crítica.";
    }
  }

  if (lowerMsg === 'cancelar' || lowerMsg === 'no') {
    const supabase = createAdminClient();
    const { data: pendingAction } = await supabase
      .from("ai_actions")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (pendingAction) {
      try {
        const { cancelPendingAction } = await import('@/services/ai/actions/confirm');
        await cancelPendingAction(tenantId, pendingAction.id);
        return "Acción cancelada. No se modificó nada en Mercado Libre.";
      } catch(e) {
        return "Error al cancelar la acción.";
      }
    }
  }

  const systemPrompt = `Eres Stockly, el asistente de inteligencia artificial interno para la gestión del negocio del usuario.
Tu objetivo es responder de forma clara, directa y concisa a las preguntas del usuario sobre sus ventas, productos y stock.
Usa las herramientas proporcionadas para obtener datos reales de la base de datos.
- Responde siempre en español.
- Nunca inventes datos (alucines). Si una herramienta no devuelve resultados, dile al usuario que no tienes esa información.
- Si vas a hablar de márgenes de ganancia o rentabilidad, advierte al usuario si nota que hay productos que no tienen configurado el costo ("Todavía no tengo costos cargados para calcular margen real"). Nunca inventes o estimes costos automáticamente salvo que el usuario lo cargue expresamente.
- Formatea los valores monetarios con el símbolo $.
- No uses lenguaje excesivamente formal, mantén un tono profesional pero cercano.
- Importante: Tienes herramientas para preparar modificaciones masivas de precio, stock y estado de los productos en Mercado Libre. Puedes buscar productos por Nombre, SKU exacto o ID de Mercado Libre.
- Si una herramienta te responde diciendo "Encontré varios productos parecidos. ¿Cuál querés modificar?", MUESTRA al usuario la lista de productos que te devolvió la herramienta y pregúntale cuál de los SKUs o nombres específicos desea elegir antes de continuar.
- Cuando prepares una acción con éxito, se creará una acción pendiente y deberás terminar tu mensaje pidiendo expresamente al usuario que responda con la palabra 'CONFIRMO' para ejecutar los cambios.`;

  const runner = openai.chat.completions.runTools({
    model: process.env.AI_MODEL || "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    tools: [
      {
        type: "function",
        function: {
          function: async () => tools.getTodaySales(tenantId),
          name: "getTodaySales",
          description: "Obtiene la suma total de dinero vendido en el día de hoy y la cantidad de órdenes de hoy.",
          parse: JSON.parse,
          parameters: { type: "object", properties: {} },
        },
      },
      {
        type: "function",
        function: {
          function: async () => tools.getWeeklySales(tenantId),
          name: "getWeeklySales",
          description: "Obtiene la suma total de dinero vendido en los últimos 7 días y la cantidad de órdenes.",
          parse: JSON.parse,
          parameters: { type: "object", properties: {} },
        },
      },
      {
        type: "function",
        function: {
          function: async () => tools.getLowStockProducts(tenantId),
          name: "getLowStockProducts",
          description: "Obtiene una lista de productos que tienen un stock bajo (5 unidades o menos).",
          parse: JSON.parse,
          parameters: { type: "object", properties: {} },
        },
      },
      {
        type: "function",
        function: {
          function: async (args: { days: number }) => tools.getSalesByDays(tenantId, args.days),
          name: "getSalesByDays",
          description: "Obtiene la suma total de dinero vendido y la cantidad de órdenes en los últimos N días (por ejemplo, para el último año, days=365).",
          parse: JSON.parse,
          parameters: {
            type: "object",
            properties: {
              days: { type: "number", description: "Cantidad de días hacia atrás a consultar (ej: 365 para un año, 30 para un mes)." },
            },
            required: ["days"],
          },
        },
      },
      {
        type: "function",
        function: {
          function: async (args: { query: string }) => tools.searchProductByName(tenantId, args.query),
          name: "searchProductByName",
          description: "Busca un producto por nombre y devuelve su precio, stock disponible, estado y cantidad vendida.",
          parse: JSON.parse,
          parameters: {
            type: "object",
            properties: {
              query: { type: "string", description: "El nombre, SKU exacto o ID de Mercado Libre del producto a buscar." },
            },
            required: ["query"],
          },
        },
      },
      {
        type: "function",
        function: {
          function: async (args: { limit?: number }) => tools.getTopProducts(tenantId, args.limit),
          name: "getTopProducts",
          description: "Obtiene los productos más vendidos ordenados de mayor a menor cantidad vendida.",
          parse: JSON.parse,
          parameters: {
            type: "object",
            properties: {
              limit: { type: "number", description: "Cantidad máxima de productos a devolver (por defecto 5)." },
            },
          },
        },
      },
      {
        type: "function",
        function: {
          function: async (args: { currentDays: number; previousDays: number }) => 
            tools.compareSalesPeriods(tenantId, args.currentDays, args.previousDays),
          name: "compareSalesPeriods",
          description: "Compara las ventas totales de un periodo reciente vs un periodo anterior.",
          parse: JSON.parse,
          parameters: {
            type: "object",
            properties: {
              currentDays: { type: "number", description: "Días del periodo actual a evaluar (ej: 7 para esta semana)." },
              previousDays: { type: "number", description: "Días del periodo anterior a evaluar (ej: 7 para la semana pasada)." },
            },
            required: ["currentDays", "previousDays"],
          },
        },
      },
      {
        type: "function",
        function: {
          function: async (args: { productName: string }) => tools.getProductProfitability(tenantId, args.productName),
          name: "getProductProfitability",
          description: "Obtiene la rentabilidad (margen) de un producto específico, calculando la diferencia entre su precio de venta y su costo base.",
          parse: JSON.parse,
          parameters: {
            type: "object",
            properties: {
              productName: { type: "string", description: "El nombre, SKU exacto o ID de Mercado Libre del producto a evaluar." },
            },
            required: ["productName"],
          },
        },
      },
      {
        type: "function",
        function: {
          function: async (args: { query: string; newPrice?: number; percentageChange?: number }) => tools.preparePriceUpdate(tenantId, args.query, args.newPrice, args.percentageChange),
          name: "preparePriceUpdate",
          description: "Prepara una actualización de precio para uno o más productos. Puede ser un precio exacto o un cambio porcentual. Solo pre-calcula los cambios.",
          parse: JSON.parse,
          parameters: {
            type: "object",
            properties: {
              query: { type: "string", description: "Búsqueda del producto (puede ser SKU exacto, ID de Mercado Libre o Nombre parcial)" },
              newPrice: { type: "number", description: "Nuevo precio exacto" },
              percentageChange: { type: "number", description: "Porcentaje a aumentar/disminuir (ej: 10 para aumentar 10%)" }
            },
            required: ["query"],
          },
        },
      },
      {
        type: "function",
        function: {
          function: async (args: { query: string; newQuantity: number; operation?: 'set' | 'add' | 'subtract' }) => tools.prepareStockUpdate(tenantId, args.query, args.newQuantity, args.operation),
          name: "prepareStockUpdate",
          description: "Prepara un cambio de stock para uno o más productos. Puede establecer un valor, sumar o restar.",
          parse: JSON.parse,
          parameters: {
            type: "object",
            properties: {
              query: { type: "string", description: "Búsqueda del producto (puede ser SKU exacto, ID de Mercado Libre o Nombre parcial)" },
              newQuantity: { type: "number", description: "Cantidad de stock" },
              operation: { type: "string", enum: ["set", "add", "subtract"], description: "Operación a realizar" }
            },
            required: ["query", "newQuantity"],
          },
        },
      },
      {
        type: "function",
        function: {
          function: async (args: { query: string; status: 'paused' | 'active' }) => tools.prepareStatusChange(tenantId, args.query, args.status),
          name: "prepareStatusChange",
          description: "Prepara pausar o reactivar uno o más productos.",
          parse: JSON.parse,
          parameters: {
            type: "object",
            properties: {
              query: { type: "string", description: "Búsqueda del producto (puede ser SKU exacto, ID de Mercado Libre o Nombre parcial)" },
              status: { type: "string", enum: ["paused", "active"], description: "Nuevo estado" }
            },
            required: ["query", "status"],
          },
        },
      },
      {
        type: "function",
        function: {
          function: async () => {
            const { prepareAutonomousWorkflow } = await import('@/services/ai/tools_workflow');
            return prepareAutonomousWorkflow(tenantId);
          },
          name: "prepareAutonomousWorkflow",
          description: "Analiza el negocio automáticamente (busca problemas de stock, márgenes bajos y nulas ventas) y prepara un plan de acción sugerido. Úsalo cuando el usuario pide analizar el negocio o 'arreglar lo urgente'.",
          parse: JSON.parse,
          parameters: { type: "object", properties: {} },
        },
      },
    ],
  });

  const finalContent = await runner.finalContent();
  
  if (finalContent) {
    await incrementAIUsage(tenantId);
  }

  return finalContent || "Lo siento, hubo un problema procesando tu consulta.";
}
