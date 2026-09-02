import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { calculateRealProfitability } from "../../src/services/profitability/calculateRealProfitability";

describe("calculateRealProfitability Baseline Tests", () => {
  test("returns missing_cost when cost is null, undefined, or <= 0", () => {
    const res1 = calculateRealProfitability({
      price: 1000,
      cost: null,
      estimated_fee: 100,
      extra_fee_amount: 0,
      estimated_shipping_cost: 50,
      promotion_discount_amount: 0,
      estimated_tax: 0,
    });
    assert.equal(res1.profitability_status, "missing_cost");
    assert.equal(res1.margin_amount, null);

    const res2 = calculateRealProfitability({
      price: 1000,
      cost: 0,
      estimated_fee: 100,
      extra_fee_amount: 0,
      estimated_shipping_cost: 50,
      promotion_discount_amount: 0,
      estimated_tax: 0,
    });
    assert.equal(res2.profitability_status, "missing_cost");
  });

  test("returns missing_fee when estimated_fee is null", () => {
    const res = calculateRealProfitability({
      price: 1000,
      cost: 400,
      estimated_fee: null,
      extra_fee_amount: 0,
      estimated_shipping_cost: 50,
      promotion_discount_amount: 0,
      estimated_tax: 0,
    });
    assert.equal(res.profitability_status, "missing_fee");
    assert.equal(res.margin_amount, null);
  });

  test("returns missing_shipping when estimated_shipping_cost is null", () => {
    const res = calculateRealProfitability({
      price: 1000,
      cost: 400,
      estimated_fee: 150,
      extra_fee_amount: 0,
      estimated_shipping_cost: null,
      promotion_discount_amount: 0,
      estimated_tax: 0,
    });
    assert.equal(res.profitability_status, "missing_shipping");
    assert.equal(res.margin_amount, null);
  });

  test("calculates complete profitability correctly with base components", () => {
    const res = calculateRealProfitability({
      price: 10000,
      cost: 5000,
      estimated_fee: 1300,
      extra_fee_amount: 0,
      estimated_shipping_cost: 700,
      promotion_discount_amount: 0,
      estimated_tax: 500,
    });

    // Total cost = 5000 + 1300 + 700 + 500 = 7500
    // Net profit = 10000 - 7500 = 2500
    // Margin percent = (2500 / 10000) * 100 = 25%
    assert.equal(res.profitability_status, "complete");
    assert.equal(res.margin_amount, 2500);
    assert.equal(res.margin_percent, 25);
    assert.equal(res.real_margin_amount, 2500);
    assert.equal(res.real_margin_percent, 25);
  });

  test("calculates real profitability incorporating extra fees, promo, packaging and flex", () => {
    const res = calculateRealProfitability({
      price: 10000,
      cost: 4000,
      estimated_fee: 1000,
      extra_fee_amount: 200,
      estimated_shipping_cost: 500,
      promotion_discount_amount: 300,
      estimated_tax: 0,
      packaging_cost: 150,
      flex_cost: 50,
    });

    // Base total cost = 4000 + 1000 + 500 = 5500 -> base Net = 4500 (45%)
    // Real Net = 4500 - 200 - 300 - 150 - 50 = 3800
    // Real margin % = (3800 / 10000) * 100 = 38%
    assert.equal(res.profitability_status, "complete");
    assert.equal(res.margin_amount, 4500);
    assert.equal(res.margin_percent, 45);
    assert.equal(res.real_margin_amount, 3800);
    assert.equal(res.real_margin_percent, 38);
  });
});
