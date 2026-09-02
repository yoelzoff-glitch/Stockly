import { NextResponse } from "next/server";
import { simulatePriceAdjustment } from "@/services/pricing/priceAdjustmentSimulator";
import { requireTenantContext, assertRequestedTenant, toAuthErrorResponse } from "@/lib/security/tenantAuth";
import { CORRELATION_ID_HEADER } from "@/lib/observability/correlationId";
import { logger } from "@/lib/errors/logger";

export async function POST(request: Request) {
  let correlationId: string | undefined;

  try {
    const context = await requireTenantContext(request);
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

    const { tenantId, tenant_id, targetMarginPercent, filter } = body || {};
    const requestedTenant = tenantId || tenant_id;

    if (
      typeof targetMarginPercent !== "number" ||
      !Number.isFinite(targetMarginPercent) ||
      targetMarginPercent < -100 ||
      targetMarginPercent > 1000
    ) {
      return NextResponse.json(
        { error: "Invalid targetMarginPercent: must be a valid number" },
        { status: 400, headers: { [CORRELATION_ID_HEADER]: correlationId } }
      );
    }

    // Reject tenant mismatch with 403
    assertRequestedTenant(context, requestedTenant);

    // Simulate price adjustment exclusively with server-derived tenantId
    const preview = await simulatePriceAdjustment(context.tenantId, targetMarginPercent, filter);

    return NextResponse.json(
      { preview },
      { status: 200, headers: { [CORRELATION_ID_HEADER]: correlationId } }
    );
  } catch (err: any) {
    logger.error({
      event: "PRICING_SIMULATE_ERROR",
      correlationId,
      error: err,
      message: err?.message || "Error simulating price adjustment",
    });
    return toAuthErrorResponse(err, correlationId);
  }
}
