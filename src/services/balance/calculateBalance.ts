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

export interface FreightReconciliationAudit {
  status: "reconciled" | "unverified" | "prorated_estimate" | "discrepancy" | "none";
  purchasesFreightTotal: number;
  appliedFreightTotal: number;
  difference: number;
  hasVerifiableLinkage?: boolean;
  reason: string;
}

export type BalanceIntegrityStatus =
  | "full"
  | "partial_costs"
  | "freight_unverified"
  | "freight_prorated"
  | "freight_discrepancy"
  | "items_discrepancy";

export interface CalculateBalanceParams {
  gananciaDespuesDeGastos: number; // financials.gananciaBolsilloLimpia
  cmv: number;                     // financials.costosProductos
  purchases: BalancePurchaseOrderInput[];
  appliedFreightTotal?: number;   // Sum of freight expenses identified in Finance
  isProratedTimeframe?: boolean;  // True if period prorates expenses (e.g. custom or partial month)
  hasVerifiableLinkage?: boolean; // True only if an explicit foreign key or verifiable linkage exists
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
  isProporcionEstimated: boolean;
  isComprasVsCMVEstimated: boolean;

  // Integrity, audits and freights
  integrityStatus: BalanceIntegrityStatus;
  integrityLabel: string;
  integrityExplanation: string;
  freightAudit: FreightReconciliationAudit;
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
 *    Does NOT double-count freight/extra_costs if they were discounted in monthly_expenses.
 * 3. Balance después de compras = Generado antes de reinvertir - Compras de mercadería.
 * 4. Detects incomplete/unknown costs vs valid zero cost ($0).
 * 5. Reconciles header (total_amount - extra_costs) with items.total_cost sum.
 * 6. Audits freight against Finance applied expenses to detect unverified or prorated freights.
 * 7. Strictly avoids showing "Conciliación Completa" if there are discrepancies or unverified freights.
 */
export function calculateBalance(params: CalculateBalanceParams): BalanceCalculationResult {
  const {
    gananciaDespuesDeGastos,
    cmv,
    purchases = [],
    appliedFreightTotal = 0,
    isProratedTimeframe = false,
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

  // Secondary metrics
  let proporcionDestinadaACompras: number | null = null;
  if (generadoAntesDeReinvertir > 0) {
    proporcionDestinadaACompras = Number(((comprasMercaderia / generadoAntesDeReinvertir) * 100).toFixed(1));
  }
  const comprasVsCMV = Number((comprasMercaderia - cmv).toFixed(2));

  // Freight reconciliation audit
  const appliedFreight = Number(Number(appliedFreightTotal || 0).toFixed(2));
  const purchasesFreight = Number(totalExtraCosts.toFixed(2));
  const freightDiff = Number(Math.abs(purchasesFreight - appliedFreight).toFixed(2));

  let freightAudit: FreightReconciliationAudit;

  if (purchasesFreight === 0 && appliedFreight === 0) {
    freightAudit = {
      status: "none",
      purchasesFreightTotal: 0,
      appliedFreightTotal: 0,
      difference: 0,
      hasVerifiableLinkage: false,
      reason: "Sin costos de flete ni extras registrados en el período.",
    };
  } else if (isProratedTimeframe) {
    freightAudit = {
      status: "prorated_estimate",
      purchasesFreightTotal: purchasesFreight,
      appliedFreightTotal: appliedFreight,
      difference: freightDiff,
      hasVerifiableLinkage: Boolean(params.hasVerifiableLinkage),
      reason: `El período seleccionado prorratea los gastos mensuales. El gasto de flete computado en Finanzas ($${appliedFreight.toLocaleString("es-AR")}) difiere del total de compras ($${purchasesFreight.toLocaleString("es-AR")}).`,
    };
  } else if (purchasesFreight > 0 && appliedFreight === 0) {
    freightAudit = {
      status: "unverified",
      purchasesFreightTotal: purchasesFreight,
      appliedFreightTotal: 0,
      difference: purchasesFreight,
      hasVerifiableLinkage: false,
      reason: `Las compras registran fletes por $${purchasesFreight.toLocaleString("es-AR")}, pero no se encontró un gasto de flete correspondiente en Finanzas. El balance se presenta como pendiente de conciliación.`,
    };
  } else if (freightDiff > 1) {
    freightAudit = {
      status: "discrepancy",
      purchasesFreightTotal: purchasesFreight,
      appliedFreightTotal: appliedFreight,
      difference: freightDiff,
      hasVerifiableLinkage: Boolean(params.hasVerifiableLinkage),
      reason: `Existe una diferencia de $${freightDiff.toLocaleString("es-AR")} entre los extras registrados en Compras ($${purchasesFreight.toLocaleString("es-AR")}) y los gastos identificados como flete en Finanzas ($${appliedFreight.toLocaleString("es-AR")}).`,
    };
  } else if (!params.hasVerifiableLinkage) {
    // Both amounts match or differ by <= $1, but without verifiable linkage, conserve "Sin trazabilidad verificable"
    freightAudit = {
      status: "unverified",
      purchasesFreightTotal: purchasesFreight,
      appliedFreightTotal: appliedFreight,
      difference: freightDiff,
      hasVerifiableLinkage: false,
      reason: `Sin trazabilidad verificable: se registraron $${purchasesFreight.toLocaleString("es-AR")} en extras de Compras y $${appliedFreight.toLocaleString("es-AR")} en fletes de Finanzas. Aunque los importes coincidan, no existe una vinculación comprobable entre ambas fuentes.`,
    };
  } else {
    freightAudit = {
      status: "reconciled",
      purchasesFreightTotal: purchasesFreight,
      appliedFreightTotal: appliedFreight,
      difference: 0,
      hasVerifiableLinkage: true,
      reason: "Fletes de compras vinculados y verificados con trazabilidad comprobable contra Finanzas.",
    };
  }

  // Determine global integrity status
  let integrityStatus: BalanceIntegrityStatus = "full";
  let integrityLabel = "Conciliación Completa";
  let integrityExplanation = "Todos los importes de compras y ventas fueron conciliados y verificados.";

  if (incompletePurchasesCount > 0) {
    integrityStatus = "partial_costs";
    integrityLabel = `Cálculo Parcial (${incompletePurchasesCount} compra(s) sin costo exacto)`;
    integrityExplanation = "Existen compras con costo unitario desconocido. La inversión real en mercadería podría ser superior.";
  } else if (freightAudit.status === "unverified") {
    integrityStatus = "freight_unverified";
    integrityLabel = "Sin trazabilidad verificable (Fletes y extras)";
    integrityExplanation = freightAudit.reason;
  } else if (freightAudit.status === "discrepancy") {
    integrityStatus = "freight_discrepancy";
    integrityLabel = "Pendiente de Conciliación (Discrepancia de fletes)";
    integrityExplanation = freightAudit.reason;
  } else if (freightAudit.status === "prorated_estimate") {
    integrityStatus = "freight_prorated";
    integrityLabel = "Resultado Estimado (Prorrateo temporal)";
    integrityExplanation = freightAudit.reason;
  } else if (discrepancies.length > 0) {
    integrityStatus = "items_discrepancy";
    integrityLabel = "Pendiente de Conciliación (Diferencia ítems/cabecera)";
    integrityExplanation = "Existen compras donde la suma de ítems difiere del total neto de cabecera.";
  }

  const isProporcionEstimated = integrityStatus !== "full";
  const isComprasVsCMVEstimated = integrityStatus !== "full";

  return {
    cmv,
    gananciaDespuesDeGastos,
    generadoAntesDeReinvertir,
    comprasMercaderia,
    balanceDespuesDeCompras,
    proporcionDestinadaACompras,
    comprasVsCMV,
    isProporcionEstimated,
    isComprasVsCMVEstimated,
    integrityStatus,
    integrityLabel,
    integrityExplanation,
    freightAudit,
    totalExtraCosts: purchasesFreight,
    validPurchasesCount,
    voidedPurchasesCount,
    totalPurchasesCount: purchases.length,
    hasIncompleteCosts: incompletePurchasesCount > 0,
    incompletePurchasesCount,
    discrepancies,
    processedPurchases,
  };
}
