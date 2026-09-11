import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/errors/logger";

export type ActivityHealth = "ACTIVE" | "AT_RISK" | "INACTIVE" | "DORMANT" | "UNKNOWN";

export type PlatformActivityEventName =
  | "dashboard_viewed"
  | "orders_viewed"
  | "order_opened"
  | "products_viewed"
  | "profitability_viewed"
  | "ads_viewed"
  | "report_exported"
  | "product_viewed"
  | "cost_updated"
  | "settings_viewed"
  | "heartbeat";

export interface TrackHumanActivityParams {
  tenantId: string;
  userId?: string | null;
  eventName: PlatformActivityEventName | string;
  metadata?: Record<string, any>;
  forceImmediate?: boolean;
}

export interface ActivityHealthResult {
  health: ActivityHealth;
  daysSince: number | null;
  reason: string;
}

export interface TenantActivityStatus {
  lastUserActivityAt: string | null;
  lastUserId: string | null;
  lastLoginAt: string | null;
  lastSyncAt: string | null;
  health: ActivityHealth;
  daysSinceLastActivity: number | null;
  reason: string;
}

// In-memory throttling map to prevent hammering DB on frequent calls
// tenantId -> lastActivityTimestampMs
const activityThrottleMap = new Map<string, number>();
const THROTTLE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Calculates tenant health strictly based on real human activity (Rules V1):
 * - NULL -> UNKNOWN ("Sin actividad registrada / Tracking pendiente")
 * - 0–7 días -> ACTIVE
 * - 8–14 días -> AT_RISK
 * - 15–30 días -> INACTIVE
 * - > 30 días -> DORMANT
 * 
 * CRITICAL RULE: NULL !== DORMANT. Never infer +30 days when there is no data.
 */
export function calculateActivityHealth(lastActivityAt: string | Date | null | undefined): ActivityHealthResult {
  if (!lastActivityAt) {
    return {
      health: "UNKNOWN",
      daysSince: null,
      reason: "Sin datos / Tracking pendiente",
    };
  }

  const activityTime = new Date(lastActivityAt).getTime();
  if (isNaN(activityTime)) {
    return {
      health: "UNKNOWN",
      daysSince: null,
      reason: "Fecha de actividad inválida",
    };
  }

  const diffMs = Date.now() - activityTime;
  if (diffMs < 0) {
    return {
      health: "ACTIVE",
      daysSince: 0,
      reason: "Actividad reciente (hace pocos minutos)",
    };
  }

  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 7) {
    const timeLabel =
      diffDays === 0
        ? "hace menos de 24 hs"
        : diffDays === 1
        ? "hace 1 día"
        : `hace ${diffDays} días`;
    return {
      health: "ACTIVE",
      daysSince: diffDays,
      reason: `Actividad humana reciente (${timeLabel})`,
    };
  }

  if (diffDays <= 14) {
    return {
      health: "AT_RISK",
      daysSince: diffDays,
      reason: `Alerta temprana: sin actividad humana hace ${diffDays} días (rango 8–14d)`,
    };
  }

  if (diffDays <= 30) {
    return {
      health: "INACTIVE",
      daysSince: diffDays,
      reason: `Inactivo: sin actividad humana hace ${diffDays} días (rango 15–30d)`,
    };
  }

  return {
    health: "DORMANT",
    daysSince: diffDays,
    reason: `Dormido: sin actividad humana hace ${diffDays} días (>30d confirmados)`,
  };
}

/**
 * Records human activity with throttling (max once per 5 min for generic navigation / heartbeat).
 * Explicit functional actions (cost_updated, report_exported) bypass throttling.
 */
