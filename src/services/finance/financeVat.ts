export interface FinanceVatEstimate {
  commissionVat: number;
  shippingVat: number;
  advertisingVat: number;
  advertisingAmount: number;
  commissionAmount: number;
  shippingAmount: number;
  fetchedAt: string;
}
export interface FinanceVatData { estimate: FinanceVatEstimate | null; error: string | null }

/** Approximation: assume the amounts displayed in Finance include 21% VAT. */
export function calculateFinanceVat(
  financials: { comisionesML: number; envios: number; appliedExpensesBreakdown?: { name: string; netAmount?: number; vatAmount?: number }[] },
  fetchedAt = new Date().toISOString(),
): FinanceVatEstimate {
  const includedVat = (amount: number) => {
    if (!Number.isFinite(amount) || Math.abs(amount) > 999999999999.99) {
      throw new Error("Invalid financial amount");
    }
    return Math.round(Math.round(amount * 100) * 21 / 121) / 100;
  };
  let advertisingAmount = 0;
  let advertisingVat = 0;
  for (const expense of financials.appliedExpensesBreakdown || []) {
    // Existing expenses have free-text names, not a category. Only advertising labels qualify.
    if (!/\b(publicidad|ads|advertising)\b/i.test(expense.name)) continue;
    const base = expense.netAmount ?? 0;
    const vat = expense.vatAmount ?? 0;
    if (!Number.isFinite(base) || !Number.isFinite(vat) || base < 0 || vat < 0) {
      throw new Error("Invalid advertising expense");
    }
    advertisingAmount += Math.round(base * 100);
    advertisingVat += Math.round(vat * 100);
  }
  return {
    advertisingAmount: advertisingAmount / 100,
    advertisingVat: advertisingVat / 100,
    commissionVat: includedVat(financials.comisionesML),
    shippingVat: includedVat(financials.envios),
    commissionAmount: financials.comisionesML,
    shippingAmount: financials.envios,
    fetchedAt,
  };
}
