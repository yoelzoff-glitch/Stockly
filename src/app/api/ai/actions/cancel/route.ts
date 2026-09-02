import { NextResponse } from "next/server";
import { logger } from "@/lib/errors/logger";
import { cancelPendingAction } from "@/services/ai/actions/confirm";
import { requireTenantContext, assertRequestedTenant, toAuthErrorResponse } from "@/lib/security/tenantAuth";
import { CORRELATION_ID_HEADER } from "@/lib/observability/correlationId";

export async function POST(req: Request) {
  let correlationId: string | undefined;

  try {
    const context = await requireTenantContext(req);
    correlationId = context.correlationId;

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON payload" },
        { status: 400, headers: { [CORRELATION_ID_HEADER]: correlationId } }
      );
    }

    const { action_id, actionId, tenant_id, tenantId } = body || {};
    const effectiveActionId = action_id || actionId;
    const requestedTenant = tenant_id || tenantId;

    if (!effectiveActionId || typeof effectiveActionId !== "string" || effectiveActionId.trim().length === 0) {
      return NextResponse.json(
        { error: "action_id is required" },
        { status: 400, headers: { [CORRELATION_ID_HEADER]: correlationId } }
      );
    }

    // Reject tenant mismatch with 403
    assertRequestedTenant(context, requestedTenant);

    // Cancel action strictly scoped to authenticated tenant
    const res = await cancelPendingAction(context.tenantId, effectiveActionId.trim());
    if (!res.success) {
      return NextResponse.json(
        { error: "Action not found or could not be cancelled" },
        { status: 404, headers: { [CORRELATION_ID_HEADER]: correlationId } }
      );
    }

    return NextResponse.json(
      { success: true },
      { status: 200, headers: { [CORRELATION_ID_HEADER]: correlationId } }
    );
  } catch (error: any) {
    logger.error({
      event: "AI_ACTIONS_CANCEL_ERROR",
      correlationId,
      error,
      message: error?.message || "Error in cancel action route",
    });
    return toAuthErrorResponse(error, correlationId);
  }
}
