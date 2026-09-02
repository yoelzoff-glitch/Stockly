import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { calculateTargetPrice } from "../../src/services/pricing/calculateTargetPrice";

describe("calculateTargetPrice Baseline Tests", () => {
  test("calculates target price for positive margin", () => {
    const costComponents = {
      baseCost: 5000,
      commissionRate: 13, // 13%
      shippingCost: 800,
      taxRate: 5, // 5%
    };

    const targetMargin = 20; // 20%
    const price = calculateTargetPrice(costComponents, targetMargin);

    assert.ok(price > costComponents.baseCost, "Price must be higher than base cost");
    
    // Verify that the resulting price achieves approx 20% margin
    const commission = (price * 13) / 100;
    const tax = ((price + commission) * 5) / 100;
    const totalCost = 5000 + commission + 800 + tax;
    const margin = ((price - totalCost) / price) * 100;

    assert.ok(Math.abs(margin - targetMargin) < 0.1, `Expected margin close to ${targetMargin}, got ${margin}`);
  });

  test("factors in promotion discounts correctly", () => {
    const withPromo = calculateTargetPrice(
      {
        baseCost: 3000,
        commissionRate: 10,
        shippingCost: 500,
        taxRate: 0,
        promotionDiscount: 300,
      },
      15
    );

    const withoutPromo = calculateTargetPrice(
      {
        baseCost: 3000,
        commissionRate: 10,
        shippingCost: 500,
        taxRate: 0,
        promotionDiscount: 0,
      },
      15
    );

    assert.ok(withPromo < withoutPromo, "Target price with promo discount reduction should be lower");
  });
});
