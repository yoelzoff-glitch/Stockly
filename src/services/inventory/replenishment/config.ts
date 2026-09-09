// src/services/inventory/replenishment/config.ts

/**
 * Parámetros determinísticos para el modelo de forecast de reposición FULL.
 */
export const REPLENISHMENT_CONFIG = {
  // Cobertura deseada: 3 semanas en Bodega FULL
  TARGET_FULL_DAYS: 21,

  // Stock de seguridad adicional
  SAFETY_DAYS: 5,

  // Ponderaciones de velocidad (el período reciente pesa más)
  WEIGHT_7D: 0.50,
  WEIGHT_14D: 0.30,
  WEIGHT_30D: 0.20,

  // Límites para el factor de tendencia del producto (evita picos absurdos)
  PRODUCT_TREND_MIN: 0.80,
  PRODUCT_TREND_MAX: 1.35,

  // Límites para la influencia del crecimiento general de la cuenta
  ACCOUNT_TREND_MIN: 0.90,
  ACCOUNT_TREND_MAX: 1.15,

  // Umbrales de cobertura para priorización
  CRITICAL_COVERAGE_DAYS: 5, // <= 5 días
  HIGH_COVERAGE_DAYS: 10,    // <= 10 días
  MEDIUM_COVERAGE_DAYS: 18,  // <= 18 días
} as const;