export async function recordHumanActivity({
  tenantId,
  userId,
  eventName,
  metadata = {},
  forceImmediate = false,
}: TrackHumanActivityParams): Promise<boolean> {
  const now = Date.now();
  const lastRecorded = activityThrottleMap.get(tenantId) || 0;
  const isHighValueEvent =
    eventName === "cost_updated" ||
    eventName === "report_exported" ||
    eventName === "order_opened";

  // Throttling check: only proceed if 5 min elapsed or is high value event or forceImmediate
  if (!forceImmediate && !isHighValueEvent && now - lastRecorded < THROTTLE_WINDOW_MS) {
    return false; // Throttled successfully without DB write
  }

  activityThrottleMap.set(tenantId, now);
  const nowIso = new Date(now).toISOString();

  try {
    const adminDb = createAdminClient();

    // 1. Update consolidated tenant_activity_state
    const { error: stateError } = await adminDb
      .from("tenant_activity_state")
      .upsert(
        {
          tenant_id: tenantId,
          last_user_activity_at: nowIso,
          last_user_id: userId || null,
          updated_at: nowIso,
        },
        { onConflict: "tenant_id" }
      );

    if (stateError) {
      logger.warn({
        event: "update_tenant_activity_state_failed",
        tenantId,
        error: stateError.message,
      });
    }

    // 2. Insert event record in platform_activity_events
    const { error: eventError } = await adminDb.from("platform_activity_events").insert({
      tenant_id: tenantId,
      user_id: userId || null,
      event_name: eventName,
      metadata,
    });

    if (eventError) {
      logger.warn({
        event: "insert_platform_activity_event_failed",
        tenantId,
        eventName,
        error: eventError.message,
      });
    }

    return true;
  } catch (err: any) {
    logger.warn({
      event: "record_human_activity_exception",
      tenantId,
      error: err?.message,
    });
    return false;
  }
}

/**
 * Updates ML sync / background sync timestamp.
 * STRICT ISOLATION: NEVER updates last_user_activity_at or last_user_id.
 */
export async function recordMlSyncActivity(
  tenantId: string,
  timestamp: Date = new Date()
): Promise<void> {
  try {
    const adminDb = createAdminClient();
    const isoString = timestamp.toISOString();

    await adminDb
      .from("tenant_activity_state")
      .upsert(
        {
          tenant_id: tenantId,
          last_ml_sync_at: isoString,
          updated_at: isoString,
        },
        { onConflict: "tenant_id" }
      );
  } catch (err: any) {
    logger.warn({
      event: "record_ml_sync_activity_failed",
      tenantId,
      error: err?.message,
    });
  }
}

/**
 * Updates login timestamp when a session is initiated.
 */
export async function recordUserLogin(
  tenantId: string,
  userId: string,
  timestamp: Date = new Date()
): Promise<void> {
  try {
    const adminDb = createAdminClient();
    const isoString = timestamp.toISOString();

    await adminDb
      .from("tenant_activity_state")
      .upsert(
        {
          tenant_id: tenantId,
          last_login_at: isoString,
          last_user_activity_at: isoString,
          last_user_id: userId,
          updated_at: isoString,
        },
        { onConflict: "tenant_id" }
      );
  } catch (err: any) {
    logger.warn({
      event: "record_user_login_failed",
      tenantId,
      error: err?.message,
    });
  }
}

/**
 * Retrieves the consolidated activity state and classification for a tenant.
 */
export async function getTenantActivityStatus(tenantId: string): Promise<TenantActivityStatus> {
  const adminDb = createAdminClient();

  const { data: state } = await adminDb
    .from("tenant_activity_state")
    .select("last_user_activity_at, last_user_id, last_login_at, last_ml_sync_at")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  const lastUserActivityAt = state?.last_user_activity_at || null;
  const lastUserId = state?.last_user_id || null;
  const lastLoginAt = state?.last_login_at || null;
  const lastSyncAt = state?.last_ml_sync_at || null;

  const { health, daysSince, reason } = calculateActivityHealth(lastUserActivityAt);

  return {
    lastUserActivityAt,
    lastUserId,
    lastLoginAt,
    lastSyncAt,
    health,
    daysSinceLastActivity: daysSince,
    reason,
  };
}
