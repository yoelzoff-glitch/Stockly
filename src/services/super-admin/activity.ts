import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/errors/logger";

export type ActivityHealth = "ACTIVE" | "LOW_ACTIVITY" | "AT_RISK" | "INACTIVE" | "DORMANT";

export type PlatformActivityEventName =
  | "dashboard_viewed"
  | "orders_viewed"
  | "profitability_viewed"
  | "ads_viewed"
  | "report_exported"
  | "product_viewed"
  | "cost_updated"
  | "sync_started";

export interface TrackActivityParams {
  tenantId: string;
  userId?: string | null;
  eventName: PlatformActivityEventName | string;
  metadata?: Record<string, any>;
}

export interface TenantActivityStatus {
  lastUserActivityAt: string | null;
  lastSyncAt: string | null;
  health: ActivityHealth;
  daysSinceLastActivity: number | null;
}

/**
 * Classifies tenant health based on days since last human activity.
 * <= 3 days -> ACTIVE
 * 4–7 days -> LOW_ACTIVITY
 * 8–14 days -> AT_RISK
 * 15–30 days -> INACTIVE
 * > 30 days -> DORMANT
 */
export function calculateActivityHealth(lastActivityAt: string | Date | null): ActivityHealth {
  if (!lastActivityAt) return "DORMANT";

  const activityTime = new Date(lastActivityAt).getTime();
  if (isNaN(activityTime)) return "DORMANT";

  const diffMs = Date.now() - activityTime;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 3) return "ACTIVE";
  if (diffDays <= 7) return "LOW_ACTIVITY";
  if (diffDays <= 14) return "AT_RISK";
  if (diffDays <= 30) return "INACTIVE";
  return "DORMANT";
}

/**
 * Tracks a significant functional event executed by a tenant user.
 */
export async function trackPlatformActivity({
  tenantId,
  userId,
  eventName,
  metadata = {},
}: TrackActivityParams): Promise<void> {
  try {
    const adminDb = createAdminClient();
    const { error } = await adminDb.from("platform_activity_events").insert({
      tenant_id: tenantId,
      user_id: userId || null,
      event_name: eventName,
      metadata,
    });

    if (error) {
      logger.warn({
        event: "track_platform_activity_failed",
        tenantId,
        eventName,
        error: error.message,
      });
    }
  } catch (err: any) {
    logger.warn({
      event: "track_platform_activity_exception",
      tenantId,
      eventName,
      error: err?.message,
    });
  }
}

/**
 * Retrieves last human activity and last sync timestamp for a tenant.
 */
export async function getTenantActivityStatus(tenantId: string): Promise<TenantActivityStatus> {
  const adminDb = createAdminClient();

  // 1. Last human activity event
  const { data: latestEvent } = await adminDb
    .from("platform_activity_events")
    .select("created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // 2. Last sync from meli_accounts
  const { data: latestAccount } = await adminDb
    .from("meli_accounts")
    .select("updated_at")
    .eq("tenant_id", tenantId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const lastUserActivityAt = latestEvent?.created_at || null;
  const lastSyncAt = latestAccount?.updated_at || null;
  const health = calculateActivityHealth(lastUserActivityAt);

  let daysSinceLastActivity: number | null = null;
  if (lastUserActivityAt) {
    const diffMs = Date.now() - new Date(lastUserActivityAt).getTime();
    daysSinceLastActivity = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }

  return {
    lastUserActivityAt,
    lastSyncAt,
    health,
    daysSinceLastActivity,
  };
}
