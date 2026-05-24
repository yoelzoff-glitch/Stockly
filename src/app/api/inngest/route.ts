import { serve } from "inngest/next";
import { inngest } from "../../../inngest/client";
import { syncProductsJob } from "../../../jobs/syncProductsJob";
import { syncOrdersJob } from "../../../jobs/syncOrdersJob";
import { questionsJob } from "../../../jobs/questionsJob";
import { refreshMeliTokensJob } from "../../../jobs/refreshMeliTokensJob";
import { massPromotionsJob } from "../../../jobs/massPromotionsJob";
import { competitorAnalysisJob } from "../../../jobs/competitorAnalysisJob";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    syncProductsJob,
    syncOrdersJob,
    questionsJob,
    refreshMeliTokensJob,
    massPromotionsJob,
    competitorAnalysisJob,
  ],
});
