import { inngest } from "../inngest/client";
import { syncOrders } from "../services/meli/syncOrders";
import { createAdminClient } from "@/lib/supabase/admin";
import { withOperationLease } from "@/lib/security/leases";
import { logger } from "@/lib/errors/logger";
import { isDemoTenant } from "@/lib/demo/assert-demo-write-allowed";

const BATCH_PAGE_SIZE = 50;

/**
 * Inngest Cron Dispatcher: Paginates active connected tenants and dispatches individual Inngest events.
 * Eliminates serverless timeout and unconstrained Promise.all execution.
 */
export const syncOrdersDispatcherJob = inngest.createFunction(
  {
    id: "sync-orders-dispatcher",
    triggers: [{ cron: "*/5 * * * *" }],
  },
  async ({ step }) => {
    const supabase = createAdminClient();
    let offset = 0;
    let hasMore = true;
    let totalDispatched = 0;

    while (hasMore) {
      const { data: accounts, error } = await supabase
        .from("meli_accounts")
        .select("tenant_id, tenants!inner(is_demo)")
        .eq("status", "connected")
        .eq("tenants.is_demo", false)
        .range(offset, offset + BATCH_PAGE_SIZE - 1);

      if (error || !accounts || accounts.length === 0) {
        hasMore = false;
        break;
      }

      const tenantIds = Array.from(new Set(accounts.map((a) => a.tenant_id)));

      if (tenantIds.length > 0) {
        const events = tenantIds.map((tenantId) => ({
          name: "meli/tenant.sync-orders.requested" as any,
          data: { tenantId, source: "cron_dispatcher" },
        }));

        await step.sendEvent(`dispatch-orders-batch-${offset}`, events);
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
 * Inngest Per-Tenant Sync Worker:
 * - Concurrency limit of 1 per tenant
 * - Distributed lease protection to prevent overlap between webhook, cron and manual sync
 * - Errors isolated to the specific tenant and re-thrown for Inngest retry handling
 */
export const syncOrdersTenantJob = inngest.createFunction(
  {
    id: "sync-orders-tenant-worker",
    triggers: [
      { event: "meli/tenant.sync-orders.requested" as any },
      { event: "meli/orders.updated" as any },
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

    if (await isDemoTenant(tenantId)) {
      logger.info({
        event: "DEMO_TENANT_SKIPPED_EXTERNAL_OPERATION",
        tenantId,
        operation: "sync_orders",
        message: "Skipping sync orders worker for demo tenant",
      });
      return { skipped: true, reason: "demo_tenant" };
    }

    const resource = event.data?.resource;
    const specificOrderId = resource ? resource.split("/").pop() : undefined;
    const workerId = `sync-orders-${tenantId}-${Date.now()}`;

    return await step.run("execute-tenant-orders-sync", async () => {
      const leaseResult = await withOperationLease(
        {
          tenantId,
          operationType: "sync_orders",
          leaseOwner: workerId,
          ttlSeconds: 180,
        },
        async () => {
          logger.info({
            event: "SYNC_ORDERS_TENANT_STARTED",
            tenantId,
            specificOrderId,
            source: event.data?.source || event.name,
          });

          const syncedCount = await syncOrders(tenantId, specificOrderId);
          return { tenantId, status: "completed", syncedCount };
        }
      );

      if (!leaseResult.executed) {
        logger.info({
          event: "SYNC_ORDERS_TENANT_SKIPPED_ACTIVE_LEASE",
          tenantId,
          reason: leaseResult.skipReason,
        });
        return { tenantId, status: "skipped", reason: leaseResult.skipReason };
      }

      return leaseResult.result;
    });
  }
);
