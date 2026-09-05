import { inngest } from "../inngest/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/errors/logger";
import { isDemoTenant } from "@/lib/demo/assert-demo-write-allowed";
import * as Sentry from "@sentry/nextjs";

export const massPromotionsJob = inngest.createFunction(
  { 
    id: "mass-promotions", 
    name: "Mass Promotions",
    triggers: [{ event: "meli/promotions.mass_create" as any }]
  },
  async ({ event, step }) => {
    const { tenantId, promotionData, productIds } = event.data;

    if (await isDemoTenant(tenantId)) {
      logger.info({
        event: "DEMO_TENANT_SKIPPED_EXTERNAL_OPERATION",
        tenantId,
        operation: "mass_promotions",
        message: "Skipping mass promotions for demo tenant",
      });
      return { skipped: true, reason: "demo_tenant" };
    }
    
    await step.run("create-mass-promotions", async () => {
      try {
        const supabase = createAdminClient();
        const { checkAutomationLimit, incrementUsage } = await import("@/services/billing/checkLimits");
        
        const hasLimit = await checkAutomationLimit(tenantId);
        if (!hasLimit) {
          await supabase.from("alerts").insert({
            tenant_id: tenantId,
            type: "warning",
            title: "Límite de Automatizaciones Alcanzado",
            message: "No se pudieron crear las promociones masivas porque has alcanzado el límite de tu plan.",
            is_read: false
          });
          logger.warn(`Automation limit reached for tenant ${tenantId}. Aborting mass promotions.`, "MASS_PROMOTIONS");
          return { success: false, reason: "limit_reached" };
        }

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
        
        await incrementUsage(tenantId, "automation_actions_used");
        
        return { success: true };
      } catch (error) {
        Sentry.captureException(error, { extra: { context: "MASS_PROMOTIONS_JOB" } });
        throw error;
      }
    });
  }
);
