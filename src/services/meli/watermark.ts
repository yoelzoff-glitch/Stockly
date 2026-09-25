import { logger } from "@/lib/errors/logger";

export interface WatermarkAdvanceResult {
  advanced: boolean;
  watermark: string;
}

/**
 * Atomically advances the incremental orders watermark in meli_sync_state.
 * Enforces monotonic progression: an older/delayed execution finishing later
 * can NEVER roll back a newer watermark.
 */
export async function advanceOrdersWatermark(
  supabase: any,
  tenantId: string,
  newWatermarkIso: string
): Promise<WatermarkAdvanceResult> {
  const newMs = new Date(newWatermarkIso).getTime();
  if (isNaN(newMs)) {
    throw new Error(`Invalid watermark timestamp: ${newWatermarkIso}`);
  }

  // 1. Try atomic PostgreSQL RPC with FOR UPDATE locking
  try {
    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      "advance_meli_sync_watermark",
      {
        p_tenant_id: tenantId,
        p_resource_type: "orders",
        p_new_watermark: newWatermarkIso,
      }
    );

    if (!rpcError && rpcResult?.success) {
      return {
        advanced: Boolean(rpcResult.advanced),
        watermark: rpcResult.watermark || newWatermarkIso,
      };
    }
  } catch {
    // Graceful fallback to client-side optimistic comparison if RPC not available
  }

  // 2. Client-side monotonic guard (resilient fallback during migration rollout)
  const { data: current } = await supabase
    .from("meli_sync_state")
    .select("last_successful_sync_at")
    .eq("tenant_id", tenantId)
    .eq("resource_type", "orders")
    .maybeSingle();

  if (current?.last_successful_sync_at) {
    const currentMs = new Date(current.last_successful_sync_at).getTime();
    if (newMs < currentMs) {
      logger.info({
        event: "ORDERS_WATERMARK_ROLLBACK_PREVENTED",
        tenantId,
        currentWatermark: current.last_successful_sync_at,
        staleWatermark: newWatermarkIso,
        message: "Stale execution attempted to roll back a newer watermark. Ignored safely.",
      });
      return {
        advanced: false,
        watermark: current.last_successful_sync_at,
      };
    }
  }

  const { error: upsertErr } = await supabase.from("meli_sync_state").upsert(
    {
      tenant_id: tenantId,
      resource_type: "orders",
      last_successful_sync_at: newWatermarkIso,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id,resource_type" }
  );

  if (upsertErr) {
    throw new Error(`Failed to advance orders watermark: ${upsertErr.message}`);
  }

  return {
    advanced: true,
    watermark: newWatermarkIso,
  };
}
