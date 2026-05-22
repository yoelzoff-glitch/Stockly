import { inngest } from "../inngest/client";
import { syncProducts } from "../services/meli/syncProducts";
import { createAdminClient } from "@/lib/supabase/admin";

export const syncProductsJob = inngest.createFunction(
  { id: "sync-products" },
  { cron: "*/15 * * * *" }, // Cada 15 minutos
  async ({ step }) => {
    // 1. Get all tenants that have a meli_account
    const supabase = createAdminClient();
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
