import { createAdminClient } from "@/lib/supabase/admin";
import { openai } from "@/lib/ai/openai";
import { logger } from "@/lib/errors/logger";
import { getMidnightInTimezone } from "./tools/finance";

/**
 * Obtiene o genera el resumen diario del negocio utilizando Inteligencia Artificial.
 * Si ya se ha generado un resumen en el día de hoy, lo recupera directamente desde la 
 * tabla de alertas en la base de datos para optimizar costes. De lo contrario, consulta
 * las métricas básicas de ventas de hoy, productos críticos con bajo stock y el producto
 * estrella, e invoca a OpenAI GPT-4o-Mini para redactar un resumen breve y amigable (máximo 4 líneas)
 * con emojis, guardando el resultado como una nueva alerta en base de datos.
 * 
 * @param tenantId Identificador único del comercio
 * @returns Promesa que resuelve en el texto del resumen diario generado, o null si ocurre algún error
 */
export async function getOrCreateDailySummary(tenantId: string): Promise<string | null> {
  const supabase = createAdminClient();
  
  // Obtener la zona horaria del tenant
  const { data: tenant } = await supabase.from("tenants").select("timezone").eq("id", tenantId).single();
  const timezone = tenant?.timezone || 'America/Argentina/Buenos_Aires';
  const todayStart = getMidnightInTimezone(new Date(), timezone);

  // 1. Check if we already have a summary today
  const { data: existing } = await supabase
    .from("alerts")
    .select("body")
    .eq("tenant_id", tenantId)
    .eq("severity", "info")
    .like("title", "Resumen Diario%")
    .gte("created_at", todayStart.toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (existing?.body) {
    return existing.body;
  }

  // 2. We need to generate it
  try {
    // Fetch some basic data
    const { data: todayOrders } = await supabase
      .from("orders")
      .select("total_amount")
      .eq("tenant_id", tenantId)
      .gte("date_created", todayStart.toISOString());
    
    const salesToday = todayOrders?.reduce((acc, o) => acc + (Number(o.total_amount) || 0), 0) || 0;
    
    const { count: lowStockCount } = await supabase
      .from("products")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .lte("available_quantity", 5);

    const { data: topProducts } = await supabase
      .from("products")
      .select("title, sold_quantity")
      .eq("tenant_id", tenantId)
      .order("sold_quantity", { ascending: false })
      .limit(1);

    const topProduct = topProducts?.[0]?.title || "Ninguno";

    // Call OpenAI to write the summary
    const prompt = `Eres el asistente inteligente de Klyvo.
Escribe un breve resumen diario (máximo 4 líneas) para el dueño de la tienda.
Usa emojis. Sé directo y alentador.
Datos de hoy:
- Ventas totales hoy: $${salesToday}
- Producto estrella: ${topProduct}
- Productos con bajo stock: ${lowStockCount}

Formato deseado (ejemplo aproximado):
"Hoy vendiste $X.
Top producto: Y.
Atención: Z productos tienen bajo stock."`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 150,
      temperature: 0.7,
    });

    const summaryText = completion.choices[0]?.message?.content?.trim();

    if (!summaryText) return null;

    // 3. Save it as an alert so it doesn't generate again today
    await supabase.from("alerts").insert({
      tenant_id: tenantId,
      title: `Resumen Diario - ${new Date().toLocaleDateString()}`,
      body: summaryText,
      severity: "info",
      is_read: false
    });

    return summaryText;

  } catch (error) {
    logger.error(error, "DAILY_SUMMARY_GEN");
    return null;
  }
}
