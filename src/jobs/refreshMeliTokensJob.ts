import { inngest } from "../inngest/client";
import { refreshMeliToken } from "../services/meli/refreshToken";
import { createAdminClient } from "@/lib/supabase/admin";

export const refreshMeliTokensJob = inngest.createFunction(
  { 
    id: "refresh-meli-tokens",
    triggers: [{ cron: "0 */6 * * *" }] // Cada 6 horas
  },
  async ({ step }) => {
    const supabase = createAdminClient();
    
    // Buscar cuentas conectadas cuyo token expire en las próximas 12 horas
    const twelveHoursFromNow = new Date();
    twelveHoursFromNow.setHours(twelveHoursFromNow.getHours() + 12);

    const { data: accounts, error } = await supabase
      .from("meli_accounts")
      .select("id, tenant_id")
      .eq("status", "connected")
      .lt("token_expires_at", twelveHoursFromNow.toISOString());

    if (error || !accounts || accounts.length === 0) {
      return { message: "No tokens require refresh at this moment." };
    }

    const results = await step.run("refresh-all-tokens", async () => {
      const settled = await Promise.allSettled(
        accounts.map((acc) => refreshMeliToken(acc.id))
      );
      
      return settled.map((result, index) => ({
        accountId: accounts[index].id,
        tenantId: accounts[index].tenant_id,
        status: result.status,
        reason: result.status === "rejected" ? String(result.reason) : null
      }));
    });

    return { message: `Attempted to refresh ${accounts.length} tokens`, details: results };
  }
);
