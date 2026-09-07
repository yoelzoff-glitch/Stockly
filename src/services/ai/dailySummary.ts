import { createAdminClient } from "@/lib/supabase/admin";
import { openai } from "@/lib/ai/openai";
import { logger } from "@/lib/errors/logger";
import { getMidnightInTimezone } from "./tools/finance";
import { isDemoTenant } from "@/lib/demo/assert-demo-write-allowed";

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
  
  // Zero AI consumption for demo tenants: return pre-seeded or static fixture
  if (await isDemoTenant(tenantId, supabase)) {
    const { data: demoAlert } = await supabase
      .from("alerts")
      .select("body")
      .eq("tenant_id", tenantId)
      .like("title", "Resumen Diario%")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (demoAlert?.body) {
      return demoAlert.body;
    }

    return "📊 Resumen Demo: Operaciones comerciales estables con crecimiento sostenido en Hogar y Organización.\n⭐ Producto estrella: Lámpara de escritorio Nórdica.\n📦 Control de stock: 4 productos en nivel crítico para reposición.";
  }

  // Obtener la zona horaria del tenant
  const { data: tenant } = await supabase.from("tenants").select("timezone").eq("id", tenantId).single();
  const timezone = tenant?.timezone || 'America/Argentina/Buenos_Aires';
  const todayStart = getMidnightInTimezone(new Date(), timezone);

  const dedupeKey = `tenant:${tenantId}:cache:daily_summary`;

  // 1. Check if we already have a fresh cached summary
  const { data: existing } = await supabase
    .from("alerts")
    .select("id, body, created_at, updated_at")
    .eq("tenant_id", tenantId)
    .eq("dedupe_key", dedupeKey)
    .maybeSingle();

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const lastTime = existing?.updated_at || existing?.created_at;
  if (existing?.body && lastTime && new Date(lastTime) > oneHourAgo && new Date(lastTime) >= todayStart) {
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

    // 3. Save as single bounded cache record per tenant using dedupe_key (zero table bloat)
    await supabase.from("alerts").upsert(
      {
        tenant_id: tenantId,
        type: "daily_summary_archived",
        category: "activity",
        status: "archived",
        is_read: true,
        source: "system",
        title: `Resumen Diario - ${new Date().toLocaleDateString("es-AR")}`,
        body: summaryText,
        severity: "info",
        dedupe_key: dedupeKey,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "tenant_id, dedupe_key",
      }
    );

    return summaryText;

  } catch (error) {
    logger.error(error, "DAILY_SUMMARY_GEN");
    return null;
  }
}
