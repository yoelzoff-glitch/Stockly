import "server-only";

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateCorrelationId, CORRELATION_ID_HEADER } from "@/lib/observability/correlationId";
import { logger } from "@/lib/errors/logger";
import { AppError } from "@/lib/errors/AppError";
import { isFeatureFlagEnabled } from "@/lib/safety/featureFlags";

export type TenantRole = "owner" | "admin" | "user";

export interface TenantContext {
  userId: string;
  tenantId: string;
  role: TenantRole;
  isActive: boolean;
  correlationId: string;
}

export type AuthErrorCode =
  | "AUTH_REQUIRED"
  | "PROFILE_NOT_FOUND"
  | "INACTIVE_USER_DENIED"
  | "TENANT_NOT_ASSIGNED"
  | "TENANT_MISMATCH_DENIED"
  | "ROLE_DENIED"
  | "CROSS_TENANT_RESOURCE_DENIED"
  | "INVALID_REQUEST_BODY";

export class TenantAuthError extends Error {
  public readonly code: AuthErrorCode;
  public readonly statusCode: number;
  public readonly correlationId?: string;

  constructor(code: AuthErrorCode, message: string, statusCode: number = 403, correlationId?: string) {
    super(message);
    this.name = "TenantAuthError";
    this.code = code;
    this.statusCode = statusCode;
    this.correlationId = correlationId;

    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Validates that an active authenticated Supabase session exists.
 * Rejects if user is unauthenticated.
 */
export async function requireAuthenticatedUser(
  req?: Request,
  customClient?: any
): Promise<{ user: { id: string; email?: string }; correlationId: string }> {
  const correlationId = req ? getOrCreateCorrelationId(req) : getOrCreateCorrelationId();
  const supabase = customClient || (await createClient());

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    logger.warn({
      event: "AUTH_REQUIRED",
      correlationId,
      message: "Access denied: Unauthenticated user request",
    });
    throw new TenantAuthError("AUTH_REQUIRED", "Authentication required", 401, correlationId);
  }

  return { user, correlationId };
}

/**
 * Resolves the authenticated user, verifies active profile, and strictly derives the tenantId.
 */
export async function requireTenantContext(
  req?: Request,
  options: { customClient?: any } = {}
): Promise<TenantContext> {
  const { user, correlationId } = await requireAuthenticatedUser(req, options.customClient);
  const supabase = options.customClient || (await createClient());

  // Query profile strictly by authenticated user.id
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("tenant_id, role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    logger.warn({
      event: "PROFILE_NOT_FOUND",
      correlationId,
      userId: user.id,
      message: "Access denied: User profile not found",
    });
    throw new TenantAuthError("PROFILE_NOT_FOUND", "User profile not found", 403, correlationId);
  }

  // Check if profile is active (treat null/undefined as true for backwards compatibility if field is unset)
  if (profile.is_active === false) {
    logger.warn({
      event: "INACTIVE_USER_DENIED",
      correlationId,
      userId: user.id,
      tenantId: profile.tenant_id,
      message: "Access denied: Inactive user account",
    });
    throw new TenantAuthError("INACTIVE_USER_DENIED", "User account is inactive", 403, correlationId);
  }

  if (!profile.tenant_id) {
    logger.warn({
      event: "TENANT_NOT_ASSIGNED",
      correlationId,
      userId: user.id,
      message: "Access denied: No tenant assigned to user profile",
    });
    throw new TenantAuthError("TENANT_NOT_ASSIGNED", "No tenant assigned to user profile", 403, correlationId);
  }

  const role: TenantRole = (profile.role as TenantRole) || "user";

  return {
    userId: user.id,
    tenantId: profile.tenant_id,
    role,
    isActive: profile.is_active !== false,
    correlationId,
  };
}

/**
 * Enforces role restrictions.
 * If the feature flag 'strict_tenant_authorization' is enabled, it blocks roles not in allowedRoles.
 * If the flag is disabled (default), it logs a warning but permits the call to prevent breaking existing users.
 */
export async function requireTenantRole(
  allowedRoles: TenantRole[],
  req?: Request,
  options: { customClient?: any } = {}
): Promise<TenantContext> {
  const context = await requireTenantContext(req, options);

  if (allowedRoles.includes(context.role)) {
    return context;
  }

  // Check if strict role enforcement feature flag is enabled
  const strictEnabled = await isFeatureFlagEnabled(
    context.tenantId,
    "strict_tenant_authorization",
    options.customClient
  );

  if (strictEnabled) {
    logger.warn({
      event: "ROLE_DENIED",
      correlationId: context.correlationId,
      userId: context.userId,
      tenantId: context.tenantId,
      role: context.role,
      allowedRoles,
      message: "Access denied: Role unauthorized under strict authorization policy",
    });
    throw new TenantAuthError(
      "ROLE_DENIED",
      "Unauthorized role for this operation",
      403,
      context.correlationId
    );
  }

  // Non-strict mode: Log audit warning and permit execution for backwards compatibility
  logger.info({
    event: "ROLE_PERMISSIVE_ACCESS",
    correlationId: context.correlationId,
    userId: context.userId,
    tenantId: context.tenantId,
    role: context.role,
    allowedRoles,
    message: "Permissive role execution allowed (strict_tenant_authorization is false)",
  });

  return context;
}

/**
 * Compares an optional tenantId supplied in the request body/query against the server-derived tenant context.
 * If present and mismatched, rejects with 403.
 */
export function assertRequestedTenant(
  context: TenantContext,
  requestedTenantId?: string | null
): void {
  if (!requestedTenantId) {
    return; // Permitted: Server uses context.tenantId automatically
  }

  const normalizedRequested = String(requestedTenantId).trim();
  const normalizedActual = String(context.tenantId).trim();

  if (normalizedRequested !== normalizedActual) {
    logger.warn({
      event: "TENANT_MISMATCH_DENIED",
      correlationId: context.correlationId,
      userId: context.userId,
      tenantId: context.tenantId,
      message: "Access denied: Requested tenant does not match authenticated tenant context",
    });
    throw new TenantAuthError(
      "TENANT_MISMATCH_DENIED",
      "Access forbidden: Tenant mismatch",
      403,
      context.correlationId
    );
  }
}

/**
 * Converts authorization errors into standard, sanitized JSON responses.
 */
export function toAuthErrorResponse(error: unknown, correlationId?: string): NextResponse {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (correlationId) {
    headers[CORRELATION_ID_HEADER] = correlationId;
  }

  if (error instanceof TenantAuthError) {
    if (error.correlationId && !headers[CORRELATION_ID_HEADER]) {
      headers[CORRELATION_ID_HEADER] = error.correlationId;
    }
    return NextResponse.json(
      { error: error.message },
      { status: error.statusCode, headers }
    );
  }

  if (error instanceof AppError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.statusCode, headers }
    );
  }

  // SyntaxError from invalid JSON body
  if (error instanceof SyntaxError) {
    return NextResponse.json(
      { error: "Invalid JSON in request payload" },
      { status: 400, headers }
    );
  }

  // Generic fallback
  return NextResponse.json(
    { error: "Internal Server Error" },
    { status: 500, headers }
  );
}
