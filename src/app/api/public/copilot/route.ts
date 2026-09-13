import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { runPublicAssistant } from "@/services/ai/public/publicAgent";
import { checkPublicRateLimit } from "@/services/ai/public/publicRateLimiter";
import { logger } from "@/lib/errors/logger";
import { CORRELATION_ID_HEADER, getOrCreateCorrelationId } from "@/lib/observability/correlationId";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const correlationId = getOrCreateCorrelationId(req.headers.get(CORRELATION_ID_HEADER));

  try {
    // 1. Feature flag check (Rollback support)
    if (process.env.PUBLIC_COPILOT_ENABLED === "false") {
      return NextResponse.json(
        { error: "El servicio de consultas públicas está temporalmente deshabilitado." },
        { status: 503, headers: { [CORRELATION_ID_HEADER]: correlationId } }
      );
    }

    // 2. Client IP extraction & SHA-256 hash
    const forwarded = req.headers.get("x-forwarded-for") || "";
    const ip = forwarded.split(",")[0].trim() || "127.0.0.1";
    const ipHash = crypto.createHash("sha256").update(ip).digest("hex").slice(0, 16);

    // 3. Payload size check
    const contentLength = req.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > 16384) {
      return NextResponse.json(
        { error: "Payload demasiado grande" },
        { status: 413, headers: { [CORRELATION_ID_HEADER]: correlationId } }
      );
    }

    // 4. Body parsing
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Formato de datos JSON inválido" },
        { status: 400, headers: { [CORRELATION_ID_HEADER]: correlationId } }
      );
    }

    // Explicitly reject/discard tenant-identifying fields to enforce complete isolation
    const {
      message,
      page = "/",
      history = [],
      publicSessionId,
      // The following fields must NEVER be used:
      tenantId: _discardedTenantId,
      userId: _discardedUserId,
      companyId: _discardedCompanyId,
      accountId: _discardedAccountId,
    } = body || {};

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return NextResponse.json(
        { error: "Mensaje requerido" },
        { status: 400, headers: { [CORRELATION_ID_HEADER]: correlationId } }
      );
    }

    // 5. Rate limiting check (IP hash + session)
    const rateLimit = checkPublicRateLimit(ipHash, publicSessionId);
    if (!rateLimit.allowed) {
      logger.warn({
        event: "PUBLIC_COPILOT_RATE_LIMITED",
        correlationId,
        ipHash,
        reason: rateLimit.reason,
      });

      return NextResponse.json(
        { error: "Alcanzaste temporalmente el límite de consultas. Probá nuevamente más tarde." },
        { status: 429, headers: { [CORRELATION_ID_HEADER]: correlationId } }
      );
    }

    // 6. Run isolated Public Assistant
    const result = await runPublicAssistant({
      message: message.trim(),
      page: typeof page === "string" ? page.slice(0, 100) : "/",
      history: Array.isArray(history) ? history : [],
      publicSessionId: typeof publicSessionId === "string" ? publicSessionId : undefined,
      correlationId,
    });

    return NextResponse.json(
      {
        response: result.response,
        metadata: {
          provider: result.metadata.provider,
          model: result.metadata.model,
        },
      },
      { status: 200, headers: { [CORRELATION_ID_HEADER]: correlationId } }
    );
  } catch (error: any) {
    logger.error({
      event: "PUBLIC_COPILOT_ROUTE_ERROR",
      correlationId,
      error: error?.message || error,
    });

    return NextResponse.json(
      {
        response: "En este momento no puedo responder tu consulta sobre LibretaX. Por favor probá de nuevo en unos momentos.",
      },
      { status: 500, headers: { [CORRELATION_ID_HEADER]: correlationId } }
    );
  }
}
