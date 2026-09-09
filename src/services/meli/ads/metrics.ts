import { AdsMetrics } from "./types";

export function parseAdsMetrics(raw: any): AdsMetrics {
  if (!raw) {
    return {
      impressions: null,
      clicks: null,
      cost: null,
      cpc: null,
      ctr: null,
      directAmount: null,
      indirectAmount: null,
      totalAmount: null,
      acos: null,
      tacos: null,
      roas: null,
      cvr: null,
      directUnitsQuantity: null,
      indirectUnitsQuantity: null,
      unitsQuantity: null,
    };
  }

  const m = raw.metrics || raw;

  const toNullableNumber = (val: any): number | null => {
    if (val === undefined || val === null || val === "" || Number.isNaN(Number(val))) {
      return null;
    }
    return Number(val);
  };

  const impressions = toNullableNumber(m.prints ?? m.impressions);
  const clicks = toNullableNumber(m.clicks ?? m.clics);
  const cost = toNullableNumber(m.cost ?? m.consumed_budget);
  const cpc = toNullableNumber(m.cpc);
  const ctr = toNullableNumber(m.ctr);
  const directAmount = toNullableNumber(m.direct_amount);
  const indirectAmount = toNullableNumber(m.indirect_amount);
  const totalAmount = toNullableNumber(m.total_amount ?? m.revenue ?? m.amount);
  const tacos = toNullableNumber(m.tacos);
  const cvr = toNullableNumber(m.cvr);

  const directUnitsQuantity = toNullableNumber(m.direct_units_quantity);
  const indirectUnitsQuantity = toNullableNumber(m.indirect_units_quantity);
  let unitsQuantity = toNullableNumber(m.units_quantity ?? m.units_sold ?? m.sold_units);
  if (unitsQuantity === null && (directUnitsQuantity !== null || indirectUnitsQuantity !== null)) {
    unitsQuantity = (directUnitsQuantity || 0) + (indirectUnitsQuantity || 0);
  }

  // ACOS: Priority official m.acos, mathematical derivation fallback if cost and totalAmount exist
  let acos = toNullableNumber(m.acos);
  if (acos === null && cost !== null && totalAmount !== null && totalAmount > 0) {
    acos = Number(((cost / totalAmount) * 100).toFixed(2));
  }

  // ROAS: Priority official m.roas, mathematical derivation fallback if cost > 0 and totalAmount exist
  let roas = toNullableNumber(m.roas);
  if (roas === null && totalAmount !== null && cost !== null && cost > 0) {
    roas = Number((totalAmount / cost).toFixed(2));
  }

  return {
    impressions,
    clicks,
    cost,
    cpc,
    ctr,
    directAmount,
    indirectAmount,
    totalAmount,
    acos,
    tacos,
    roas,
    cvr,
    directUnitsQuantity,
    indirectUnitsQuantity,
    unitsQuantity,
  };
}
