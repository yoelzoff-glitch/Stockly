import { inngest } from "../inngest/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/errors/logger";
import * as Sentry from "@sentry/nextjs";

export const applySubscriptionDowngradesJob = inngest.createFunction(
  { 
    id: "apply-subscription-downgrades", 
    name: "Apply Subscription Downgrades",
    triggers: [{ cron: "0 * * * *" }] // Every hour
  },
  async ({ step }) => {
    await step.run("apply-downgrades", async () => {
      try {
        const supabase = createAdminClient();
        
        // Find expired subscriptions that have a pending downgrade
        const { data: expired, error } = await supabase
          .from("subscriptions")
          .select("id, tenant_id, pending_plan")
          .not("pending_plan", "is", null)
          .lt("expires_at", new Date().toISOString());
          
        if (error) throw error;
        
        if (!expired || expired.length === 0) {
          logger.info("No subscription downgrades to apply.", "DOWNGRADES_JOB");
          return { message: "No downgrades to apply" };
        }
        
        const outcomes = [];
        for (const sub of expired) {
          // Apply subscription downgrade
          const { error: subErr } = await supabase.from("subscriptions").update({
            plan: sub.pending_plan,
            pending_plan: null,
            status: "canceled"
          }).eq("id", sub.id);
          
          if (subErr) throw subErr;
          
          // Apply tenant downgrade
          const { error: tenantErr } = await supabase.from("tenants").update({
            plan: sub.pending_plan
          }).eq("id", sub.tenant_id);
          
          if (tenantErr) throw tenantErr;
          
          outcomes.push({ tenant_id: sub.tenant_id, appliedPlan: sub.pending_plan });
          logger.info(`Successfully downgraded tenant ${sub.tenant_id} to plan ${sub.pending_plan}`, "DOWNGRADES_JOB");
        }
        
        logger.info(`Finished applying downgrades. Total: ${outcomes.length}`, "DOWNGRADES_JOB");
        return { message: `Applied ${outcomes.length} downgrades`, outcomes };
      } catch (error: any) {
        Sentry.captureException(error);
        logger.error(`Error in applySubscriptionDowngradesJob: ${error.message}`, "DOWNGRADES_JOB");
        throw error;
      }
    });
  }
);
