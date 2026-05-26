import { inngest } from "../inngest/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/errors/logger";
import * as Sentry from "@sentry/nextjs";

export const competitorAnalysisJob = inngest.createFunction(
  { 
    id: "competitor-analysis", 
    name: "Competitor Analysis",
    triggers: [{ event: "ai/competitor.analysis.requested" as any }]
  },
  async ({ event, step }) => {
    const { tenantId, productIds } = event.data;
    
    await step.run("analyze-competitors", async () => {
      try {
        const supabase = createAdminClient();
        const { checkAutomationLimit, incrementUsage } = await import("@/services/billing/checkLimits");
        
        const hasLimit = await checkAutomationLimit(tenantId);
        if (!hasLimit) {
          await supabase.from("alerts").insert({
            tenant_id: tenantId,
            type: "warning",
            title: "Límite de Automatizaciones Alcanzado",
            message: "No se pudo realizar el análisis de competencia masivo porque has alcanzado el límite de tu plan.",
            is_read: false
          });
          logger.warn(`Automation limit reached for tenant ${tenantId}. Aborting competitor analysis.`, "COMPETITOR_ANALYSIS");
          return { success: false, reason: "limit_reached" };
        }

        logger.info(`Starting competitor analysis for tenant ${tenantId}`, "COMPETITOR_ANALYSIS");
        
        // Placeholder for heavy competitor analysis logic
        // ... (API ML calls, embeddings, AI comparisons)
        
        // Simular progreso
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        await supabase.from("alerts").insert({
          tenant_id: tenantId,
          type: "info",
          title: "Análisis de Competencia Finalizado",
          message: `El análisis masivo para ${productIds?.length || 0} productos ha concluido.`,
          is_read: false
        });
        
        await incrementUsage(tenantId, "automation_actions_used");
        
        return { success: true };
      } catch (error) {
        Sentry.captureException(error, { extra: { context: "COMPETITOR_ANALYSIS_JOB" } });
        throw error;
      }
    });
  }
);
