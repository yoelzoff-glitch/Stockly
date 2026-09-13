import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { runBusinessAgent } from "@/services/ai/agent";
import { logger } from "@/lib/errors/logger";
import { requireTenantContext, toAuthErrorResponse } from "@/lib/security/tenantAuth";
import { CORRELATION_ID_HEADER } from "@/lib/observability/correlationId";
import { createScopedIdempotencyKey } from "@/lib/security/idempotency";

export async function POST(request: Request) {
  let correlationId: string | undefined;

  try {
    const context = await requireTenantContext(request);
    correlationId = context.correlationId;

    // Feature flag check (Backend rollback support)
    if (process.env.COPILOT_ENABLED === "false") {
      return NextResponse.json(
        { error: "El servicio de Copilot está temporalmente deshabilitado." },
        { status: 503, headers: { [CORRELATION_ID_HEADER]: correlationId } }
      );
    }

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

    if (context.isDemo) {
      logger.info({
        event: "DEMO_TENANT_SKIPPED_EXTERNAL_OPERATION",
        tenantId,
        operation: "ai_chat",
        message: "Skipping AI chat execution for demo tenant",
      });
      return NextResponse.json(
        {
          response: "Esta es una cuenta demostrativa privada (Casa Norte). La ejecución en vivo de modelos de IA y el consumo de cuotas están deshabilitados. Podés explorar todas las métricas, productos y herramientas con datos precargados.",
          metadata: {
            provider: "demo",
            model: "demo-readonly",
            toolsUsed: [],
          },
          duplicate: false,
        },
        { headers: { [CORRELATION_ID_HEADER]: correlationId } }
      );
    }

    const adminSupabase = createAdminClient();

    // 1. Save inbound message under copilot channel
    const { error: inboundError } = await adminSupabase.from("messages").insert({
      tenant_id: tenantId,
      channel: "copilot",
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

    // 2. Run the AI Agent with correlationId, idempotencyKey, and copilot channel
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
      channel: "copilot",
      idempotencyKey,
      correlationId,
    });

    // Handle response formatting
    const aiResponse = typeof aiResult === "string" ? aiResult : aiResult.response;
    const productId = typeof aiResult === "string" ? null : aiResult.product_id;
    const isDuplicate = typeof aiResult === "string" ? false : aiResult.duplicate === true;
    const metadata = typeof aiResult === "object" && aiResult.metadata ? aiResult.metadata : {
      provider: "gemini",
      model: process.env.GEMINI_MODEL_PRIMARY || "gemini-3.7-flash",
      toolsUsed: [],
      fallbackCount: 0,
    };

    // 3. Save outbound message under copilot channel (only if not duplicate)
    if (!isDuplicate) {
      const { error: outboundError } = await adminSupabase.from("messages").insert({
        tenant_id: tenantId,
        channel: "copilot",
        direction: "outbound",
        text: aiResponse,
        product_id: productId,
        raw_payload: { metadata },
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
      {
        response: aiResponse,
        metadata: {
          provider: metadata.provider,
          model: metadata.model,
          toolsUsed: metadata.toolsUsed,
        },
        duplicate: isDuplicate,
      },
      { status: 200, headers: { [CORRELATION_ID_HEADER]: correlationId } }
    );
  } catch (error: any) {
    if (error?.name === "TenantAuthError" || error?.statusCode === 401 || error?.statusCode === 403) {
      return toAuthErrorResponse(error, correlationId);
    }

    if (error?.status === 429 || error?.code === 'insufficient_quota' || error?.message?.includes("quota")) {
      return NextResponse.json(
        { response: "El servicio de IA está temporalmente ocupado o alcanzaste el límite mensual de consultas. Probá de nuevo en unos segundos." }, 
        { status: 429, headers: correlationId ? { [CORRELATION_ID_HEADER]: correlationId } : {} }
      );
    }
    
    logger.error({
      event: "AI_CHAT_ERROR",
      correlationId,
      error: error?.message || error,
      message: "Error interno procesando el chat",
    });

    return NextResponse.json(
      { response: "No pude consultar tus datos en este momento. Por favor intentá nuevamente más tarde." },
      { status: 500, headers: correlationId ? { [CORRELATION_ID_HEADER]: correlationId } : {} }
    );
  }
}
