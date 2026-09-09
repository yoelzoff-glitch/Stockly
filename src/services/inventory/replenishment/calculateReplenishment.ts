// src/services/inventory/replenishment/calculateReplenishment.ts

import { REPLENISHMENT_CONFIG } from "./config";
import {
  ReplenishmentSnapshot,
  FullReplenishmentRecommendation,
  ReplenishmentPriority,
  ReplenishmentConfidence,
} from "./types";

/**
 * Clamps a number between min and max.
 */
function clamp(val: number, min: number, max: number): number {
  return Math.min(Math.max(val, min), max);
}

/**
 * Motor determinístico puro para calcular la recomendación de reposición FULL.
 * Sin llamadas a bases de datos, sin OpenAI, sin side-effects.
 */
export function calculateReplenishment(
  snapshot: ReplenishmentSnapshot
): FullReplenishmentRecommendation {
  const {
    productId,
    sku,
    title,
    thumbnailUrl = null,
    fullStock,
    internalStock,
    sales7d: rawSales7d,
    sales14d: rawSales14d,
    sales30d: rawSales30d,
    sales60d,
    unitCost = null,
    marginPercent = null,
    adsActive = false,
  } = snapshot;

  // Outlier containment: sales in 7d cannot physically exceed 30d total if accurate
  const sales30d = Math.max(0, rawSales30d);
  const sales14d = Math.max(0, Math.min(rawSales14d, sales30d * 1.5));
  const sales7d = Math.max(0, Math.min(rawSales7d, sales14d * 1.25, sales30d));

  // 1. Velocidad Diaria por ventana
  const velocity7 = Number((sales7d / 7).toFixed(3));
  const velocity14 = Number((sales14d / 14).toFixed(3));
  const velocity30 = Number((sales30d / 30).toFixed(3));

  // 2. Velocidad Ponderada (período reciente pesa más)
  const weightedVelocity = Number(
    (
      velocity7 * REPLENISHMENT_CONFIG.WEIGHT_7D +
      velocity14 * REPLENISHMENT_CONFIG.WEIGHT_14D +
      velocity30 * REPLENISHMENT_CONFIG.WEIGHT_30D
    ).toFixed(3)
  );

  // 3. Factor de Tendencia del Producto (acotado entre 0.80 y 1.35)
  let trendVs30: number | null = null;
  let productTrendFactor = 1.0;

  if (velocity30 > 0) {
    trendVs30 = (velocity7 / velocity30) - 1;
    productTrendFactor = clamp(
      1 + trendVs30,
      REPLENISHMENT_CONFIG.PRODUCT_TREND_MIN,
      REPLENISHMENT_CONFIG.PRODUCT_TREND_MAX
    );
  } else if (velocity7 > 0) {
    // Producto nuevo con ventas recientes pero sin historial de 30 días
    trendVs30 = 1.0; // +100%
    productTrendFactor = 1.15;
  }

  // 4. Factor de Tendencia de la Cuenta General (acotado entre 0.90 y 1.15)
  let accountTrendFactor = 1.0;
  let accountTrendPercent: number | null = null;

  if (snapshot.accountGrowth7d !== undefined && snapshot.accountGrowth7d !== null) {
    accountTrendPercent = Number((snapshot.accountGrowth7d * 100).toFixed(1));
    accountTrendFactor = clamp(
      1 + snapshot.accountGrowth7d * 0.5,
      REPLENISHMENT_CONFIG.ACCOUNT_TREND_MIN,
      REPLENISHMENT_CONFIG.ACCOUNT_TREND_MAX
    );
  } else if (
    snapshot.accountOrdersLast7d !== undefined &&
    snapshot.accountOrdersPrev7d !== undefined &&
    snapshot.accountOrdersPrev7d > 0
  ) {
    const rawGrowth =
      (snapshot.accountOrdersLast7d / snapshot.accountOrdersPrev7d) - 1;
    accountTrendPercent = Number((rawGrowth * 100).toFixed(1));
    accountTrendFactor = clamp(
      1 + rawGrowth * 0.5,
      REPLENISHMENT_CONFIG.ACCOUNT_TREND_MIN,
      REPLENISHMENT_CONFIG.ACCOUNT_TREND_MAX
    );
  }

  // 5. Velocidad Proyectada (Forecast Velocity)
  let forecastVelocity = Number(
    (weightedVelocity * productTrendFactor * accountTrendFactor).toFixed(2)
  );

  // Si no hay ventas en 30 días ni en 7 días, velocidad = 0
  if (sales30d === 0 && sales7d === 0) {
    forecastVelocity = 0;
  }

  // 6. Cobertura en Días
  const coverageDays =
    forecastVelocity > 0
      ? Number((fullStock / forecastVelocity).toFixed(1))
      : null;

  // 7. Reposición Sugerida Base
  const targetCoverageDays = REPLENISHMENT_CONFIG.TARGET_FULL_DAYS;
  const safetyDays = REPLENISHMENT_CONFIG.SAFETY_DAYS;
  const totalTargetDays = targetCoverageDays + safetyDays; // 26 días

  let recommendedUnits = 0;

  if (sales30d > 0 || sales7d > 0) {
    const targetUnits = forecastVelocity * totalTargetDays;
    const needed = Math.ceil(targetUnits - fullStock);
    recommendedUnits = Math.max(0, needed);
  }

  // 8. Disponibilidad para Enviar (Stock Interno)
  const availableToSend =
    internalStock !== null
      ? Math.max(0, Math.min(internalStock, recommendedUnits))
      : null;

  // 9. Clasificación de Prioridad
  let priority: ReplenishmentPriority = "ok";

  if (sales30d === 0 && sales7d === 0) {
    priority = "ok";
  } else if (coverageDays !== null) {
    if (coverageDays <= REPLENISHMENT_CONFIG.CRITICAL_COVERAGE_DAYS) {
      priority = "critical";
    } else if (coverageDays <= REPLENISHMENT_CONFIG.HIGH_COVERAGE_DAYS) {
      priority = "high";
    } else if (coverageDays <= REPLENISHMENT_CONFIG.MEDIUM_COVERAGE_DAYS) {
      priority = "medium";
    } else {
      priority = "ok";
    }
  } else {
    // Si forecastVelocity > 0 y fullStock === 0, quiebre inminente
    if (fullStock === 0 && (sales7d > 0 || sales30d > 0)) {
      priority = "critical";
    } else {
      priority = "ok";
    }
  }

  // Si no se recomienda enviar nada (stock suficiente o cubierto), prioridad = "ok"
  if (recommendedUnits === 0 && fullStock > 0) {
    priority = "ok";
  }

  // 10. Nivel de Confianza
  let confidence: ReplenishmentConfidence = "medium";

  if (sales30d >= 10 && sales7d > 0) {
    confidence = "high";
  } else if (sales30d < 3) {
    confidence = "low";
  }

  // 11. Capital Necesario
  const capitalRequired =
    unitCost !== null && recommendedUnits > 0
      ? Math.round(recommendedUnits * unitCost)
      : null;

  return {
    productId,
    sku,
    title,
    thumbnailUrl,

    fullStock,
    internalStock,

    sales7d,
    sales14d,
    sales30d,
    sales60d,

    velocity7,
    velocity14,
    velocity30,

    weightedVelocity,
    forecastVelocity,

    coverageDays,

    targetCoverageDays,
    safetyDays,

    recommendedUnits,
    availableToSend,

    priority,
    confidence,

    trendPercent: trendVs30 !== null ? Number((trendVs30 * 100).toFixed(0)) : null,
    accountTrendPercent,

    unitCost,
    marginPercent,
    capitalRequired,

    adsActive,

    aiExplanation: null, // Asignado por capa de IA o fallback
    calculatedAt: new Date().toISOString(),
  };
}
