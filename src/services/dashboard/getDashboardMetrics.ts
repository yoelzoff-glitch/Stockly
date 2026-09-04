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
  source: "rpc_aggregates" | "query_fallback";
}

/**
 * Resolves dashboard KPIs for a tenant.
 * Uses SQL RPC aggregates when `dashboard_aggregates_v2` is active, or optimized scoped queries as fallback.
 */
export async function getDashboardMetrics(
  tenantId: string,
  days: number = 30,
  customClient?: any
): Promise<DashboardMetrics> {
  const supabase = customClient || createAdminClient();
  const useRpc = await isFeatureFlagEnabled(tenantId, "dashboard_aggregates_v2", supabase);

  if (useRpc) {
    try {
      const { data, error } = await supabase.rpc("get_dashboard_aggregates_v2", {
        p_tenant_id: tenantId,
        p_days: days,
      });

      if (!error && data) {
        return {
          totalRevenue: Number(data.total_revenue || 0),
          totalOrders: Number(data.total_orders || 0),
          averageTicket: Number(data.average_ticket || 0),
          todayRevenue: Number(data.today_revenue || 0),
          todayOrders: Number(data.today_orders || 0),
          totalProducts: Number(data.total_products || 0),
          criticalStockCount: Number(data.critical_stock_count || 0),
          productsWithoutCost: Number(data.products_without_cost || 0),
          activeAlertsCount: Number(data.active_alerts_count || 0),
          source: "rpc_aggregates",
        };
      }
    } catch {
      // Fallback on RPC failure
    }
  }

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
    source: "query_fallback",
  };
}
