import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { isFeatureFlagEnabled } from "@/lib/safety/featureFlags";

export interface DashboardMetrics {
  totalRevenue: number;
  totalOrders: number;
  averageTicket: number;
  todayRevenue: number;
  todayOrders: number;
  totalProducts: number;
  criticalStockCount: number;
  productsWithoutCost: number;
  activeAlertsCount: number;
  source: "scoped_queries";
}

/**
 * Resolves dashboard KPIs for a tenant using optimized tenant-scoped queries.
 */
export async function getDashboardMetrics(
  tenantId: string,
  days: number = 30,
  customClient?: any
): Promise<DashboardMetrics> {
  const supabase = customClient || createAdminClient();

  // Standard optimized scoped query mode
  const now = new Date();
  const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [ordersRes, todayOrdersRes, productsRes, alertsRes] = await Promise.all([
    supabase
      .from("orders")
      .select("total_amount")
      .eq("tenant_id", tenantId)
      .neq("status", "cancelled")
      .gte("date_created", startDate.toISOString()),
    supabase
      .from("orders")
      .select("total_amount")
      .eq("tenant_id", tenantId)
      .neq("status", "cancelled")
      .gte("date_created", todayStart.toISOString()),
    supabase
      .from("products")
      .select("available_quantity, cost")
      .eq("tenant_id", tenantId)
      .eq("status", "active"),
    supabase
      .from("alerts")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("is_read", false),
  ]);

  const orders = ordersRes.data || [];
  const todayOrders = todayOrdersRes.data || [];
  const products = productsRes.data || [];

  const totalRevenue = orders.reduce((sum: number, o: any) => sum + Number(o.total_amount || 0), 0);
  const totalOrders = orders.length;
  const todayRevenue = todayOrders.reduce((sum: number, o: any) => sum + Number(o.total_amount || 0), 0);
  const todayOrdersCount = todayOrders.length;

  const totalProducts = products.length;
  const criticalStockCount = products.filter((p: any) => Number(p.available_quantity) > 0 && Number(p.available_quantity) <= 5).length;
  const productsWithoutCost = products.filter((p: any) => !p.cost || Number(p.cost) === 0).length;
  const activeAlertsCount = alertsRes.count || 0;

  return {
    totalRevenue,
    totalOrders,
    averageTicket: totalOrders > 0 ? Math.round((totalRevenue / totalOrders) * 100) / 100 : 0,
    todayRevenue,
    todayOrders: todayOrdersCount,
    totalProducts,
    criticalStockCount,
    productsWithoutCost,
    activeAlertsCount,
    source: "scoped_queries",
  };
}
