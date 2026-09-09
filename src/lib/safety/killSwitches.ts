/**
 * Centralized, typed Kill Switches utility for LibretaX.
 * 
 * Kill switches allow operators to immediately stop dangerous write operations
 * via environment variables without redeploying code or affecting reads.
 * 
 * Canonical variables:
 * - LIBRETAX_DISABLE_MANUAL_SYNCS: Blocks on-demand manual sync routes.
 * - LIBRETAX_DISABLE_AI_WRITES: Blocks execution of AI suggested actions/workflows.
 * - LIBRETAX_DISABLE_MELI_WRITES: Blocks price, stock, or status updates to Mercado Libre.
 * - LIBRETAX_DISABLE_WHATSAPP_AGENT: Blocks automated AI outbound responses on WhatsApp.
 * 
 * Backwards compatibility fallbacks (deprecated):
 * - KLYVO_DISABLE_MANUAL_SYNCS
 * - KLYVO_DISABLE_AI_WRITES
 * - KLYVO_DISABLE_MELI_WRITES
 * - KLYVO_DISABLE_WHATSAPP_AGENT
 */

export interface KillSwitchesState {
  disableManualSyncs: boolean;
  disableAiWrites: boolean;
  disableMeliWrites: boolean;
  disableWhatsappAgent: boolean;
}

/**
 * Parses truthy environment variable values: "true", "1", "yes", "on" (case-insensitive).
 * All other values ("false", "0", "", undefined, null, etc.) return false.
 */
export function parseBooleanEnv(value?: string | null): boolean {
  if (!value) return false;
  const trimmed = value.trim().toLowerCase();
  return trimmed === "true" || trimmed === "1" || trimmed === "yes" || trimmed === "on";
}

/**
 * Returns current snapshot of all active kill switches.
 */
export function getKillSwitches(): KillSwitchesState {
  return {
    disableManualSyncs: isManualSyncDisabled(),
    disableAiWrites: isAiWritesDisabled(),
    disableMeliWrites: isMeliWritesDisabled(),
    disableWhatsappAgent: isWhatsappAgentDisabled(),
  };
}

export function isManualSyncDisabled(): boolean {
  return parseBooleanEnv(process.env.LIBRETAX_DISABLE_MANUAL_SYNCS) || parseBooleanEnv(process.env.KLYVO_DISABLE_MANUAL_SYNCS);
}

export function isAiWritesDisabled(): boolean {
  return parseBooleanEnv(process.env.LIBRETAX_DISABLE_AI_WRITES) || parseBooleanEnv(process.env.KLYVO_DISABLE_AI_WRITES);
}

export function isMeliWritesDisabled(): boolean {
  return parseBooleanEnv(process.env.LIBRETAX_DISABLE_MELI_WRITES) || parseBooleanEnv(process.env.KLYVO_DISABLE_MELI_WRITES);
}

export function isWhatsappAgentDisabled(): boolean {
  return parseBooleanEnv(process.env.LIBRETAX_DISABLE_WHATSAPP_AGENT) || parseBooleanEnv(process.env.KLYVO_DISABLE_WHATSAPP_AGENT);
}
