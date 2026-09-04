import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Returns cached recent orders for a tenant.
 * Stricly partitioned by tenantId and period to prevent cross-tenant data leaks.
 */
export async function getCachedOrders(tenantId: string, days: number = 7) {
  const fetcher = unstable_cache(
    async (tId: string, d: number) => {
      const supabase = createAdminClient();

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - d);
      startDate.setHours(0, 0, 0, 0);

      const { data: recentOrders } = await supabase
        .from("orders")
        .select("total_amount, date_created, status, meli_order_id")
        .eq("tenant_id", tId)
        .gte("date_created", startDate.toISOString())
        .order("date_created", { ascending: false })
        .limit(1000);

      return recentOrders || [];
    },
    [`dashboard-orders-${tenantId}-${days}`],
    {
      revalidate: 60,
      tags: [`orders-${tenantId}`, `tenant-${tenantId}`],
    }
  );

  return fetcher(tenantId, days);
}
