import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateVatReconciliation, vatReconciliationSchema, type VatReconciliationInput } from "../../src/services/finance/vatReconciliation";
import { parseMeliVatSummary } from "../../src/services/finance/meliVat";

const base: VatReconciliationInput = {
  month: "2026-11", debitFiscal: 2100, creditFiscal: 0,
  commissionVat: 210, shippingVat: 105, mlFetchedAt: "2026-11-16T12:00:00.000Z",
  purchases: [], previousTechnicalBalance: 0, retentions: 0, perceptions: 0,
  paymentsOnAccount: 0, previousFreeBalance: 0, arcaBalance: null, reference: "",
};

test("deducts ML, shipping, optional eligible purchases and direct credits in cents", () => {
  const result = calculateVatReconciliation({ ...base, purchases: [
    { reference: "Proveedor A 0001-00000001", invoiceType: "A", eligible: true, vat: 420 },
    { reference: "Proveedor A no computable", invoiceType: "A", eligible: false, vat: 50 },
    { reference: "Proveedor C 0001-00000002", invoiceType: "C", eligible: false, vat: 0 },
  ], retentions: 100, perceptions: 50, previousFreeBalance: 25 });
  assert.equal(result.purchaseCredit, 420);
  assert.equal(result.totalCredit, 735);
  assert.equal(result.due, 1190);
  assert.equal(result.difference, null);
});

test("technical and freely available credits remain separate", () => {
  const result = calculateVatReconciliation({ ...base, debitFiscal: 100,
    previousTechnicalBalance: 50, retentions: 30, previousFreeBalance: 20 });
  assert.equal(result.due, 0);
  assert.equal(result.technicalCarryForward, 265);
  assert.equal(result.freeCarryForward, 50);
});

test("credit notes can reverse prior ML credits, without clamping to zero", () => {
  const result = calculateVatReconciliation({ ...base, commissionVat: -21, shippingVat: 0 });
  assert.equal(result.due, 2121);
});

test("ARCA zero is a loaded value, not an absent comparison", () => {
  const result = calculateVatReconciliation({ ...base, arcaBalance: 0, reference: "F2051 prueba" });
  assert.equal(result.difference, 1785);
  assert.equal(calculateVatReconciliation({ ...base, arcaBalance: 1785, reference: "F2051" }).difference, 0);
});

test("rejects fictitious C credits, duplicate invoices and invalid financial inputs", () => {
  assert.equal(vatReconciliationSchema.safeParse({ ...base, purchases: [
    { reference: "C 1", invoiceType: "C", eligible: true, vat: 21 },
  ] }).success, false);
  const invoice = { reference: "A 1", invoiceType: "A", eligible: true, vat: 21 };
  assert.equal(vatReconciliationSchema.safeParse({ ...base, purchases: [invoice, { ...invoice, reference: " a 1 " }] }).success, false);
  for (const changes of [{ debitFiscal: -1 }, { creditFiscal: Infinity }, { retentions: 1.001 },
    { month: "2026-13" }, { arcaBalance: 0, reference: "" }]) {
    assert.equal(vatReconciliationSchema.safeParse({ ...base, ...changes }).success, false);
  }
});

const report = {
  period: { key: "2026-11-01", date_from: "2026-10-19", date_to: "2026-11-18" },
  bill_includes: {
    charges: [{ type: "CV", amount: 1210 }, { type: "CXD", amount: 605 }, { type: "CIVA", amount: 900 }],
    bonuses: [{ type: "BV", amount: 121 }, { type: "BXD", amount: 121 }],
  }, errors: [],
};

test("advertising credit reduces the balance once and old saved reconciliations remain compatible", () => {
  const oldResult = calculateVatReconciliation(base);
  const withAdvertising = calculateVatReconciliation({ ...base, advertisingVat: 210 });
  assert.equal(withAdvertising.due, oldResult.due - 210);
  assert.equal(withAdvertising.totalCredit, oldResult.totalCredit + 210);
});

test("automated ML VAT uses only commission/shipping codes net of bonuses", () => {
  const result = parseMeliVatSummary(report, "2026-11", base.mlFetchedAt);
  assert.equal(result.commissionVat, 189);
  assert.equal(result.shippingVat, 84);
  assert.equal(result.periodFrom, "2026-10-19");
  assert.throws(() => parseMeliVatSummary({ ...report, errors: ["incomplete"] }, "2026-11", base.mlFetchedAt));
  assert.throws(() => parseMeliVatSummary(report, "2026-10", base.mlFetchedAt));
  assert.throws(() => parseMeliVatSummary({}, "2026-11", base.mlFetchedAt));
});
