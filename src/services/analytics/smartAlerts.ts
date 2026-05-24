import { createAdminClient } from "@/lib/supabase/admin";
import * as Sentry from "@sentry/nextjs";

export async function generateSmartAlerts() {
  const supabase = createAdminClient();
  try {
    // Fetch all active tenants
    const { data: tenants } = await supabase.from("tenants").select("id");
    if (!tenants) return;

    for (const tenant of tenants) {
      const tenantId = tenant.id;

      // Fetch products
      const { data: products } = await supabase
        .from("products")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("status", "active");

      if (!products) continue;

      let totalRevenue = 0;
      products.forEach(p => {
        totalRevenue += (p.price * (p.sold_quantity || 0));
      });

      for (const product of products) {
        const title = product.title || "Producto desconocido";
        const alertsToCreate = [];

        // Regla 1: Stock Bajo (Menos de 3)
        if (product.available_quantity > 0 && product.available_quantity <= 3) {
          alertsToCreate.push({
            type: "warning",
            title: "Stock Bajo detectado",
            message: `El producto "${title}" tiene solo ${product.available_quantity} unidades disponibles.`
          });
        }

        // Regla 2: Margen Bajo (Menos de 15%)
        if (product.margin_percent !== null && product.margin_percent < 15) {
          alertsToCreate.push({
            type: "error",
            title: "Margen Crítico",
            message: `El producto "${title}" bajó de 15% de margen (${product.margin_percent.toFixed(2)}%).`
          });
        }

        // Regla 3: Producto Líder (Más del 35% de la facturación)
        const productRev = product.price * (product.sold_quantity || 0);
        if (totalRevenue > 0 && (productRev / totalRevenue) > 0.35) {
          alertsToCreate.push({
            type: "info",
            title: "Producto Líder",
            message: `El producto "${title}" representa más del 35% de tu facturación total.`
          });
        }

        // Regla 4: Productos sin ventas en 15 días
        // Calculamos días desde el last_sale (si existe) o desde la creación de BD local
        const refDate = product.last_sale ? new Date(product.last_sale) : new Date(product.created_at);
        const daysWithoutSales = Math.floor((new Date().getTime() - refDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysWithoutSales >= 15 && product.available_quantity > 0) {
          alertsToCreate.push({
            type: "warning",
            title: "Producto Estancado",
            message: `El producto "${title}" lleva ${daysWithoutSales} días sin ventas registradas.`
          });
        }

        // Insert Alerts avoiding duplicates for the same day
        for (const alert of alertsToCreate) {
          const { data: existing } = await supabase
            .from("alerts")
            .select("id")
            .eq("tenant_id", tenantId)
            .eq("title", alert.title)
            .like("message", `%${title}%`)
            .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
            .maybeSingle();

          if (!existing) {
            await supabase.from("alerts").insert({
              tenant_id: tenantId,
              type: alert.type,
              title: alert.title,
              message: alert.message,
              is_read: false
            });
          }
        }
      }
    }
  } catch (error) {
    Sentry.captureException(error, { extra: { context: "SMART_ALERTS" } });
  }
}
