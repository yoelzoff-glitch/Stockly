import { z } from "zod";

const amount = z.number().finite().min(0).max(9999999999.99)
  .refine(value => Number(value.toFixed(2)) === value, "Usá hasta dos decimales");

export const vatReconciliationSchema = z.object({
  month: z.string().regex(/^(20\d{2}|[3-9]\d{3})-(0[1-9]|1[0-2])$/),
  debitFiscal: amount,
  creditFiscal: amount,
  commissionVat: z.number().finite().min(-999999999999.99).max(999999999999.99),
  shippingVat: z.number().finite().min(-999999999999.99).max(999999999999.99),
  advertisingVat: amount.optional(),
  mlFetchedAt: z.string().datetime(),
  creditSource: z.enum(["finance_approximation", "meli_report"]).optional(),
  purchases: z.array(z.object({
    reference: z.string().trim().min(1).max(200),
    invoiceType: z.enum(["A", "C", "OTHER"]),
    eligible: z.boolean(),
    vat: amount,
  }).refine(value => value.invoiceType === "A" || (!value.eligible && value.vat === 0),
    "Solo las facturas con IVA discriminado pueden sumar crédito")).max(500),
  previousTechnicalBalance: amount,
  retentions: amount,
  perceptions: amount,
  paymentsOnAccount: amount,
  previousFreeBalance: amount,
  arcaBalance: amount.nullable(),
  reference: z.string().trim().max(500),
}).refine(value => value.arcaBalance === null || value.reference.length > 0, {
  message: "Indicá la referencia de la declaración de ARCA", path: ["reference"],
}).refine(value => new Set(value.purchases.map(p => p.reference.trim().toLocaleLowerCase("es-AR"))).size === value.purchases.length, {
  message: "Hay comprobantes de compra repetidos", path: ["purchases"],
});

export type VatReconciliationInput = z.infer<typeof vatReconciliationSchema>;
export interface VatReconciliationRecord {
  values: VatReconciliationInput;
  revision: number;
  updatedAt: string;
}

export function calculateVatReconciliation(input: VatReconciliationInput) {
  const values = vatReconciliationSchema.parse(input);
  const cents = (value: number) => Math.round(value * 100);
  const purchaseCredit = values.purchases.reduce((sum, purchase) =>
    sum + (purchase.eligible && purchase.invoiceType === "A" ? cents(purchase.vat) : 0), 0);
  const totalCredit = cents(values.creditFiscal) + cents(values.commissionVat) + cents(values.shippingVat)
    + cents(values.advertisingVat ?? 0) + purchaseCredit;
  const technical = cents(values.debitFiscal) - totalCredit - cents(values.previousTechnicalBalance);
  const payable = Math.max(technical, 0) - cents(values.retentions) - cents(values.perceptions)
    - cents(values.paymentsOnAccount) - cents(values.previousFreeBalance);
  const due = Math.max(payable, 0);
  return {
    purchaseCredit: purchaseCredit / 100,
    totalCredit: totalCredit / 100,
    technicalDue: Math.max(technical, 0) / 100,
    technicalCarryForward: Math.max(-technical, 0) / 100,
    freeCarryForward: Math.max(-payable, 0) / 100,
    due: due / 100,
    difference: values.arcaBalance === null ? null : (due - cents(values.arcaBalance)) / 100,
  };
}
