import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Parámetros requeridos para consultar el contexto reciente de la conversación.
 */
export interface ConversationContextParams {
  tenantId: string;
  channel: string;
  fromPhone?: string; // Solo usado para WhatsApp
  userId?: string;    // Solo usado para dashboard
  limit?: number;
}

/**
 * Contexto de las entidades de productos identificadas en el chat reciente.
 * Permite resolver pronombres o referencias directas implícitas.
 */
export interface ConversationEntityContext {
  last_product_id: string | null;
  last_product_title: string | null;
  last_sku: string | null;
  last_meli_item_id: string | null;
}

/**
 * Consulta y devuelve el historial de mensajes de chat reciente para un canal específico.
 * Los mensajes se retornan en orden cronológico (más antiguo al más reciente) para que 
 * el modelo de lenguaje entienda el flujo natural de la conversación.
 * 
 * @param params Objeto de parámetros
 * @returns Lista de mensajes del chat reciente con relaciones de productos resueltas
 */
export async function getRecentConversationContext({
  tenantId,
  channel,
  fromPhone,
  limit = 10
}: ConversationContextParams) {
  const supabase = createAdminClient();

  let query = supabase
    .from("messages")
    .select(`
      id,
      direction,
      text,
      channel,
      created_at,
      product_id,
      products (
        id, title, sku, meli_item_id
      )
    `)
    .eq("tenant_id", tenantId)
    .eq("channel", channel)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (channel === "whatsapp" && fromPhone) {
    // Asumiendo que guardamos el from_phone en raw_payload o de alguna manera en metadata
    // Si tenemos una columna from_phone (no está en el schema actual de messages de forma nativa), 
    // pero podemos filtrar a través del payload si existe, o limitarlo.
    // Dado que messages no tiene from_phone directo, usamos el JSON:
    query = query.contains('raw_payload', { from: fromPhone });
  }

  const { data, error } = await query;
  if (error || !data) return [];

  // Los devolvemos en orden cronológico para que el agente entienda el hilo natural
  return data.reverse();
}

/**
 * Analiza el historial de chat para extraer el producto más reciente mencionado o enfocado.
 * Esto permite alimentar la memoria a corto plazo del agente y resolver referencias como
 * "aumentalo 10%" o "cuánto stock queda?".
 * 
 * @param messages Arreglo de mensajes de chat recientes
 * @returns Contexto de la última entidad identificada en la memoria
 */
export function extractConversationEntities(messages: any[]): ConversationEntityContext {
  // Buscamos el product_id más reciente mencionado en la conversación
  const entityContext: ConversationEntityContext = {
    last_product_id: null,
    last_product_title: null,
    last_sku: null,
    last_meli_item_id: null
  };

  // Iteramos desde el más reciente hacia atrás (como ya hicimos reverse, el último de la lista es el más reciente)
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.product_id && msg.products) {
      entityContext.last_product_id = msg.products.id;
      entityContext.last_product_title = msg.products.title;
      entityContext.last_sku = msg.products.sku;
      entityContext.last_meli_item_id = msg.products.meli_item_id;
      break;
    }
  }

  return entityContext;
}
