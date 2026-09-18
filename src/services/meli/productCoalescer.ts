import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/errors/logger";

const COALESCING_WINDOW_MS = 45 * 1000; // 45 seconds coalescing window
const MAX_FULL_SYNC_AGE_MS = 6 * 60 * 60 * 1000; // 6 hours maximum idle age before forced safety sync

// In-memory debounce tracker per tenant to complement DB state across hot requests
const inMemoryScheduledSyncs = new Map<string, number>();

export interface ProductCoalesceDecision {
  shouldSchedule: boolean;
  reason: "initial_scheduled" | "already_in_progress_marked_dirty" | "within_coalescing_window_marked_dirty";
}

/**
 * Sprint 40 Phase 6 & 7: Records an incoming item webhook for a tenant,
 * marks products_dirty = true, and decides whether a new coalesced sync job must be scheduled.
 */
export async function recordProductItemWebhook(tenantId: string): Promise<ProductCoalesceDecision> {
  const supabase = createAdminClient();
  const now = new Date();
  const nowIso = now.toISOString();

  // 1. Fetch current sync state
  const { data: state } = await supabase
    .from("meli_sync_state")
    .select("products_dirty, sync_in_progress, last_item_event_at")
    .eq("tenant_id", tenantId)
    .eq("resource_type", "products")
    .maybeSingle();

  const syncInProgress = state?.sync_in_progress ?? false;
  const lastScheduled = inMemoryScheduledSyncs.get(tenantId) || 0;
  const withinWindow = now.getTime() - lastScheduled < COALESCING_WINDOW_MS;

  // 2. Mark products_dirty = true and record last_item_event_at
  await supabase
    .from("meli_sync_state")
    .upsert(
      {
        tenant_id: tenantId,
        resource_type: "products",
        products_dirty: true,
        last_item_event_at: nowIso,
        updated_at: nowIso,
      },
      { onConflict: "tenant_id,resource_type" }
    );

  if (syncInProgress) {
    logger.info({
      event: "PRODUCT_WEBHOOK_COALESCED_DURING_SYNC",
      tenantId,
      message: "Sync currently running; marked products_dirty = true for subsequent pass",
    });
    return { shouldSchedule: false, reason: "already_in_progress_marked_dirty" };
  }

  if (withinWindow) {
    logger.info({
      event: "PRODUCT_WEBHOOK_COALESCED_IN_WINDOW",
      tenantId,
      message: "Sync already scheduled within 45s coalescing window; accumulated event",
    });
    return { shouldSchedule: false, reason: "within_coalescing_window_marked_dirty" };
  }

  // Schedule new run and record timestamp
  inMemoryScheduledSyncs.set(tenantId, now.getTime());
  return { shouldSchedule: true, reason: "initial_scheduled" };
}

/**
 * Marks product sync execution start. Clears dirty flag to detect any new events arriving during run.
 */
export async function markProductSyncStarted(tenantId: string): Promise<void> {
  const supabase = createAdminClient();
  const nowIso = new Date().toISOString();

  await supabase
    .from("meli_sync_state")
    .upsert(
      {
        tenant_id: tenantId,
        resource_type: "products",
        sync_in_progress: true,
        products_dirty: false,
        updated_at: nowIso,
      },
      { onConflict: "tenant_id,resource_type" }
    );
}

/**
 * Marks product sync execution finished.
 * Returns true if new webhooks arrived while sync was running (requiring a second pass).
 */
export async function markProductSyncFinished(tenantId: string): Promise<boolean> {
  const supabase = createAdminClient();
  const nowIso = new Date().toISOString();

  // Check if new webhooks arrived during execution
  const { data: state } = await supabase
    .from("meli_sync_state")
    .select("products_dirty")
    .eq("tenant_id", tenantId)
    .eq("resource_type", "products")
    .maybeSingle();

  const hasPendingChanges = state?.products_dirty ?? false;

  await supabase
    .from("meli_sync_state")
    .upsert(
      {
        tenant_id: tenantId,
        resource_type: "products",
        sync_in_progress: false,
        last_full_sync_at: nowIso,
        last_successful_sync_at: nowIso,
        updated_at: nowIso,
      },
      { onConflict: "tenant_id,resource_type" }
    );

  inMemoryScheduledSyncs.delete(tenantId);
  return hasPendingChanges;
}

/**
 * Sprint 40 Phase 9: Evaluates whether a scheduled hourly cron can be skipped
 * because the catalog is not dirty and last sync was within max allowed age (6 hours).
 */
export async function shouldSkipProductCron(tenantId: string): Promise<{ skip: boolean; reason: string }> {
  const supabase = createAdminClient();

  const { data: state } = await supabase
    .from("meli_sync_state")
    .select("products_dirty, last_full_sync_at")
    .eq("tenant_id", tenantId)
    .eq("resource_type", "products")
    .maybeSingle();

  if (!state) {
    return { skip: false, reason: "no_prior_sync_state" };
  }

  if (state.products_dirty) {
    return { skip: false, reason: "products_dirty" };
  }

  if (!state.last_full_sync_at) {
    return { skip: false, reason: "no_last_full_sync" };
  }

  const lastSyncTime = new Date(state.last_full_sync_at).getTime();
  const ageMs = Date.now() - lastSyncTime;

  if (ageMs >= MAX_FULL_SYNC_AGE_MS) {
    return { skip: false, reason: "max_age_exceeded" };
  }

  return { skip: true, reason: `catalog_clean_age_${Math.round(ageMs / 60000)}m` };
}

/**
 * Resets the in-memory coalescer cache (useful for testing or manual eviction).
 */
export function resetProductCoalescerForTenant(tenantId?: string): void {
  if (tenantId) {
    inMemoryScheduledSyncs.delete(tenantId);
  } else {
    inMemoryScheduledSyncs.clear();
  }
}
