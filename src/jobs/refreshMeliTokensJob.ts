import { inngest } from "../inngest/client";
import { refreshMeliToken } from "../services/meli/refreshToken";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/errors/logger";
import { startOperationRun, completeOperationRun, partialOperationRun, failOperationRun } from "@/lib/observability/operationRuns";

export const refreshMeliTokensJob = inngest.createFunction(
  { 
    id: "refresh-meli-tokens",
    triggers: [{ cron: "0 */6 * * *" }] // Cada 6 horas
  },
  async ({ step, event }) => {
    const correlationId = event?.id || undefined;
    const runId = await startOperationRun({
      operationType: "refresh_meli_tokens_job",
      source: "inngest_cron",
      correlationId,
    });

    try {
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
        await completeOperationRun(runId, { itemsProcessed: 0, metadata: { message: "No tokens require refresh" } });
        return { message: "No tokens require refresh at this moment." };
      }

      logger.info({
        event: "REFRESH_MELI_TOKENS_JOB_STARTED",
        correlationId,
        operation: "refresh_meli_tokens_job",
        source: "inngest_cron",
        accountCount: accounts.length,
      });

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

      const successCount = results.filter((r) => r.status === "fulfilled").length;

      if (successCount === accounts.length) {
        await completeOperationRun(runId, {
          itemsProcessed: successCount,
          metadata: { total: accounts.length, success: successCount },
        });
      } else if (successCount > 0) {
        await partialOperationRun(runId, {
          itemsProcessed: successCount,
          metadata: { total: accounts.length, success: successCount, failed: accounts.length - successCount },
        });
      } else {
        await failOperationRun(runId, {
          errorCode: "ALL_TOKEN_REFRESHES_FAILED",
          errorMessage: "Failed to refresh any of the target tokens",
          metadata: { total: accounts.length, success: 0 },
        });
      }

      logger.info({
        event: "REFRESH_MELI_TOKENS_JOB_COMPLETED",
        correlationId,
        operation: "refresh_meli_tokens_job",
        source: "inngest_cron",
        total: accounts.length,
        refreshed: successCount,
        status: successCount === accounts.length ? "completed" : (successCount > 0 ? "partial" : "failed"),
      });

      return { message: `Attempted to refresh ${accounts.length} tokens`, details: results };
    } catch (err: any) {
      logger.error({
        event: "REFRESH_MELI_TOKENS_JOB_FAILED",
        correlationId,
        operation: "refresh_meli_tokens_job",
        source: "inngest_cron",
        error: err,
        message: err?.message,
      });

      if (runId) {
        await failOperationRun(runId, {
          errorCode: "REFRESH_JOB_ERROR",
          errorMessage: err?.message,
        });
      }

      throw err;
    }
  }
);
