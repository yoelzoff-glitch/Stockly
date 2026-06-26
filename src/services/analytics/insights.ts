import { createAdminClient } from "@/lib/supabase/admin";

export type InsightType = "positive" | "negative" | "warning" | "info";

export interface BusinessInsight {
  id: string;
  type: InsightType;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
}

export async function generateBusinessInsights(tenantId: string): Promise<BusinessInsight[]> {
  const supabase = createAdminClient();
  const insights: BusinessInsight[] = [];

  // 1. Sales Trend
  const now = new Date();
  const lastWeekStart = new Date(now);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  
  const previousWeekStart = new Date(lastWeekStart);
  previousWeekStart.setDate(previousWeekStart.getDate() - 7);

  const { data: currentWeekOrders } = await supabase
    .from("orders")
    .select("total_amount")
    .eq("tenant_id", tenantId)
    .gte("date_created", lastWeekStart.toISOString());

  const { data: previousWeekOrders } = await supabase
    .from("orders")
    .select("total_amount")
    .eq("tenant_id", tenantId)
    .gte("date_created", previousWeekStart.toISOString())
    .lt("date_created", lastWeekStart.toISOString());

  const currentSales = currentWeekOrders?.reduce((acc, order) => acc + (Number(order.total_amount) || 0), 0) || 0;
  const previousSales = previousWeekOrders?.reduce((acc, order) => acc + (Number(order.total_amount) || 0), 0) || 0;

  if (currentSales > 0 && previousSales > 0) {
    const diff = ((currentSales - previousSales) / previousSales) * 100;
    if (diff > 5) {
      insights.push({
        id: "sales-up",
        type: "positive",
        title: "Tus ventas suben",
        description: `Han crecido un ${diff.toFixed(1)}% respecto a la semana pasada. ¡Buen trabajo!`,
      });
    } else if (diff < -5) {
      insights.push({
        id: "sales-down",
        type: "negative",
        title: "Tus ventas bajaron",
        description: `Han caído un ${Math.abs(diff).toFixed(1)}% vs la semana pasada.`,
      });
    }
  }

  // 2. Critical Stock
  const { data: lowStock } = await supabase
    .from("products")
    .select("title, available_quantity")
    .eq("tenant_id", tenantId)
    .lte("available_quantity", 5)
    .limit(1); // Just check if at least one exists

  if (lowStock && lowStock.length > 0) {
    insights.push({
      id: "low-stock",
      type: "warning",
      title: "Stock crítico detectado",
      description: `Tienes productos con 5 unidades o menos. Considera reponer pronto.`,
      actionLabel: "Revisar Stock",
      actionHref: "/dashboard/products?filter=low-stock"
    });
  }



  return insights;
}
