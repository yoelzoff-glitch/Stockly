import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireTenantRole, toAuthErrorResponse } from "@/lib/security/tenantAuth";
import { CORRELATION_ID_HEADER } from "@/lib/observability/correlationId";
import { logger } from "@/lib/errors/logger";

export async function POST(req: Request) {
  let correlationId: string | undefined;

  try {
    const context = await requireTenantRole(["owner", "admin"], req);
    correlationId = context.correlationId;
    const supabase = createAdminClient();

    // MÓDULO 5: Update status to disconnected instead of deleting the row (prevents cascade deletion)
    const { error } = await supabase
      .from("meli_accounts")
      .update({
        status: "disconnected",
        access_token: null,
        refresh_token: null,
        token_expires_at: null,
        sync_error: null
      })
      .eq("tenant_id", context.tenantId);

    if (error) {
      logger.error({
        event: "MELI_DISCONNECT_DB_ERROR",
        correlationId,
        tenantId: context.tenantId,
        error,
        message: "Error disconnecting Mercado Libre account",
      });
      return NextResponse.json(
        { error: "Failed to disconnect account" },
        { status: 500, headers: { [CORRELATION_ID_HEADER]: correlationId } }
      );
    }

    // Create Audit Log
    await supabase.from("audit_logs").insert({
      tenant_id: context.tenantId,
      action: "meli_disconnected",
      resource_type: "meli_account",
      details: { message: "Conexión desconectada manualmente por el usuario conservando los datos históricos." }
    });

    return NextResponse.json(
      { success: true },
      { status: 200, headers: { [CORRELATION_ID_HEADER]: correlationId } }
    );
  } catch (error: any) {
    logger.error({
      event: "MELI_DISCONNECT_ERROR",
      correlationId,
      error,
      message: error?.message || "Disconnect error",
    });
    return toAuthErrorResponse(error, correlationId);
  }
}
