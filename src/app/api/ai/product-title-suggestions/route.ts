import { NextResponse } from "next/server";
import { openai } from "@/lib/ai/openai";
import { logger } from "@/lib/errors/logger";
import { AppError } from "@/lib/errors/AppError";
import { consumeQuota } from "@/lib/billing/quotaService";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireTenantContext, toAuthErrorResponse } from "@/lib/security/tenantAuth";
import { CORRELATION_ID_HEADER } from "@/lib/observability/correlationId";
import { createScopedIdempotencyKey } from "@/lib/security/idempotency";

export async function POST(req: Request) {
  let correlationId: string | undefined;

  try {
    const context = await requireTenantContext(req);
    correlationId = context.correlationId;
    const tenantId = context.tenantId;

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON payload" },
        { status: 400, headers: { [CORRELATION_ID_HEADER]: correlationId } }
      );
    }

    const { product_id } = body || {};

    if (!product_id || typeof product_id !== "string") {
      return NextResponse.json(
        { error: "El ID del producto es requerido" },
        { status: 400, headers: { [CORRELATION_ID_HEADER]: correlationId } }
      );
    }

    const adminSupabase = createAdminClient();
    const { data: product, error: productError } = await adminSupabase
      .from("products")
      .select("id, title, sku, category_id, price, raw_data")
      .eq("id", product_id.trim())
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (productError || !product) {
      return NextResponse.json(
        { error: "Producto no encontrado" },
        { status: 404, headers: { [CORRELATION_ID_HEADER]: correlationId } }
      );
    }

    // Atomic quota reservation for 5 AI credits
    const customKey = req.headers.get("x-idempotency-key") || body?.idempotencyKey;
    const idempotencyKey = createScopedIdempotencyKey({
      prefix: "ai_title_sug",
      tenantId,
      userId: context.userId,
      payload: { product_id: product.id },
      customKey,
    });
    const quotaReservation = await consumeQuota({
      tenantId,
      metric: "ai_credits_used",
      amount: 5,
      idempotencyKey,
      source: "ai_product_title_suggestions",
      correlationId,
    });

    if (!quotaReservation.allowed) {
      return NextResponse.json(
        { error: "Límite mensual de consultas de Inteligencia Artificial alcanzado para tu plan." },
        { status: 429, headers: { [CORRELATION_ID_HEADER]: correlationId } }
      );
    }

    if (quotaReservation.duplicate) {
      return NextResponse.json(
        { suggestions: [], duplicate: true },
        { status: 200, headers: { [CORRELATION_ID_HEADER]: correlationId } }
      );
    }

    // Extract context for the prompt
    const promptContext = {
      title: product.title,
      sku: product.sku,
      category_id: product.category_id,
      price: product.price,
      description: product.raw_data?.description || "",
      attributes: product.raw_data?.attributes || [],
    };

    const prompt = `Sos un experto en optimización de títulos para Mercado Libre Argentina.
Generá entre 5 y 8 alternativas de título para esta publicación.

Reglas:
- máximo 60 caracteres
- español argentino neutro
- sin emojis
- sin inventar datos
- usar palabras clave buscables
- priorizar claridad y conversión
- no repetir títulos similares
- devolver solo JSON válido con esta forma:
{
  "suggestions": [
    { "title": "...", "reason": "..." }
  ]
}

Datos del producto:
Título actual: ${promptContext.title}
SKU: ${promptContext.sku || 'N/A'}
Categoría: ${promptContext.category_id || 'N/A'}
Precio: $${promptContext.price}
Descripción: ${JSON.stringify(promptContext.description).substring(0, 1000)}
Atributos: ${JSON.stringify(promptContext.attributes).substring(0, 1000)}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a specialized e-commerce assistant." },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const resultText = completion.choices[0]?.message?.content || '{"suggestions": []}';
    let resultJson;
    
    try {
      resultJson = JSON.parse(resultText);
    } catch {
      logger.error({
        event: "AI_SUGGESTIONS_PARSE_ERROR",
        correlationId,
        tenantId,
        message: "Error parsing OpenAI response for title suggestions",
      });
      return NextResponse.json(
        { error: "Error procesando las sugerencias de la IA" },
        { status: 500, headers: { [CORRELATION_ID_HEADER]: correlationId } }
      );
    }

    return NextResponse.json(
      resultJson,
      { status: 200, headers: { [CORRELATION_ID_HEADER]: correlationId } }
    );
  } catch (error: any) {
    logger.error({
      event: "AI_TITLE_SUGGESTIONS_ERROR",
      correlationId,
      error,
      message: error?.message || "Error interno del servidor",
    });
    return toAuthErrorResponse(error, correlationId);
  }
}
