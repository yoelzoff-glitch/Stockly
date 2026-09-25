import { inngest } from "../inngest/client";
import { refreshMeliToken } from "../services/meli/refreshToken";
import { isTransientErrorString } from "../services/meli/tokenErrorClassification";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/errors/logger";
import { startOperationRun, completeOperationRun, partialOperationRun, failOperationRun } from "@/lib/observability/operationRuns";

export const refreshMeliTokensJob = inngest.createFunction(
  { 
    id: "refresh-meli-tokens",
    triggers: [{ cron: "*/30 * * * *" }] // Cada 30 minutos
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
      
      // Buscar cuentas activas con refresh token presente
      let accounts: any[] | null = null;
      const { data: fullAccounts, error: accountsError } = await supabase
        .from("meli_accounts")
        .select("id, tenant_id, status, sync_error, token_expires_at, last_success_refresh, next_retry_at, last_failure_category, tenants!inner(is_demo)")
        .eq("tenants.is_demo", false)
        .not("refresh_token", "is", null);

      if (accountsError) {
        const { data: baseAccounts } = await supabase
          .from("meli_accounts")
          .select("id, tenant_id, status, sync_error, token_expires_at, last_success_refresh, tenants!inner(is_demo)")
          .eq("tenants.is_demo", false)
          .not("refresh_token", "is", null);
        accounts = baseAccounts;
      } else {
        accounts = fullAccounts;
      }

      if (!accounts || accounts.length === 0) {
        await completeOperationRun(runId, { itemsProcessed: 0, metadata: { message: "No accounts found for token check" } });
        return { message: "No accounts found for token check." };
      }

      const now = Date.now();
      const accountsToRefresh = accounts.filter((acc) => {
        const isActuallyExpired = !acc.token_expires_at || new Date(acc.token_expires_at).getTime() <= now;

        // Regla 1: Omitir si se renovó exitosamente hace menos de 60 minutos,
        // PERO NUNCA bloquear si el token está realmente vencido!
        if (acc.last_success_refresh && !isActuallyExpired) {
          const timeSinceLastRefreshMs = now - new Date(acc.last_success_refresh).getTime();
          if (timeSinceLastRefreshMs < 60 * 60 * 1000) {
            return false;
          }
        }

        // Regla 2: Cuentas conectadas que expiren en las próximas 1.5 horas (90 min) o ya expiradas
        if (acc.status === "connected") {
          if (isActuallyExpired) {
            logger.warn({
              event: "MELI_EXPIRED_TOKEN_DETECTED_IN_CRON",
              tenantId: acc.tenant_id,
              accountId: acc.id,
              message: "Token is actually expired; renewing immediately regardless of 60m guard",
            });
            return true;
          }
          const remainingMs = new Date(acc.token_expires_at).getTime() - now;
          return remainingMs <= 90 * 60 * 1000;
        }

        // Regla 3: Recuperación automática controlada para cuentas en 'error' SOLO si el error fue transitorio
        // Usar datos estructurados (last_failure_category) con fallback retrocompatible a sync_error
        if (acc.status === "error") {
          const isTransient =
            acc.last_failure_category === "rate_limit" ||
            acc.last_failure_category === "timeout" ||
            acc.last_failure_category === "server_error" ||
            isTransientErrorString(acc.sync_error);

          if (!isTransient) return false;

          // Si hay espera programada (next_retry_at), respetarla salvo que esté vencido
          if (acc.next_retry_at && new Date(acc.next_retry_at).getTime() > now && !isActuallyExpired) {
            return false;
          }

          return true;
        }

        return false;
      });

      if (accountsToRefresh.length === 0) {
        await completeOperationRun(runId, { itemsProcessed: 0, metadata: { message: "No tokens require refresh at this moment" } });
        return { message: "No tokens require refresh at this moment." };
      }

      logger.info({
        event: "REFRESH_MELI_TOKENS_JOB_STARTED",
        correlationId,
        operation: "refresh_meli_tokens_job",
        source: "inngest_cron",
        accountCount: accountsToRefresh.length,
      });

      const results = await step.run("refresh-all-tokens", async () => {
        const settled = await Promise.allSettled(
          accountsToRefresh.map((acc) => refreshMeliToken(acc.id))
        );
        
        return settled.map((result, index) => ({
          accountId: accountsToRefresh[index].id,
          tenantId: accountsToRefresh[index].tenant_id,
          status: result.status,
          reason: result.status === "rejected" ? String(result.reason) : null
        }));
      });

      const successCount = results.filter((r) => r.status === "fulfilled").length;

      if (successCount === accountsToRefresh.length) {
        await completeOperationRun(runId, {
          itemsProcessed: successCount,
          metadata: { total: accountsToRefresh.length, success: successCount },
        });
      } else if (successCount > 0) {
        await partialOperationRun(runId, {
          itemsProcessed: successCount,
          metadata: { total: accountsToRefresh.length, success: successCount, failed: accountsToRefresh.length - successCount },
        });
      } else {
        await failOperationRun(runId, {
          errorCode: "ALL_TOKEN_REFRESHES_FAILED",
          errorMessage: "Failed to refresh any of the target tokens",
          metadata: { total: accountsToRefresh.length, success: 0 },
        });
      }

      logger.info({
        event: "REFRESH_MELI_TOKENS_JOB_COMPLETED",
        correlationId,
        operation: "refresh_meli_tokens_job",
        source: "inngest_cron",
        total: accountsToRefresh.length,
        refreshed: successCount,
        status: successCount === accountsToRefresh.length ? "completed" : (successCount > 0 ? "partial" : "failed"),
      });

      return { message: `Attempted to refresh ${accountsToRefresh.length} tokens`, details: results };
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
