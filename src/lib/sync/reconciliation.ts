import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/errors/logger";

export interface TenantSyncHealthReport {
  tenantId: string;
  accountStatus: string;
  tokenExpired: boolean;
  tokenExpiresAt: string | null;
  lastSuccessfulSync: string | null;
  lastFailedSync: {
    at: string;
    errorCode: string | null;
    errorMessage: string | null;
  } | null;
  lastOrderDate: string | null;
  lastProductDate: string | null;
  activeLeases: Array<{
    operationType: string;
    leaseOwner: string;
    expiresAt: string;
    isExpired: boolean;
  }>;
  webhookQueueStats: {
    received: number;
    processing: number;
    retrying: number;
    completed: number;
    ignored: number;
    dead_letter: number;
  };
  hasDiscrepancies: boolean;
  discrepancies: string[];
}

/**
 * Backend-only, read-only diagnostic reconciliation function.
 * Detects sync drift, zombie leases, dead-letter events, and token expiration without modifying data.
 */
export async function reconcileTenantSyncState(tenantId: string, customClient?: any): Promise<TenantSyncHealthReport> {
  const supabase = customClient || createAdminClient();
  const discrepancies: string[] = [];

  // 1. Fetch Mercado Libre Account Status
  const { data: account } = await supabase
    .from("meli_accounts")
    .select("status, token_expires_at, updated_at")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  const accountStatus = account?.status || "disconnected";
  const tokenExpiresAt = account?.token_expires_at || null;
  const tokenExpired = tokenExpiresAt ? new Date(tokenExpiresAt) <= new Date() : false;

  if (tokenExpired && accountStatus === "connected") {
    discrepancies.push("ACCOUNT_CONNECTED_BUT_TOKEN_EXPIRED");
  }

  // 2. Fetch Last Operation Runs
  const { data: runs } = await supabase
    .from("operation_runs")
    .select("operation_type, status, started_at, completed_at, error_code, error_message, metadata")
    .eq("tenant_id", tenantId)
    .order("started_at", { ascending: false })
    .limit(20);

  const lastSuccess = runs?.find((r: any) => r.status === "completed")?.completed_at || null;
  const lastFailedRun = runs?.find((r: any) => r.status === "failed");
  const lastFailedSync = lastFailedRun
    ? {
        at: lastFailedRun.started_at,
        errorCode: lastFailedRun.error_code,
        errorMessage: lastFailedRun.error_message,
      }
    : null;

  // 3. Fetch Most Recent Order and Product Sync Timestamps
  const { data: lastOrder } = await supabase
    .from("orders")
    .select("date_created")
    .eq("tenant_id", tenantId)
    .order("date_created", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: lastProduct } = await supabase
    .from("products")
    .select("updated_at")
    .eq("tenant_id", tenantId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // 4. Fetch Active Leases
  const { data: leases } = await supabase
    .from("operation_leases")
    .select("operation_type, lease_owner, expires_at")
    .eq("tenant_id", tenantId);

  const now = new Date();
  const activeLeases = (leases || []).map((l: any) => ({
    operationType: l.operation_type,
    leaseOwner: l.lease_owner,
    expiresAt: l.expires_at,
    isExpired: new Date(l.expires_at) <= now,
  }));

  const zombieLeaseCount = activeLeases.filter((l: any) => l.isExpired).length;
  if (zombieLeaseCount > 0) {
    discrepancies.push(`ZOMBIE_LEASES_DETECTED (${zombieLeaseCount})`);
  }

  // 5. Fetch Webhook Queue Stats
  const { data: webhooks } = await supabase
    .from("webhook_events")
    .select("status")
    .eq("tenant_id", tenantId);

  const webhookQueueStats = {
    received: 0,
    processing: 0,
    retrying: 0,
    completed: 0,
    ignored: 0,
    dead_letter: 0,
  };

  for (const wh of webhooks || []) {
    if (wh.status in webhookQueueStats) {
      webhookQueueStats[wh.status as keyof typeof webhookQueueStats]++;
    }
  }

  if (webhookQueueStats.dead_letter > 0) {
    discrepancies.push(`DEAD_LETTER_WEBHOOKS_PRESENT (${webhookQueueStats.dead_letter})`);
  }

  const report: TenantSyncHealthReport = {
    tenantId,
    accountStatus,
    tokenExpired,
    tokenExpiresAt,
    lastSuccessfulSync: lastSuccess,
    lastFailedSync,
    lastOrderDate: lastOrder?.date_created || null,
    lastProductDate: lastProduct?.updated_at || null,
    activeLeases,
    webhookQueueStats,
    hasDiscrepancies: discrepancies.length > 0,
    discrepancies,
  };

  logger.info({
    event: "RECONCILIATION_REPORT_GENERATED",
    tenantId,
    hasDiscrepancies: report.hasDiscrepancies,
    discrepanciesCount: discrepancies.length,
  });

  return report;
}

export interface ReconcileOrdersParams {
  tenantId: string;
  from: string;
  to: string;
}

/**
 * PARTE 13: Reconciliación manual de emergencia acotada.
 * Requiere explícitamente una ventana temporal (from y to).
 * Nunca permite recorrer todo el histórico sin parámetros.
 */
export async function reconcileOrders({ tenantId, from, to }: ReconcileOrdersParams): Promise<number> {
  if (!tenantId) throw new Error("tenantId is required for manual order reconciliation");
  if (!from || !to) throw new Error("Explicit 'from' and 'to' ISO timestamps are required for order reconciliation");

  const fromTime = new Date(from).getTime();
  const toTime = new Date(to).getTime();

  if (isNaN(fromTime) || isNaN(toTime)) {
    throw new Error("Invalid date format provided for 'from' or 'to'");
  }

  if (fromTime >= toTime) {
    throw new Error("'from' timestamp must be strictly earlier than 'to' timestamp");
  }

  // Safety guardrail: maximum 30 days window per execution
  const MAX_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
  if (toTime - fromTime > MAX_WINDOW_MS) {
    throw new Error("Reconciliation window cannot exceed 30 days to protect egress");
  }

  const { syncOrders } = await import("@/services/meli/syncOrders");
  return await syncOrders(tenantId, undefined, from, { source: "manual" });
}

