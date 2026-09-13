import { NextResponse } from "next/server";
import { getGeminiModel } from "@/lib/ai/gemini";
import { requireTenantContext, toAuthErrorResponse } from "@/lib/security/tenantAuth";
import { consumeQuota } from "@/lib/billing/quotaService";
import { createScopedIdempotencyKey } from "@/lib/security/idempotency";
import { CORRELATION_ID_HEADER } from "@/lib/observability/correlationId";
import { resolveCompetitor } from "@/services/meli/competitor/resolver";
import {
  normalizeCompetitorData,
  validateCompetitorSnapshot,
} from "@/services/meli/competitor/normalizer";
import {
  CompetitorAnalysisError,
  CompetitorSnapshot,
} from "@/services/meli/competitor/types";
import { logger } from "@/lib/errors/logger";

export interface HandleCompetitorAnalysisOptions {
  testContext?: any;
  mockQuotaResult?: any;
  mockGeminiModel?: any;
}

export async function handleCompetitorAnalysis(
  request: Request,
  options?: HandleCompetitorAnalysisOptions
) {
  let correlationId: string | undefined;

  try {
    const context = options?.testContext || (await requireTenantContext(request));
    correlationId = context.correlationId;
    const tenantId = context.tenantId;

    const responseHeaders: Record<string, string> = correlationId
      ? { [CORRELATION_ID_HEADER]: correlationId }
      : {};

    if (context.isDemo) {
      return NextResponse.json(
        {
          analysis: {
            summary:
              "Análisis de competencia simulado para la cuenta demostrativa (Casa Norte). En producción, esta función consulta información pública en tiempo real de Mercado Libre y ejecuta análisis de posicionamiento con Gemini.",
            competitors: [
              {
                title: "Lámpara Nórdica Madera y Metal",
                price: 28900,
                sold_quantity: 120,
                reputation: "MercadoLíder Platinum",
              },
              {
                title: "Lámpara de Escritorio Minimalista",
                price: 31500,
                sold_quantity: 85,
                reputation: "MercadoLíder Gold",
              },
            ],
            recommendations: [
              "Mantener precio competitivo dentro del rango $28.000 - $31.000.",
              "Destacar acabado en madera natural y despacho inmediato FULL.",
            ],
          },
          demo: true,
        },
        { headers: responseHeaders }
      );
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON payload" },
        { status: 400, headers: responseHeaders }
      );
    }

    const { action = "resolve", url, clientData } = body || {};

    // ==========================================
    // ACTION: RESOLVE
    // ==========================================
    if (action === "resolve") {
      if (!url || typeof url !== "string") {
        return NextResponse.json(
          { error: "URL is required" },
          { status: 400, headers: responseHeaders }
        );
      }

      try {
        const snapshot = await resolveCompetitor({
          url,
          tenantId,
          correlationId,
          clientData,
        });

        return NextResponse.json(
          {
            success: true,
            data: {
              snapshot,
              partial: snapshot.resolution.partial,
              resolvedId: snapshot.sourceId,
              // Compatibility fields for legacy consumers
              id: snapshot.sourceId,
              itemData: {
                id: snapshot.sourceId,
                title: snapshot.title,
                price: snapshot.price,
                original_price: snapshot.originalPrice,
                permalink: snapshot.permalink,
                thumbnail: snapshot.thumbnail,
                listing_type_id: snapshot.listingTypeId,
                shipping: {
                  free_shipping: snapshot.shipping.freeShipping,
                  logistic_type: snapshot.shipping.logisticType,
                },
                available_quantity: snapshot.availableQuantity,
                sold_quantity: snapshot.soldQuantity,
                attributes: snapshot.attributes,
              },
              sellerData: {
                id: snapshot.seller.id,
                nickname: snapshot.seller.nickname,
                seller_reputation: {
                  level_id: snapshot.seller.reputationLevel,
                  power_seller_status: snapshot.seller.powerSellerStatus,
                },
              },
              isCatalogProduct: snapshot.sourceType === "catalog",
            },
          },
          { headers: responseHeaders }
        );
      } catch (err: any) {
        if (err instanceof CompetitorAnalysisError) {
          logger.warn({
            event: "COMPETITOR_RESOLVE_BUSINESS_ERROR",
            tenantId,
            correlationId,
            code: err.competitorCode,
            message: err.message,
          });
          return NextResponse.json(
            {
              error: err.message,
              code: err.competitorCode,
            },
            { status: err.statusCode, headers: responseHeaders }
          );
        }
        throw err;
      }
    }

    // ==========================================
    // ACTION: ANALYZE (or legacy "all")
    // ==========================================
    if (action === "analyze" || action === "all") {
      // Check if Gemini API Key is configured
      if (!process.env.GEMINI_API_KEY && !options?.mockGeminiModel) {
        return NextResponse.json(
          {
            error:
              "La clave de API de Gemini (GEMINI_API_KEY) no está configurada en el servidor. Asegúrate de haberla agregado en las variables de entorno de Vercel y haber redesplegado la aplicación.",
          },
          { status: 500, headers: responseHeaders }
        );
      }

      // Reconstruct or extract snapshot
      let snapshot: CompetitorSnapshot;
      if (body.snapshot && typeof body.snapshot === "object") {
        snapshot = body.snapshot as CompetitorSnapshot;
      } else if (body.itemData) {
        // Compatibility mode for raw item payloads
        const resolvedId = body.resolvedId ?? body.id ?? body.itemData?.id ?? "UNKNOWN";
        snapshot = normalizeCompetitorData({
          sourceId: resolvedId,
          sourceType: body.isCatalogProduct ? "catalog" : "item",
          itemData: body.itemData,
          sellerData: body.sellerData,
          description: body.description,
          resolutionSource: "legacy_body_payload",
        });
      } else {
        return NextResponse.json(
          { error: "Se requiere snapshot de la publicación para ejecutar el análisis" },
          { status: 400, headers: responseHeaders }
        );
      }

      // Validate minimum viable fields
      const validation = validateCompetitorSnapshot(snapshot);
      if (!validation.valid) {
        return NextResponse.json(
          {
            error:
              "No pudimos obtener suficiente información pública de esta publicación. Mercado Libre restringe algunos datos de determinadas publicaciones. Probá con el enlace directo del producto o con otra publicación.",
            code: "COMPETITOR_INSUFFICIENT_DATA",
          },
          { status: 422, headers: responseHeaders }
        );
      }

      const canonicalResolvedId = body.resolvedId ?? body.id ?? snapshot.sourceId;

      // Atomic quota reservation before invoking Gemini
      const customKey = request.headers.get("x-idempotency-key") || body?.idempotencyKey;
      const idempotencyKey = createScopedIdempotencyKey({
        prefix: "ai_comp_analysis",
        tenantId,
        userId: context.userId,
        payload: { item_id: canonicalResolvedId, title: snapshot.title },
        customKey,
      });

      const quotaReservation = options?.mockQuotaResult || (await consumeQuota({
        tenantId,
        metric: "ai_credits_used",
        amount: 1,
        idempotencyKey,
        source: "ai_competitor_analysis",
        correlationId,
      }));

      if (!quotaReservation.allowed) {
        return NextResponse.json(
          { error: "Límite mensual de consultas de Inteligencia Artificial alcanzado para tu plan." },
          { status: 429, headers: responseHeaders }
        );
      }

      if (quotaReservation.duplicate) {
        return NextResponse.json(
          { analysis: { duplicate: true, message: "Solicitud duplicada ya procesada" }, duplicate: true },
          { status: 200, headers: responseHeaders }
        );
      }

      // Prepare strict prompt payload for Gemini
      const competitorPayload = {
        title: snapshot.title,
        price: snapshot.price,
        original_price: snapshot.originalPrice,
        available_quantity: snapshot.availableQuantity ?? "No especificado por Mercado Libre",
        sold_quantity:
          snapshot.soldQuantity !== null
            ? snapshot.soldQuantity
            : "No disponible (Mercado Libre no expone este dato)",
        listing_type:
          snapshot.listingTypeId === "gold_pro"
            ? "Premium (Ofrece Cuotas sin Interés)"
            : snapshot.listingTypeId === "gold_special"
              ? "Clásica (Cuotas con interés estándar)"
              : snapshot.listingTypeId || "No especificado",
        free_shipping: snapshot.shipping.freeShipping,
        logistic_type: snapshot.shipping.logisticType || "No especificado",
        seller_nickname: snapshot.seller.nickname || "No disponible",
        seller_reputation: snapshot.seller.powerSellerStatus
          ? `MercadoLíder ${snapshot.seller.powerSellerStatus.replace(/_/g, " ")}`
          : snapshot.seller.reputationLevel
            ? `Nivel ${snapshot.seller.reputationLevel}`
            : "No disponible",
        description: (snapshot.description || "No disponible").substring(0, 2500),
        attributes: snapshot.attributes.slice(0, 15),
        is_partial_data: snapshot.resolution.partial,
        unavailable_fields: snapshot.resolution.unavailableFields,
      };

      let analysisResult: any;
      try {
        const model = options?.mockGeminiModel || getGeminiModel("gemini-2.5-flash");
        const prompt = `
        Actúa como un analista experto en E-commerce y Mercado Libre de Latinoamérica.
        Analiza la siguiente publicación de la competencia y proporciona un análisis estratégico detallado estructurado en JSON.

        INSTRUCCIONES ESTRICTAS:
        1. Utiliza ÚNICAMENTE la información provista. NUNCA inventes información no disponible.
        2. Cuando un atributo, descripción o vendedor figure como "No disponible" o falte en los datos, indícalo expresamente señalando que Mercado Libre no expuso ese dato.
        3. NUNCA inventes una cantidad de ventas. Si el campo "sold_quantity" figura como "No disponible", coloca textualmente en "estimatedSales": "Mercado Libre no expone este dato".
        4. Realiza el diagnóstico estratégico y plan de acción aprovechando al máximo los datos disponibles (precio, envío, tipo de listado, atributos).

        Datos de la Publicación Competidora:
        ${JSON.stringify(competitorPayload, null, 2)}

        El JSON devuelto DEBE seguir estrictamente esta estructura y todos los campos deben ser en español:
        {
          "title": "Título analizado",
          "price": precio_numero,
          "listingType": "Clásica o Premium",
          "shipping": "Detalle del envío",
          "estimatedSales": "Ventas estimadas o 'Mercado Libre no expone este dato'",
          "reputation": "Nivel de reputación del vendedor o 'No disponible'",
          "analysis": {
            "strengths": ["Punto fuerte 1", "Punto fuerte 2", "Punto fuerte 3"],
            "weaknesses": ["Punto débil 1", "Punto débil 2", "Punto débil 3"],
            "opportunities": ["Oportunidad para ganarle 1", "Oportunidad para ganarle 2", "Oportunidad para ganarle 3"]
          },
          "pricingStrategy": "Análisis detallado de su estrategia de precio, financiamiento en cuotas y envío gratis.",
          "actionPlan": [
            "Paso 1 del plan de acción para superarlo",
            "Paso 2 del plan de acción para superarlo",
            "Paso 3 del plan de acción para superarlo"
          ]
        }
        `;

        const result = await model.generateContent({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
          },
        });

        const responseText = result.response.text();
        analysisResult = JSON.parse(responseText);
      } catch (geminiError: any) {
        logger.error({
          event: "COMPETITOR_GEMINI_CALL_FAILED",
          tenantId,
          correlationId,
          error: geminiError?.message,
        });
        return NextResponse.json(
          {
            error: `Error al conectar con la Inteligencia Artificial (Gemini): ${
              geminiError.message || "Por favor verifica que la clave de API sea válida."
            }`,
          },
          { status: 502, headers: responseHeaders }
        );
      }

      return NextResponse.json(
        {
          success: true,
          data: {
            ...analysisResult,
            permalink: snapshot.permalink || url,
            thumbnail: snapshot.thumbnail,
            resolvedId: canonicalResolvedId,
            snapshot,
            partial: snapshot.resolution.partial,
          },
        },
        { headers: responseHeaders }
      );
    }

    return NextResponse.json(
      { error: "Acción inválida. Usa 'resolve' o 'analyze'." },
      { status: 400, headers: responseHeaders }
    );
  } catch (error: any) {
    return toAuthErrorResponse(error, correlationId);
  }
}

export async function POST(request: Request) {
  return handleCompetitorAnalysis(request);
}
