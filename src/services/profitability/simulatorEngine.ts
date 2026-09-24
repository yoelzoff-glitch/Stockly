// src/services/profitability/simulatorEngine.ts
import { SellingCostsBreakdown } from "../meli/profitability/getSellingCosts";

export interface SimulatorInputs {
  supplierCost: number;       // Costo de compra unitario
  quantity?: number;          // Cantidad por venta (default 1)
  salePrice?: number;         // Precio de lista estimado
  targetMarginPercent?: number; // Margen objetivo (e.g. 25 para 25%)

  // Mercado Libre
  categoryId: string;
  listingTypeId: string;      // "gold_special" | "gold_pro"
  logisticType?: string;
  shippingMode?: string;
  billableWeight?: number;
  freeShipping?: boolean;
  meliItemId?: string;

  // Ads
  adsMode: "none" | "manual" | "acos";
  adsPercent?: number;        // e.g. 8 para 8%

  // Descuentos / Promociones
  discountType?: "none" | "percent" | "fixed";
  discountValue?: number;     // e.g. 10% o $1000

  // Otros costos
  otherCostsFixed?: number;   // $ empaque, embalaje, etc.
  otherCostsPercent?: number; // % impuestos, comisiones externas, etc.
}

export interface SimulationResult {
  listPrice: number;
  effectivePrice: number;     // Precio final tras descuentos
  supplierCostTotal: number;
  supplierCostUnit: number;
  quantity: number;

  // Desglose de costos
  meliFee: number;
  meliFixedFee: number;
  meliPercentageFee: number;
  meliFeePercent: number;
  shippingCost: number;
  totalShippingCost: number;
  mlShippingDiscount: number;
  adsCost: number;
  adsPercent: number;
  discountAmount: number;
  otherCostsFixed: number;
  otherCostsPercent: number;
  otherCostsTotal: number;
  totalCosts: number;

  // Resultados principales
  gananciaNeta: number;
  margenNetoPercent: number;
  retornoSobreCostoPercent: number;

  // Punto de equilibrio
  breakEvenPrice?: number;

  // Comparación contra objetivo
  targetMarginPercent?: number;
  targetDifferencePoints?: number;
  isTargetAchieved?: boolean;

  // Modo C: Costo máximo de compra
  maxSupplierCostUnit?: number;
  supplierCostDiff?: number;
  isSupplierCostViable?: boolean;
}

export interface MarginComparisonRow {
  targetMargin: number;
  requiredPrice: number;
  netProfit: number;
  meliFee: number;
}

