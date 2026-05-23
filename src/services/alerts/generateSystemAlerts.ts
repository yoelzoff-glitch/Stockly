import { createAdminClient } from "@/lib/supabase/admin";
import { createAlert } from "./createAlert";
import { getParetoAnalysis } from "../analytics/pareto";

export async function generateSystemAlerts(tenantId: string) {
  const supabase = createAdminClient();

  const { data: products } = await supabase
    .from("products")
    .select("id, title, available_quantity, margin_percent, status")
    .eq("tenant_id", tenantId)
    .eq("status", "active");

  if (!products) return;

  for (const p of products) {
    if (p.available_quantity !== null && p.available_quantity <= 5) {
      await createAlert({
        tenantId,
        title: `Stock Crítico: ${p.title}`,
        body: `Te quedan solo ${p.available_quantity} unidades. Reponé inventario pronto para evitar perder posicionamiento.`,
        severity: p.available_quantity === 0 ? "critical" : "warning",
      });
    }

    if (p.margin_percent !== null && p.margin_percent < 10 && p.margin_percent > 0) {
      await createAlert({
        tenantId,
        title: `Margen Bajo en: ${p.title}`,
        body: `El margen estimado está en ${p.margin_percent}%. Considera ajustar el precio o revisar los costos.`,
        severity: "warning",
      });
    }
  }

  // Check top products risk
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const pareto = await getParetoAnalysis({ tenantId, dateFrom: sevenDaysAgo });

  if (pareto.paretoProducts.length > 0) {
    for (const topProd of pareto.paretoProducts) {
      const prod = products.find(p => p.title === topProd.title);
      if (prod && prod.available_quantity !== null && prod.available_quantity <= 10) {
        await createAlert({
          tenantId,
          title: `Peligro en Producto Líder: ${topProd.title}`,
          body: `Este producto es clave para tu facturación y su stock está bajando (${prod.available_quantity} uds).`,
          severity: "critical"
        });
      }
    }
  }
}
