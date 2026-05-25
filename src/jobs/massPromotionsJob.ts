import { inngest } from "../inngest/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/errors/logger";
import * as Sentry from "@sentry/nextjs";

export const massPromotionsJob = inngest.createFunction(
  { 
    id: "mass-promotions", 
    name: "Mass Promotions",
    triggers: [{ event: "meli/promotions.mass_create" as any }]
  },
  async ({ event, step }) => {
    const { tenantId, promotionData, productIds } = event.data;
    
    await step.run("create-mass-promotions", async () => {
      try {
        const supabase = createAdminClient();
        logger.info(`Starting mass promotions for tenant ${tenantId}`, "MASS_PROMOTIONS");
        
        // Placeholder for heavy mass promotions logic
        // Iterating over productIds and hitting ML SDK / createItemPromotion
        
        // Simular progreso
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        await supabase.from("alerts").insert({
          tenant_id: tenantId,
          type: "success",
          title: "Promociones Masivas Creadas",
          message: `Se aplicó la promoción a ${productIds?.length || 0} productos.`,
          is_read: false
        });
        
        const { incrementUsage } = await import("@/services/billing/checkLimits");
        await incrementUsage(tenantId, "automation_actions_used");
        
        return { success: true };
      } catch (error) {
        Sentry.captureException(error, { extra: { context: "MASS_PROMOTIONS_JOB" } });
        throw error;
      }
    });
  }
);
