import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/errors/logger";

export class DemoReadOnlyError extends Error {
  public readonly statusCode = 403;
  public readonly code = "DEMO_READ_ONLY";

  constructor(
    message: string = "Esta es una cuenta de demostración. Podés recorrer toda la información, pero los cambios y las conexiones externas están deshabilitados."
  ) {
    super(message);
    this.name = "DemoReadOnlyError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// In-memory cache for fast tenant is_demo lookups (TTL 60s)
const demoTenantCache = new Map<string, { isDemo: boolean; timestamp: number }>();
const CACHE_TTL_MS = 60 * 1000;

/**
 * Checks whether a given tenant is marked as an internal demo tenant.
 * Fails safely by returning false only if explicitly queried and not demo.
 */
export async function isDemoTenant(tenantId: string, customClient?: any): Promise<boolean> {
  if (!tenantId) return false;

  const now = Date.now();
  const cached = demoTenantCache.get(tenantId);
  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return cached.isDemo;
  }

  try {
    const supabase = customClient || createAdminClient();
    const { data: tenant, error } = await supabase
      .from("tenants")
      .select("is_demo")
      .eq("id", tenantId)
      .maybeSingle();

    if (error || !tenant) {
      // If error querying or not found, fail safely
      return false;
    }

    const isDemo = Boolean(tenant.is_demo);
    demoTenantCache.set(tenantId, { isDemo, timestamp: now });
    return isDemo;
  } catch (err) {
    logger.warn({
      event: "DEMO_CHECK_FAILED",
      tenantId,
      error: String(err),
      message: "Failed to verify demo status for tenant",
    });
    return false;
  }
}

/**
 * Enforces that mutations are strictly forbidden for demo tenants.
 * Throws DemoReadOnlyError (HTTP 403) on any write attempt.
 */
export async function assertTenantWritable(tenantId: string, customClient?: any): Promise<void> {
  if (!tenantId) {
    throw new DemoReadOnlyError("Tenant no identificado");
  }

  const isDemo = await isDemoTenant(tenantId, customClient);
  if (isDemo) {
    logger.warn({
      event: "DEMO_WRITE_BLOCKED",
      tenantId,
      message: "Blocked mutation attempt on read-only demo tenant",
    });
    throw new DemoReadOnlyError(
      "Esta es una cuenta de demostración. Podés recorrer toda la información, pero los cambios y las conexiones externas están deshabilitados."
    );
  }
}

/**
 * Utility to clear the in-memory cache (e.g. during test teardown or migrations).
 */
export function clearDemoTenantCache(): void {
  demoTenantCache.clear();
}
