// src/services/inventory/replenishment/ai/explainReplenishment.ts

import crypto from "crypto";
import { z } from "zod";
import { openai } from "@/lib/ai/openai";
import {
  FullReplenishmentRecommendation,
  ReplenishmentExplanation,
} from "../types";

export const ReplenishmentExplanationSchema = z.object({
  priorityExplanation: z.string(),
  trendSummary: z.string(),
  riskSummary: z.string(),
  recommendationExplanation: z.string(),
});

/**
 * Genera un hash determinístico para deduplicar explicaciones de IA.
 */
export function computeDedupeHash(rec: {
  sku: string | null;
  productId: string;
  recommendedUnits: number;
  sales7d: number;
  sales30d: number;
  fullStock: number;
  priority: string;
}): string {
  const payload = `${rec.sku || rec.productId}:${rec.recommendedUnits}:${rec.sales7d}:${rec.sales30d}:${rec.fullStock}:${rec.priority}`;
  return crypto.createHash("sha256").update(payload).digest("hex");
}

/**
 * Genera una explicación basada en reglas determinísticas (Fallback cuando la IA no está disponible).
 */
export function generateRuleBasedExplanation(
  rec: FullReplenishmentRecommendation
): ReplenishmentExplanation {
  const trendText =
    rec.trendPercent !== null && rec.trendPercent > 0
      ? `Las ventas del producto aceleraron un +${rec.trendPercent}% durante los últimos 7 días`
      : rec.trendPercent !== null && rec.trendPercent < 0
      ? `Las ventas del producto se desaceleraron un ${rec.trendPercent}% respecto al promedio mensual`
      : "El ritmo de ventas se mantiene estable respecto al promedio mensual";

  const accountText =
    rec.accountTrendPercent !== null && rec.accountTrendPercent > 0
      ? ` y la cuenta en general creció un +${rec.accountTrendPercent}%`
      : "";

  let riskSummary = "";
  if (rec.priority === "critical") {
    riskSummary = `Existe riesgo inminente de quiebre de stock en FULL (cobertura estimada: ${rec.coverageDays ?? 0} días).`;
  } else if (rec.priority === "high") {
    riskSummary = `Con el stock actual se alcanzará a cubrir aproximadamente ${rec.coverageDays ?? 0} días de demanda. Conviene reponer esta semana.`;
  } else if (rec.priority === "medium") {
    riskSummary = `El inventario actual cubre ${rec.coverageDays ?? 0} días. Planificar reposición antes de fin de mes.`;
  } else {
    riskSummary = `Stock suficiente en Bodega FULL (${rec.coverageDays ?? 0} días de cobertura estimada). No se requiere reposición inmediata.`;
  }

  const recommendationExplanation =
    rec.recommendedUnits > 0
      ? `Se sugiere enviar ${rec.recommendedUnits} unidades para alcanzar ${rec.targetCoverageDays} días de ventas proyectadas más ${rec.safetyDays} días de stock de seguridad.`
      : "No se requiere enviar unidades adicionales en este momento.";

  const priorityExplanation =
    rec.priority === "critical"
      ? "Prioridad Crítica: Quiebre de stock inminente."
      : rec.priority === "high"
      ? "Prioridad Alta: Reposición recomendada para esta semana."
      : rec.priority === "medium"
      ? "Prioridad Media: Reposición preventiva recomendada."
      : "Prioridad Óptima: Sin necesidad de reposición.";

  return {
    priorityExplanation,
    trendSummary: `${trendText}${accountText}.`,
    riskSummary,
    recommendationExplanation,
  };
}

/**
 * Enriquece la recomendación con OpenAI GPT-4o-Mini mediante Structured Outputs.
 * Si OpenAI no está configurado, falla o está activo el kill switch, retorna el fallback de reglas.
 */
export async function explainReplenishmentWithAI(
  rec: FullReplenishmentRecommendation
): Promise<ReplenishmentExplanation> {
  // 1. Kill Switch y Check de API Key
  if (
    process.env.LIBRETAX_DISABLE_AI_WRITES === "true" ||
    !process.env.OPENAI_API_KEY
  ) {
    return generateRuleBasedExplanation(rec);
  }

  // 2. Payload seguro (sin PII, sólo agregados analíticos)
  const safePayload = {
    productTitle: rec.title,
    sku: rec.sku,
    fullStock: rec.fullStock,
    internalStock: rec.internalStock,
    sales7d: rec.sales7d,
    sales14d: rec.sales14d,
    sales30d: rec.sales30d,
    velocity7d: rec.velocity7,
    velocity30d: rec.velocity30,
    forecastVelocity: rec.forecastVelocity,
    coverageDays: rec.coverageDays,
    recommendedUnits: rec.recommendedUnits,
    availableToSend: rec.availableToSend,
    priority: rec.priority,
    marginPercent: rec.marginPercent,
    adsActive: rec.adsActive,
    accountGrowthPercent: rec.accountTrendPercent,
  };

  try {
    const prompt = `
Sos el analista de reposición logística de LibretaX para Mercado Libre Bodegas FULL.
Tu tarea es EXPLICAR de forma ejecutiva, breve y profesional una recomendación de stock FULL que YA fue calculada determinísticamente por el sistema.

REGLAS CRÍTICAS:
1. NO cambies la cantidad sugerida de unidades (${rec.recommendedUnits} u.). El cálculo matemático es la única fuente de verdad.
2. NO inventes ventas, costos ni fechas.
3. NO prometas ventas futuras ni uses lenguaje exagerado.
4. Explica con claridad qué señales (aceleración/desaceleración, cobertura actual, stock interno) justifican la prioridad.
5. Si el margen es bajo o alto, menciónalo como contexto comercial prudente.

Datos del producto:
${JSON.stringify(safePayload, null, 2)}
`.trim();

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Sos el analista logístico de LibretaX. Responde en formato JSON estricto cumpliendo el schema.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "replenishment_explanation",
          strict: true,
          schema: {
            type: "object",
            properties: {
              priorityExplanation: { type: "string" },
              trendSummary: { type: "string" },
              riskSummary: { type: "string" },
              recommendationExplanation: { type: "string" },
            },
            required: [
              "priorityExplanation",
              "trendSummary",
              "riskSummary",
              "recommendationExplanation",
            ],
            additionalProperties: false,
          },
        },
      },
      temperature: 0.2,
      max_tokens: 350,
    });

    const rawContent = response.choices[0]?.message?.content;
    if (!rawContent) {
      return generateRuleBasedExplanation(rec);
    }

    const parsed = JSON.parse(rawContent);
    const validated = ReplenishmentExplanationSchema.safeParse(parsed);

    if (validated.success) {
      return validated.data;
    }

    return generateRuleBasedExplanation(rec);
  } catch (err) {
    console.warn("OpenAI replenishment explanation fallback triggered:", err);
    return generateRuleBasedExplanation(rec);
  }
}
