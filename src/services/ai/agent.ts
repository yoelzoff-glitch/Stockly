import { openai } from "@/lib/ai/openai";
import * as tools from "./tools";

export async function runBusinessAgent({
  tenantId,
  userMessage,
}: {
  tenantId: string;
  userMessage: string;
}) {
  const systemPrompt = `Eres Stockly, el asistente de inteligencia artificial interno para la gestión del negocio del usuario.
Tu objetivo es responder de forma clara, directa y concisa a las preguntas del usuario sobre sus ventas, productos y stock.
Usa las herramientas proporcionadas para obtener datos reales de la base de datos.
- Responde siempre en español.
- Nunca inventes datos (alucines). Si una herramienta no devuelve resultados, dile al usuario que no tienes esa información.
- Formatea los valores monetarios con el símbolo $.
- No uses lenguaje excesivamente formal, mantén un tono profesional pero cercano.
- Importante: NO intentes modificar precios, crear órdenes ni realizar acciones peligrosas. Eres un asistente de solo lectura.`;

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
          function: async (args: { query: string }) => tools.searchProductByName(tenantId, args.query),
          name: "searchProductByName",
          description: "Busca un producto por nombre y devuelve su precio, stock disponible, estado y cantidad vendida.",
          parse: JSON.parse,
          parameters: {
            type: "object",
            properties: {
              query: { type: "string", description: "El nombre o parte del nombre del producto a buscar." },
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
              productName: { type: "string", description: "El nombre del producto a evaluar." },
            },
            required: ["productName"],
          },
        },
      },
    ],
  });

  const finalContent = await runner.finalContent();
  return finalContent || "Lo siento, hubo un problema procesando tu consulta.";
}
