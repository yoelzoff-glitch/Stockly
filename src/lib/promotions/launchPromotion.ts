/**
 * Centralized Launch Promotion Configuration & Pricing Logic
 * LibretaX Official Launch Campaign (10% OFF)
 */

export interface PromotionConfig {
  enabled: boolean;
  name: string;
  badgeText: string;
  headline: string;
  subheadline: string;
  discountPercentage: number;
  startsAt: string;
  endsAt: string;
  timezone: string;
}

export const LAUNCH_PROMOTION: PromotionConfig = {
  enabled: true,
  name: "Precio de lanzamiento",
  badgeText: "10% OFF",
  headline: "Precio especial de lanzamiento",
  subheadline: "Sumate a LibretaX durante el lanzamiento y accedé a un 10% de descuento.",
  discountPercentage: 10,
  startsAt: "2026-10-01T00:00:00-03:00",
  endsAt: "2026-12-01T00:00:00-03:00",
  timezone: "America/Argentina/Buenos_Aires",
};

export type PromotionStatus = "upcoming" | "active" | "expired";

/**
 * Returns the promotion status evaluated against the universal timestamp (UTC-03:00 equivalent).
 */
export function getPromotionStatus(now: Date = new Date()): PromotionStatus {
  if (!LAUNCH_PROMOTION.enabled) return "expired";

  const currentTime = now.getTime();
  const startTime = new Date(LAUNCH_PROMOTION.startsAt).getTime();
  const endTime = new Date(LAUNCH_PROMOTION.endsAt).getTime();

  if (currentTime < startTime) {
    return "upcoming";
  }
  if (currentTime >= startTime && currentTime < endTime) {
    return "active";
  }
  return "expired";
}

/**
 * Checks if the launch promotion is currently active.
 */
export function isPromotionActive(now: Date = new Date()): boolean {
  return getPromotionStatus(now) === "active";
}

export interface CalculatedPrice {
  baseAmount: number;
  promoAmount: number;
  normalPriceFormatted: string;
  promoPriceFormatted: string;
  discountPercentage: number;
}

/**
 * Calculates the promotional price with consistent rounding for USD and ARS.
 */
export function calculatePromotionalPrice(
  baseAmount: number,
  currency: "USD" | "ARS" = "USD",
  discountPercentage: number = LAUNCH_PROMOTION.discountPercentage
): CalculatedPrice {
  const discountFactor = 1 - discountPercentage / 100;
  const rawDiscounted = baseAmount * discountFactor;

  if (currency === "USD") {
    // Round to 2 decimals, respecting standard commercial .99 endings when original was .99
    // e.g. 49.99 * 0.9 = 44.991 -> 44.99
    // 79.99 * 0.9 = 71.991 -> 71.99
    // 129.99 * 0.9 = 116.991 -> 116.99
    const rounded = Math.round(rawDiscounted * 100) / 100;
    const normalFormatted = `$ ${baseAmount.toFixed(2).replace(".", ",")} USD`;
    const promoFormatted = `$ ${rounded.toFixed(2).replace(".", ",")} USD`;

    return {
      baseAmount,
      promoAmount: rounded,
      normalPriceFormatted: normalFormatted,
      promoPriceFormatted: promoFormatted,
      discountPercentage,
    };
  } else {
    // ARS / integer currency rounding
    const rounded = Math.round(rawDiscounted);
    const normalFormatted = `$ ${baseAmount.toLocaleString("es-AR")}`;
    const promoFormatted = `$ ${rounded.toLocaleString("es-AR")}`;

    return {
      baseAmount,
      promoAmount: rounded,
      normalPriceFormatted: normalFormatted,
      promoPriceFormatted: promoFormatted,
      discountPercentage,
    };
  }
}

export interface CountdownTimeRemaining {
  totalMs: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isExpired: boolean;
}

/**
 * Calculates remaining time until promotion ends.
 */
export function getPromotionTimeRemaining(now: Date = new Date()): CountdownTimeRemaining {
  const endTime = new Date(LAUNCH_PROMOTION.endsAt).getTime();
  const totalMs = Math.max(0, endTime - now.getTime());
  const isExpired = totalMs <= 0;

  const seconds = Math.floor((totalMs / 1000) % 60);
  const minutes = Math.floor((totalMs / 1000 / 60) % 60);
  const hours = Math.floor((totalMs / (1000 * 60 * 60)) % 24);
  const days = Math.floor(totalMs / (1000 * 60 * 60 * 24));

  return {
    totalMs,
    days,
    hours,
    minutes,
    seconds,
    isExpired,
  };
}

export interface PlanPricingItem {
  id: string;
  name: string;
  skuLimit: string;
  baseAmount: number;
  billingPeriod: string;
  description: string;
  features: string[];
  ctaText: string;
  isPopular?: boolean;
}

export const CANONICAL_PLANS: PlanPricingItem[] = [
  {
    id: "starter",
    name: "Starter",
    skuLimit: "Hasta 100 SKUs activos",
    baseAmount: 49.99,
    billingPeriod: "/ mes",
    description: "Para pequeños vendedores que inician el orden de su operativa.",
    features: [
      "15 días de prueba gratis",
      "Auditoría de comisiones y margen neto",
      "Monitoreo de órdenes y costos de envío",
      "Control de stock interno en depósito",
      "500 consultas de IA mensuales",
      "250 procesos automáticos de sincronización",
      "1 número de WhatsApp vinculado",
    ],
    ctaText: "Probar Starter",
  },
  {
    id: "pro",
    name: "Pro",
    skuLimit: "Hasta 400 SKUs activos",
    baseAmount: 79.99,
    billingPeriod: "/ mes",
    description: "Para catálogos medianos con volumen constante de ventas.",
    features: [
      "Todo lo incluido en Starter",
      "15 días de prueba gratis",
      "Cálculo de rentabilidad sobre Mercado Libre Ads",
      "1.500 consultas de IA mensuales",
      "800 procesos automáticos de sincronización",
      "Hasta 2 números de WhatsApp vinculados",
      "Soporte prioritario por canales directos",
    ],
    ctaText: "Probar Pro",
    isPopular: true,
  },
  {
    id: "ultra",
    name: "Ultra",
    skuLimit: "Hasta 1.000 SKUs activos",
    baseAmount: 129.99,
    billingPeriod: "/ mes",
    description: "Para cuentas de alto volumen con múltiples líneas de producto.",
    features: [
      "Todo lo incluido en Pro",
      "15 días de prueba gratis",
      "Seguimiento de combos sin descalce de insumos",
      "5.000 consultas de IA mensuales",
      "1.500 procesos automáticos mensuales",
      "Hasta 2 números de WhatsApp vinculados",
      "Alertas preventivas de quiebre de stock",
    ],
    ctaText: "Probar Ultra",
  },
];
