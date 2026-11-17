import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateFinanceVat } from "../../src/services/finance/financeVat";

test("extracts included VAT from the actual Finance amounts, retaining their bases", () => {
  const estimate = calculateFinanceVat({ comisionesML: 1210, envios: 605 }, "2026-11-17T12:00:00.000Z");
  assert.equal(estimate.commissionVat, 210);
  assert.equal(estimate.shippingVat, 105);
  assert.equal(estimate.commissionAmount, 1210);
  assert.equal(estimate.shippingAmount, 605);
});

test("zero costs remain valid and negative adjustments keep their sign", () => {
  const estimate = calculateFinanceVat({ comisionesML: 0, envios: -121 });
  assert.equal(estimate.commissionVat, 0);
  assert.equal(estimate.shippingVat, -21);
});

test("invalid costs cannot silently turn into zero credits", () => {
  assert.throws(() => calculateFinanceVat({ comisionesML: NaN, envios: 121 }));
  assert.throws(() => calculateFinanceVat({ comisionesML: 121, envios: Infinity }));
});

test("advertising uses the added IVA on net budget, excludes unrelated expenses and unmarked VAT", () => {
  const result = calculateFinanceVat({ comisionesML: 0, envios: 0, appliedExpensesBreakdown: [
    { name: "MELI ADS", netAmount: 110000 * 17, vatAmount: 110000 * 17 * 0.21 },
    { name: "Publicidad", netAmount: 1000, vatAmount: 0 },
    { name: "Contador", netAmount: 10000, vatAmount: 2100 },
  ] });
  assert.equal(result.advertisingVat, 392700);
  assert.equal(result.advertisingAmount, 1871000);
});
