import { inngest } from "../inngest/client";
import { syncProducts } from "../services/meli/syncProducts";
import { createAdminClient } from "@/lib/supabase/admin";

export const syncProductsJob = inngest.createFunction(
  { 
    id: "sync-products",
    triggers: [
      { cron: "*/15 * * * *" },
      { event: "meli/items.updated" as any }
    ]
  },
  async ({ event, step }) => {
    const supabase = createAdminClient();

    // If triggered by a webhook event, sync only for that tenant
    if (event?.name === "meli/items.updated") {
      const tenantId = event.data?.tenantId;
      if (!tenantId) {
        return { message: "No tenantId provided in event data" };
      }
      const result = await step.run("sync-products-single-tenant", async () => {
        try {
          const syncedCount = await syncProducts(tenantId);
          return { tenantId, status: "fulfilled", syncedCount };
        } catch (error: any) {
          return { tenantId, status: "rejected", reason: error.message };
        }
      });
      return { message: `Synced products for tenant ${tenantId}`, details: [result] };
    }
    const { data: accounts } = await supabase.from("meli_accounts").select("tenant_id");

    if (!accounts || accounts.length === 0) {
      return { message: "No accounts to sync" };
    }

    const tenantIds = Array.from(new Set(accounts.map((a) => a.tenant_id)));

    // 2. Sync products for each tenant in parallel
    const results = await step.run("sync-all-tenants", async () => {
      const settled = await Promise.allSettled(
        tenantIds.map((tenantId) => syncProducts(tenantId))
      );
      
      return settled.map((result, index) => ({
        tenantId: tenantIds[index],
        status: result.status,
        reason: result.status === "rejected" ? result.reason : null
      }));
    });

    return { message: `Synced products for ${tenantIds.length} tenants`, details: results };
  }
);
