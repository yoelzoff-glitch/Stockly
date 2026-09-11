import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/errors/logger";

export interface LogAuditParams {
  actorUserId: string;
  action: string;
  targetTenantId?: string | null;
  targetSubscriptionId?: string | null;
  metadata?: Record<string, any>;
}

/**
 * Records an immutable platform admin audit log entry.
 */
export async function logPlatformAdminAction({
  actorUserId,
  action,
  targetTenantId,
  targetSubscriptionId,
  metadata = {},
}: LogAuditParams): Promise<void> {
  try {
    const adminDb = createAdminClient();
    const { error } = await adminDb.from("platform_admin_audit_log").insert({
      actor_user_id: actorUserId,
      action,
      target_tenant_id: targetTenantId || null,
      target_subscription_id: targetSubscriptionId || null,
      metadata,
    });

    if (error) {
      logger.error({
        event: "platform_admin_audit_log_failed",
        action,
        actorUserId,
        error: error.message,
      });
    }
  } catch (err: any) {
    logger.error({
      event: "platform_admin_audit_log_exception",
      action,
      actorUserId,
      error: err?.message,
    });
  }
}
