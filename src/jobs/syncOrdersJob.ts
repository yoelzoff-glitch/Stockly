import { inngest } from "../inngest/client";
import { syncOrders } from "../services/meli/syncOrders";
import { createAdminClient } from "@/lib/supabase/admin";
import { withOperationLease } from "@/lib/security/leases";
import { logger } from "@/lib/errors/logger";
import { isDemoTenant } from "@/lib/demo/assert-demo-write-allowed";

import { RetryAfterError } from "inngest";
import { updateWebhookEventStatus } from "@/lib/security/idempotency";

const BATCH_PAGE_SIZE = 50;
const REPAIR_RESOURCE = "orders_shipments_repair_v41";

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
    // Five-minute incremental safety net. Never gate on wall-clock minutes:
    // delayed Inngest delivery must still execute the scheduled reconciliation.
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
        .order("tenant_id")
        .range(offset, offset + BATCH_PAGE_SIZE - 1);

      if (error) throw new Error(`Failed to list ML accounts: ${error.message}`);
      if (!accounts || accounts.length === 0) {
        hasMore = false;
        break;
      }

      const tenantIds = Array.from(new Set(accounts.map((a) => a.tenant_id)));

      if (tenantIds.length > 0) {
        // One-time bounded recovery for missing sales/shipments from Sprint 40.
        // The marker is written by the worker only after orders + shipments succeed.
        const { data: repairs, error: repairError } = await supabase
          .from("meli_sync_state").select("tenant_id")
          .eq("resource_type", REPAIR_RESOURCE).in("tenant_id", tenantIds);
        if (repairError) throw new Error(`Failed to read repair state: ${repairError.message}`);
        const repaired = new Set((repairs || []).map(r => r.tenant_id));
        const repairFrom = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        // Health check: check orders watermark lag for each tenant
        const { data: orderSyncStates } = await supabase
          .from("meli_sync_state")
          .select("tenant_id, last_successful_sync_at")
          .eq("resource_type", "orders")
          .in("tenant_id", tenantIds);

        const orderSyncMap = new Map<string, string | null>();
        (orderSyncStates || []).forEach((s) => orderSyncMap.set(s.tenant_id, s.last_successful_sync_at));

        const now = Date.now();
        const events = [];

        for (const tenantId of tenantIds) {
          const lastSuccess = orderSyncMap.get(tenantId);
          const lagMinutes = lastSuccess ? (now - new Date(lastSuccess).getTime()) / (1000 * 60) : 999;
          const correlationId = `cron-sync-${tenantId}-${now}`;

          if (lagMinutes > 15) {
            // Watermark lag > 15 minutes while account is connected: trigger incremental repair
            logger.warn({
              event: "ORDERS_WATERMARK_LAG_DETECTED",
              tenantId,
              lagMinutes: Math.round(lagMinutes),
              correlationId,
              stage: "health_check_dispatcher",
            });

            events.push({
              name: "meli/tenant.sync-orders.requested" as any,
              data: {
                tenantId,
                source: "health_check_repair",
                correlationId,
                lagMinutes: Math.round(lagMinutes),
              },
            });

            // If lag persists beyond 45 minutes, raise an operational alert
            if (lagMinutes > 45) {
              try {
                const { upsertStateAlert } = await import("@/services/notifications/notificationService");
                await upsertStateAlert({
                  tenantId,
                  type: "sync_failed",
                  severity: "warning",
                  title: "Sincronización de ventas demorada",
                  body: `La sincronización de órdenes tiene un atraso de más de ${Math.round(lagMinutes)} minutos. Se activó la recuperación automática.`,
                  actionUrl: "/dashboard/integrations",
                  actionLabel: "Revisar integración",
                  entityType: "integration",
                  dedupeKey: `tenant:${tenantId}:state:sync_lag_alert`,
                  count: 1,
                  metadata: {
                    lag_minutes: Math.round(lagMinutes),
                    stage: "health_check_dispatcher",
                    correlation_id: correlationId,
                  },
                });
              } catch (alertErr: any) {
                logger.error({
                  event: "ORDERS_WATERMARK_LAG_ALERT_FAILED",
                  tenantId,
                  error: alertErr?.message,
                });
              }
            }
          } else {
            // Normal 5-minute incremental reconciliation
            events.push({
              name: "meli/tenant.sync-orders.requested" as any,
              data: {
                tenantId,
                source: "cron_dispatcher",
                correlationId,
              },
            });

            // Auto-resolve lag alert when lag is healthy
            try {
              const { upsertStateAlert } = await import("@/services/notifications/notificationService");
              await upsertStateAlert({
                tenantId,
                type: "sync_failed",
                title: "Sincronización de ventas demorada",
                body: "Sincronización normalizada.",
                actionUrl: "/dashboard/integrations",
                actionLabel: "Revisar integración",
                entityType: "integration",
                dedupeKey: `tenant:${tenantId}:state:sync_lag_alert`,
                count: 0,
              });
            } catch {}
          }
        }

        await step.sendEvent(`dispatch-orders-batch-${offset}`, events);
        totalDispatched += tenantIds.length;
        const repairEvents = tenantIds.filter(id => !repaired.has(id)).map(tenantId => ({
          name: "meli/orders.repair.requested" as any,
          data: { tenantId, source: "sprint41_repair", dateFrom: repairFrom, repair: true },
        }));
        if (repairEvents.length) await step.sendEvent(`repair-orders-batch-${offset}`, repairEvents);
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
    retries: 6,
    concurrency: {
      key: "event.data.tenantId",
      limit: 1,
    },
    onFailure: async ({ event, error }: { event: any; error: any }) => {
      const originalData = event?.data?.event?.data as any;
      const tenantId = originalData?.tenantId;
      if (!tenantId) return;
      if (originalData?.eventId) await updateWebhookEventStatus(originalData.eventId, "dead_letter", {
        lastErrorCode: "SYNC_ORDERS_RETRIES_EXHAUSTED", lastErrorMessage: error?.message,
      });

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
          dedupeKey: `tenant:${tenantId}:state:sync_failed:sync_orders`,
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
    const eventId = event.data?.eventId;
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
      if (eventId) await updateWebhookEventStatus(eventId, "ignored");
      return { skipped: true, reason: "demo_tenant" };
    }

    // Requirement 14: Check subscription status before executing heavy work
    const supabase = createAdminClient();
    const { data: sub, error: subscriptionError } = await supabase
      .from("subscriptions")
      .select("status")
      .eq("tenant_id", tenantId)
      .in("status", ["active", "trialing", "past_due", "paused", "cancelled", "expired"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subscriptionError) throw new Error(subscriptionError.message);

    if (sub && (sub.status === "paused" || sub.status === "cancelled" || sub.status === "expired")) {
      logger.info({
        event: "SUBSCRIPTION_INACTIVE_SKIPPED",
        tenantId,
        status: sub.status,
        operation: "sync_orders",
        message: "Skipping sync orders for inactive/paused tenant",
      });
      if (eventId) await updateWebhookEventStatus(eventId, "ignored");
      return { status: "skipped", reason: "skipped_subscription_inactive" };
    }

    const resource = event.data?.resource;
    const specificOrderId = resource ? resource.split("/").pop() : undefined;
    const workerId = `sync-orders-${tenantId}-${Date.now()}`;

    return await step.run("execute-tenant-orders-sync", async () => {
      if (eventId) await updateWebhookEventStatus(eventId, "processing");
      try {
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

            const syncedCount = await syncOrders(tenantId, specificOrderId, undefined, {
              correlationId: event.data?.correlationId,
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
                dedupeKey: `tenant:${tenantId}:state:sync_failed:sync_orders`,
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
            event: "SYNC_ORDERS_TENANT_SKIPPED_ACTIVE_LEASE",
            tenantId,
            reason: leaseResult.skipReason,
          });
          throw new RetryAfterError(`Orders lease unavailable: ${leaseResult.skipReason}`, "30s");
        }

        if (eventId) await updateWebhookEventStatus(eventId, "completed");
        return leaseResult.result;
      } catch (error: any) {
        if (eventId) await updateWebhookEventStatus(eventId, "retrying", {
          lastErrorCode: "SYNC_ORDERS_FAILED", lastErrorMessage: error?.message, incrementAttempts: true,
        });
        throw new RetryAfterError(error?.message || "Orders sync failed", "30s", { cause: error });
      }
    });
  }
);
