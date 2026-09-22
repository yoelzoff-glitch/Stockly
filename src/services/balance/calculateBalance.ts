export interface BalancePurchaseOrderItem {
  id: string;
  quantity: number;
  unit_cost: number | null;
  total_cost: number | null;
  sku?: string | null;
  sku_normalized?: string | null;
}

export interface BalancePurchaseOrderInput {
  id: string;
  supplier_name?: string | null;
  purchase_date?: string | null;
  created_at: string;
  total_amount: number | null;
  extra_costs?: number | null;
  status: string;
  source?: string | null;
  purchase_order_items?: BalancePurchaseOrderItem[];
}

export interface ProcessedPurchaseOrder {
  id: string;
  supplier_name: string;
  purchaseDate: string;
  merchandiseCost: number | null;
  extraCosts: number;
  totalAmount: number | null;
  status: string;
  isVoided: boolean;
  hasIncompleteCost: boolean;
  itemsCount: number;
  discrepancyNote?: string;
}

export interface BalanceDiscrepancy {
  orderId: string;
  headerMerchandiseCost: number;
  itemsSumCost: number;
  diff: number;
}

export interface CalculateBalanceParams {
  gananciaDespuesDeGastos: number; // financials.gananciaBolsilloLimpia
  cmv: number;                     // financials.costosProductos
  purchases: BalancePurchaseOrderInput[];
}

export interface BalanceCalculationResult {
  cmv: number;
  gananciaDespuesDeGastos: number;
  generadoAntesDeReinvertir: number;
  comprasMercaderia: number;
  balanceDespuesDeCompras: number;

  // Secondary metrics
  proporcionDestinadaACompras: number | null; // null if generado <= 0 -> "No aplica"
  comprasVsCMV: number;                       // comprasMercaderia - cmv

  // Integrity and audits
  totalExtraCosts: number;
  validPurchasesCount: number;
  voidedPurchasesCount: number;
  totalPurchasesCount: number;
  hasIncompleteCosts: boolean;
  incompletePurchasesCount: number;
  discrepancies: BalanceDiscrepancy[];

  // Formatted processed orders for detail display
  processedPurchases: ProcessedPurchaseOrder[];
}

/**
 * Pure calculation function for LibretaX Balance module.
 * Reconciles sales financials with registered merchandise purchases.
 * 
 * Rules:
 * 1. Generado antes de reinvertir = gananciaDespuesDeGastos + cmv
 * 2. Compras de mercadería = sum of merchandise costs of valid purchases (status != 'voided').
 *    Does NOT include freight/extra_costs if they were already discounted in monthly_expenses.
 * 3. Balance después de compras = Generado antes de reinvertir - Compras de mercadería.
 * 4. Detects incomplete/unknown costs vs valid zero cost.
 * 5. Reconciles header (total_amount - extra_costs) with items.total_cost sum.
 */
