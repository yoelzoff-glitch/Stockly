import { inngest } from "../inngest/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncShipments } from "@/services/meli/syncShipments";
import { syncCancellations } from "@/services/meli/syncCancellations";
import { logger } from "@/lib/errors/logger";

const BATCH_PAGE_SIZE = 50;

/**
 * Background safety reconciliation for Shipments: Runs every 2 hours
 */
export const reconcileShipmentsDispatcherJob = inngest.createFunction(
  {
    id: "reconcile-shipments-dispatcher",
    triggers: [{ cron: "0 */2 * * *" }],
  },
  async ({ step }) => {
    const supabase = createAdminClient();
    const { data: accounts, error } = await supabase
      .from("meli_accounts")
      .select("tenant_id, tenants!inner(is_demo)")
      .eq("status", "connected")
      .eq("tenants.is_demo", false)
      .limit(BATCH_PAGE_SIZE);

    if (error || !accounts || accounts.length === 0) {
      return { reconciled: 0 };
    }

    const tenantIds = Array.from(new Set(accounts.map((a: any) => a.tenant_id)));
    let reconciledCount = 0;

    for (const tenantId of tenantIds) {
      await step.run(`reconcile-shipments-${tenantId}`, async () => {
        try {
          logger.info({
            event: "RECONCILE_SHIPMENTS_STARTED",
            tenantId,
          });
          await syncShipments(tenantId, undefined, { source: "cron_incremental" });
          reconciledCount++;
        } catch (err: any) {
          logger.error({
            event: "RECONCILE_SHIPMENTS_FAILED",
            tenantId,
            error: err?.message,
          });
        }
      });
    }

    return { reconciled: reconciledCount };
  }
);

/**
 * Background safety reconciliation for Cancellations: Runs every 60 minutes
 */
export const reconcileCancellationsDispatcherJob = inngest.createFunction(
  {
    id: "reconcile-cancellations-dispatcher",
    triggers: [{ cron: "0 * * * *" }],
  },
  async ({ step }) => {
    const supabase = createAdminClient();
    const { data: accounts, error } = await supabase
      .from("meli_accounts")
      .select("tenant_id, tenants!inner(is_demo)")
      .eq("status", "connected")
      .eq("tenants.is_demo", false)
      .limit(BATCH_PAGE_SIZE);

    if (error || !accounts || accounts.length === 0) {
      return { reconciled: 0 };
    }

    const tenantIds = Array.from(new Set(accounts.map((a: any) => a.tenant_id)));
    let reconciledCount = 0;

    for (const tenantId of tenantIds) {
      await step.run(`reconcile-cancellations-${tenantId}`, async () => {
        try {
          logger.info({
            event: "RECONCILE_CANCELLATIONS_STARTED",
            tenantId,
          });
          await syncCancellations(tenantId, { source: "cron_incremental" });
          reconciledCount++;
        } catch (err: any) {
          logger.error({
            event: "RECONCILE_CANCELLATIONS_FAILED",
            tenantId,
            error: err?.message,
          });
        }
      });
    }

    return { reconciled: reconciledCount };
  }
);

/**
 * Sprint 40 Phase 5: Deep Safety Reconciliation for Orders: Runs every 4 hours (7-day historical window)
 */
export const reconcileOrdersDeepDispatcherJob = inngest.createFunction(
  {
    id: "orders-deep-reconciliation",
    triggers: [{ cron: "0 */4 * * *" }],
  },
  async ({ step }) => {
    const isDeepEnabled = process.env.LIBRETAX_DEEP_ORDER_RECONCILIATION !== "false";
    if (!isDeepEnabled) {
      return { status: "skipped", reason: "deep_reconciliation_disabled" };
    }

    const supabase = createAdminClient();
    let dispatched = 0;
    for (let offset = 0; ; offset += BATCH_PAGE_SIZE) {
      const { data: accounts, error } = await supabase.from("meli_accounts")
        .select("tenant_id, tenants!inner(is_demo)").eq("status", "connected")
        .eq("tenants.is_demo", false).order("tenant_id")
        .range(offset, offset + BATCH_PAGE_SIZE - 1);
      if (error) throw new Error(error.message);
      if (!accounts?.length) break;
      const tenantIds = [...new Set(accounts.map(a => a.tenant_id))];
      await step.sendEvent(`deep-orders-${offset}`, tenantIds.map(tenantId => ({
        name: "meli/orders.repair.requested" as any,
        data: { tenantId, dateFrom: new Date(Date.now() - 7 * 86400000).toISOString(), source: "cron_deep" },
      })));
      dispatched += tenantIds.length;
      if (accounts.length < BATCH_PAGE_SIZE) break;
    }
    return { dispatched };
  }
);
