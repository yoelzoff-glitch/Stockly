import { serve } from "inngest/next";
import { inngest } from "../../../inngest/client";
import { syncProductsDispatcherJob, syncProductsTenantJob } from "../../../jobs/syncProductsJob";
import { syncOrdersDispatcherJob, syncOrdersTenantJob } from "../../../jobs/syncOrdersJob";
import { questionsJob } from "../../../jobs/questionsJob";
import { refreshMeliTokensJob } from "../../../jobs/refreshMeliTokensJob";
import { massPromotionsJob } from "../../../jobs/massPromotionsJob";
import { competitorAnalysisJob } from "../../../jobs/competitorAnalysisJob";
import { cleanupZombieUsersJob } from "../../../jobs/cleanupZombieUsersJob";
import { applySubscriptionDowngradesJob } from "../../../jobs/applySubscriptionDowngradesJob";
import { meliShipmentsJob, mercadopagoWebhookJob, whatsappWebhookJob } from "../../../jobs/webhookJobs";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    syncProductsDispatcherJob,
    syncProductsTenantJob,
    syncOrdersDispatcherJob,
    syncOrdersTenantJob,
    questionsJob,
    refreshMeliTokensJob,
    massPromotionsJob,
    competitorAnalysisJob,
    cleanupZombieUsersJob,
    applySubscriptionDowngradesJob,
    meliShipmentsJob,
    mercadopagoWebhookJob,
    whatsappWebhookJob,
  ],
});
