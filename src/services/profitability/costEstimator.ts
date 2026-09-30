// src/services/profitability/costEstimator.ts
import { CategoryRateInfo, EstimateSellingCostsParams, SellingCostsBreakdown } from "./types";

/**
 * Categorías oficiales frecuentes de Mercado Libre Argentina (MLA) con sus alícuotas de referencia
 * para publicación Clásica (gold_special) y Premium (gold_pro).
 */
export const POPULAR_CATEGORIES_INFO: CategoryRateInfo[] = [
  { id: "MLA1430", name: "Ropa y Accesorios", clasicaPercent: 15.5, premiumPercent: 31.5 },
  { id: "MLA3937", name: "Joyas y Relojes", clasicaPercent: 14.0, premiumPercent: 30.0 },
  { id: "MLA1051", name: "Celulares y Teléfonos", clasicaPercent: 11.5, premiumPercent: 27.5 },
  { id: "MLA1000", name: "Electrónica, Audio y Video", clasicaPercent: 13.0, premiumPercent: 29.0 },
  { id: "MLA1574", name: "Hogar, Muebles y Jardín", clasicaPercent: 15.0, premiumPercent: 31.0 },
  { id: "MLA1276", name: "Deportes y Fitness", clasicaPercent: 14.5, premiumPercent: 30.5 },
  { id: "MLA1246", name: "Belleza y Cuidado Personal", clasicaPercent: 15.0, premiumPercent: 31.0 },
  { id: "MLA1132", name: "Juegos y Juguetes", clasicaPercent: 15.0, premiumPercent: 31.0 },
  { id: "MLA1743", name: "Autopartes y Accesorios", clasicaPercent: 14.5, premiumPercent: 30.5 },
  { id: "MLA1071", name: "Computación", clasicaPercent: 12.0, premiumPercent: 28.0 },
];

/**
 * Redondeo exacto a 2 decimales para operaciones monetarias seguras.
 */
function round2(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

/**
 * Calcula el costo de envío oficial para el vendedor en Mercado Envíos Argentina (MLA).
 * Reutiliza las reglas oficiales del módulo interno:
 * - Para ventas >= $33.000 el envío gratis es obligatorio en publicaciones nuevas y bonificado hasta un 50% por ML.
 * - Para ventas < $33.000 el vendedor absorbe el 100% de la tarifa si ofrece envío gratis voluntario.
 * - Si no ofrece envío gratis, el comprador abona el envío (costo para el vendedor = $0).
 */
export function estimateShippingCost(
  price: number,
  freeShipping: boolean = false,
  billableWeight?: number,
  customShippingCost?: number
): {
  sellerShippingCost: number;
  totalShippingCost: number;
  mlShippingDiscount: number;
  isShippingEstimated: boolean;
} {
  if (customShippingCost !== undefined && customShippingCost >= 0) {
    const cost = round2(customShippingCost);
    return {
      sellerShippingCost: cost,
      totalShippingCost: cost,
      mlShippingDiscount: 0,
      isShippingEstimated: true,
    };
  }

  if (!freeShipping) {
    return {
      sellerShippingCost: 0,
      totalShippingCost: 0,
      mlShippingDiscount: 0,
      isShippingEstimated: false,
    };
  }

  const isFreeShippingMandatory = price >= 33000;
  const weightGrams = billableWeight || 300;

  let baseRate = 6080;
  if (weightGrams > 2000) baseRate = 9500;
  else if (weightGrams > 500) baseRate = 7200;

  const totalShippingCost = baseRate;
  let mlShippingDiscount = 0;
  let sellerShippingCost = 0;

  if (isFreeShippingMandatory) {
    mlShippingDiscount = round2(baseRate * 0.5);
    sellerShippingCost = round2(baseRate - mlShippingDiscount);
  } else {
    mlShippingDiscount = 0;
    sellerShippingCost = baseRate;
  }

  return {
    sellerShippingCost,
    totalShippingCost,
    mlShippingDiscount,
    isShippingEstimated: true,
  };
}

/**
 * Obtiene la tasa de comisión porcentual predeterminada de Mercado Libre según categoría y tipo.
 */
export function getDefaultCommissionPercent(
  listingTypeId: string = "gold_special",
  categoryId?: string
): number {
  const cat = POPULAR_CATEGORIES_INFO.find((c) => c.id === categoryId);
  const isPremium = listingTypeId === "gold_pro";

  if (cat) {
    return isPremium ? cat.premiumPercent : cat.clasicaPercent;
  }

  // Si no se encuentra la categoría específica, tasas estándar del sitio MLA
  return isPremium ? 31.0 : 15.0;
}

/**
 * Estima el desglose completo de costos de venta (SellingCostsBreakdown) de Mercado Libre
 * de forma 100% pura y sin dependencias de base de datos ni tokens de Mercado Libre.
 */
export function estimateSellingCosts(params: EstimateSellingCostsParams): SellingCostsBreakdown {
  const price = Math.max(0, params.price || 0);
  const listingTypeId = params.listingTypeId || "gold_special";
  
  // 1. Alícuota porcentual de comisión
  let saleFeePercent = params.customCommissionPercent !== undefined
    ? Math.max(0, params.customCommissionPercent)
    : getDefaultCommissionPercent(listingTypeId, params.categoryId);

  // 2. Costo fijo adicional si aplica
  const fixedFee = Math.max(0, params.fixedFee || 0);

  // 3. Monto de comisión porcentual
  const percentageFee = round2((price * saleFeePercent) / 100);

  // CRITICAL RULE: saleFeeAmount es el total de la comisión de venta (porcentual + cargo fijo)
  const saleFeeAmount = round2(percentageFee + fixedFee);

  // 4. Envío
  const shipping = estimateShippingCost(
    price,
    params.freeShipping,
    params.billableWeight,
    params.customShippingCost
  );

  return {
    saleFeeAmount,
    saleFeePercent: price > 0 ? round2((saleFeeAmount / price) * 100) : saleFeePercent,
    fixedFee,
    percentageFee,
    financingFee: 0,
    currencyId: params.currencyId || "ARS",
    sellerShippingCost: shipping.sellerShippingCost,
    totalShippingCost: shipping.totalShippingCost,
    mlShippingDiscount: shipping.mlShippingDiscount,
    isShippingEstimated: shipping.isShippingEstimated,
  };
}
