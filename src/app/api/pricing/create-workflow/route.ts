import { NextResponse } from "next/server";
import { createPriceAdjustmentWorkflow } from "@/services/pricing/createPriceAdjustmentWorkflow";
import { requireTenantRole, assertRequestedTenant, toAuthErrorResponse } from "@/lib/security/tenantAuth";
import { CORRELATION_ID_HEADER } from "@/lib/observability/correlationId";
import { logger } from "@/lib/errors/logger";

export async function POST(request: Request) {
  let correlationId: string | undefined;

  try {
    const context = await requireTenantRole(["owner", "admin"], request);
    correlationId = context.correlationId;

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON payload" },
        { status: 400, headers: { [CORRELATION_ID_HEADER]: correlationId } }
      );
    }

    const { tenantId, tenant_id, targetMarginPercent, adjustments } = body || {};
    const requestedTenant = tenantId || tenant_id;

    if (
      typeof targetMarginPercent !== "number" ||
      !Number.isFinite(targetMarginPercent) ||
      !Array.isArray(adjustments) ||
      adjustments.length === 0
    ) {
      return NextResponse.json(
        { error: "Invalid payload: targetMarginPercent and non-empty adjustments array are required" },
        { status: 400, headers: { [CORRELATION_ID_HEADER]: correlationId } }
      );
    }

    // Limit batch size to prevent denial of service (existing safe max limit 500)
    if (adjustments.length > 500) {
      return NextResponse.json(
        { error: "Adjustments batch limit exceeded (max 500 items)" },
        { status: 400, headers: { [CORRELATION_ID_HEADER]: correlationId } }
      );
    }

    // Reject tenant mismatch with 403
    assertRequestedTenant(context, requestedTenant);

    // Create workflow strictly for authenticated tenant
    const workflowId = await createPriceAdjustmentWorkflow(
      context.tenantId,
      targetMarginPercent,
      adjustments
    );

    return NextResponse.json(
      { workflowId },
      { status: 201, headers: { [CORRELATION_ID_HEADER]: correlationId } }
    );
  } catch (err: any) {
    logger.error({
      event: "PRICING_CREATE_WORKFLOW_ERROR",
      correlationId,
      error: err,
      message: err?.message || "Error creating price adjustment workflow",
    });
    return toAuthErrorResponse(err, correlationId);
  }
}
