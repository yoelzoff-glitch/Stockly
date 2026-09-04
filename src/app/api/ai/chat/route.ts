import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { runBusinessAgent } from "@/services/ai/agent";
import { checkAILimit } from "@/services/billing/checkLimits";
import { logger } from "@/lib/errors/logger";
import { AppError } from "@/lib/errors/AppError";
import { requireTenantContext, toAuthErrorResponse } from "@/lib/security/tenantAuth";
import { CORRELATION_ID_HEADER } from "@/lib/observability/correlationId";
import { createScopedIdempotencyKey } from "@/lib/security/idempotency";

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

    const { message } = body || {};
    
    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return NextResponse.json(
        { error: "Invalid message: non-empty string is required" },
        { status: 400, headers: { [CORRELATION_ID_HEADER]: correlationId } }
      );
    }

    const tenantId = context.tenantId;
    const adminSupabase = createAdminClient();

    // 3. Save inbound message
    const { error: inboundError } = await adminSupabase.from("messages").insert({
      tenant_id: tenantId,
      channel: "whatsapp", // Mapped to whatsapp due to database enum constraints
      direction: "inbound",
      text: message.trim(),
      raw_payload: {},
      created_at: new Date().toISOString(),
    });
    if (inboundError) {
      logger.error({
        event: "AI_CHAT_INBOUND_INSERT_ERROR",
        correlationId,
        tenantId,
        error: inboundError,
        message: "Error inserting inbound chat message",
      });
    }

    // 4. Run the AI Agent with correlationId and idempotencyKey
    const customKey = request.headers.get("x-idempotency-key") || body?.idempotencyKey;
    const idempotencyKey = createScopedIdempotencyKey({
      prefix: "ai_chat",
      tenantId,
      userId: context.userId,
      payload: message.trim(),
      customKey,
    });

    const aiResult = await runBusinessAgent({
      tenantId,
      userMessage: message.trim(),
      channel: "web",
      idempotencyKey,
      correlationId,
    });

    // Handle string fallback just in case some logic still returns a string
    const aiResponse = typeof aiResult === "string" ? aiResult : aiResult.response;
    const productId = typeof aiResult === "string" ? null : aiResult.product_id;
    const isDuplicate = typeof aiResult === "string" ? false : aiResult.duplicate === true;

    // 5. Save outbound message (only if not duplicate)
    if (!isDuplicate) {
      const { error: outboundError } = await adminSupabase.from("messages").insert({
        tenant_id: tenantId,
        channel: "whatsapp", // Mapped to whatsapp due to database enum constraints
        direction: "outbound",
        text: aiResponse,
        product_id: productId,
        raw_payload: {},
        created_at: new Date().toISOString(),
      });
      if (outboundError) {
        logger.error({
          event: "AI_CHAT_OUTBOUND_INSERT_ERROR",
          correlationId,
          tenantId,
          error: outboundError,
          message: "Error inserting outbound chat message",
        });
      }
    }

    return NextResponse.json(
      { response: aiResponse, duplicate: isDuplicate },
      { status: 200, headers: { [CORRELATION_ID_HEADER]: correlationId } }
    );
  } catch (error: any) {
    if (error?.name === "TenantAuthError" || error?.statusCode === 401 || error?.statusCode === 403) {
      return toAuthErrorResponse(error, correlationId);
    }

    if (error?.status === 429 || error?.code === 'insufficient_quota') {
      logger.error(new AppError("OPENAI_QUOTA_EXCEEDED", "Sin saldo en OpenAI", 429, error.message), "AI_CHAT");
      return NextResponse.json(
        { error: "Nos hemos quedado sin saldo en el servicio de Inteligencia Artificial. Por favor, recarga tu cuenta de OpenAI." }, 
        { status: 429, headers: correlationId ? { [CORRELATION_ID_HEADER]: correlationId } : {} }
      );
    }
    
    logger.error({
      event: "AI_CHAT_ERROR",
      correlationId,
      error,
      message: error?.message || "Error interno procesando el chat",
    });
    return toAuthErrorResponse(error, correlationId);
  }
}
