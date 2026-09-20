import { RetryAfterError } from "inngest";
import { inngest } from "@/inngest/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { isDemoTenant } from "@/lib/demo/assert-demo-write-allowed";
import { withOperationLease } from "@/lib/security/leases";
import { getOrders } from "@/services/meli/getOrders";
import { syncOrders } from "@/services/meli/syncOrders";

const REPAIR_RESOURCE = "orders_shipments_repair_v41";

// Separate function/steps: historical repair must not occupy the live sales
// worker's concurrency slot or repeat the entire history on a single failure.
export const repairOrdersJob = inngest.createFunction({
  id: "orders-history-recovery",
  triggers: [{ event: "meli/orders.repair.requested" as any }],
  retries: 6,
  concurrency: { key: "event.data.tenantId", limit: 1 },
}, async ({ event, step }) => {
  const { tenantId, dateFrom, repair } = event.data;
  if (!tenantId || !dateFrom || !Number.isFinite(Date.parse(dateFrom))) throw new Error("Invalid order recovery request");
  const supabase = createAdminClient();
  const allowed = await step.run("check-recovery", async () => {
    if (await isDemoTenant(tenantId)) return false;
    const { data: sub, error } = await supabase.from("subscriptions").select("status")
      .eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (error) throw new Error(error.message);
    if (sub && ["paused", "cancelled", "expired"].includes(sub.status)) return false;
    if (repair) {
      const { data, error: stateError } = await supabase.from("meli_sync_state").select("tenant_id")
        .eq("tenant_id", tenantId).eq("resource_type", REPAIR_RESOURCE).maybeSingle();
      if (stateError) throw new Error(stateError.message);
      if (data) return false;
    }
    return true;
  });
  if (!allowed) return { skipped: true };

  const orderIds = await step.run("discover-orders", async () => {
    const { data: account, error } = await supabase.from("meli_accounts").select("meli_user_id")
      .eq("tenant_id", tenantId).eq("status", "connected").single();
    if (error || !account) throw new Error(error?.message || "ML account not connected");
    const orders = await getOrders(tenantId, account.meli_user_id, dateFrom);
    return [...new Set(orders.map(o => String(o.id)))];
  });

  for (const orderId of orderIds) {
    await step.run(`recover-order-${orderId}`, async () => {
      const lease = await withOperationLease({
        tenantId, operationType: "sync_orders",
        leaseOwner: `repair-${tenantId}-${orderId}-${Date.now()}`, ttlSeconds: 180,
      }, () => syncOrders(tenantId, orderId, undefined, { source: "cron_deep" }));
      if (!lease.executed) throw new RetryAfterError("Live orders sync holds the lease", "30s");
    });
  }
  if (repair) await step.run("complete-recovery", async () => {
    const now = new Date().toISOString();
    const { error } = await supabase.from("meli_sync_state").upsert({
      tenant_id: tenantId, resource_type: REPAIR_RESOURCE,
      last_successful_sync_at: now, updated_at: now,
    }, { onConflict: "tenant_id,resource_type" });
    if (error) throw new Error(error.message);
  });
  return { recovered: orderIds.length };
});
