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
    // Sprint 40 Phase 8: Product cron reduced mode (hourly instead of every 15 min)
    const reconciliationMode = process.env.LIBRETAX_PRODUCTS_RECONCILIATION_MODE || "reduced";
    if (reconciliationMode === "reduced") {
      const currentMinute = new Date().getUTCMinutes();
      if (currentMinute % 60 !== 0) {
        logger.info({
          event: "SYNC_PRODUCTS_DISPATCHER_SKIPPED_REDUCED_MODE",
          currentMinute,
          mode: "reduced",
          message: "Skipping product cron in reduced mode (runs hourly at 00)",
        });
        return { status: "skipped", reason: "reduced_mode_hourly_skip" };
      }
    }

    const supabase = createAdminClient();
    let offset = 0;
    let hasMore = true;
    let totalDispatched = 0;

    const { shouldSkipProductCron } = await import("@/services/meli/productCoalescer");

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

      // Sprint 40 Phase 9: Lightweight dirty check per tenant
      const activeTenants: string[] = [];
      for (const tId of tenantIds) {
        const check = await shouldSkipProductCron(tId);
        if (check.skip) {
          logger.info({
            event: "SYNC_PRODUCTS_DISPATCHER_TENANT_SKIPPED_CLEAN",
            tenantId: tId,
            reason: check.reason,
          });
          const { recordSyncExecution } = await import("@/lib/observability/operationRuns");
          await recordSyncExecution({
            tenantId: tId,
            operationType: "sync_products",
            source: "cron_incremental",
            status: "skipped",
            skipReason: check.reason,
          });
        } else {
          activeTenants.push(tId);
        }
      }

      if (activeTenants.length > 0) {
        const events = activeTenants.map((tenantId) => ({
          name: "meli/tenant.sync-products.requested" as any,
          data: { tenantId, source: "cron_dispatcher" },
        }));

        await step.sendEvent(`dispatch-products-batch-${offset}`, events);
        totalDispatched += activeTenants.length;
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

    // Requirement 14: Check subscription status before executing heavy work
    const supabase = createAdminClient();
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("status")
      .eq("tenant_id", tenantId)
      .in("status", ["active", "trialing", "past_due", "paused", "cancelled", "expired"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (sub && (sub.status === "paused" || sub.status === "cancelled" || sub.status === "expired")) {
      logger.info({
        event: "SUBSCRIPTION_INACTIVE_SKIPPED",
        tenantId,
        status: sub.status,
        operation: "sync_products",
        message: "Skipping sync products for inactive/paused tenant",
      });
      return { status: "skipped", reason: "skipped_subscription_inactive" };
    }

    // Sprint 40 Phase 6 & 7: Webhook Coalescing for meli/items.updated
    const isWebhook = event.name === "meli/items.updated" || event.data?.source === "webhook";
    const isCoalescingEnabled = process.env.LIBRETAX_PRODUCT_WEBHOOK_COALESCING !== "false";

    if (isWebhook && isCoalescingEnabled) {
      const { recordProductItemWebhook } = await import("@/services/meli/productCoalescer");
      const decision = await recordProductItemWebhook(tenantId);
      if (!decision.shouldSchedule) {
        return { status: "coalesced", reason: decision.reason, tenantId };
      }
      // Wait for burst events to settle (45s coalescing window)
      await step.sleep("wait-coalescing-window", "45s");
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
          const rawSource = event.data?.source || event.name;
          const source = rawSource === "cron_dispatcher" || rawSource === "cron"
            ? "cron"
            : event.name === "meli/items.updated" || rawSource === "webhook"
            ? "webhook"
            : "manual";

          logger.info({
            event: "SYNC_PRODUCTS_TENANT_STARTED",
            tenantId,
            source,
          });

          const { markProductSyncStarted, markProductSyncFinished } = await import("@/services/meli/productCoalescer");
          await markProductSyncStarted(tenantId);

          const syncSource = isWebhook ? "webhook" : "cron_incremental";
          let syncedCount = await syncProducts(tenantId, { source: syncSource });

          // If new items arrived during sync execution, perform a second pass so no updates are lost
          const hasPending = await markProductSyncFinished(tenantId);
          if (hasPending) {
            logger.info({
              event: "SYNC_PRODUCTS_SECOND_PASS_TRIGGERED",
              tenantId,
              message: "Additional item webhooks arrived during sync; running second pass",
            });
            await markProductSyncStarted(tenantId);
            const secondCount = await syncProducts(tenantId, { source: syncSource });
            syncedCount += secondCount;
            await markProductSyncFinished(tenantId);
          }

          logger.info({
            event: "SYNC_PRODUCTS_EXECUTION",
            tenantId,
            source,
            syncedCount,
          });

          try {
            const { recordMlSyncActivity } = await import("@/services/super-admin/activity");
            await recordMlSyncActivity(tenantId);
          } catch {}

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
