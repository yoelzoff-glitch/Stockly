import { inngest } from "../inngest/client";
import { syncProducts } from "../services/meli/syncProducts";
import { createAdminClient } from "@/lib/supabase/admin";
import { withOperationLease } from "@/lib/security/leases";
import { logger } from "@/lib/errors/logger";

const BATCH_PAGE_SIZE = 50;

/**
 * Inngest Cron Dispatcher: Paginates connected accounts and dispatches per-tenant product sync events.
 */
export const syncProductsDispatcherJob = inngest.createFunction(
  {
    id: "sync-products-dispatcher",
    triggers: [{ cron: "*/15 * * * *" }],
  },
  async ({ step }) => {
    const supabase = createAdminClient();
    let offset = 0;
    let hasMore = true;
    let totalDispatched = 0;

    while (hasMore) {
      const { data: accounts, error } = await supabase
        .from("meli_accounts")
        .select("tenant_id")
        .eq("status", "connected")
        .range(offset, offset + BATCH_PAGE_SIZE - 1);

      if (error || !accounts || accounts.length === 0) {
        hasMore = false;
        break;
      }

      const tenantIds = Array.from(new Set(accounts.map((a) => a.tenant_id)));

      if (tenantIds.length > 0) {
        const events = tenantIds.map((tenantId) => ({
          name: "meli/tenant.sync-products.requested" as any,
          data: { tenantId, source: "cron_dispatcher" },
        }));

        await step.sendEvent(`dispatch-products-batch-${offset}`, events);
        totalDispatched += tenantIds.length;
      }

      if (accounts.length < BATCH_PAGE_SIZE) {
        hasMore = false;
      } else {
        offset += BATCH_PAGE_SIZE;
      }
    }

    return { dispatched: totalDispatched };
  }
);

/**
 * Inngest Per-Tenant Product Sync Worker:
 * - Concurrency limit 1 per tenant
 * - Distributed lease protection against concurrent cron/webhook execution
 * - Individual error handling and retry support
 */
export const syncProductsTenantJob = inngest.createFunction(
  {
    id: "sync-products-tenant-worker",
    triggers: [
      { event: "meli/tenant.sync-products.requested" as any },
      { event: "meli/items.updated" as any },
    ],
    retries: 3,
    concurrency: {
      key: "event.data.tenantId",
      limit: 1,
    },
  },
  async ({ event, step }) => {
    const tenantId = event.data?.tenantId;
    if (!tenantId) {
      return { status: "ignored", reason: "missing_tenant_id" };
    }

    const workerId = `sync-products-${tenantId}-${Date.now()}`;

    return await step.run("execute-tenant-products-sync", async () => {
      const leaseResult = await withOperationLease(
        {
          tenantId,
          operationType: "sync_products",
          leaseOwner: workerId,
          ttlSeconds: 300,
        },
        async () => {
          logger.info({
            event: "SYNC_PRODUCTS_TENANT_STARTED",
            tenantId,
            source: event.data?.source || event.name,
          });

          const syncedCount = await syncProducts(tenantId);
          return { tenantId, status: "completed", syncedCount };
        }
      );

      if (!leaseResult.executed) {
        logger.info({
          event: "SYNC_PRODUCTS_TENANT_SKIPPED_ACTIVE_LEASE",
          tenantId,
          reason: leaseResult.skipReason,
        });
        return { tenantId, status: "skipped", reason: leaseResult.skipReason };
      }

      return leaseResult.result;
    });
  }
);