// Redondeo exacto a 2 decimales para evitar problemas de coma flotante
function round2(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

/**
 * Calcula la rentabilidad neta a partir de un precio efectivo y el desglose de costos.
 */
export function calculateNetProfit(
  inputs: SimulatorInputs,
  costs: SellingCostsBreakdown,
  forcedEffectivePrice?: number
): SimulationResult {
  const qty = Math.max(1, inputs.quantity || 1);
  const supplierCostUnit = Math.max(0, inputs.supplierCost || 0);
  const supplierCostTotal = round2(supplierCostUnit * qty);

  const listPrice = forcedEffectivePrice !== undefined 
    ? forcedEffectivePrice 
    : Math.max(0, inputs.salePrice || 0);

  // 1. Aplicar descuentos
  let discountAmount = 0;
  if (inputs.discountType === "percent" && inputs.discountValue) {
    discountAmount = round2((listPrice * inputs.discountValue) / 100);
  } else if (inputs.discountType === "fixed" && inputs.discountValue) {
    discountAmount = round2(inputs.discountValue);
  }
  const effectivePrice = Math.max(0, round2(listPrice - discountAmount));

  // 2. Costo ML (CRITICAL: costs.saleFeeAmount ya incluye fixed_fee)
  const meliFee = round2(costs.saleFeeAmount);
  const meliFixedFee = round2(costs.fixedFee);
  const meliPercentageFee = round2(costs.percentageFee);
  const meliFeePercent = costs.saleFeePercent;

  // 3. Envío (efectivo vendedor)
  const shippingCost = round2(costs.sellerShippingCost);

  // 4. Ads
  const adsPercent = inputs.adsMode === "none" ? 0 : Math.max(0, inputs.adsPercent || 0);
  const adsCost = round2((effectivePrice * adsPercent) / 100);

  // 5. Otros costos
  const otherFixed = Math.max(0, inputs.otherCostsFixed || 0);
  const otherPercent = Math.max(0, inputs.otherCostsPercent || 0);
  const otherFromPercent = round2((effectivePrice * otherPercent) / 100);
  const otherCostsTotal = round2(otherFixed + otherFromPercent);

  // 6. Costos totales y Ganancia Neta
  const nonProductCosts = round2(meliFee + shippingCost + adsCost + otherCostsTotal);
  const totalCosts = round2(supplierCostTotal + nonProductCosts);
  const gananciaNeta = round2(effectivePrice - totalCosts);

  // 7. Margen Neto y Retorno sobre costo
  const margenNetoPercent = effectivePrice > 0 ? round2((gananciaNeta / effectivePrice) * 100) : 0;
  const retornoSobreCostoPercent = supplierCostTotal > 0 ? round2((gananciaNeta / supplierCostTotal) * 100) : 0;

  // 8. Comparación con objetivo si fue definido
  let targetDiff: number | undefined;
  let isTargetAchieved: boolean | undefined;
  if (inputs.targetMarginPercent !== undefined) {
    targetDiff = round2(margenNetoPercent - inputs.targetMarginPercent);
    isTargetAchieved = targetDiff >= 0;
  }

  // 9. Costo máximo proveedor (para modo C)
  let maxSupplierCostUnit: number | undefined;
  let supplierCostDiff: number | undefined;
  let isSupplierCostViable: boolean | undefined;

  if (inputs.targetMarginPercent !== undefined && effectivePrice > 0) {
    const targetProfitAmount = round2((effectivePrice * inputs.targetMarginPercent) / 100);
    const availableForSupplierTotal = round2(effectivePrice - targetProfitAmount - nonProductCosts);
    maxSupplierCostUnit = round2(Math.max(0, availableForSupplierTotal / qty));
    supplierCostDiff = round2(maxSupplierCostUnit - supplierCostUnit);
    isSupplierCostViable = supplierCostDiff >= 0;
  }

  return {
    listPrice,
    effectivePrice,
    supplierCostTotal,
    supplierCostUnit,
    quantity: qty,
    meliFee,
    meliFixedFee,
    meliPercentageFee,
    meliFeePercent,
    shippingCost,
    totalShippingCost: costs.totalShippingCost,
    mlShippingDiscount: costs.mlShippingDiscount,
    adsCost,
    adsPercent,
    discountAmount,
    otherCostsFixed: otherFixed,
    otherCostsPercent: otherPercent,
    otherCostsTotal,
    totalCosts,
    gananciaNeta,
    margenNetoPercent,
    retornoSobreCostoPercent,
    targetMarginPercent: inputs.targetMarginPercent,
    targetDifferencePoints: targetDiff,
    isTargetAchieved,
    maxSupplierCostUnit,
    supplierCostDiff,
    isSupplierCostViable,
  };
}

/**
 * Solver numérico mediante búsqueda binaria segura para encontrar el precio necesario para un margen objetivo.
 */
export async function solveTargetPrice(
  targetMarginPercent: number,
  inputs: SimulatorInputs,
  getCostsFn: (price: number) => Promise<SellingCostsBreakdown>,
  tolerance: number = 0.1,
  maxIterations: number = 25
): Promise<{ targetPrice: number; simulation: SimulationResult; iterations: number }> {
  const qty = Math.max(1, inputs.quantity || 1);
  const cost = (inputs.supplierCost || 0) * qty;

  if (targetMarginPercent >= 95) {
    throw new Error("No es posible simular un margen objetivo superior al 95%.");
  }

  // Límites iniciales de búsqueda
  let low = Math.max(500, cost * 1.1);
  let high = Math.max(cost * 5, 20000);

  if (targetMarginPercent >= 50) {
    high = Math.max(cost * 15, 100000);
  }

  let iterations = 0;
  let bestPrice = low;
  let bestSim: SimulationResult | null = null;
  let bestDiff = Infinity;

  while (iterations < maxIterations) {
    iterations++;
    const midPrice = Math.round((low + high) / 2);

    const costs = await getCostsFn(midPrice);
    const sim = calculateNetProfit(inputs, costs, midPrice);

    const diff = sim.margenNetoPercent - targetMarginPercent;

    if (Math.abs(diff) < Math.abs(bestDiff)) {
      bestDiff = diff;
      bestPrice = midPrice;
      bestSim = sim;
    }

    if (Math.abs(diff) <= tolerance) {
      break;
    }

    if (diff < 0) {
      // Margen obtenido es menor que el deseado -> subir precio
      low = midPrice + 1;
      if (low >= high) high = high * 1.5;
    } else {
      // Margen obtenido es mayor que el deseado -> bajar precio
      high = midPrice - 1;
    }
  }

  // Validación final en bestPrice
  const finalCosts = await getCostsFn(bestPrice);
  const finalSim = calculateNetProfit(inputs, finalCosts, bestPrice);

  return {
    targetPrice: bestPrice,
    simulation: finalSim,
    iterations,
  };
}

/**
 * Solver para calcular el punto de equilibrio (ganancia neta = 0).
 */
export async function solveBreakEvenPrice(
  inputs: SimulatorInputs,
  getCostsFn: (price: number) => Promise<SellingCostsBreakdown>
): Promise<number> {
  const { targetPrice } = await solveTargetPrice(0, inputs, getCostsFn, 0.2, 20);
  return targetPrice;
}

/**
 * Genera la tabla comparativa rápida de márgenes para 10%, 20%, 25%, 30%, 35%, 40%.
 */
export async function generateMarginComparisonTable(
  inputs: SimulatorInputs,
  getCostsFn: (price: number) => Promise<SellingCostsBreakdown>
): Promise<MarginComparisonRow[]> {
  const targetMargins = [10, 20, 25, 30, 35, 40];
  const rows: MarginComparisonRow[] = [];

  for (const m of targetMargins) {
    try {
      const { targetPrice, simulation } = await solveTargetPrice(m, inputs, getCostsFn, 0.3, 15);
      rows.push({
        targetMargin: m,
        requiredPrice: targetPrice,
        netProfit: simulation.gananciaNeta,
        meliFee: simulation.meliFee,
      });
    } catch {
      // En caso de que un margen extremo no converja
      continue;
    }
  }

  return rows;
}

/**
 * Resuelve el costo máximo unitario que se puede pagar al proveedor para alcanzar un margen objetivo.
 */
export function solveMaxSupplierCost(
  expectedSalePrice: number,
  targetMarginPercent: number,
  inputs: SimulatorInputs,
  costs: SellingCostsBreakdown
): {
  maxSupplierCostUnit: number;
  supplierCostDiff: number;
  isSupplierCostViable: boolean;
  simulation: SimulationResult;
} {
  const sim = calculateNetProfit(
    { ...inputs, salePrice: expectedSalePrice, targetMarginPercent },
    costs,
    expectedSalePrice
  );

  return {
    maxSupplierCostUnit: sim.maxSupplierCostUnit || 0,
    supplierCostDiff: sim.supplierCostDiff || 0,
    isSupplierCostViable: !!sim.isSupplierCostViable,
    simulation: sim,
  };
}

