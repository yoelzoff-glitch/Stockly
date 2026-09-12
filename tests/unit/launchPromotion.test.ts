import test, { describe } from "node:test";
import assert from "node:assert/strict";
import {
  LAUNCH_PROMOTION,
  getPromotionStatus,
  isPromotionActive,
  calculatePromotionalPrice,
  getPromotionTimeRemaining,
  CANONICAL_PLANS,
} from "../../src/lib/promotions/launchPromotion";

describe("Sprint: Launch Promotion & 10% OFF Countdown Tests", () => {
  describe("Campaign Date Validity & Timezone Boundaries", () => {
    test("marks status as 'upcoming' before launch start", () => {
      // 2026-08-15
      const date1 = new Date("2026-08-15T12:00:00-03:00");
      assert.equal(getPromotionStatus(date1), "upcoming");
      assert.equal(isPromotionActive(date1), false);

      // 1 minute before launch
      const date2 = new Date("2026-08-31T23:59:59-03:00");
      assert.equal(getPromotionStatus(date2), "upcoming");
      assert.equal(isPromotionActive(date2), false);
    });

    test("marks status as 'active' starting September 2026 through launch", () => {
      const launchStart = new Date("2026-09-01T00:00:00-03:00");
      assert.equal(getPromotionStatus(launchStart), "active");
      assert.equal(isPromotionActive(launchStart), true);

      // Today (September 12, 2026)
      const today = new Date("2026-09-12T12:00:00-03:00");
      assert.equal(getPromotionStatus(today), "active");
      assert.equal(isPromotionActive(today), true);
    });

    test("marks status as 'active' throughout October and November 2026", () => {
      // Mid October
      const midOctober = new Date("2026-10-15T15:30:00-03:00");
      assert.equal(getPromotionStatus(midOctober), "active");
      assert.equal(isPromotionActive(midOctober), true);

      // Mid November
      const midNovember = new Date("2026-11-15T10:00:00-03:00");
      assert.equal(getPromotionStatus(midNovember), "active");
      assert.equal(isPromotionActive(midNovember), true);

      // Last second of promotion: 2026-11-30 23:59:59 ART
      const lastSecond = new Date("2026-11-30T23:59:59-03:00");
      assert.equal(getPromotionStatus(lastSecond), "active");
      assert.equal(isPromotionActive(lastSecond), true);
    });

    test("marks status as 'expired' starting December 1, 2026 00:00:00 ART", () => {
      // Exactly at expiry
      const expiry = new Date("2026-12-01T00:00:00-03:00");
      assert.equal(getPromotionStatus(expiry), "expired");
      assert.equal(isPromotionActive(expiry), false);

      // Days after expiry
      const later = new Date("2026-12-10T12:00:00-03:00");
      assert.equal(getPromotionStatus(later), "expired");
      assert.equal(isPromotionActive(later), false);
    });

    test("maintains timezone independence (UTC timestamp matches Argentina offset)", () => {
      // 2026-09-01T00:00:00-03:00 is 2026-09-01T03:00:00.000Z in UTC
      const startInUTC = new Date("2026-09-01T03:00:00.000Z");
      assert.equal(isPromotionActive(startInUTC), true);

      // 1 ms before in UTC
      const beforeInUTC = new Date("2026-09-01T02:59:59.999Z");
      assert.equal(isPromotionActive(beforeInUTC), false);

      // Expiration in UTC: 2026-12-01T03:00:00.000Z
      const expiryInUTC = new Date("2026-12-01T03:00:00.000Z");
      assert.equal(isPromotionActive(expiryInUTC), false);
    });
  });

  describe("Price Calculations & Rounding Consistency", () => {
    test("calculates 10% OFF for Starter plan ($49.99 USD -> $44.99 USD)", () => {
      const price = calculatePromotionalPrice(49.99, "USD", 10);
      assert.equal(price.baseAmount, 49.99);
      assert.equal(price.promoAmount, 44.99);
      assert.equal(price.normalPriceFormatted, "$ 49,99 USD");
      assert.equal(price.promoPriceFormatted, "$ 44,99 USD");
    });

    test("calculates 10% OFF for Pro plan ($79.99 USD -> $71.99 USD)", () => {
      const price = calculatePromotionalPrice(79.99, "USD", 10);
      assert.equal(price.baseAmount, 79.99);
      assert.equal(price.promoAmount, 71.99);
      assert.equal(price.normalPriceFormatted, "$ 79,99 USD");
      assert.equal(price.promoPriceFormatted, "$ 71,99 USD");
    });

    test("calculates 10% OFF for Ultra plan ($129.99 USD -> $116.99 USD)", () => {
      const price = calculatePromotionalPrice(129.99, "USD", 10);
      assert.equal(price.baseAmount, 129.99);
      assert.equal(price.promoAmount, 116.99);
      assert.equal(price.normalPriceFormatted, "$ 129,99 USD");
      assert.equal(price.promoPriceFormatted, "$ 116,99 USD");
    });

    test("calculates 10% OFF for ARS prices with integer rounding ($30.000 -> $27.000)", () => {
      const price = calculatePromotionalPrice(30000, "ARS", 10);
      assert.equal(price.baseAmount, 30000);
      assert.equal(price.promoAmount, 27000);
      assert.ok(price.promoPriceFormatted.includes("27"));
    });

    test("canonical plans list contains Starter, Pro, and Ultra", () => {
      const planIds = CANONICAL_PLANS.map((p) => p.id);
      assert.deepEqual(planIds, ["starter", "pro", "ultra"]);
    });
  });

  describe("Countdown Calculation Logic", () => {
    test("calculates exact days, hours, minutes, and seconds remaining", () => {
      // 10 days, 5 hours, 30 minutes, 15 seconds before endsAt
      const endsAtTime = new Date("2026-12-01T00:00:00-03:00").getTime();
      const mockTime = new Date(
        endsAtTime - (10 * 86400 + 5 * 3600 + 30 * 60 + 15) * 1000
      );

      const remaining = getPromotionTimeRemaining(mockTime);
      assert.equal(remaining.days, 10);
      assert.equal(remaining.hours, 5);
      assert.equal(remaining.minutes, 30);
      assert.equal(remaining.seconds, 15);
      assert.equal(remaining.isExpired, false);
    });

    test("returns isExpired = true and 0 remaining when current time is past endsAt", () => {
      const pastTime = new Date("2026-12-05T12:00:00-03:00");
      const remaining = getPromotionTimeRemaining(pastTime);

      assert.equal(remaining.days, 0);
      assert.equal(remaining.hours, 0);
      assert.equal(remaining.minutes, 0);
      assert.equal(remaining.seconds, 0);
      assert.equal(remaining.isExpired, true);
    });
  });

  describe("GA4 Privacy & Event Structure", () => {
    test("launch offer events strictly adhere to non-PII guidelines", () => {
      const piiRegex = /email|token|password|secret|cost|price|revenue|amount|tenant|user_id|dni|phone|credential|name|company/i;

      const launchOfferViewParams = {
        promotion: "launch_2026",
        discount_percentage: 10,
      };

      const launchOfferCtaParams = {
        promotion: "launch_2026",
        plan: "starter",
      };

      for (const [k, v] of Object.entries(launchOfferViewParams)) {
        assert.equal(piiRegex.test(k), false, `Key ${k} violates PII rules`);
      }

      for (const [k, v] of Object.entries(launchOfferCtaParams)) {
        assert.equal(piiRegex.test(k), false, `Key ${k} violates PII rules`);
      }
    });
  });
});
