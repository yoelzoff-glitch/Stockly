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

    // Explicit 7-day deep historical window
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const deepDateFrom = sevenDaysAgo.toISOString();

    for (const tenantId of tenantIds) {
      await step.run(`deep-reconcile-orders-${tenantId}`, async () => {
        try {
          const { syncOrders } = await import("@/services/meli/syncOrders");
          logger.info({
            event: "DEEP_ORDERS_RECONCILIATION_STARTED",
            tenantId,
            deepDateFrom,
          });
          await syncOrders(tenantId, undefined, deepDateFrom, { source: "cron_deep" });
          reconciledCount++;
        } catch (err: any) {
          logger.error({
            event: "DEEP_ORDERS_RECONCILIATION_FAILED",
            tenantId,
            error: err?.message,
          });
        }
      });
    }

    return { reconciled: reconciledCount };
  }
);

