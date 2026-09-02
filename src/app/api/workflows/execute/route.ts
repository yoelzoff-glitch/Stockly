import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { executeWorkflow } from "@/services/ai/workflows";
import { requireTenantRole, toAuthErrorResponse } from "@/lib/security/tenantAuth";
import { CORRELATION_ID_HEADER } from "@/lib/observability/correlationId";
import { logger } from "@/lib/errors/logger";
import * as Sentry from "@sentry/nextjs";

export async function POST(req: Request) {
  let correlationId: string | undefined;

  try {
    const context = await requireTenantRole(["owner", "admin"], req);
    correlationId = context.correlationId;
    const adminSupabase = createAdminClient();

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON payload" },
        { status: 400, headers: { [CORRELATION_ID_HEADER]: correlationId } }
      );
    }

    const { workflowId, action } = body || {};
    if (!workflowId || typeof workflowId !== "string") {
      return NextResponse.json(
        { error: "workflowId is required" },
        { status: 400, headers: { [CORRELATION_ID_HEADER]: correlationId } }
      );
    }

    if (action === "approve") {
      // Execute the workflow actions sequentially
      const result = await executeWorkflow(context.tenantId, workflowId.trim());
      if (result.error) {
        return NextResponse.json(
          { error: result.error },
          { status: 400, headers: { [CORRELATION_ID_HEADER]: correlationId } }
        );
      }
      return NextResponse.json(
        { success: true, result },
        { status: 200, headers: { [CORRELATION_ID_HEADER]: correlationId } }
      );
    } else if (action === "reject") {
      // Update workflow status to 'rejected' strictly scoped to tenant
      const { error: rejectError } = await adminSupabase
        .from("action_workflows")
        .update({ status: "rejected" })
        .eq("id", workflowId.trim())
        .eq("tenant_id", context.tenantId);

      if (rejectError) {
        throw rejectError;
      }
      return NextResponse.json(
        { success: true },
        { status: 200, headers: { [CORRELATION_ID_HEADER]: correlationId } }
      );
    } else {
      return NextResponse.json(
        { error: `Invalid action: ${action}` },
        { status: 400, headers: { [CORRELATION_ID_HEADER]: correlationId } }
      );
    }
  } catch (error: any) {
    Sentry.captureException(error, { extra: { context: "WORKFLOWS_EXECUTE", correlationId } });
    logger.error({
      event: "WORKFLOWS_EXECUTE_ERROR",
      correlationId,
      error,
      message: error?.message || "Exception in workflows/execute API",
    });
    return toAuthErrorResponse(error, correlationId);
  }
}
