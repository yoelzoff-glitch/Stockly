import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/errors/logger";

export interface AcquireLeaseParams {
  tenantId: string;
  operationType: string;
  leaseOwner: string;
  ttlSeconds?: number;
}

export interface AcquireLeaseResult {
  acquired: boolean;
  reason?: string;
  currentOwner?: string;
  expiresAt?: string;
}

/**
 * Atomically acquires a distributed lease for a (tenant_id, operation_type).
 * Prevents overlapping cron, webhook, or manual sync operations for the same tenant.
 */
export async function acquireOperationLease(
  params: AcquireLeaseParams,
  customClient?: any
): Promise<AcquireLeaseResult> {
  const supabase = customClient || createAdminClient();
  const ttl = params.ttlSeconds || 300;

  try {
    const { data, error } = await supabase.rpc("acquire_operation_lease", {
      p_tenant_id: params.tenantId,
      p_operation_type: params.operationType,
      p_lease_owner: params.leaseOwner,
      p_ttl_seconds: ttl,
    });

    if (error) {
      logger.error({
        event: "OPERATION_LEASE_ACQUIRE_ERROR",
        tenantId: params.tenantId,
        operationType: params.operationType,
        leaseOwner: params.leaseOwner,
        error: error.message,
      });
      return { acquired: false, reason: "rpc_error" };
    }

    return {
      acquired: Boolean(data?.acquired),
      reason: data?.reason,
      currentOwner: data?.current_owner,
      expiresAt: data?.expires_at,
    };
  } catch (err: any) {
    logger.error({
      event: "OPERATION_LEASE_ACQUIRE_EXCEPTION",
      tenantId: params.tenantId,
      operationType: params.operationType,
      error: err?.message,
    });
    return { acquired: false, reason: "exception" };
  }
}

/**
 * Renews an existing lease, extending its expiration.
 */
export async function renewOperationLease(
  params: { tenantId: string; operationType: string; leaseOwner: string; ttlSeconds?: number },
  customClient?: any
): Promise<boolean> {
  const supabase = customClient || createAdminClient();
  const ttl = params.ttlSeconds || 300;

  try {
    const { data, error } = await supabase.rpc("renew_operation_lease", {
      p_tenant_id: params.tenantId,
      p_operation_type: params.operationType,
      p_lease_owner: params.leaseOwner,
      p_ttl_seconds: ttl,
    });

    if (error) return false;
    return Boolean(data?.renewed);
  } catch {
    return false;
  }
}

/**
 * Releases a distributed lease once an operation has completed or failed.
 */
export async function releaseOperationLease(
  params: { tenantId: string; operationType: string; leaseOwner: string },
  customClient?: any
): Promise<boolean> {
  const supabase = customClient || createAdminClient();

  try {
    const { data, error } = await supabase.rpc("release_operation_lease", {
      p_tenant_id: params.tenantId,
      p_operation_type: params.operationType,
      p_lease_owner: params.leaseOwner,
    });

    if (error) return false;
    return Boolean(data?.released);
  } catch {
    return false;
  }
}

/**
 * Higher-order helper to safely execute an asynchronous job with a distributed lease.
 */
export async function withOperationLease<T>(
  params: AcquireLeaseParams,
  fn: () => Promise<T>,
  customClient?: any
): Promise<{ executed: boolean; result?: T; skipReason?: string }> {
  const lease = await acquireOperationLease(params, customClient);
  if (!lease.acquired) {
    logger.info({
      event: "OPERATION_LEASE_SKIPPED_ACTIVE_LEASE",
      tenantId: params.tenantId,
      operationType: params.operationType,
      heldBy: lease.currentOwner,
      expiresAt: lease.expiresAt,
    });
    return { executed: false, skipReason: lease.reason || "lease_held_by_other" };
  }

  try {
    const result = await fn();
    return { executed: true, result };
  } finally {
    await releaseOperationLease(
      {
        tenantId: params.tenantId,
        operationType: params.operationType,
        leaseOwner: params.leaseOwner,
      },
      customClient
    );
  }
}
