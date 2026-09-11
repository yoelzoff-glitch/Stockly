import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrCreateCorrelationId } from "@/lib/observability/correlationId";
import { logger } from "@/lib/errors/logger";

export type PlatformRole = "super_admin" | "support" | "finance";

export interface PlatformAdminContext {
  id: string;
  userId: string;
  email: string;
  role: PlatformRole;
  isActive: boolean;
  correlationId: string;
}

export type PlatformAuthErrorCode =
  | "AUTH_REQUIRED"
  | "PLATFORM_ADMIN_REQUIRED"
  | "PLATFORM_ADMIN_INACTIVE"
  | "PLATFORM_ROLE_UNAUTHORIZED";

export class PlatformAdminAuthError extends Error {
  public readonly code: PlatformAuthErrorCode;
  public readonly statusCode: number;
  public readonly correlationId?: string;

  constructor(
    code: PlatformAuthErrorCode,
    message: string,
    statusCode: number = 403,
    correlationId?: string
  ) {
    super(message);
    this.name = "PlatformAdminAuthError";
    this.code = code;
    this.statusCode = statusCode;
    this.correlationId = correlationId;

    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Validates that the current user has an active platform admin record.
 * Rejects if unauthenticated, not in platform_admins, inactive, or not in allowedRoles.
 */
export async function requirePlatformAdmin(
  req?: Request,
  allowedRoles: PlatformRole[] = ["super_admin"]
): Promise<PlatformAdminContext> {
  const correlationId = req ? getOrCreateCorrelationId(req) : getOrCreateCorrelationId();
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    logger.warn({
      event: "platform_auth_failed",
      reason: "No active user session",
      correlationId,
    });
    throw new PlatformAdminAuthError(
      "AUTH_REQUIRED",
      "Authentication required to access platform administration.",
      401,
      correlationId
    );
  }

  // Use admin client to query platform_admins since it is strictly isolated from normal client RLS
  const adminDb = createAdminClient();
  const { data: adminRecord, error: dbError } = await adminDb
    .from("platform_admins")
    .select("id, user_id, role, is_active")
    .eq("user_id", user.id)
    .maybeSingle();

  if (dbError) {
    logger.error({
      event: "platform_auth_db_error",
      userId: user.id,
      error: dbError.message,
      correlationId,
    });
    throw new PlatformAdminAuthError(
      "PLATFORM_ADMIN_REQUIRED",
      "Failed to verify platform admin authorization.",
      403,
      correlationId
    );
  }

  if (!adminRecord) {
    logger.warn({
      event: "platform_auth_denied_not_admin",
      userId: user.id,
      email: user.email,
      correlationId,
    });
    throw new PlatformAdminAuthError(
      "PLATFORM_ADMIN_REQUIRED",
      "Platform administrator access required.",
      403,
      correlationId
    );
  }

  if (!adminRecord.is_active) {
    logger.warn({
      event: "platform_auth_denied_inactive",
      userId: user.id,
      correlationId,
    });
    throw new PlatformAdminAuthError(
      "PLATFORM_ADMIN_INACTIVE",
      "Platform administrator account is inactive.",
      403,
      correlationId
    );
  }

  const userRole = adminRecord.role as PlatformRole;
  if (!allowedRoles.includes(userRole)) {
    logger.warn({
      event: "platform_auth_denied_role",
      userId: user.id,
      role: userRole,
      allowedRoles,
      correlationId,
    });
    throw new PlatformAdminAuthError(
      "PLATFORM_ROLE_UNAUTHORIZED",
      `Role '${userRole}' is not authorized for this action. Allowed: ${allowedRoles.join(", ")}.`,
      403,
      correlationId
    );
  }

  return {
    id: adminRecord.id,
    userId: user.id,
    email: user.email || "",
    role: userRole,
    isActive: true,
    correlationId,
  };
}

/**
 * Checks if a user is an active platform admin without throwing.
 * Safe for conditional UI rendering.
 */
export async function isPlatformAdmin(userId?: string): Promise<boolean> {
  try {
    let targetUserId = userId;
    if (!targetUserId) {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return false;
      targetUserId = user.id;
    }

    const adminDb = createAdminClient();
    const { data: record } = await adminDb
      .from("platform_admins")
      .select("id, is_active")
      .eq("user_id", targetUserId)
      .eq("is_active", true)
      .maybeSingle();

    return !!record;
  } catch {
    return false;
  }
}
