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
    .select("title, available_quantity, cost, extra_fee_amount, promotion_discount_amount, profit_real_margin")
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
  
  // Sprint 20: Real Profitability Alerts
  let productsWithInstallmentsPenalty = 0;
  let productsWithPromotions = 0;
  let productsBelowMinimumMargin = 0;

  products.forEach(p => {
    if (!p.cost || p.cost <= 0) noCostCount++;
    if (p.available_quantity !== null && p.available_quantity <= 5) lowStockCount++;
    
    // Sprint 20 rules
    if (p.extra_fee_amount && p.extra_fee_amount > 0) {
      productsWithInstallmentsPenalty++;
    }
    if (p.promotion_discount_amount && p.promotion_discount_amount > 0) {
      productsWithPromotions++;
    }
    // Asume un margen mínimo genérico del 10% si no está en preferences
    if (p.profit_real_margin !== null && p.profit_real_margin < 10) {
      productsBelowMinimumMargin++;
    }
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

  // Sprint 20: Rentabilidad Real Alerts
  if (productsWithInstallmentsPenalty > 0) {
    score -= 5;
    issues.push({
      severity: "warning",
      message: `${productsWithInstallmentsPenalty} productos están perdiendo margen por campañas de cuotas`
    });
  }

  if (productsWithPromotions > 0) {
    score -= 5;
    issues.push({
      severity: "warning",
      message: `${productsWithPromotions} productos tienen descuentos promocionales o cupones activos`
    });
  }

  if (productsBelowMinimumMargin > 0) {
    score -= 15;
    issues.push({
      severity: "critical",
      message: `${productsBelowMinimumMargin} productos cayeron debajo del margen mínimo de ganancia`
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
