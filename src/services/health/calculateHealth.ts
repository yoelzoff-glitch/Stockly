import { createClient } from "@/lib/supabase/server";

export type HealthStatus = "Excelente" | "Bueno" | "Atención" | "Crítico";
export type HealthIssue = { severity: "critical" | "warning"; message: string };

export async function calculateBusinessHealth(tenantId: string) {
  const supabase = await createClient();

  let score = 100;
  const issues: HealthIssue[] = [];

  // 1. Check Products and Stock
  const { data: products } = await supabase
    .from("products")
    .select("available_quantity, unit_cost")
    .eq("tenant_id", tenantId);

  if (!products || products.length === 0) {
    return {
      score: 0,
      status: "Crítico" as HealthStatus,
      issues: [{ severity: "critical" as "critical" | "warning", message: "No tienes productos sincronizados" }]
    };
  }

  const totalProducts = products.length;
  let noCostCount = 0;
  let lowStockCount = 0;

  products.forEach(p => {
    if (!p.unit_cost || p.unit_cost <= 0) noCostCount++;
    if (p.available_quantity !== null && p.available_quantity <= 5) lowStockCount++;
  });

  // Cost rules
  const noCostPercentage = noCostCount / totalProducts;
  if (noCostPercentage > 0) {
    const penalty = Math.min(20, Math.floor(noCostPercentage * 10) * 5);
    score -= penalty;
    issues.push({ 
      severity: (noCostPercentage > 0.5 ? "critical" : "warning") as "critical" | "warning", 
      message: `${noCostCount} productos no tienen costo asignado` 
    });
  }

  // Stock rules
  const lowStockPercentage = lowStockCount / totalProducts;
  if (lowStockPercentage > 0.1) {
    score -= 10;
    issues.push({ 
      severity: (lowStockPercentage > 0.3 ? "critical" : "warning") as "critical" | "warning", 
      message: `${lowStockCount} productos tienen stock bajo (<= 5)` 
    });
  }

  // 2. Check recent sales (last 7 vs previous 7 days)
  const today = new Date();
  const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000);

  const { data: recentOrders } = await supabase
    .from("orders")
    .select("total_amount, date_created")
    .eq("tenant_id", tenantId)
    .gte("date_created", twoWeeksAgo.toISOString());

  let salesThisWeek = 0;
  let salesLastWeek = 0;

  recentOrders?.forEach(o => {
    const d = new Date(o.date_created);
    if (d >= lastWeek) salesThisWeek += Number(o.total_amount || 0);
    else salesLastWeek += Number(o.total_amount || 0);
  });

  if (salesLastWeek > 0) {
    const growth = (salesThisWeek - salesLastWeek) / salesLastWeek;
    if (growth < -0.1) {
      score -= 10;
      issues.push({ 
        severity: (growth < -0.3 ? "critical" : "warning") as "critical" | "warning", 
        message: `Tus ventas cayeron un ${(Math.abs(growth) * 100).toFixed(0)}% respecto a la semana anterior` 
      });
    }
  }

  // 3. Check ML Integration errors (if any)
  const { data: meli } = await supabase
    .from("meli_accounts")
    .select("status")
    .eq("tenant_id", tenantId)
    .single();

  if (!meli) {
    score -= 30;
    issues.push({ severity: "critical" as "critical" | "warning", message: "Mercado Libre no está conectado" });
  } else if (meli.status !== "active") {
    score -= 20;
    issues.push({ severity: "critical" as "critical" | "warning", message: "La conexión con Mercado Libre presenta problemas" });
  }

  // Calculate status
  let status: HealthStatus = "Excelente";
  if (score < 50) status = "Crítico";
  else if (score < 70) status = "Atención";
  else if (score < 90) status = "Bueno";

  return { score: Math.max(0, score), status, issues };
}
