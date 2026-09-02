import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { logger } from "@/lib/errors/logger";
import { requireTenantContext, toAuthErrorResponse } from "@/lib/security/tenantAuth";
import { CORRELATION_ID_HEADER } from "@/lib/observability/correlationId";

export async function DELETE(req: Request) {
  let correlationId: string | undefined;

  try {
    const context = await requireTenantContext(req);
    correlationId = context.correlationId;
    const adminSupabase = createAdminClient();

    // Delete all web messages for this tenant (mapped to whatsapp but with null from_phone)
    const { error } = await adminSupabase
      .from("messages")
      .delete()
      .eq("tenant_id", context.tenantId)
      .eq("channel", "whatsapp")
      .is("from_phone", null);

    if (error) throw error;

    return NextResponse.json(
      { success: true },
      { status: 200, headers: { [CORRELATION_ID_HEADER]: correlationId } }
    );
  } catch (error: any) {
    logger.error({
      event: "AI_CHAT_CLEAR_ERROR",
      correlationId,
      error,
      message: error?.message || "Error eliminando el historial de chat",
    });
    return toAuthErrorResponse(error, correlationId);
  }
}
