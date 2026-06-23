export interface ProfitabilityInput {
  price: number;
  cost: number | null;
  estimated_fee: number | null;
  estimated_shipping_cost: number | null;
  estimated_tax: number | null;
}

export interface ProfitabilityResult {
  margin_amount: number | null;
  margin_percent: number | null;
  profitability_status: "complete" | "missing_cost" | "missing_fee" | "missing_shipping" | "unknown";
}

export function calculateProductProfitability(input: ProfitabilityInput): ProfitabilityResult {
  // Verificaciones de faltantes
  if (input.cost === null || input.cost === undefined || input.cost <= 0) {
    return {
      margin_amount: null,
      margin_percent: null,
      profitability_status: "missing_cost"
    };
  }

  if (input.estimated_fee === null || input.estimated_fee === undefined) {
    return {
      margin_amount: null,
      margin_percent: null,
      profitability_status: "missing_fee"
    };
  }

  if (input.estimated_shipping_cost === null || input.estimated_shipping_cost === undefined) {
    return {
      margin_amount: null,
      margin_percent: null,
      profitability_status: "missing_shipping"
    };
  }

  const grossRevenue = input.price;
  const estimatedTotalCost = input.cost + input.estimated_fee + input.estimated_shipping_cost + (input.estimated_tax || 0);
  
  const netProfit = grossRevenue - estimatedTotalCost;
  const netMarginPercent = grossRevenue > 0 ? (netProfit / grossRevenue) * 100 : 0;

  return {
    margin_amount: parseFloat(netProfit.toFixed(2)),
    margin_percent: parseFloat(netMarginPercent.toFixed(2)),
    profitability_status: "complete"
  };
}
