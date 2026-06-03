import { inngest } from "../inngest/client";
import { syncOrders } from "../services/meli/syncOrders";
import { createAdminClient } from "@/lib/supabase/admin";

export const syncOrdersJob = inngest.createFunction(
  { 
    id: "sync-orders",
    triggers: [
      { cron: "*/5 * * * *" },
      { event: "meli/orders.updated" as any }
    ]
  },
  async ({ event, step }) => {
    const supabase = createAdminClient();

    // If triggered by a webhook event, sync only for that tenant
    if (event?.name === "meli/orders.updated") {
      const tenantId = event.data?.tenantId;
      if (!tenantId) {
        return { message: "No tenantId provided in event data" };
      }
      const result = await step.run("sync-orders-single-tenant", async () => {
        try {
          const syncedCount = await syncOrders(tenantId);
          return { tenantId, status: "fulfilled", syncedCount };
        } catch (error: any) {
          return { tenantId, status: "rejected", reason: error.message };
        }
      });
      return { message: `Synced orders for tenant ${tenantId}`, details: [result] };
    }

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