export function calculateBalance(params: CalculateBalanceParams): BalanceCalculationResult {
  const {
    gananciaDespuesDeGastos,
    cmv,
    purchases = []
  } = params;

  const generadoAntesDeReinvertir = Number((gananciaDespuesDeGastos + cmv).toFixed(2));

  let comprasMercaderia = 0;
  let totalExtraCosts = 0;
  let validPurchasesCount = 0;
  let voidedPurchasesCount = 0;
  let incompletePurchasesCount = 0;
  const discrepancies: BalanceDiscrepancy[] = [];
  const processedPurchases: ProcessedPurchaseOrder[] = [];

  for (const po of purchases) {
    const isVoided = (po.status || "").toLowerCase() === "voided";
    const extraCosts = Number(po.extra_costs || 0);
    const dateStr = po.purchase_date || po.created_at;
    const items = po.purchase_order_items || [];

    if (isVoided) {
      voidedPurchasesCount++;
    } else {
      validPurchasesCount++;
      totalExtraCosts += extraCosts;
    }

    // Evaluate items cost and check for missing/unknown costs
    let itemsSum = 0;
    let orderHasIncompleteCost = false;
    let itemsEvaluated = 0;

    if (items.length > 0) {
      for (const item of items) {
        const hasExplicitTotal = item.total_cost !== null && item.total_cost !== undefined;
        const hasExplicitUnit = item.unit_cost !== null && item.unit_cost !== undefined;

        if (!hasExplicitTotal && !hasExplicitUnit) {
          orderHasIncompleteCost = true;
        } else if (hasExplicitTotal) {
          itemsSum += Number(item.total_cost);
          itemsEvaluated++;
        } else if (hasExplicitUnit) {
          itemsSum += Number(item.unit_cost) * Number(item.quantity || 1);
          itemsEvaluated++;
        }
      }
    } else {
      // If order has no items, check header total_amount
      if (po.total_amount === null || po.total_amount === undefined) {
        orderHasIncompleteCost = true;
      }
    }

    // Header merchandise cost = total_amount - extra_costs
    const headerMerchandiseCost = po.total_amount !== null && po.total_amount !== undefined
      ? Math.max(0, Number(po.total_amount) - extraCosts)
      : null;

    if (headerMerchandiseCost === null && items.length === 0) {
      orderHasIncompleteCost = true;
    }

    // Reconcile items with header if both exist
    let discrepancyNote: string | undefined;
    if (!orderHasIncompleteCost && items.length > 0 && headerMerchandiseCost !== null) {
      const diff = Math.abs(itemsSum - headerMerchandiseCost);
      if (diff > 0.05) {
        discrepancies.push({
          orderId: po.id,
          headerMerchandiseCost: Number(headerMerchandiseCost.toFixed(2)),
          itemsSumCost: Number(itemsSum.toFixed(2)),
          diff: Number(diff.toFixed(2))
        });
        discrepancyNote = `Diferencia de $${diff.toFixed(2)} entre cabecera e ítems`;
      }
    }

    // Resolved merchandise cost for this order
    let resolvedMerchandiseCost: number | null = null;
    if (items.length > 0 && itemsEvaluated === items.length) {
      resolvedMerchandiseCost = Number(itemsSum.toFixed(2));
    } else if (headerMerchandiseCost !== null) {
      resolvedMerchandiseCost = Number(headerMerchandiseCost.toFixed(2));
    }

    if (orderHasIncompleteCost && !isVoided) {
      incompletePurchasesCount++;
    }

    if (!isVoided && resolvedMerchandiseCost !== null) {
      comprasMercaderia += resolvedMerchandiseCost;
    }

    processedPurchases.push({
      id: po.id,
      supplier_name: po.supplier_name || "Proveedor sin registrar",
      purchaseDate: dateStr,
      merchandiseCost: resolvedMerchandiseCost,
      extraCosts,
      totalAmount: po.total_amount !== null && po.total_amount !== undefined ? Number(po.total_amount) : null,
      status: po.status,
      isVoided,
      hasIncompleteCost: orderHasIncompleteCost,
      itemsCount: items.length,
      discrepancyNote
    });
  }

  comprasMercaderia = Number(comprasMercaderia.toFixed(2));
  const balanceDespuesDeCompras = Number((generadoAntesDeReinvertir - comprasMercaderia).toFixed(2));

  // Proporción destinada a compras = (Compras de mercadería / Generado antes de reinvertir) * 100
  // Si el denominador es cero o negativo, mostrar "No aplica" (null)
  let proporcionDestinadaACompras: number | null = null;
  if (generadoAntesDeReinvertir > 0) {
    proporcionDestinadaACompras = Number(((comprasMercaderia / generadoAntesDeReinvertir) * 100).toFixed(1));
  }

  // Compras por encima / debajo del CMV = Compras de mercadería - CMV
  const comprasVsCMV = Number((comprasMercaderia - cmv).toFixed(2));

  return {
    cmv,
    gananciaDespuesDeGastos,
    generadoAntesDeReinvertir,
    comprasMercaderia,
    balanceDespuesDeCompras,
    proporcionDestinadaACompras,
    comprasVsCMV,
    totalExtraCosts: Number(totalExtraCosts.toFixed(2)),
    validPurchasesCount,
    voidedPurchasesCount,
    totalPurchasesCount: purchases.length,
    hasIncompleteCosts: incompletePurchasesCount > 0,
    incompletePurchasesCount,
    discrepancies,
    processedPurchases
  };
}
