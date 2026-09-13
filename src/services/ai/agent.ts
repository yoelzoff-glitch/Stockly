import { openai } from "@/lib/ai/openai";
import * as tools from "./tools";
import { consumeQuota } from "@/lib/billing/quotaService";
import { createAdminClient } from "@/lib/supabase/admin";
import { defaultProviderRouter } from "./providers/providerRouter";
import { AgentTool } from "./providers/types";
import { logger } from "@/lib/errors/logger";

/**
 * Orquestador principal del Agente de Inteligencia Artificial de LibretaX.
 * Desacoplado de un proveedor específico: utiliza ProviderRouter con Gemini Cascade
 * (gemini-3.7-flash -> gemini-3.6-flash -> gemini-3.5-flash-lite) y fallback opcional a OpenAI.
 * Gestiona reserva de cuotas (1 crédito por consulta de usuario), memoria conversacional,
 * y suite canónica de herramientas financieras y operativas basadas en datos reales.
 */
export async function runBusinessAgent({
  tenantId,
  userMessage,
  channel = "web",
  fromPhone,
  idempotencyKey,
  correlationId,
}: {
  tenantId: string;
  userMessage: string;
  channel?: string;
  fromPhone?: string;
  idempotencyKey?: string;
  correlationId?: string;
}) {
  const { getActiveSession, createSession, updateSessionState, clearSessionState } = await import('@/services/ai/session');
  
  let session = await getActiveSession({ tenantId, channel, fromPhone });
  if (!session) {
    session = await createSession({ tenantId, channel, fromPhone });
  }

  // Intercept Confirm/Cancel using explicit session
  const lowerMsg = userMessage.trim().toLowerCase();
  
  const validConfirms = ['confirmo', 'confirmar', 'sí, confirmo', 'si, confirmo', 'si confirmo'];
  const invalidConfirms = ['ok', 'dale', 'si', 'sí', 'bueno', 'perfecto', 'listo', 'avanza', 'hacelo'];

  if (validConfirms.includes(lowerMsg)) {
    if (session && session.current_workflow_id) {
      try {
        const { executeWorkflow } = await import('@/services/ai/workflows');
        const res = await executeWorkflow(tenantId, session.current_workflow_id);
        if (res.success) {
          await clearSessionState(session.id);
          return { response: "¡Plan de acción confirmado y ejecutado con éxito!", product_id: null };
        } else {
          return { response: "Hubo errores al ejecutar algunas acciones del plan. Revisa el dashboard.", product_id: null };
        }
      } catch (e) {
        return { response: "No pude confirmar el plan por un error interno.", product_id: null };
      }
    }

    if (session && session.current_action_id) {
      try {
        const { confirmPendingAction } = await import('@/services/ai/actions/confirm');
        const res = await confirmPendingAction(tenantId, session.current_action_id);
        if (res.success) {
          await clearSessionState(session.id);
          const hasErrors = res.results?.some((r: any) => !r.success);
          if (hasErrors) {
            const errors = (res.results || []).filter((r: any) => !r.success).map((r: any) => r.error).join(", ");
            return { response: `Intenté aplicar la acción, pero Mercado Libre respondió con un error: ${errors}`, product_id: null };
          }
          return { response: "¡Acción confirmada y ejecutada con éxito en Mercado Libre!", product_id: null };
        } else {
          return { response: `Hubo un error al ejecutar la acción: ${res.error || "Revisa los logs"}.`, product_id: null };
        }
      } catch (e) {
        return { response: "No pude confirmar la acción por un error interno.", product_id: null };
      }
    }

    return { response: "No tienes ninguna acción pendiente en esta conversación para confirmar.", product_id: null };
  }

  if (invalidConfirms.includes(lowerMsg)) {
    if (session && (session.current_action_id || session.current_workflow_id)) {
      return { response: "⚠️ *Por seguridad*, debes escribir exactamente la palabra **'confirmo'** o **'confirmar'** para ejecutar esta acción crítica.", product_id: null };
    }
  }

  if (lowerMsg === 'cancelar' || lowerMsg === 'no') {
    if (session && session.current_action_id) {
      try {
        const { cancelPendingAction } = await import('@/services/ai/actions/confirm');
        await cancelPendingAction(tenantId, session.current_action_id);
        await clearSessionState(session.id);
        return { response: "Acción cancelada. No se modificó nada en Mercado Libre.", product_id: null };
      } catch(e) {
        return { response: "Error al cancelar la acción.", product_id: null };
      }
    } else if (session && session.missing_fields && session.missing_fields.length > 0) {
      await clearSessionState(session.id);
      return { response: "Operación cancelada.", product_id: null };
    }
  }

  // Atomic quota reservation via consume_tenant_quota RPC (1 credit consumed per user prompt)
  const quotaReservation = await consumeQuota({
    tenantId,
    metric: "ai_credits_used",
    amount: 1,
    idempotencyKey,
    source: "ai_business_agent",
    correlationId,
  });

  if (!quotaReservation.allowed) {
    return {
      response: "Alcanzaste el límite mensual de consultas de Inteligencia Artificial. Por favor, actualiza tu plan en la sección de Facturación para seguir operando.",
      product_id: null,
      duplicate: false,
    };
  }

  if (quotaReservation.duplicate) {
    return {
      response: "Solicitud duplicada: la consulta ya fue procesada anteriormente.",
      product_id: null,
      duplicate: true,
    };
  }

  // Intercept if session is waiting for fields
  if (session && session.missing_fields && session.missing_fields.length > 0) {
    const extractionPrompt = `El usuario está en medio de una acción (${session.current_action_type}).
Faltan los siguientes campos: ${session.missing_fields.join(", ")}.
Extrae los valores de estos campos del mensaje del usuario: "${userMessage}".
Devuelve ÚNICAMENTE un objeto JSON plano con las claves correspondientes a los campos faltantes. Si el usuario no proporciona la información, devuelve un JSON vacío {}.`;
    
    try {
      const extractionResponse = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: extractionPrompt }]
      });

      const content = extractionResponse.choices[0]?.message?.content || "{}";
      const extracted = JSON.parse(content.replace(/```json/g, '').replace(/```/g, ''));

      const updatedContext = { ...session.context, ...extracted };
      const remainingFields = session.missing_fields.filter((f: string) => !extracted[f]);

      if (remainingFields.length > 0) {
        await updateSessionState(session.id, { missing_fields: remainingFields, context: updatedContext });
        return { response: `Aún necesito que me indiques: ${remainingFields.join(", ")}.`, product_id: null };
      } else {
        await updateSessionState(session.id, { missing_fields: [], context: updatedContext });
        userMessage = `El usuario completó los parámetros para la acción ${session.current_action_type}. Por favor ejecuta la herramienta correspondiente usando TODOS estos parámetros: ${JSON.stringify(updatedContext)}`;
      }
    } catch (e) {
      return { response: "No pude entender tu respuesta. Por favor indícame los valores para: " + session.missing_fields.join(", "), product_id: null };
    }
  }

  // Extraer el contexto de memoria conversacional
  const { getRecentConversationContext, extractConversationEntities } = await import('@/services/ai/conversationContext');
  const contextMsgs = await getRecentConversationContext({ tenantId, channel, fromPhone, limit: 10 });
  const entityContext = extractConversationEntities(contextMsgs);
  
  // Format recent chat
  const chatHistory = contextMsgs.map(m => `${m.direction === 'inbound' ? 'Usuario' : 'LibretaX'}: ${m.text}`).join("\n");

  const systemPrompt = `Eres LibretaX, el asistente de inteligencia artificial interno para la gestión del negocio del usuario.
Tu objetivo es responder de forma clara, directa y concisa a las preguntas del usuario sobre sus ventas, rentabilidad, productos y stock.
Usa EXCLUSIVAMENTE las herramientas proporcionadas para obtener datos reales del negocio.

**REGLAS CRÍTICAS DE VERACIDAD (OBLIGATORIAS):**
- Los números provienen exclusivamente de las herramientas de LibretaX.
- Nunca calcules montos financieros usando conocimiento propio ni inventes ventas, costos, margen o stock.
- Si una herramienta no devuelve el dato o devuelve 0, aclaralo tal cual.
- Si la cobertura de costos es incompleta (costCoveragePct < 100), indícalo explícitamente al hablar de ganancias (ej: "El cálculo tiene una cobertura del 78% de costos cargados, por lo que la ganancia puede estar sobreestimada").
- No presentes una estimación como un valor exacto.
- Formatea siempre los importes en pesos con el símbolo $ y separador de miles si aplica (ej: $184.320).
- Cuando el usuario pregunte por rentabilidad o ganancias (ej: "¿Cuánto gané hoy?"), DESGLOSA los valores en formato limpio:
  - Facturación bruta
  - Costo de productos
  - Comisiones de Mercado Libre
  - Envíos
  - Promociones y otros costos
  - Ganancia neta y Margen neto %
  - Cobertura de costos si aplica.
- Responde siempre en español, con un tono profesional, cercano y directo.

**MEMORIA CONVERSACIONAL Y PREGUNTAS EN CONTEXTO:**
Tenés acceso al contexto reciente de la conversación.
Si el usuario hace preguntas de seguimiento como:
- "¿Y ayer?" -> Evalúa la misma métrica (ventas o ganancia) para el día de ayer usando la herramienta analítica correspondiente con el rango de ayer.
- "¿Y ese producto?" o "¿Cuánto vendió?" -> Asume que habla de la entidad en memoria:
  [ENTIDAD ACTUAL EN MEMORIA]: ${entityContext.last_sku ? `SKU: ${entityContext.last_sku} (Título: ${entityContext.last_product_title}, ID: ${entityContext.last_product_id})` : 'Ninguna'}
- Si hay ambigüedad o la entidad actual es "Ninguna", pedí aclaración brevemente.

Chat reciente:
${chatHistory}
`;

  // Helper to capture session updates from tool results
  const captureSession = async (result: any) => {
    if (session && result && typeof result === "object") {
      try {
        if (result.action_id) {
          await updateSessionState(session.id, { current_action_id: result.action_id });
        }
        if (result.workflow_id) {
          await updateSessionState(session.id, { current_workflow_id: result.workflow_id });
        }
        if (result._session_state) {
          await updateSessionState(session.id, {
            current_action_type: result._session_state.action_type,
            missing_fields: result._session_state.missing_fields,
            context: result._session_state.context
          });
        }
      } catch (e) {
        logger.warn({ event: "AI_SESSION_UPDATE_WARNING", error: (e as any)?.message });
      }
    }
    return result;
  };

  const isWriteActionsEnabled = process.env.COPILOT_WRITE_ACTIONS_ENABLED === "true";
  const isCopilotChannel = channel === "copilot" || channel === "web";

  // Build canonical and legacy tools adhering to AgentTool interface
  const agentTools: AgentTool[] = [
    // 1. Canonical Analytics Tools
    {
      name: "getSalesSummary",
      description: "Obtiene la facturación, cantidad de órdenes, unidades vendidas y ticket promedio de un período (hoy, ayer, esta_semana, este_mes, mes_pasado, o rango de fechas ISO from/to). Excluye órdenes canceladas.",
      parameters: {
        type: "object",
        properties: {
          period: { type: "string", description: "Período predefinido: 'hoy', 'ayer', 'esta_semana', 'este_mes', 'mes_pasado'" },
          from: { type: "string", description: "Fecha inicio ISO (opcional si se usa period)" },
          to: { type: "string", description: "Fecha fin ISO (opcional si se usa period)" },
        },
      },
      execute: async (args) => captureSession(await tools.getSalesSummary(tenantId, args)),
    },
    {
      name: "getProfitSummary",
      description: "Obtiene el resumen financiero completo: facturación, costos de producto, comisiones ML, envíos, promociones, costos operativos, ganancia neta, margen neto % y porcentaje de cobertura de costos para un período ('hoy', 'ayer', 'esta_semana', 'este_mes', 'mes_pasado', o from/to).",
      parameters: {
        type: "object",
        properties: {
          period: { type: "string", description: "Período predefinido: 'hoy', 'ayer', 'esta_semana', 'este_mes', 'mes_pasado'" },
          from: { type: "string", description: "Fecha inicio ISO (opcional si se usa period)" },
          to: { type: "string", description: "Fecha fin ISO (opcional si se usa period)" },
        },
      },
      execute: async (args) => captureSession(await tools.getProfitSummary(tenantId, args)),
    },
    {
      name: "getTopProfitProducts",
      description: "Obtiene los productos que dejaron mayor GANANCIA NETA ABSOLUTA en dinero ($) en un período ('hoy', 'ayer', 'esta_semana', 'este_mes'). Úsalo cuando pregunten qué producto dejó más plata o ganancia.",
      parameters: {
        type: "object",
        properties: {
          period: { type: "string", description: "Período predefinido: 'hoy', 'ayer', 'esta_semana', 'este_mes'" },
          from: { type: "string", description: "Fecha inicio ISO" },
          to: { type: "string", description: "Fecha fin ISO" },
          limit: { type: "number", description: "Cantidad máxima de productos a devolver (por defecto 5)" },
        },
      },
      execute: async (args) => captureSession(await tools.getTopProfitProducts(tenantId, args)),
    },
    {
      name: "getTopMarginProducts",
      description: "Obtiene los productos con MEJOR MARGEN PORCENTUAL NETO (%) en un período. Úsalo cuando pregunten qué producto tuvo mejor margen o fue más rentable en porcentaje.",
      parameters: {
        type: "object",
        properties: {
          period: { type: "string", description: "Período predefinido: 'hoy', 'ayer', 'esta_semana', 'este_mes'" },
          from: { type: "string", description: "Fecha inicio ISO" },
          to: { type: "string", description: "Fecha fin ISO" },
          limit: { type: "number", description: "Cantidad máxima de productos a devolver (por defecto 5)" },
        },
      },
      execute: async (args) => captureSession(await tools.getTopMarginProducts(tenantId, args)),
    },
    {
      name: "getTopSellingProducts",
      description: "Obtiene los productos con mayor cantidad de unidades vendidas o mayor facturación en un período.",
      parameters: {
        type: "object",
        properties: {
          period: { type: "string", description: "Período predefinido: 'hoy', 'ayer', 'esta_semana', 'este_mes'" },
          from: { type: "string", description: "Fecha inicio ISO" },
          to: { type: "string", description: "Fecha fin ISO" },
          limit: { type: "number", description: "Cantidad máxima de productos (por defecto 5)" },
        },
      },
      execute: async (args) => captureSession(await tools.getTopSellingProducts(tenantId, args)),
    },
    {
      name: "compareSalesRanges",
      description: "Compara ventas entre dos períodos equivalentes (por ejemplo 'este_mes' vs 'mes_pasado' comparando días proporcionales para evitar sesgos, o 'esta_semana' vs semana anterior).",
      parameters: {
        type: "object",
        properties: {
          currentPeriod: { type: "string", description: "Período actual ('este_mes', 'esta_semana')" },
          previousPeriod: { type: "string", description: "Período anterior ('mes_pasado', etc.)" },
          currentFrom: { type: "string", description: "Fecha inicio actual ISO" },
          currentTo: { type: "string", description: "Fecha fin actual ISO" },
          previousFrom: { type: "string", description: "Fecha inicio anterior ISO" },
          previousTo: { type: "string", description: "Fecha fin anterior ISO" },
        },
      },
      execute: async (args) => captureSession(await tools.compareSalesRanges(tenantId, args)),
    },
    {
      name: "compareProfitRanges",
      description: "Compara ganancias netas y márgenes porcentuales entre dos períodos.",
      parameters: {
        type: "object",
        properties: {
          currentPeriod: { type: "string", description: "Período actual ('este_mes', 'esta_semana')" },
          previousPeriod: { type: "string", description: "Período anterior ('mes_pasado')" },
          currentFrom: { type: "string", description: "Fecha inicio actual ISO" },
          currentTo: { type: "string", description: "Fecha fin actual ISO" },
          previousFrom: { type: "string", description: "Fecha inicio anterior ISO" },
          previousTo: { type: "string", description: "Fecha fin anterior ISO" },
        },
      },
      execute: async (args) => captureSession(await tools.compareProfitRanges(tenantId, args)),
    },
    {
      name: "getStockSummary",
      description: "Devuelve el resumen de stock del inventario: total de productos, productos con bajo stock, productos sin stock, y lista de ítems críticos.",
      parameters: {
        type: "object",
        properties: {
          lowStockThreshold: { type: "number", description: "Umbral para considerar stock bajo (por defecto 5)" },
        },
      },
      execute: async (args) => captureSession(await tools.getStockSummary(tenantId, args)),
    },
    {
      name: "getProductPerformance",
      description: "Obtiene el rendimiento específico de un producto (unidades vendidas, facturación, ganancia, margen, stock actual) buscando por nombre o SKU.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Nombre o SKU del producto" },
          period: { type: "string", description: "Período predefinido ('este_mes', 'esta_semana', 'hoy')" },
        },
        required: ["query"],
      },
      execute: async (args) => captureSession(await tools.getProductPerformance(tenantId, args)),
    },

    // 2. Legacy / Auxiliary Query Tools
    {
      name: "getTodaySales",
      description: "Obtiene la suma total de dinero vendido hoy y la cantidad de órdenes de hoy.",
      parameters: { type: "object", properties: {} },
      execute: async () => captureSession(await tools.getTodaySales(tenantId)),
    },
    {
      name: "getSalesDetail",
      description: "Obtiene el detalle de qué productos específicos se vendieron en los últimos N días.",
      parameters: {
        type: "object",
        properties: {
          days: { type: "number", description: "Cantidad de días hacia atrás a analizar" },
        },
      },
      execute: async (args) => captureSession(await tools.getSalesDetail(tenantId, args.days)),
    },
    {
      name: "getWeeklySales",
      description: "Obtiene la suma total de dinero vendido en los últimos 7 días y la cantidad de órdenes.",
      parameters: { type: "object", properties: {} },
      execute: async () => captureSession(await tools.getWeeklySales(tenantId)),
    },
    {
      name: "getLowStockProducts",
      description: "Obtiene una lista de productos que tienen un stock bajo (5 unidades o menos).",
      parameters: { type: "object", properties: {} },
      execute: async () => captureSession(await tools.getLowStockProducts(tenantId)),
    },
    {
      name: "getSalesByDays",
      description: "Obtiene la suma total de dinero vendido y la cantidad de órdenes en los últimos N días.",
      parameters: {
        type: "object",
        properties: {
          days: { type: "number", description: "Cantidad de días hacia atrás a consultar" },
        },
        required: ["days"],
      },
      execute: async (args) => captureSession(await tools.getSalesByDays(tenantId, args.days)),
    },
    {
      name: "searchProductByName",
      description: "Busca un producto por nombre y devuelve su precio, stock disponible, estado y cantidad vendida.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "El nombre, SKU exacto o ID de Mercado Libre del producto a buscar." },
        },
        required: ["query"],
      },
      execute: async (args) => captureSession(await tools.searchProductByName(tenantId, args.query)),
    },
    {
      name: "getTopProducts",
      description: "Obtiene los productos más vendidos ordenados de mayor a menor cantidad vendida.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Cantidad máxima de productos a devolver" },
        },
      },
      execute: async (args) => captureSession(await tools.getTopProducts(tenantId, args.limit)),
    },
    {
      name: "compareSalesPeriods",
      description: "Compara las ventas totales de un periodo reciente vs un periodo anterior.",
      parameters: {
        type: "object",
        properties: {
          currentDays: { type: "number", description: "Días del periodo actual a evaluar" },
          previousDays: { type: "number", description: "Días del periodo anterior a evaluar" },
        },
        required: ["currentDays", "previousDays"],
      },
      execute: async (args) => captureSession(await tools.compareSalesPeriods(tenantId, args.currentDays, args.previousDays)),
    },
    {
      name: "getProductProfitability",
      description: "Obtiene la rentabilidad de un producto específico calculando la diferencia entre su precio de venta y su costo.",
      parameters: {
        type: "object",
        properties: {
          productName: { type: "string", description: "Nombre, SKU exacto o ID ML del producto" },
        },
        required: ["productName"],
      },
      execute: async (args) => captureSession(await tools.getProductProfitability(tenantId, args.productName)),
    },
    {
      name: "getFinancialSummary",
      description: "Calcula la facturación bruta, costos, comisiones, envíos, ganancia neta y margen en los últimos N días.",
      parameters: {
        type: "object",
        properties: {
          days: { type: "string", description: "Cantidad de días hacia atrás a analizar ('30' para mes, '7' para semana)" },
        },
      },
      execute: async (args) => captureSession(await tools.getFinancialSummary(tenantId, args.days)),
    },
    {
      name: "getDelayedShipments",
      description: "Consulta y devuelve una lista de los envíos demorados.",
      parameters: { type: "object", properties: {} },
      execute: async () => captureSession(await tools.getDelayedShipments(tenantId)),
    },
    {
      name: "getCancellationStats",
      description: "Devuelve estadísticas de ventas canceladas (total, pérdida de ingresos y desglose por motivo).",
      parameters: { type: "object", properties: {} },
      execute: async () => captureSession(await tools.getCancellationStats(tenantId)),
    },
    {
      name: "getTopCancelledProducts",
      description: "Devuelve una lista de los productos que tienen más cancelaciones de ventas.",
      parameters: { type: "object", properties: {} },
      execute: async () => captureSession(await tools.getTopCancelledProducts(tenantId)),
    },
    {
      name: "getGrowingProducts",
      description: "Devuelve los productos con mejor crecimiento o tracción reciente.",
      parameters: { type: "object", properties: {} },
      execute: async () => captureSession(await tools.getGrowingProducts(tenantId)),
    },
    {
      name: "getFallingProducts",
      description: "Devuelve los productos con caída en ventas o estancados.",
      parameters: { type: "object", properties: {} },
      execute: async () => captureSession(await tools.getFallingProducts(tenantId)),
    },
    {
      name: "getProductsToReview",
      description: "Devuelve productos con alertas críticas de bajo margen o falta de stock.",
      parameters: { type: "object", properties: {} },
      execute: async () => captureSession(await tools.getProductsToReview(tenantId)),
    },
    {
      name: "getComponentStock",
      description: "Obtiene el stock real de un componente en depósito a partir de su SKU.",
      parameters: {
        type: "object",
        properties: { sku: { type: "string", description: "SKU del componente" } },
        required: ["sku"],
      },
      execute: async (args) => {
        const { getComponentStock } = await import('./tools/queryTools');
        return captureSession(await getComponentStock(tenantId, args.sku));
      },
    },
    {
      name: "getComboStock",
      description: "Calcula cuántos combos se pueden fabricar en base al stock real del depósito.",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "SKU o nombre del combo" } },
        required: ["query"],
      },
      execute: async (args) => {
        const { getComboStock } = await import('./tools/queryTools');
        return captureSession(await getComboStock(tenantId, args.query));
      },
    },
    {
      name: "getProductsUsingComponent",
      description: "Muestra qué publicaciones de Mercado Libre están asociadas a un componente.",
      parameters: {
        type: "object",
        properties: { sku: { type: "string", description: "SKU del componente" } },
        required: ["sku"],
      },
      execute: async (args) => {
        const { getProductsUsingComponent } = await import('./tools/queryTools');
        return captureSession(await getProductsUsingComponent(tenantId, args.sku));
      },
    },
    {
      name: "getOutOfStockComponents",
      description: "Obtiene componentes faltantes o críticos en depósito y publicaciones afectadas.",
      parameters: { type: "object", properties: {} },
      execute: async () => {
        const { getOutOfStockComponents } = await import('./tools/queryTools');
        return captureSession(await getOutOfStockComponents(tenantId));
      },
    },
    {
      name: "getProductComponentsCostDetail",
      description: "Obtiene el detalle de costeo por componentes y costos extra de un producto.",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "SKU o nombre de la publicación" } },
        required: ["query"],
      },
      execute: async (args) => {
        const { getProductComponentsCostDetail } = await import('./tools/queryTools');
        return captureSession(await getProductComponentsCostDetail(tenantId, args.query));
      },
    },
    {
      name: "getStockInconsistencies",
      description: "Muestra publicaciones con más stock en Mercado Libre que el disponible en depósito.",
      parameters: { type: "object", properties: {} },
      execute: async () => {
        const { getStockInconsistencies } = await import('./tools/queryTools');
        return captureSession(await getStockInconsistencies(tenantId));
      },
    },
  ];

  // 3. Action Tools (Only enabled if COPILOT_WRITE_ACTIONS_ENABLED=true or not in copilot web mode)
  if (!isCopilotChannel || isWriteActionsEnabled) {
    agentTools.push(
      {
        name: "preparePriceUpdate",
        description: "Prepara una actualización de precio para uno o más productos. Solo pre-calcula los cambios.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "Búsqueda del producto" },
            newPrice: { type: "number", description: "Nuevo precio exacto" },
            percentageChange: { type: "number", description: "Porcentaje a variar" },
            allowMultiple: { type: "boolean", description: "true para aplicar a múltiples" },
          },
          required: ["query"],
        },
        execute: async (args) => captureSession(await tools.preparePriceUpdate(tenantId, args.query, args.newPrice, args.percentageChange, args.allowMultiple)),
      },
      {
        name: "prepareInternalStockUpdate",
        description: "Prepara un cambio de stock interno (depósito físico).",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "Búsqueda del producto interno" },
            newQuantity: { type: "number", description: "Cantidad de stock" },
            operation: { type: "string", enum: ["set", "add", "subtract"], description: "Operación" },
            allowMultiple: { type: "boolean", description: "true para múltiples" },
          },
          required: ["query", "newQuantity"],
        },
        execute: async (args) => captureSession(await tools.prepareInternalStockUpdate(tenantId, args.query, args.newQuantity, args.operation, args.allowMultiple)),
      },
      {
        name: "prepareMeliStockUpdate",
        description: "Prepara un cambio de stock en la publicación de Mercado Libre.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "Búsqueda del producto en ML" },
            newQuantity: { type: "number", description: "Cantidad de stock" },
            operation: { type: "string", enum: ["set", "add", "subtract"], description: "Operación" },
            allowMultiple: { type: "boolean", description: "true para múltiples" },
          },
          required: ["query", "newQuantity"],
        },
        execute: async (args) => captureSession(await tools.prepareMeliStockUpdate(tenantId, args.query, args.newQuantity, args.operation, args.allowMultiple)),
      },
      {
        name: "prepareStatusChange",
        description: "Prepara pausar o reactivar uno o más productos.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "Búsqueda del producto" },
            status: { type: "string", enum: ["paused", "active"], description: "Nuevo estado" },
            allowMultiple: { type: "boolean", description: "true para múltiples" },
          },
          required: ["query", "status"],
        },
        execute: async (args) => captureSession(await tools.prepareStatusChange(tenantId, args.query, args.status, args.allowMultiple)),
      },
      {
        name: "prepareCreatePromotion",
        description: "Prepara una oferta o descuento para un producto.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "Nombre o SKU del producto" },
            type: { type: "string", description: "Tipo de promo" },
            discountPercent: { type: "number", description: "Porcentaje de descuento" },
            discountAmount: { type: "number", description: "Monto de descuento" },
            duration: { type: "string", description: "Duración" },
          },
          required: ["query", "type"],
        },
        execute: async (args) => {
          const promos = await import('@/services/ai/tools/promotions');
          return captureSession(await promos.prepareCreatePromotion(tenantId, args.query, args.type, args.discountPercent, args.discountAmount, args.duration));
        },
      },
      {
        name: "prepareCreateCoupon",
        description: "Prepara la creación de un cupón de descuento.",
        parameters: {
          type: "object",
          properties: {
            discountType: { type: "string", description: "'percent' o 'amount'" },
            discountValue: { type: "number", description: "Valor de descuento" },
            targetAudience: { type: "string", description: "Audiencia" },
            maxUses: { type: "number", description: "Uso máximo" },
            minPurchaseAmount: { type: "number", description: "Compra mínima" },
            duration: { type: "string", description: "Vigencia" },
          },
          required: ["discountType", "discountValue"],
        },
        execute: async (args) => {
          const promos = await import('@/services/ai/tools/promotions');
          return captureSession(await promos.prepareCreateCoupon(tenantId, args.discountType, args.discountValue, args.targetAudience, args.maxUses, args.minPurchaseAmount, args.duration));
        },
      },
      {
        name: "prepareRegisterPurchase",
        description: "Prepara el registro de una compra interna en el depósito físico.",
        parameters: {
          type: "object",
          properties: {
            items: {
              type: "array",
              description: "Lista de productos o componentes comprados",
              items: {
                type: "object",
                properties: {
                  sku: { type: "string", description: "SKU" },
                  quantity: { type: "number", description: "Cantidad" },
                  unit_cost: { type: "number", description: "Costo unitario" },
                },
                required: ["sku", "quantity"],
              },
            },
            supplier_name: { type: "string", description: "Nombre del proveedor" },
            extra_costs: { type: "number", description: "Costos adicionales" },
          },
          required: ["items"],
        },
        execute: async (args) => {
          const { prepareRegisterPurchase } = await import('./tools/purchaseTools');
          return captureSession(await prepareRegisterPurchase(tenantId, args.items, args.supplier_name, args.extra_costs));
        },
      }
    );
  }

  try {
    const aiResult = await defaultProviderRouter.run({
      systemPrompt,
      userMessage,
      tools: agentTools,
      tenantId,
      correlationId,
    });

    return {
      response: aiResult.response || "No pude completar la consulta en este momento.",
      product_id: aiResult.product_id,
      duplicate: false,
      metadata: aiResult.metadata,
    };
  } catch (err: any) {
    logger.error({
      event: "AI_BUSINESS_AGENT_ROUTER_ERROR",
      tenantId,
      correlationId,
      error: err?.message,
    });

    throw err;
  }
}
