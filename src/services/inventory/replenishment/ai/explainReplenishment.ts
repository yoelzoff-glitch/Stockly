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
 * Sprint 32: Reposición FULL 100% Determinística (Zero OpenAI Consumption).
 * Retorna la explicación basada en reglas determinísticas a costo $0 sin llamadas a OpenAI.
 */
export async function explainReplenishmentWithAI(
  rec: FullReplenishmentRecommendation
): Promise<ReplenishmentExplanation> {
  // Sprint 32: 100% deterministic rule-based explanation with 0 OpenAI calls ($0 consumption)
  return generateRuleBasedExplanation(rec);
}
