import { inngest } from "../inngest/client";
import { syncOrders } from "../services/meli/syncOrders";
import { createAdminClient } from "@/lib/supabase/admin";

export const syncOrdersJob = inngest.createFunction(
  { id: "sync-orders" },
  { cron: "*/5 * * * *" }, // Cada 5 minutos
  async ({ step }) => {
    const supabase = createAdminClient();
    const { data: accounts } = await supabase.from("meli_accounts").select("tenant_id");

    if (!accounts || accounts.length === 0) {
      return { message: "No accounts to sync" };
    }

    const tenantIds = Array.from(new Set(accounts.map((a) => a.tenant_id)));

    const results = await step.run("sync-orders-all-tenants", async () => {
      const settled = await Promise.allSettled(
        tenantIds.map((tenantId) => syncOrders(tenantId))
      );
      
      return settled.map((result, index) => ({
        tenantId: tenantIds[index],
        status: result.status,
        reason: result.status === "rejected" ? result.reason : null
      }));
    });

    return { message: `Synced orders for ${tenantIds.length} tenants`, details: results };
  }
);
