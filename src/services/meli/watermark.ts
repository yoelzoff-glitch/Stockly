export interface WatermarkAdvanceResult {
  advanced: boolean;
  watermark: string;
}

/**
 * Atomically advances the incremental orders watermark in meli_sync_state.
 * The database RPC is mandatory: a client-side read followed by an upsert
 * cannot preserve monotonicity under concurrent workers.
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

  const { data: rpcResult, error: rpcError } = await supabase.rpc(
    "advance_meli_sync_watermark",
    {
      p_tenant_id: tenantId,
      p_resource_type: "orders",
      p_new_watermark: newWatermarkIso,
    }
  );

  if (rpcError) {
    throw new Error(`Failed to advance orders watermark atomically: ${rpcError.message}`);
  }
  if (!rpcResult?.success || !rpcResult?.watermark) {
    throw new Error(
      `Failed to advance orders watermark atomically: ${rpcResult?.reason || "invalid_rpc_result"}`
    );
  }

  return {
    advanced: Boolean(rpcResult.advanced),
    watermark: rpcResult.watermark,
  };
}
