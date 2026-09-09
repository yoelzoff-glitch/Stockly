import { inngest } from "../inngest/client";
import { syncProducts } from "../services/meli/syncProducts";
import { createAdminClient } from "@/lib/supabase/admin";
import { withOperationLease } from "@/lib/security/leases";
import { logger } from "@/lib/errors/logger";
import { isDemoTenant } from "@/lib/demo/assert-demo-write-allowed";

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
    onFailure: async ({ event, error }: { event: any; error: any }) => {
      const tenantId = (event?.data?.event?.data as any)?.tenantId;
      if (!tenantId) return;

      try {
        const { upsertStateAlert } = await import("@/services/notifications/notificationService");
        await upsertStateAlert({
          tenantId,
          type: "sync_failed",
          severity: "warning",
          title: "No pudimos actualizar los datos de Mercado Libre",
          body: `LibretaX agotó los reintentos automáticos. Error: ${error?.message || "Fallo de conexión"}`,
          actionUrl: "/dashboard/integrations",
          actionLabel: "Revisar integración",
          entityType: "integration",
          dedupeKey: `tenant:${tenantId}:state:sync_failed:sync_products`,
          count: 1,
          metadata: {
            last_error: error?.message,
            last_attempt: new Date().toISOString(),
          },
        });
      } catch (alertErr: any) {
        console.error("Failed to create sync_failed alert on failure:", alertErr.message);
      }
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
        operation: "sync_products",
        message: "Skipping sync products worker for demo tenant",
      });
      return { skipped: true, reason: "demo_tenant" };
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

          // Resolve sync_failed alert on success
          try {
            const { upsertStateAlert } = await import("@/services/notifications/notificationService");
            await upsertStateAlert({
              tenantId,
              type: "sync_failed",
              title: "No pudimos actualizar los datos de Mercado Libre",
              body: "LibretaX agotó los reintentos automáticos.",
              actionUrl: "/dashboard/integrations",
              actionLabel: "Revisar integración",
              dedupeKey: `tenant:${tenantId}:state:sync_failed:sync_products`,
              count: 0,
            });
          } catch (e: any) {
            console.error("Failed to auto-resolve sync_failed alert:", e.message);
          }

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
