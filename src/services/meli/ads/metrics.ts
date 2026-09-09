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
  const acos = toNullableNumber(m.acos);
  const tacos = toNullableNumber(m.tacos);
  const roas = toNullableNumber(m.roas);
  const cvr = toNullableNumber(m.cvr);
  const unitsQuantity = toNullableNumber(m.units_quantity ?? m.units_sold ?? m.sold_units);

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
    unitsQuantity,
  };
}
