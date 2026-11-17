import { syncProductsDispatcherJob, syncProductsTenantJob } from "../jobs/syncProductsJob";
import { syncOrdersDispatcherJob, syncOrdersTenantJob } from "../jobs/syncOrdersJob";
import { refreshMeliTokensJob } from "../jobs/refreshMeliTokensJob";
import { massPromotionsJob } from "../jobs/massPromotionsJob";
import { competitorAnalysisJob } from "../jobs/competitorAnalysisJob";
import { cleanupZombieUsersJob } from "../jobs/cleanupZombieUsersJob";
import { applySubscriptionDowngradesJob } from "../jobs/applySubscriptionDowngradesJob";
import { meliShipmentsJob, mercadopagoWebhookJob, whatsappWebhookJob } from "../jobs/webhookJobs";
import { fullReplenishmentAnalysisJob } from "../jobs/fullReplenishmentJob";
import { repairOrdersJob } from "../jobs/repairOrdersJob";
import { 
  reconcileShipmentsDispatcherJob, 
  reconcileCancellationsDispatcherJob,
  reconcileOrdersDeepDispatcherJob 
} from "../jobs/reconciliationJobs";


export const registeredJobs = [
    syncProductsDispatcherJob,
    syncProductsTenantJob,
    syncOrdersDispatcherJob,
    syncOrdersTenantJob,
    refreshMeliTokensJob,
    massPromotionsJob,
    competitorAnalysisJob,
    cleanupZombieUsersJob,
    applySubscriptionDowngradesJob,
    meliShipmentsJob,
    mercadopagoWebhookJob,
    whatsappWebhookJob,
    fullReplenishmentAnalysisJob,
    reconcileShipmentsDispatcherJob,
    reconcileCancellationsDispatcherJob,
    reconcileOrdersDeepDispatcherJob,
    repairOrdersJob,
  ];
