export interface RealProfitabilityInput {
  price: number;
  cost: number | null;
  estimated_fee: number | null;
  extra_fee_amount: number | null;
  estimated_shipping_cost: number | null;
  promotion_discount_amount: number | null;
  estimated_tax: number | null;
}

export interface RealProfitabilityResult {
  margin_amount: number | null;
  margin_percent: number | null;
  profitability_status: "complete" | "missing_cost" | "missing_fee" | "missing_shipping" | "unknown";
  real_margin_amount: number | null;
  real_margin_percent: number | null;
}

export function calculateRealProfitability(input: RealProfitabilityInput): RealProfitabilityResult {
  // Base verifications
  if (input.cost === null || input.cost === undefined) {
    return {
      margin_amount: null,
      margin_percent: null,
      profitability_status: "missing_cost",
      real_margin_amount: null,
      real_margin_percent: null
    };
  }

  if (input.estimated_fee === null || input.estimated_fee === undefined) {
    return {
      margin_amount: null,
      margin_percent: null,
      profitability_status: "missing_fee",
      real_margin_amount: null,
      real_margin_percent: null
    };
  }

  if (input.estimated_shipping_cost === null || input.estimated_shipping_cost === undefined) {
    return {
      margin_amount: null,
      margin_percent: null,
      profitability_status: "missing_shipping",
      real_margin_amount: null,
      real_margin_percent: null
    };
  }

  // Calculate Base Profit (Old Logic)
  const grossRevenue = input.price;
  const estimatedTotalCost = input.cost + input.estimated_fee + input.estimated_shipping_cost + (input.estimated_tax || 0);
  
  const baseNetProfit = grossRevenue - estimatedTotalCost;
  const baseMarginPercent = grossRevenue > 0 ? (baseNetProfit / grossRevenue) * 100 : 0;

  // Calculate Real Profit (Advanced Logic)
  const extraFees = input.extra_fee_amount || 0;
  const promoDiscount = input.promotion_discount_amount || 0;

  const realNetProfit = baseNetProfit - extraFees - promoDiscount;
  const realMarginPercent = grossRevenue > 0 ? (realNetProfit / grossRevenue) * 100 : 0;

  return {
    margin_amount: parseFloat(baseNetProfit.toFixed(2)),
    margin_percent: parseFloat(baseMarginPercent.toFixed(2)),
    profitability_status: "complete",
    real_margin_amount: parseFloat(realNetProfit.toFixed(2)),
    real_margin_percent: parseFloat(realMarginPercent.toFixed(2))
  };
}
