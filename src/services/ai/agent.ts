import { openai } from "@/lib/ai/openai";
import * as tools from "./tools";

import { checkAILimit, incrementAIUsage } from "../billing/checkLimits";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Orquestador principal del Agente de Inteligencia Artificial de Stockly.
 * Esta función procesa las consultas de lenguaje natural del usuario, gestiona el
 * control de consumo mensual (billing), intercepta y ejecuta comandos de confirmación
 * o cancelación segura de acciones críticas en Mercado Libre, carga el contexto de memoria
 * conversacional reciente, y despacha la petición a OpenAI GPT-4o-Mini con una suite
 * integrada de herramientas de negocio.
 * 
 * @param params Objeto de parámetros
 * @param params.tenantId Identificador único del comercio (tenant)
 * @param params.userMessage Mensaje en texto plano ingresado por el usuario
 * @param params.channel Canal de comunicación de origen ('web' | 'whatsapp')
 * @param params.fromPhone Número telefónico de origen (requerido para WhatsApp)
 * @returns Promesa que resuelve un objeto con la respuesta textual de la IA y el id de producto enfocado (opcional)
 */
export async function runBusinessAgent({
  tenantId,
  userMessage,
  channel = "web",
  fromPhone,
}: {
  tenantId: string;
  userMessage: string;
  channel?: string;
  fromPhone?: string;
}) {
  const isAllowed = await checkAILimit(tenantId);
  if (!isAllowed) {
    return { response: "Alcanzaste el límite mensual de consultas de Inteligencia Artificial. Por favor, actualiza tu plan en la sección de Facturación para seguir operando.", product_id: null };
  }

  const { getActiveSession, createSession, updateSessionState, clearSessionState } = await import('@/services/ai/session');
  
  let session = await getActiveSession({ tenantId, channel, fromPhone });
  if (!session) {
    session = await createSession({ tenantId, channel, fromPhone });
  }

  // SPRINT 32: Intercept Confirm/Cancel using explicit session
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

  // Intercept if session is waiting for fields
  if (session && session.missing_fields && session.missing_fields.length > 0) {
    const extractionPrompt = `El usuario está en medio de una acción (${session.current_action_type}).
Faltan los siguientes campos: ${session.missing_fields.join(", ")}.
Extrae los valores de estos campos del mensaje del usuario: "${userMessage}".
Devuelve ÚNICAMENTE un objeto JSON plano con las claves correspondientes a los campos faltantes. Si el usuario no proporciona la información, devuelve un JSON vacío {}.`;
    
    const extractionResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: extractionPrompt }]
    });

    try {
      const content = extractionResponse.choices[0].message.content || "{}";
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
  const chatHistory = contextMsgs.map(m => `${m.direction === 'inbound' ? 'Usuario' : 'Stockly'}: ${m.text}`).join("\n");

  const systemPrompt = `Eres Stockly, el asistente de inteligencia artificial interno para la gestión del negocio del usuario.
Tu objetivo es responder de forma clara, directa y concisa a las preguntas del usuario sobre sus ventas, productos y stock.
Usa las herramientas proporcionadas para obtener datos reales de la base de datos.
- Responde siempre en español.
- Nunca inventes datos (alucines). Si una herramienta no devuelve resultados, dile al usuario que no tienes esa información.
- Si vas a hablar de márgenes de ganancia o rentabilidad, advierte al usuario si nota que hay productos que no tienen configurado el costo ("Todavía no tengo costos cargados para calcular margen real"). 
- Cuando el usuario pregunte por rentabilidad, margen o ganancias, DESGLOSA los valores (Precio de venta, Costo cargado, Comisión ML, Envío, Ganancia Neta, Margen Neto). Si falta la fee o el envío, aclara que es una estimación incompleta.
- Formatea los valores monetarios con el símbolo $.
- No uses lenguaje excesivamente formal, mantén un tono profesional pero cercano.
- Importante: Tienes herramientas para preparar modificaciones masivas de precio, stock y estado de los productos en Mercado Libre, así como la creación de OFERTAS, PROMOCIONES y CUPONES. Puedes buscar productos por Nombre, SKU exacto o ID de Mercado Libre.
- Si una herramienta te responde diciendo "Encontré varios productos parecidos. ¿Cuál querés modificar?", MUESTRA al usuario la lista de productos que te devolvió la herramienta y pregúntale cuál de los SKUs o nombres específicos desea elegir antes de continuar.
- Cuando prepares una acción con éxito, se creará una acción pendiente y deberás terminar tu mensaje pidiendo expresamente al usuario que responda con la palabra 'CONFIRMO' para ejecutar los cambios.

**GESTIÓN DE STOCK (SPRINT 35 - MUY IMPORTANTE):**
- Existen DOS tipos de stock: Stock Interno (depósito/local) y Stock de Mercado Libre (publicaciones).
- Si el usuario dice "aumentá stock", "poné stock a 15", "sumá stock", "dejá el stock en X" SIN especificar el alcance, ES OBLIGATORIO PREGUNTAR: "¿Querés actualizar el stock interno del depósito o el stock publicado en Mercado Libre?". NO EJECUTES NINGUNA HERRAMIENTA.
- Frases para stock interno: "stock interno", "depósito", "local", "inventario real", "stock real". Usa la herramienta \`prepareInternalStockUpdate\`.
- Frases para stock ML: "stock de Mercado Libre", "stock publicado", "publicación", "disponible en ML". Usa la herramienta \`prepareMeliStockUpdate\`.
- Nunca asumas el tipo de stock si el usuario no lo especifica.
- Puedes consultar discrepancias de stock con la herramienta \`getStockInconsistencies\`.
- Puedes registrar compras internas con \`prepareRegisterPurchase\`.
- Tienes herramientas para consultar stock (\`getComponentStock\`, \`getComboStock\`, \`getProductsUsingComponent\`, \`getOutOfStockComponents\`).

**MEMORIA CONVERSACIONAL**
Tenés acceso al contexto reciente de la conversación y al último producto del que estaban hablando.
Úsalo para resolver referencias implícitas como:
- "este producto", "ese", "el anterior"
- "aumentalo 10%", "bajalo", "pausalo", "reactivalo", "sumale stock"
- "cuánto margen deja?", "y el stock?"
Si el usuario da una orden o pregunta sin especificar el producto, asume que habla de la entidad en memoria y usa su SKU como parámetro 'query' en las herramientas:
[ENTIDAD ACTUAL EN MEMORIA]: ${entityContext.last_sku ? `SKU: ${entityContext.last_sku} (Título: ${entityContext.last_product_title}, ID: ${entityContext.last_product_id})` : 'Ninguna'}

No inventes contexto. Si hay ambigüedad o la entidad actual es "Ninguna", pedí aclaración diciendo: "No estoy seguro de qué producto querés modificar o consultar. ¿Me indicás SKU o nombre?"

Chat reciente:
${chatHistory}
`;

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
          function: async (args: { days: number }) => tools.getNoMovementProducts(tenantId, { days: args.days }),
          name: "getNoMovementProducts",
          description: "Obtiene una lista de productos que no han tenido ventas en los últimos X días. Incluye recomendaciones como pausar o crear promoción.",
          parse: JSON.parse,
          parameters: { 
            type: "object", 
            properties: {
              days: { type: "number", description: "Cantidad de días hacia atrás para buscar (ej. 30, 60, 90)" }
            },
            required: ["days"]
          },
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
          function: async (args: { query: string; newPrice?: number; percentageChange?: number; allowMultiple?: boolean }) => tools.preparePriceUpdate(tenantId, args.query, args.newPrice, args.percentageChange, args.allowMultiple),
          name: "preparePriceUpdate",
          description: "Prepara una actualización de precio para uno o más productos. Puede ser un precio exacto o un cambio porcentual. Solo pre-calcula los cambios.",
          parse: JSON.parse,
          parameters: {
            type: "object",
            properties: {
              query: { type: "string", description: "Búsqueda del producto (puede ser componente de SKU exacto, SKU exacto, ID de Mercado Libre o Nombre parcial)" },
              newPrice: { type: "number", description: "Nuevo precio exacto" },
              percentageChange: { type: "number", description: "Porcentaje a aumentar/disminuir (ej: 10 para aumentar 10%)" },
              allowMultiple: { type: "boolean", description: "Debe ser true si el usuario pide explícitamente aplicar el cambio a TODOS los productos que coincidan (ej: todos los combos que tengan C 144)." }
            },
            required: ["query"],
          },
        },
      },
      {
        type: "function",
        function: {
          function: async (args: { query: string; newQuantity: number; operation?: 'set' | 'add' | 'subtract'; allowMultiple?: boolean }) => tools.prepareInternalStockUpdate(tenantId, args.query, args.newQuantity, args.operation, args.allowMultiple),
          name: "prepareInternalStockUpdate",
          description: "Prepara un cambio de stock INTERNO (físico/depósito) para uno o más componentes. No toca Mercado Libre.",
          parse: JSON.parse,
          parameters: {
            type: "object",
            properties: {
              query: { type: "string", description: "Búsqueda del producto interno (SKU exacto, nombre)" },
              newQuantity: { type: "number", description: "Cantidad de stock" },
              operation: { type: "string", enum: ["set", "add", "subtract"], description: "Operación a realizar" },
              allowMultiple: { type: "boolean", description: "Debe ser true si el usuario pide aplicar el cambio a TODOS los que coincidan." }
            },
            required: ["query", "newQuantity"],
          },
        },
      },
      {
        type: "function",
        function: {
          function: async (args: { query: string; newQuantity: number; operation?: 'set' | 'add' | 'subtract'; allowMultiple?: boolean }) => tools.prepareMeliStockUpdate(tenantId, args.query, args.newQuantity, args.operation, args.allowMultiple),
          name: "prepareMeliStockUpdate",
          description: "Prepara un cambio de stock EN MERCADO LIBRE (publicación) para uno o más productos. No toca stock interno.",
          parse: JSON.parse,
          parameters: {
            type: "object",
            properties: {
              query: { type: "string", description: "Búsqueda del producto en ML (SKU, ID ML o Nombre parcial)" },
              newQuantity: { type: "number", description: "Cantidad de stock" },
              operation: { type: "string", enum: ["set", "add", "subtract"], description: "Operación a realizar" },
              allowMultiple: { type: "boolean", description: "Debe ser true si el usuario pide aplicar el cambio a TODOS los que coincidan." }
            },
            required: ["query", "newQuantity"],
          },
        },
      },
      {
        type: "function",
        function: {
          function: async (args: { query: string; status: 'paused' | 'active'; allowMultiple?: boolean }) => tools.prepareStatusChange(tenantId, args.query, args.status, args.allowMultiple),
          name: "prepareStatusChange",
          description: "Prepara pausar o reactivar uno o más productos.",
          parse: JSON.parse,
          parameters: {
            type: "object",
            properties: {
              query: { type: "string", description: "Búsqueda del producto (puede ser componente de SKU exacto, SKU exacto, ID de Mercado Libre o Nombre parcial)" },
              status: { type: "string", enum: ["paused", "active"], description: "Nuevo estado" },
              allowMultiple: { type: "boolean", description: "Debe ser true si el usuario pide explícitamente aplicar el cambio a TODOS los productos que coincidan." }
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
      {
        type: "function",
        function: {
          function: async () => tools.getDelayedShipments(tenantId),
          name: "getDelayedShipments",
          description: "Consulta y devuelve una lista de los envíos que actualmente se encuentran demorados.",
          parse: JSON.parse,
          parameters: { type: "object", properties: {} },
        },
      },
      {
        type: "function",
        function: {
          function: async () => tools.getCancellationStats(tenantId),
          name: "getCancellationStats",
          description: "Devuelve estadísticas de ventas canceladas (total, pérdida de ingresos y desglose por motivo).",
          parse: JSON.parse,
          parameters: { type: "object", properties: {} },
        },
      },
      {
        type: "function",
        function: {
          function: async () => tools.getTopCancelledProducts(tenantId),
          name: "getTopCancelledProducts",
          description: "Devuelve una lista de los productos que tienen más cancelaciones de ventas.",
          parse: JSON.parse,
          parameters: { type: "object", properties: {} },
        },
      },
      {
        type: "function",
        function: {
          function: async () => tools.getGrowingProducts(tenantId),
          name: "getGrowingProducts",
          description: "Devuelve los productos con mejor tracción o crecimiento de ventas recientes. Úsalo cuando te pregunten qué productos están creciendo o vendiendo más.",
          parse: JSON.parse,
          parameters: { type: "object", properties: {} },
        },
      },
      {
        type: "function",
        function: {
          function: async () => tools.getFallingProducts(tenantId),
          name: "getFallingProducts",
          description: "Devuelve los productos que están cayendo en ventas o no tienen ventas (productos estancados).",
          parse: JSON.parse,
          parameters: { type: "object", properties: {} },
        },
      },
      {
        type: "function",
        function: {
          function: async () => tools.getProductsToReview(tenantId),
          name: "getProductsToReview",
          description: "Devuelve productos con alertas críticas: bajos márgenes o falta de stock. Úsalo cuando el usuario pregunte qué debe revisar o qué le preocupa a la IA.",
          parse: JSON.parse,
          parameters: { type: "object", properties: {} },
        },
      },
      {
        type: "function",
        function: {
          function: async (args: { days?: string }) => tools.getFinancialSummary(tenantId, args.days),
          name: "getFinancialSummary",
          description: "Calcula la facturación bruta, costos, comisiones, envíos, ganancia neta real y margen del negocio en un periodo de tiempo. Úsalo cuando pregunten por rentabilidad, ganancias, margen real, o gastos.",
          parse: JSON.parse,
          parameters: {
            type: "object",
            properties: {
              days: { type: "string", description: "Cantidad de días hacia atrás a analizar. Ejemplo: '30' para último mes, '7' para última semana." }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          function: async (args: { query: string; type: string; discountPercent?: number; discountAmount?: number; duration?: string }) => {
            const promos = await import('@/services/ai/tools/promotions');
            return promos.prepareCreatePromotion(tenantId, args.query, args.type, args.discountPercent, args.discountAmount, args.duration);
          },
          name: "prepareCreatePromotion",
          description: "Prepara una oferta o descuento para un producto. Úsalo cuando el usuario pide poner en oferta, crear promo o descuento.",
          parse: JSON.parse,
          parameters: {
            type: "object",
            properties: {
              query: { type: "string", description: "El nombre o SKU del producto" },
              type: { type: "string", description: "El tipo de promoción (oferta, relampago, descuento)" },
              discountPercent: { type: "number", description: "El porcentaje de descuento si aplica" },
              discountAmount: { type: "number", description: "El monto de descuento fijo si aplica" },
              duration: { type: "string", description: "La duración (ej: 48 horas)" }
            },
            required: ["query", "type"]
          }
        }
      },
      {
        type: "function",
        function: {
          function: async (args: { discountType: string; discountValue: number; targetAudience?: string; maxUses?: number; minPurchaseAmount?: number; duration?: string }) => {
            const promos = await import('@/services/ai/tools/promotions');
            return promos.prepareCreateCoupon(tenantId, args.discountType, args.discountValue, args.targetAudience, args.maxUses, args.minPurchaseAmount, args.duration);
          },
          name: "prepareCreateCoupon",
          description: "Prepara la creación de un cupón de descuento.",
          parse: JSON.parse,
          parameters: {
            type: "object",
            properties: {
              discountType: { type: "string", description: "'percent' o 'amount'" },
              discountValue: { type: "number", description: "El valor del descuento" },
              targetAudience: { type: "string", description: "Audiencia (ej: seguidores, nuevos)" },
              maxUses: { type: "number", description: "Uso máximo del cupón" },
              minPurchaseAmount: { type: "number", description: "Compra mínima requerida" },
              duration: { type: "string", description: "Vigencia del cupón" }
            },
            required: ["discountType", "discountValue"]
          }
        }
      },
      {
        type: "function",
        function: {
          function: async (args: { items: any[]; supplier_name?: string; extra_costs?: number }) => {
            const { prepareRegisterPurchase } = await import('./tools/purchaseTools');
            return prepareRegisterPurchase(tenantId, args.items, args.supplier_name, args.extra_costs);
          },
          name: "prepareRegisterPurchase",
          description: "Prepara el registro de una compra interna en el depósito físico. Extrae SKUs, cantidades y costos unitarios.",
          parse: JSON.parse,
          parameters: {
            type: "object",
            properties: {
              items: {
                type: "array",
                description: "Lista de productos o componentes de la compra",
                items: {
                  type: "object",
                  properties: {
                    sku: { type: "string", description: "SKU del componente o producto comprado" },
                    quantity: { type: "number", description: "Cantidad de unidades compradas" },
                    unit_cost: { type: "number", description: "Costo unitario del componente si se especificó" }
                  },
                  required: ["sku", "quantity"]
                }
              },
              supplier_name: { type: "string", description: "Nombre del proveedor si aplica" },
              extra_costs: { type: "number", description: "Costos adicionales asociados a la compra si aplica" }
            },
            required: ["items"]
          }
        }
      },
      {
        type: "function",
        function: {
          function: async (args: { sku: string }) => {
            const { getComponentStock } = await import('./tools/queryTools');
            return getComponentStock(tenantId, args.sku);
          },
          name: "getComponentStock",
          description: "Obtiene el stock real de un componente en depósito a partir de su SKU.",
          parse: JSON.parse,
          parameters: {
            type: "object",
            properties: {
              sku: { type: "string", description: "SKU del componente a consultar" }
            },
            required: ["sku"]
          }
        }
      },
      {
        type: "function",
        function: {
          function: async (args: { query: string }) => {
            const { getComboStock } = await import('./tools/queryTools');
            return getComboStock(tenantId, args.query);
          },
          name: "getComboStock",
          description: "Calcula cuántos combos o unidades compuestas se pueden fabricar en base al stock real del depósito.",
          parse: JSON.parse,
          parameters: {
            type: "object",
            properties: {
              query: { type: "string", description: "SKU o nombre de la publicación o combo" }
            },
            required: ["query"]
          }
        }
      },
      {
        type: "function",
        function: {
          function: async (args: { sku: string }) => {
            const { getProductsUsingComponent } = await import('./tools/queryTools');
            return getProductsUsingComponent(tenantId, args.sku);
          },
          name: "getProductsUsingComponent",
          description: "Muestra qué publicaciones de Mercado Libre están asociadas o usan un determinado componente.",
          parse: JSON.parse,
          parameters: {
            type: "object",
            properties: {
              sku: { type: "string", description: "SKU del componente" }
            },
            required: ["sku"]
          }
        }
      },
      {
        type: "function",
        function: {
          function: async () => {
            const { getOutOfStockComponents } = await import('./tools/queryTools');
            return getOutOfStockComponents(tenantId);
          },
          name: "getOutOfStockComponents",
          description: "Obtiene la lista de componentes faltantes o críticos en depósito y las publicaciones afectadas.",
          parse: JSON.parse,
          parameters: { type: "object", properties: {} }
        }
      },
      {
        type: "function",
        function: {
          function: async (args: { query: string }) => {
            const { getProductComponentsCostDetail } = await import('./tools/queryTools');
            return getProductComponentsCostDetail(tenantId, args.query);
          },
          name: "getProductComponentsCostDetail",
          description: "Obtiene el detalle de costeo por componentes y costos extra de un producto.",
          parse: JSON.parse,
          parameters: {
            type: "object",
            properties: {
              query: { type: "string", description: "SKU o nombre de la publicación" }
            },
            required: ["query"]
          }
        }
      },
      {
        type: "function",
        function: {
          function: async () => {
            const { getStockInconsistencies } = await import('./tools/queryTools');
            return getStockInconsistencies(tenantId);
          },
          name: "getStockInconsistencies",
          description: "Muestra las publicaciones donde Mercado Libre tiene más stock publicado que el stock interno disponible en depósito.",
          parse: JSON.parse,
          parameters: { type: "object", properties: {} }
        }
      }
    ],
  });

  const finalContent = await runner.finalContent();
  
  if (finalContent) {
    await incrementAIUsage(tenantId);
  }

  let foundProductId = null;
  for (const m of runner.messages) {
    if (m.role === "tool" && typeof m.content === "string") {
      try {
        const parsed = JSON.parse(m.content);
        if (parsed.product_id) foundProductId = parsed.product_id;
        else if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].id) {
          foundProductId = parsed[0].id;
        }

        // Catch Session State changes from tools
        if (session) {
          if (parsed.action_id) {
            await updateSessionState(session.id, { current_action_id: parsed.action_id });
          }
          if (parsed.workflow_id) {
            await updateSessionState(session.id, { current_workflow_id: parsed.workflow_id });
          }
          if (parsed._session_state) {
            await updateSessionState(session.id, {
              current_action_type: parsed._session_state.action_type,
              missing_fields: parsed._session_state.missing_fields,
              context: parsed._session_state.context
            });
          }
        }
      } catch (e) {}
    }
  }

  return {
    response: finalContent || "Lo siento, hubo un problema procesando tu consulta.",
    product_id: foundProductId
  };
}
