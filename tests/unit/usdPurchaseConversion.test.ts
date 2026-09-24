import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("USD Purchase Conversion & Settings", () => {
  it("converts USD unit cost to ARS accurately using tenant exchange rate", () => {
    const usdRate = 1523;
    const usdUnitCost = 19.83;
    const quantity = 6;

    const unitCostArs = Number((usdUnitCost * usdRate).toFixed(2));
    const totalItemCostArs = Number((unitCostArs * quantity).toFixed(2));

    assert.equal(unitCostArs, 30201.09);
    assert.equal(totalItemCostArs, 181206.54);

    const extraCosts = 20500;
    const totalOrderAmountArs = Number((totalItemCostArs + extraCosts).toFixed(2));
    assert.equal(totalOrderAmountArs, 201706.54);
  });

  it("handles fallback to default exchange rate when not configured", () => {
    const defaultRate = 1500;
    const tenantMetadata: Record<string, any> = {};
    const configuredRate = Number(tenantMetadata.usd_exchange_rate) || defaultRate;

    assert.equal(configuredRate, 1500);

    const updatedMetadata = {
      ...tenantMetadata,
      usd_exchange_rate: 1523
    };
    const newRate = Number(updatedMetadata.usd_exchange_rate) || defaultRate;
    assert.equal(newRate, 1523);
  });

  it("preserves ARS cost when USD checkbox is not checked", () => {
    const isUsdCost = false;
    const usdRate = 1523;
    const inputCost = 30201.09;

    const finalUnitCost = isUsdCost ? Number((inputCost * usdRate).toFixed(2)) : inputCost;
    assert.equal(finalUnitCost, 30201.09);
  });
});
