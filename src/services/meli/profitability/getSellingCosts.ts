import { meliFetch } from "../client";

export interface SellingCostsParams {
  tenantId: string;
  price: number;
  categoryId: string;
  listingTypeId: string; // e.g. "gold_special" (Clásica), "gold_pro" (Premium)
  currencyId?: string;   // default "ARS"
  logisticType?: string; // e.g. "drop_off", "fulfillment", "xd_drop_off", "cross_docking"
  shippingMode?: string; // e.g. "me2"
  billableWeight?: number; // in grams or kg
  freeShipping?: boolean;
  meliItemId?: string;   // If simulating on existing ML publication
}

export interface SellingCostsBreakdown {
  saleFeeAmount: number;
  saleFeePercent: number;
  fixedFee: number;
  percentageFee: number;
  financingFee: number;
  currencyId: string;
  sellerShippingCost: number;
  totalShippingCost: number;
  mlShippingDiscount: number;
  isShippingEstimated: boolean;
  rawResponse?: any;
}

// In-memory cache with 5 minutes TTL
interface CacheEntry {
  timestamp: number;
  data: SellingCostsBreakdown;
}

const feeCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function clearSellingCostsCache() {
  feeCache.clear();
}

/**
 * Genera la clave de caché normalizada para evitar llamadas idénticas a Mercado Libre.
 */
function getCacheKey(params: SellingCostsParams): string {
  const p = Math.round(params.price * 100) / 100;
  return `${params.tenantId}_${p}_${params.categoryId}_${params.listingTypeId}_${params.logisticType || ""}_${params.freeShipping ? "free" : "paid"}_${params.billableWeight || 0}`;
}

/**
 * Obtiene los costos reales de venta en Mercado Libre para una publicación o simulación.
 * Cumple con la regla crítica de NO duplicar el fixed_fee si ya está dentro de sale_fee_amount.
 */
export async function getSellingCosts(params: SellingCostsParams): Promise<SellingCostsBreakdown> {
  const {
    tenantId,
    price,
    categoryId,
    listingTypeId,
    currencyId = "ARS",
    logisticType,
    billableWeight = 0,
    freeShipping = false,
  } = params;

  if (!price || price <= 0) {
    throw new Error("El precio de venta debe ser mayor a 0 para calcular costos de Mercado Libre.");
  }
  if (!categoryId) {
    throw new Error("Se requiere una categoría válida de Mercado Libre para consultar las comisiones.");
  }

  const cacheKey = getCacheKey(params);
  const cached = feeCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  // 1. Consultar comisiones en /sites/MLA/listing_prices
  const queryParams = new URLSearchParams({
    price: price.toString(),
    category_id: categoryId,
    listing_type_id: listingTypeId,
    currency_id: currencyId,
  });

  if (logisticType) {
    queryParams.append("logistic_type", logisticType);
  }

  let meliData: any;
  try {
    meliData = await meliFetch({
      tenantId,
      endpoint: `/sites/MLA/listing_prices?${queryParams.toString()}`,
      method: "GET",
    });
  } catch (error: any) {
    console.error("[getSellingCosts] Error consultando /sites/MLA/listing_prices:", error);
    throw new Error(`No pudimos obtener la comisión oficial de Mercado Libre: ${error.message || "Error de conexión"}`);
  }

  if (!meliData) {
    throw new Error("No pudimos obtener el costo de Mercado Libre. Reintentá la simulación.");
  }

  const results = Array.isArray(meliData) ? meliData : [meliData];
  const primaryResult = results[0] || {};

  // CRITICAL RULE: sale_fee_amount is the total sale fee returned by Mercado Libre.
  // DO NOT add fixed_fee AGAIN if it is already included within sale_fee_amount!
  const saleFeeAmount = Number(primaryResult.sale_fee_amount ?? 0);
  if (isNaN(saleFeeAmount) || (saleFeeAmount === 0 && price > 500 && !primaryResult.sale_fee_amount)) {
    throw new Error("No pudimos obtener el costo de Mercado Libre. Respuesta vacía o inválida.");
  }

  const details = primaryResult.sale_fee_details || {};
  const fixedFee = Number(details.fixed_fee ?? 0);
  const percentageFee = Number(details.percentage_fee ?? (saleFeeAmount - fixedFee));
  const financingFee = Number(primaryResult.financing_fee_amount ?? details.financing_add_on_fee ?? 0);

  const saleFeePercent = price > 0 ? Number(((saleFeeAmount / price) * 100).toFixed(2)) : 0;

  // 2. Calcular costo efectivo de envío para el vendedor
  let sellerShippingCost = 0;
  let totalShippingCost = 0;
  let mlShippingDiscount = 0;
  let isShippingEstimated = false;

  if (freeShipping) {
    // Estimación oficial Mercado Envíos (MLA):
    // Para compras >= $33.000 el envío gratis es obligatorio y bonificado hasta un 50% por ML para sellers con reputación verde.
    // Para compras < $33.000 el vendedor puede ofrecer envío gratis voluntario asumiendo el costo completo.
    const isFreeShippingMandatory = price >= 33000;
    
    // Tarifa base estimada según peso facturable en MLA (aprox $6.000 a $9.500 según tramo)
    const weightGrams = billableWeight || 300;
    let baseRate = 6080;
    if (weightGrams > 2000) baseRate = 9500;
    else if (weightGrams > 500) baseRate = 7200;

    totalShippingCost = baseRate;

    if (isFreeShippingMandatory) {
      // 50% bonificación estándar de Mercado Libre
      mlShippingDiscount = Number((baseRate * 0.5).toFixed(2));
      sellerShippingCost = Number((baseRate - mlShippingDiscount).toFixed(2));
    } else {
      // Menor a $33.000: El vendedor absorbe el 100% si decide darlo gratis
      mlShippingDiscount = 0;
      sellerShippingCost = baseRate;
    }
    isShippingEstimated = true;
  } else {
    // Si no es gratis, el comprador paga el envío: costo efectivo para el vendedor = $0
    sellerShippingCost = 0;
    totalShippingCost = 0;
    mlShippingDiscount = 0;
    isShippingEstimated = false;
  }

  const breakdown: SellingCostsBreakdown = {
    saleFeeAmount: Number(saleFeeAmount.toFixed(2)),
    saleFeePercent,
    fixedFee: Number(fixedFee.toFixed(2)),
    percentageFee: Number(percentageFee.toFixed(2)),
    financingFee: Number(financingFee.toFixed(2)),
    currencyId: primaryResult.currency_id || currencyId,
    sellerShippingCost: Number(sellerShippingCost.toFixed(2)),
    totalShippingCost: Number(totalShippingCost.toFixed(2)),
    mlShippingDiscount: Number(mlShippingDiscount.toFixed(2)),
    isShippingEstimated,
    rawResponse: primaryResult,
  };

  feeCache.set(cacheKey, { timestamp: Date.now(), data: breakdown });
  return breakdown;
}
