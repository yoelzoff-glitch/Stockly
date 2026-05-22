import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

export const getCachedOrders = unstable_cache(
  async (tenantId: string) => {
    const supabase = createAdminClient();
    
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const { data: recentOrders } = await supabase
      .from("orders")
      .select("total_amount, date_created")
      .eq("tenant_id", tenantId)
      .gte("date_created", sevenDaysAgo.toISOString());

    return recentOrders || [];
  },
  ["dashboard-orders"],
  { revalidate: 60, tags: ["orders"] }
);
