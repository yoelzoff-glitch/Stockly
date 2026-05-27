import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

export const getCachedOrders = unstable_cache(
  async (tenantId: string, days: number = 7) => {
    const supabase = createAdminClient();
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const { data: recentOrders } = await supabase
      .from("orders")
      .select("total_amount, date_created")
      .eq("tenant_id", tenantId)
      .gte("date_created", startDate.toISOString());

    return recentOrders || [];
  },
  ["dashboard-orders"],
  { revalidate: 60, tags: ["orders"] }
);
